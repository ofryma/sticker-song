#!/usr/bin/env bash
#
# One night's copy of the archive, onto the drive mounted at BACKUP_DIR_HOST.
#
# Order matters, and it is not arbitrary. An upload writes its object to MinIO
# and only then commits the row that points at it (backend/app/routers/entries.py),
# so dumping Postgres *first* and mirroring MinIO second guarantees every
# image_object_key in the dump refers to an object that was already in the bucket
# when the mirror ran. The other order can capture a row whose photo is missing —
# a memorial entry that restores as a broken image. The cost of this order is a
# few objects with no row, which is nothing.
#
# The run is built under .staging/ and moved into place with a single rename, so
# an interrupted backup is invisible rather than misleading. manifest.json is
# written last and is the record of a finished run; ops/restore.sh and the review
# page both refuse a snapshot without it.
#
#   ops/backup.sh                    the production stack
#   COMPOSE_FILE=docker-compose.yml BACKUP_DIR_HOST=/tmp/drill ops/backup.sh
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

ID="$(date -u +%Y-%m-%dT%H%M%SZ)"
STAGE="$STAGING_DIR/$ID"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STEP="starting"
LOG="$(mktemp)"

# Whatever happens, .staging is left clean and a failure is reported once.
cleanup() {
  local code=$?
  # Put the real stdout back so the tee above sees end-of-input and flushes;
  # without this the message below quotes a log that is still in a pipe.
  exec 1>&3 2>&4
  [ "$code" -eq 0 ] || sleep 1
  drop_lock
  rm -f "$LOG"
  if [ "$code" -ne 0 ]; then
    rm -rf "$STAGE"
    notify "$(printf '<b>💾 Backup failed</b>\nstep: %s\n\n<pre>%s</pre>' \
      "$STEP" "$(tail -n 20 "$LOG" 2>/dev/null | sed 's/[<&>]/ /g')")"
  fi
}
trap cleanup EXIT

exec 3>&1 4>&2
exec > >(tee -a "$LOG") 2>&1

[ -d "$BACKUP_DIR_HOST" ] || fail "no backup drive at $BACKUP_DIR_HOST"
mkdir -p "$SNAPSHOT_DIR" "$OBJECT_DIR" "$STAGE"

# One run at a time. A slow night must not overlap the next one and mirror into
# a directory another process is rotating away underneath it.
take_lock || fail "another backup is still running"

log "snapshot $ID"

# --- Postgres, first --------------------------------------------------------
STEP="dumping the database"
log "$STEP"
# Custom format: compressed in the archive, restorable selectively, and it
# carries the schema, the pg_trgm extension and the trigram index with it.
# --no-owner so the dump can land under a different role on a rebuilt box.
compose run --rm --no-deps -T backup-db \
  pg_dump --format=custom --compress=6 --no-owner --no-privileges \
    --dbname="postgresql://$POSTGRES_USER@postgres:5432/$POSTGRES_DB" \
    --file="$(in_container "$STAGE")/db.dump"

# The schema on its own, so a difference between two nights can be read without
# a running Postgres to restore into.
compose run --rm --no-deps -T backup-db \
  pg_dump --schema-only --no-owner --no-privileges \
    --dbname="postgresql://$POSTGRES_USER@postgres:5432/$POSTGRES_DB" \
  > "$STAGE/db.schema.sql"

query() {
  compose run --rm --no-deps -T backup-db \
    psql --quiet --no-align --tuples-only \
      --dbname="postgresql://$POSTGRES_USER@postgres:5432/$POSTGRES_DB" \
      --command="$1" | tr -d '\r'
}

STEP="reading the counts"
ALEMBIC="$(query 'SELECT version_num FROM alembic_version LIMIT 1')"
PG_VERSION="$(query 'SHOW server_version')"
ROWS="$(query "SELECT json_build_object(
  'memorial_entries', (SELECT count(*) FROM memorial_entries),
  'blacklisted_ips',  (SELECT count(*) FROM blacklisted_ips),
  'image_feedback',   (SELECT count(*) FROM image_feedback),
  'contact_messages', (SELECT count(*) FROM contact_messages))")"

# The keys the archive believed in at dump time. This is what a restore replays,
# so restoring last night's snapshot cannot resurrect a photo deleted since.
query "COPY (
  SELECT image_object_key FROM memorial_entries
  UNION ALL
  SELECT thumb_object_key FROM memorial_entries WHERE thumb_object_key IS NOT NULL
) TO STDOUT" | gzip > "$STAGE/object_keys.txt.gz"

