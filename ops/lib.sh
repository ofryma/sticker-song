# Shared ground for the backup scripts. Sourced, never run.
#
# Everything here is deliberately small and dependency-free: these scripts have
# to work on a box that has just been built, before anything else has been set
# up, and the day they are needed is not the day to discover they wanted a tool
# that is not installed.

# The repository root, whether this is /opt/sticker-song on the server or a
# checkout on a laptop.
OPS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname -- "$OPS_DIR")"

# Which stack to talk to. The nightly run leaves this alone and gets production;
# a drill sets COMPOSE_FILE=docker-compose.yml and gets the development stack.
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

# Read a value out of .env without sourcing it — .env is data, and a stray
# backtick in a password should not become a command.
env_value() {
  sed -n "s/^$1=//p" "$REPO_DIR/.env" 2>/dev/null | head -n 1
}

# Settings, environment first so a drill can override without touching .env.
BACKUP_DIR_HOST="${BACKUP_DIR_HOST:-$(env_value BACKUP_DIR_HOST)}"
BACKUP_DIR_HOST="${BACKUP_DIR_HOST:-/mnt/backup}"
BACKUP_KEEP="${BACKUP_KEEP:-$(env_value BACKUP_KEEP)}"
BACKUP_KEEP="${BACKUP_KEEP:-2}"
BACKUP_STALE_HOURS="${BACKUP_STALE_HOURS:-$(env_value BACKUP_STALE_HOURS)}"
BACKUP_STALE_HOURS="${BACKUP_STALE_HOURS:-30}"

POSTGRES_USER="${POSTGRES_USER:-$(env_value POSTGRES_USER)}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-$(env_value POSTGRES_DB)}"
POSTGRES_DB="${POSTGRES_DB:-stickers}"
MINIO_BUCKET="${MINIO_BUCKET:-$(env_value MINIO_BUCKET)}"
MINIO_BUCKET="${MINIO_BUCKET:-stickers}"

SNAPSHOT_DIR="$BACKUP_DIR_HOST/snapshots"
OBJECT_DIR="$BACKUP_DIR_HOST/objects"
STAGING_DIR="$BACKUP_DIR_HOST/.staging"
LAST_SUCCESS="$BACKUP_DIR_HOST/last-success"

# The same compose invocation the Makefile uses, so a hand-run and the timer
# talk to exactly one stack. .image-tag only exists for the production file.
compose() {
  if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    [ -f "$REPO_DIR/.image-tag" ] || echo "IMAGE_TAG=main" > "$REPO_DIR/.image-tag"
    docker compose -f "$REPO_DIR/$COMPOSE_FILE" \
      --env-file "$REPO_DIR/.env" --env-file "$REPO_DIR/.image-tag" "$@"
  else
    docker compose -f "$REPO_DIR/$COMPOSE_FILE" "$@"
  fi
}

# Inside the tool containers the drive is always /backup, whatever the host
# calls it. Translate once, here, rather than in every call site.
in_container() { printf '/backup%s' "${1#"$BACKUP_DIR_HOST"}"; }

# The server has GNU coreutils and util-linux; a laptop rehearsing a restore may
# not. These two shims are the whole of the difference, and they are here rather
# than scattered through the scripts so the difference stays one place.
if command -v sha256sum > /dev/null 2>&1; then
  sha256() { sha256sum "$@"; }
else
  sha256() { shasum -a 256 "$@"; }
fi

# One run at a time. flock where it exists — the server — because the kernel
# releases it however the process dies. Where it does not, a directory, which is
# atomic everywhere but survives a kill -9; so a lock older than the longest a
# backup could plausibly take is treated as abandoned rather than held. Without
# that, one hard kill would stop every backup from then on, and the only sign
# would be the staleness check a day later.
STALE_LOCK_HOURS="${STALE_LOCK_HOURS:-12}"
HELD_LOCK=""

take_lock() {
  if command -v flock > /dev/null 2>&1; then
    exec 9> "$BACKUP_DIR_HOST/.lock"
    flock -n 9 || return 1
    return 0
  fi
  local lock="$BACKUP_DIR_HOST/.lock.d"
  mkdir "$lock" 2> /dev/null && { HELD_LOCK="$lock"; return 0; }
  # -mmin rather than -mtime: hours, not days.
  if [ -n "$(find "$lock" -maxdepth 0 -mmin "+$((STALE_LOCK_HOURS * 60))" 2> /dev/null)" ]; then
    log "removing a lock left behind $STALE_LOCK_HOURS+ hours ago"
    rmdir "$lock" 2> /dev/null || true
    mkdir "$lock" 2> /dev/null && { HELD_LOCK="$lock"; return 0; }
  fi
  return 1
}

# Only ever releases a lock this process actually took. Releasing one it merely
# found would let the run that could not start unlock the run that is running.
drop_lock() {
  [ -n "$HELD_LOCK" ] || return 0
  rmdir "$HELD_LOCK" 2> /dev/null || true
  HELD_LOCK=""
}

log()  { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# One Telegram message, or silence if the channel is not configured. Never
# allowed to fail the run: an unreachable Telegram must not turn a good backup
# into a bad one.
notify() {
  python3 "$OPS_DIR/notify.py" "$1" || log "could not send the Telegram message"
}
