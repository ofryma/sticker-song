#!/usr/bin/env bash
#
# Put the archive back, from a snapshot on the drive.
#
# This is the one command, and it is written for the worst day: a box that has
# just been built, by someone who has not read the rest of this repository. It
# checks everything it can before it touches anything, then works in the only
# order that can succeed — secrets, database, photos, stack, proof.
#
#   make prod-restore SNAPSHOT=latest
#   ops/restore.sh --snapshot 2026-08-15T031000Z --confirm 2026-08-15T031000Z
#
# On a bare box, from a clone of this repository:
#
#   git clone --depth 1 https://github.com/ofryma/sticker-song /tmp/ss
#   /tmp/ss/ops/restore.sh --snapshot latest
#
# Secrets are deliberately not in the backup, so .env has to exist first — write
# it from .env.prod.example. The passwords may be new ones: the dump restores
# into a fresh cluster and does not care what the old ones were.
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

SNAPSHOT=""
CONFIRM="${CONFIRM:-}"
IMAGE_TAG_OVERRIDE="${IMAGE_TAG:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/sticker-song}"

while [ $# -gt 0 ]; do
  case "$1" in
    --snapshot) SNAPSHOT="$2"; shift 2 ;;
    --confirm)  CONFIRM="$2";  shift 2 ;;
    *) fail "unknown argument: $1" ;;
  esac
done
[ -n "$SNAPSHOT" ] || fail "usage: restore.sh --snapshot <id|latest>"

# --- a bare box: put the stack files where they belong, then start again -----
# Only the four things the deploy workflow ships, plus the scripts, and taken
# from the commit the snapshot names — so the compose file and the nginx
# templates match the images that produced the data.
# A drill against the development stack stays where it is; only a production
# restore run from somewhere other than the deploy path is a bare box.
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ] && [ "$REPO_DIR" != "$DEPLOY_PATH" ]; then
  log "setting up $DEPLOY_PATH from $REPO_DIR"
  for tool in docker make tar python3; do
    command -v "$tool" > /dev/null || fail "$tool is not installed on this host"
  done
  docker compose version > /dev/null 2>&1 || fail "docker compose v2 is not installed"
  mkdir -p "$DEPLOY_PATH"
  tar -cf - -C "$REPO_DIR" \
    docker-compose.prod.yml Makefile nginx/templates nginx/include ops scripts \
    | tar -xf - -C "$DEPLOY_PATH"
  [ -f "$DEPLOY_PATH/.env" ] || fail "write $DEPLOY_PATH/.env from .env.prod.example first"
  log "starting again from $DEPLOY_PATH"
  exec env DEPLOY_PATH="$DEPLOY_PATH" CONFIRM="$CONFIRM" \
    "$DEPLOY_PATH/ops/restore.sh" --snapshot "$SNAPSHOT"
fi

# --- preflight: everything that can be checked, before anything is touched ---
STEP="checking the snapshot"
DIR="$SNAPSHOT_DIR/$SNAPSHOT"
[ -d "$DIR" ] || fail "no snapshot $SNAPSHOT on $BACKUP_DIR_HOST"
ID="$(basename "$(readlink "$DIR" 2> /dev/null || echo "$SNAPSHOT")")"
DIR="$SNAPSHOT_DIR/$ID"

read_manifest() {
  python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],""))' \
    "$DIR/manifest.json" "$1"
}
read_rows() {
  python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["rows"].get(sys.argv[2],""))' \
    "$DIR/manifest.json" "$1"
}

[ -f "$DIR/manifest.json" ] || fail "$ID has no manifest: it is not a finished backup"
[ "$(read_manifest complete)" = "True" ] || fail "$ID did not finish; it cannot be restored"

log "verifying $ID"
( cd "$DIR" && sha256 --quiet --check SHA256SUMS ) || fail "$ID is damaged"

# Compose refuses to interpolate, let alone start, without these — and they are
# deliberately not in the backup. The development stack has defaults for all
# three, so a drill is not asked for them.
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
  for key in POSTGRES_PASSWORD MINIO_SECRET_KEY DOMAIN; do
    [ -n "$(env_value "$key")" ] || fail "$key is not set in $REPO_DIR/.env"
  done
