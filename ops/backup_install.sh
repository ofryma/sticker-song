#!/usr/bin/env bash
#
# Put the two timers in place, once.
#
# After this there is nothing to remember: `systemctl list-timers` shows both,
# journald keeps their output, and a night without a backup announces itself.
# Run it again after a deploy changes the units; it is safe to repeat.
#
set -euo pipefail

. "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

[ "$(id -u)" -eq 0 ] || fail "run this with sudo: it writes to /etc/systemd/system"

command -v systemctl > /dev/null || fail "this host does not use systemd"
[ -d "$BACKUP_DIR_HOST" ] || fail "no backup drive at $BACKUP_DIR_HOST — mount it first"

# The units name /opt/sticker-song and /mnt/backup outright, because a unit file
# is read by systemd and not by a shell: it has no idea what BACKUP_DIR_HOST is.
# Rewrite both as they are installed so one setting still governs.
for unit in "$OPS_DIR"/systemd/*; do
  name="$(basename "$unit")"
  sed -e "s#/opt/sticker-song#$REPO_DIR#g" \
      -e "s#/mnt/backup#$BACKUP_DIR_HOST#g" \
      "$unit" > "/etc/systemd/system/$name"
  log "installed $name"
done

systemctl daemon-reload
systemctl enable --now sticker-song-backup.timer sticker-song-backup-check.timer

cat <<DONE

Both timers are running:

  systemctl list-timers 'sticker-song-*'
  systemctl start sticker-song-backup.service    # a backup now
  journalctl -u sticker-song-backup.service -n 50

The first backup copies every photo, so run it by hand — in tmux — before
leaving it to the timer:

  make prod-backup

DONE