# --- MinIO, second ----------------------------------------------------------
STEP="mirroring the photos"
log "$STEP"
# No --remove, on purpose. Deleting a rejected entry removes its objects from
# the bucket; if that deletion reached the drive within a day the drive would be
# a replica, not a backup. Photos accumulate instead, and `make prod-backup-prune`
# reclaims the space deliberately rather than nightly. The mirror is shared by
# every snapshot: object keys are UUIDs and objects are never rewritten, so the
# bytes are stored once and each snapshot keeps only the list above.
compose run --rm --no-deps -T backup-objects \
  --quiet mirror "live/$MINIO_BUCKET" "$(in_container "$OBJECT_DIR")"

compose run --rm --no-deps -T backup-objects \
  ls --recursive --json "live/$MINIO_BUCKET" | gzip > "$STAGE/objects.index.jsonl.gz"

OBJECT_COUNT="$(find "$OBJECT_DIR" -type f | wc -l | tr -d ' ')"
OBJECT_BYTES="$(du -sk "$OBJECT_DIR" | cut -f1)"
OBJECT_BYTES=$((OBJECT_BYTES * 1024))

# Every full-size photo the database points at has to be on the drive. A missing
# thumbnail is tolerated: making one is already allowed to fail, thumb_object_key
# is nullable, and the image endpoint serves the full object instead.
STEP="checking the photos against the database"
MISSING=0
while IFS= read -r key; do
  case "$key" in *_thumb.*) continue ;; esac
  [ -f "$OBJECT_DIR/$key" ] || { log "missing photo: $key"; MISSING=$((MISSING + 1)); }
done < <(gzip -dc "$STAGE/object_keys.txt.gz")
[ "$MISSING" -eq 0 ] || fail "$MISSING photo(s) in the database are not on the drive"

# --- the record of the run --------------------------------------------------
STEP="writing the manifest"
DUMP_BYTES="$(wc -c < "$STAGE/db.dump" | tr -d ' ')"
DUMP_SHA="$(sha256 "$STAGE/db.dump" | cut -d' ' -f1)"
# A development stack has no .image-tag, and that is not a failure.
IMAGE_TAG="$(sed -n 's/^IMAGE_TAG=//p' "$REPO_DIR/.image-tag" 2>/dev/null | head -n 1 || true)"

cat > "$STAGE/manifest.json" <<JSON
{
  "id": "$ID",
  "complete": true,
  "started_at": "$STARTED",
  "finished_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "image_tag": "${IMAGE_TAG:-unknown}",
  "postgres_version": "$PG_VERSION",
  "alembic_version": "$ALEMBIC",
  "rows": $ROWS,
  "objects": { "count": $OBJECT_COUNT, "bytes": $OBJECT_BYTES },
  "db_dump": { "bytes": $DUMP_BYTES, "sha256": "$DUMP_SHA" }
}
JSON

( cd "$STAGE" && find . -maxdepth 1 -type f ! -name SHA256SUMS -print0 \
    | xargs -0 sha256 > SHA256SUMS )

# Cheap proof the archive is readable rather than merely present. A dump that
# only fails to open on the day it is needed is worse than no dump at all.
STEP="verifying the dump"
( cd "$STAGE" && sha256 --quiet --check SHA256SUMS )
compose run --rm --no-deps -T backup-db \
  pg_restore --list "$(in_container "$STAGE")/db.dump" > /dev/null

# --- into place, in one rename ----------------------------------------------
STEP="putting the snapshot in place"
mv "$STAGE" "$SNAPSHOT_DIR/$ID"
ln -sfn "$ID" "$SNAPSHOT_DIR/latest"
date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_SUCCESS"

# Keep BACKUP_KEEP generations. Named for the moment they were taken, so sorting
# by name is sorting by age — no reliance on mtime, which a copy would rewrite.
STEP="removing the oldest snapshot"
while IFS= read -r old; do
  [ -n "$old" ] || continue
  log "removing $old"
  rm -rf "${SNAPSHOT_DIR:?}/$old"
done < <(cd "$SNAPSHOT_DIR" && ls -1 | grep -v '^latest$' | sort -r | tail -n "+$((BACKUP_KEEP + 1))")

rm -rf "${STAGING_DIR:?}"/*
log "done: $OBJECT_COUNT photos on the drive, rows $ROWS"
