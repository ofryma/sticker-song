#!/usr/bin/env bash
#
# What is on the drive, newest first — the same thing the review page's backups
# tab shows, for when you are already on the box.
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

[ -d "$SNAPSHOT_DIR" ] || fail "no backups on $BACKUP_DIR_HOST"

if [ -f "$LAST_SUCCESS" ]; then
  echo "last finished  $(cat "$LAST_SUCCESS")"
else
  echo "last finished  never"
fi
echo "photos         $(find "$OBJECT_DIR" -type f 2> /dev/null | wc -l | tr -d ' ') on the drive, $(du -sh "$OBJECT_DIR" 2> /dev/null | cut -f1)"
echo

printf '%-22s %8s %10s %s\n' "snapshot" "entries" "dump" "built from"
for dir in $(cd "$SNAPSHOT_DIR" && ls -1 | grep -v '^latest$' | sort -r); do
  manifest="$SNAPSHOT_DIR/$dir/manifest.json"
  [ -f "$manifest" ] || { printf '%-22s %s\n' "$dir" "unfinished"; continue; }
  python3 - "$manifest" "$dir" <<'PY'
import json, sys

manifest = json.load(open(sys.argv[1]))
size = manifest.get("db_dump", {}).get("bytes", 0) / 1024 / 1024
print("%-22s %8s %9.1fM %s" % (
    sys.argv[2],
    manifest.get("rows", {}).get("memorial_entries", "?"),
    size,
    manifest.get("image_tag", "unknown"),
))
PY
done
