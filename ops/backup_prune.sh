#!/usr/bin/env bash
#
# Reclaim the photos of entries that were deleted a while ago.
#
# The nightly mirror never deletes: a rejected entry's photos leave the bucket
# but stay on the drive, because a copy that forgets things within a day is a
# replica and not a backup. They accumulate slowly — only rejections and
# resolved duplicates — so this is an occasional, deliberate chore rather than
# anything on a timer.
#
# An object is removed only when it is in none of: the live bucket, or any
# snapshot still kept. Prints what it would do and changes nothing unless asked.
#
#   make prod-backup-prune           # what would go
#   make prod-backup-prune GO=yes    # let it go
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

GO="${GO:-}"
KEEP="$(mktemp)"
trap 'rm -f "$KEEP"' EXIT

log "reading the live bucket"
compose run --rm --no-deps -T backup-objects \
  ls --recursive "live/$MINIO_BUCKET" | awk '{print $NF}' >> "$KEEP"

for snapshot in "$SNAPSHOT_DIR"/*/; do
  keys="$snapshot/object_keys.txt.gz"
  [ -f "$keys" ] || continue
  log "reading $(basename "$snapshot")"
  gzip -dc "$keys" >> "$KEEP"
done

sort -u -o "$KEEP" "$KEEP"

COUNT=0
BYTES=0
while IFS= read -r path; do
  key="${path#"$OBJECT_DIR/"}"
  grep -qxF "$key" "$KEEP" && continue
  size="$(wc -c < "$path" | tr -d ' ')"
  COUNT=$((COUNT + 1))
  BYTES=$((BYTES + size))
  if [ "$GO" = "yes" ]; then rm -f "$path"; else echo "  would remove $key"; fi
done < <(find "$OBJECT_DIR" -type f)

if [ "$GO" = "yes" ]; then
  log "removed $COUNT photo(s), $((BYTES / 1024 / 1024)) MB"
else
  log "$COUNT photo(s), $((BYTES / 1024 / 1024)) MB — run again with GO=yes to remove them"
fi
