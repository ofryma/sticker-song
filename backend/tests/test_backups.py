"""Reading what the nightly backup left on the drive.

No database and no drive: `read_status` only reads files, so these build the
directory `ops/backup.sh` would have written and check what the review page is
told about it. The cases that matter are the ones that are not a happy path —
no drive at all, a run that never finished, a manifest that cannot be parsed —
because each of those has to read as "nothing to show" rather than as a fault.
"""

import json
from datetime import UTC, datetime, timedelta

import pytest

from app import backups
from app.config import settings


@pytest.fixture
def drive(tmp_path, monkeypatch):
    """An empty backup drive, attached."""
    monkeypatch.setattr(settings, "backup_dir", str(tmp_path))
    monkeypatch.setattr(settings, "backup_stale_hours", 30)
    (tmp_path / "snapshots").mkdir()
    return tmp_path


def write_snapshot(drive, snapshot_id: str, *, complete: bool = True, entries: int = 3):
    directory = drive / "snapshots" / snapshot_id
    directory.mkdir()
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "id": snapshot_id,
                "complete": complete,
                "finished_at": "2026-08-15T03:12:00Z",
                "image_tag": "sha-abc123",
                "alembic_version": "0005",
                "rows": {"memorial_entries": entries, "contact_messages": 1},
                "objects": {"count": entries * 2, "bytes": 4096},
                "db_dump": {"bytes": 1024, "sha256": "deadbeef"},
            }
        )
    )
    return directory


def mark_success(drive, when: datetime) -> None:
    (drive / "last-success").write_text(when.isoformat())


def test_no_drive_is_not_a_fault(monkeypatch) -> None:
    monkeypatch.setattr(settings, "backup_dir", "")

    status = backups.read_status()

    assert status.configured is False
    assert status.snapshots == []
    # Nothing is claimed about staleness when there is nothing to be stale.
    assert status.stale is False


def test_a_finished_snapshot_is_reported(drive) -> None:
    write_snapshot(drive, "2026-08-15T031000Z", entries=7)
    mark_success(drive, datetime.now(UTC))

    status = backups.read_status()

    assert status.configured is True
    assert status.stale is False
    assert len(status.snapshots) == 1
    snapshot = status.snapshots[0]
    assert snapshot.entries == 7
    assert snapshot.object_count == 14
    assert snapshot.alembic_version == "0005"
    assert snapshot.image_tag == "sha-abc123"


def test_the_newest_snapshot_comes_first(drive) -> None:
    write_snapshot(drive, "2026-08-14T031000Z", entries=5)
    write_snapshot(drive, "2026-08-15T031000Z", entries=7)
    mark_success(drive, datetime.now(UTC))

    ids = [snapshot.id for snapshot in backups.read_status().snapshots]

    assert ids == ["2026-08-15T031000Z", "2026-08-14T031000Z"]


def test_the_latest_symlink_is_not_a_second_backup(drive) -> None:
    """`ops/backup.sh` points `latest` at the newest snapshot; it is not one."""
    newest = write_snapshot(drive, "2026-08-15T031000Z")
    (drive / "snapshots" / "latest").symlink_to(newest)
    mark_success(drive, datetime.now(UTC))

    assert [snapshot.id for snapshot in backups.read_status().snapshots] == [newest.name]


def test_an_unfinished_run_is_not_a_backup(drive) -> None:
    write_snapshot(drive, "2026-08-15T031000Z", complete=False)
    mark_success(drive, datetime.now(UTC))

    assert backups.read_status().snapshots == []


def test_an_unreadable_manifest_is_skipped(drive) -> None:
    good = write_snapshot(drive, "2026-08-14T031000Z")
    broken = drive / "snapshots" / "2026-08-15T031000Z"
    broken.mkdir()
    (broken / "manifest.json").write_text("{ this is not json")
    mark_success(drive, datetime.now(UTC))

    status = backups.read_status()

    assert [snapshot.id for snapshot in status.snapshots] == [good.name]


def test_an_old_last_success_is_stale(drive) -> None:
    write_snapshot(drive, "2026-08-15T031000Z")
    mark_success(drive, datetime.now(UTC) - timedelta(hours=31))

    assert backups.read_status().stale is True


def test_a_drive_that_has_never_been_written_is_stale(drive) -> None:
    status = backups.read_status()

    assert status.configured is True
    assert status.last_success is None
    assert status.stale is True
    assert status.snapshots == []
