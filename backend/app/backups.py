"""What the nightly backup left behind, read off the drive.

`ops/backup.sh` writes a `manifest.json` into each snapshot as its last act, and
touches `last-success` when the run finished. This module reads those files and
nothing else: there is no backup state in the database, and the API never starts
a backup or deletes one. The drive is mounted read-only into the container
precisely so that stays true.

Every failure here is treated as "nothing to show" rather than an error. A stack
with no drive attached — every development machine — is a normal state, not a
fault, and a manifest that cannot be parsed should not take the review page down
with it.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

MANIFEST = "manifest.json"
SNAPSHOTS = "snapshots"
LAST_SUCCESS = "last-success"


class BackupSnapshot(BaseModel):
    """One night's copy of the archive."""

    id: str
    finished_at: datetime | None
    entries: int | None
    rows: dict[str, int]
    object_count: int | None
    object_bytes: int | None
    dump_bytes: int | None
    alembic_version: str | None
    image_tag: str | None


class BackupStatus(BaseModel):
    """The state of the backups, as the review page needs to show it.

    `stale` is decided here rather than in the browser so that the page and the
    nightly staleness check answer to the same number.
    """

    configured: bool
    last_success: datetime | None = None
    stale: bool = False
    stale_after_hours: int = 0
    snapshots: list[BackupSnapshot] = []


def _read_timestamp(path: Path) -> datetime | None:
    try:
        moment = datetime.fromisoformat(path.read_text().strip())
    except (OSError, ValueError):
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def _read_manifest(directory: Path) -> BackupSnapshot | None:
    """One snapshot, or None if it is unfinished, unreadable or not a snapshot.

    A run that was interrupted never gets this far — `backup.sh` builds under
    `.staging/` and moves the finished directory into place in one rename — but
    `complete` is checked anyway, because a snapshot that lies about itself is
    worse than one that is missing.
    """
    try:
        manifest = json.loads((directory / MANIFEST).read_text())
    except (OSError, ValueError):
        return None
    if not isinstance(manifest, dict) or not manifest.get("complete"):
        return None

    def section(name: str) -> dict:
        value = manifest.get(name)
        return value if isinstance(value, dict) else {}

    rows = {k: v for k, v in section("rows").items() if isinstance(v, int)}
    objects = section("objects")
    dump = section("db_dump")

    try:
        return BackupSnapshot(
            id=str(manifest.get("id") or directory.name),
            finished_at=manifest.get("finished_at"),
            entries=rows.get("memorial_entries"),
            rows=rows,
            object_count=objects.get("count"),
            object_bytes=objects.get("bytes"),
            dump_bytes=dump.get("bytes"),
            alembic_version=manifest.get("alembic_version"),
            image_tag=manifest.get("image_tag"),
        )
    except ValueError:
        logger.warning("unreadable backup manifest in %s", directory.name)
        return None


def read_status(now: datetime | None = None) -> BackupStatus:
    """The two kept generations, newest first, and whether they are current."""
    if not settings.backup_enabled:
        return BackupStatus(configured=False)

    root = Path(settings.backup_dir)
    last_success = _read_timestamp(root / LAST_SUCCESS)
    stale_after = timedelta(hours=settings.backup_stale_hours)
    at = now or datetime.now(UTC)

    try:
        # Named for the moment they were taken, so the sort is the order.
        # `latest` is a symlink to the newest of them and is skipped, or it
        # would be reported a second time under its own name.
        directories = sorted(
            (
                d
                for d in (root / SNAPSHOTS).iterdir()
                if d.is_dir() and not d.is_symlink()
            ),
            key=lambda d: d.name,
            reverse=True,
        )
    except OSError:
        directories = []

    snapshots = [snapshot for d in directories if (snapshot := _read_manifest(d))]

    return BackupStatus(
        configured=True,
        last_success=last_success,
        stale=last_success is None or at - last_success > stale_after,
        stale_after_hours=settings.backup_stale_hours,
        snapshots=snapshots,
    )
