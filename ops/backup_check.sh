#!/usr/bin/env bash
#
# Has a backup finished recently enough?
#
# The second half of the dead man's switch. ops/backup.sh reports its own
# failures, but a run that never started reports nothing at all — a timer that
# was never installed, a drive that was unmounted, a box that filled up. This
# runs on its own timer and speaks when the drive has gone quiet.
#
# A dead box is already covered: .github/workflows/uptime.yml watches from
# outside and cannot die with the machine.
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

NOW="$(date -u +%s)"
LIMIT=$((BACKUP_STALE_HOURS * 3600))

if [ ! -f "$LAST_SUCCESS" ]; then
  notify "$(printf '<b>💾 No backup has ever finished</b>\nnothing at %s' "$BACKUP_DIR_HOST")"
  fail "no successful backup has ever been recorded"
fi

WHEN="$(cat "$LAST_SUCCESS")"
# date -d is GNU; a laptop rehearsing this has BSD date, which wants -j -f.
THEN="$(date -u -d "$WHEN" +%s 2> /dev/null \
  || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$WHEN" +%s)"
AGE=$(((NOW - THEN) / 3600))

if [ "$((NOW - THEN))" -gt "$LIMIT" ]; then
  notify "$(printf '<b>💾 No backup last night</b>\nthe last one finished %sh ago, at %s' \
    "$AGE" "$WHEN")"
  fail "the last backup finished ${AGE}h ago"
fi

log "last backup finished ${AGE}h ago, at $WHEN"