fi

log "$ID: $(read_rows memorial_entries) entries, schema $(read_manifest alembic_version), built from $(read_manifest image_tag)"

if [ "$CONFIRM" != "$ID" ]; then
  cat >&2 <<WARNING

This replaces everything the running archive holds:

  the $POSTGRES_DB database is dropped and rebuilt from $ID
  every photo on the drive is written back into the $MINIO_BUCKET bucket

Nothing here can be undone. To go ahead:

  make prod-restore SNAPSHOT=$SNAPSHOT CONFIRM=$ID

WARNING
  exit 1
fi

# --- the build the data came from -------------------------------------------
# Pinning the images to the snapshot's tag keeps the code and the schema
# agreeing. Pass IMAGE_TAG=main to deliberately restore onto a newer build; the
# alembic upgrade in step 5 carries the data forward.
STEP="pinning the build"
TAG="${IMAGE_TAG_OVERRIDE:-$(read_manifest image_tag)}"
if [ -n "$TAG" ] && [ "$TAG" != "unknown" ]; then
  echo "IMAGE_TAG=$TAG" > "$REPO_DIR/.image-tag"
  log "restoring onto $TAG"
fi

# --- Postgres ---------------------------------------------------------------
STEP="starting Postgres and MinIO"
log "$STEP"
compose pull --quiet postgres minio > /dev/null 2>&1 || true
compose up -d postgres minio
for _ in $(seq 1 40); do
  compose exec -T postgres pg_isready -q && break
  sleep 3
done

STEP="restoring the database"
log "$STEP"
admin_sql() {
  compose run --rm --no-deps -T backup-db psql --quiet -v ON_ERROR_STOP=1 \
    --dbname="postgresql://$POSTGRES_USER@postgres:5432/postgres" --command="$1"
}
# WITH (FORCE) drops the database out from under any connection still holding
# it; without it a single straggler turns the restore into a hang.
admin_sql "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)"
admin_sql "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\""

# The dump carries the schema, the pg_trgm extension, the trigram index and the
# alembic_version row, so this alone is a complete database. --single-transaction
# with --exit-on-error makes it all-or-nothing: a partial restore fails loudly
# instead of leaving something that looks restored.
compose run --rm --no-deps -T backup-db \
  pg_restore --no-owner --no-privileges --single-transaction --exit-on-error \
    --dbname="postgresql://$POSTGRES_USER@postgres:5432/$POSTGRES_DB" \
    "$(in_container "$DIR")/db.dump"

# --- the photos -------------------------------------------------------------
STEP="restoring the photos"
log "$STEP — this is the slow part"
compose run --rm --no-deps -T backup-objects mb --ignore-existing "live/$MINIO_BUCKET"
# The whole mirror goes back, not only the keys this snapshot listed. Objects
# whose entry was deleted since have no row pointing at them, so they are
# invisible in the archive and cost only disk; `make prod-backup-prune` is where
# they go. Restoring fewer photos than the drive holds is the one mistake that
# cannot be corrected afterwards.
compose run --rm --no-deps -T backup-objects \
  mirror "$(in_container "$OBJECT_DIR")" "live/$MINIO_BUCKET"

# --- the rest of the stack --------------------------------------------------
STEP="starting the archive"
log "$STEP"
# init-db runs `alembic upgrade head`: a no-op against the version the dump
# restored, and exactly the forward-repair wanted when an older snapshot is
# restored onto newer images. init-certs finds the certificate if there is one.
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
  make -C "$REPO_DIR" --no-print-directory prod-up
  make -C "$REPO_DIR" --no-print-directory prod-health
else
  compose up -d
fi

"$OPS_DIR/restore_verify.sh" --snapshot "$ID"

log "restored $ID"
[ "$COMPOSE_FILE" = "docker-compose.prod.yml" ] || exit 0
cat <<DONE

Two things are not in the backup and are not restored:

  TLS   make prod-cert EMAIL=you@example.org   (point DNS here first)
  .env  already written by hand, above

DONE
