# Todo

## Improvments
* Saving an identifier of the publisher of the entry so it could be moved to blacklist of needed and also allow the admin to do that from the admin page per entry.

## Backup
* ~~A way to dump all the content at least once a day to an external drive and a way to recover the platform from that drive.~~ Done: `ops/backup.sh` nightly onto `/mnt/backup`, `make prod-restore` to put it back, and a backups tab in the admin page. See README, "Backup and recovery".
* Still open: the drive is on the same machine. An offsite copy is the next step.

## Future
- Allow downloading and sharing of the stickers
- Allow bulk download of the entire stickers database
