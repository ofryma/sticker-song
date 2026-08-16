#!/usr/bin/env bash
#
# Does the running archive match what the snapshot said it held?
#
# ops/restore.sh calls this as its last act, and it can be run on its own at any
# time to compare the live stack against a snapshot. It only reads.
#
#   ops/restore_verify.sh --snapshot latest
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

SNAPSHOT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --snapshot) SNAPSHOT="$2"; shift 2 ;;
    *) fail "unknown argument: $1" ;;
  esac
done
[ -n "$SNAPSHOT" ] || fail "usage: restore_verify.sh --snapshot <id|latest>"

DIR="$SNAPSHOT_DIR/$SNAPSHOT"
[ -f "$DIR/manifest.json" ] || fail "no finished snapshot at $DIR"

expected_row() {
  python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["rows"].get(sys.argv[2],-1))' \
    "$DIR/manifest.json" "$1"
}

count() {
  compose run --rm --no-deps -T backup-db psql --quiet --no-align --tuples-only \
    --dbname="postgresql://$POSTGRES_USER@postgres:5432/$POSTGRES_DB" \
    --command="SELECT count(*) FROM $1" | tr -dc '0-9'
}

FAILED=0
check() {
  if [ "$2" = "$3" ]; then
    printf '  ok    %-20s %s\n' "$1" "$2"
  else
    printf '  WRONG %-20s snapshot %s, running %s\n' "$1" "$3" "$2"
    FAILED=$((FAILED + 1))
  fi
}

log "comparing the running archive against $SNAPSHOT"

for table in memorial_entries blacklisted_ips image_feedback contact_messages; do
  check "$table" "$(count "$table")" "$(expected_row "$table")"
done

SCHEMA="$(compose run --rm --no-deps -T backup-db psql --quiet --no-align --tuples-only \
  --dbname="postgresql://$POSTGRES_USER@postgres:5432/$POSTGRES_DB" \
  --command='SELECT version_num FROM alembic_version LIMIT 1' | tr -d '\r\n ')"
EXPECTED_SCHEMA="$(python3 -c \
  'import json,sys;print(json.load(open(sys.argv[1])).get("alembic_version",""))' \
  "$DIR/manifest.json")"
# A newer schema is not a fault: restoring an old snapshot onto newer images is
# meant to leave alembic ahead of the manifest.
if [ "$SCHEMA" = "$EXPECTED_SCHEMA" ]; then
  printf '  ok    %-20s %s\n' "schema" "$SCHEMA"
else
  printf '  note  %-20s snapshot %s, running %s (migrated forward)\n' \
    "schema" "$EXPECTED_SCHEMA" "$SCHEMA"
fi

# Every full-size photo the database points at has to be in the bucket. Thumbs
# are allowed to be missing — the image endpoint falls back to the full object.
log "checking every photo is back"
compose run --rm --no-deps -T backup-objects \
  ls --recursive "live/$MINIO_BUCKET" | awk '{print $NF}' | sort > /tmp/in-bucket.$$
MISSING=0
while IFS= read -r key; do
  case "$key" in *_thumb.*) continue ;; esac
  grep -qxF "$key" /tmp/in-bucket.$$ || { echo "  missing photo: $key"; MISSING=$((MISSING + 1)); }
done < <(gzip -dc "$DIR/object_keys.txt.gz")
rm -f /tmp/in-bucket.$$
check "photos missing" "$MISSING" "0"

[ "$FAILED" -eq 0 ] || fail "$FAILED check(s) did not match the snapshot"
log "the archive matches $SNAPSHOT"
