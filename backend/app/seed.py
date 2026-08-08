"""Seed the wall from a manifest of real entries.

An empty archive on launch day reads as abandoned, so the wall should already hold
real stickers before anyone is invited to it. This loads photographs from disk with
the name and transcribed text alongside them, and writes them in as **published**
entries — they have been reviewed by whoever assembled the manifest.

    uv run python -m app.seed seed/entries.json

The manifest is a JSON list; `image` is relative to the manifest's own directory:

    [
      {
        "image": "photos/example.jpg",
        "person_name": "Full Name",
        "sticker_text": "Everything written on the sticker",
        "latitude": 32.0853,
        "longitude": 34.7818
      }
    ]

Re-running is safe: an entry whose normalized name and image dimensions already
match a published row is skipped rather than duplicated.
"""

import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app import images, storage
from app.db import SessionFactory
from app.models import MemorialEntry
from app.names import normalize_person_name, tidy_person_name

REQUIRED_FIELDS = ("image", "person_name", "sticker_text")


def load_manifest(path: Path) -> list[dict]:
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise ValueError("manifest must be a JSON list of entries")
    for index, entry in enumerate(entries):
        missing = [field for field in REQUIRED_FIELDS if not entry.get(field)]
        if missing:
            raise ValueError(f"entry {index}: missing {', '.join(missing)}")
    return entries


async def seed_one(session, root: Path, record: dict) -> str:
    """Insert one entry. Returns a one-line report of what happened."""
    name = tidy_person_name(record["person_name"])
    normalized = normalize_person_name(name)
    image_path = (root / record["image"]).resolve()
    if not image_path.is_file():
        return f"skipped {name}: no such image {image_path}"

    normalized_image = images.normalize(image_path.read_bytes())

    existing = await session.scalar(
        select(MemorialEntry.id).where(
            MemorialEntry.person_name_normalized == normalized,
            MemorialEntry.image_width == normalized_image.width,
            MemorialEntry.image_height == normalized_image.height,
        )
    )
    if existing is not None:
        return f"skipped {name}: already in the archive"

    object_key = storage.build_object_key(normalized_image.extension)
    storage.upload_image(object_key, normalized_image.data, normalized_image.content_type)
    thumb_key = storage.build_thumb_key(object_key)
    thumb = images.make_thumbnail(normalized_image.data)
    storage.upload_image(thumb_key, thumb.data, thumb.content_type)

    session.add(
        MemorialEntry(
            # Seeded entries were reviewed by whoever wrote the manifest.
            status="published",
            person_name=name,
            person_name_normalized=normalized,
            sticker_text=record["sticker_text"].strip(),
            latitude=record.get("latitude"),
            longitude=record.get("longitude"),
            image_object_key=object_key,
            thumb_object_key=thumb_key,
            image_width=normalized_image.width,
            image_height=normalized_image.height,
            image_bytes=len(normalized_image.data),
            review_note="seeded from manifest",
        )
    )
    await session.commit()
    return f"added {name}"


async def seed(manifest_path: Path) -> int:
    records = load_manifest(manifest_path)
    storage.ensure_bucket()
    async with SessionFactory() as session:
        for record in records:
            print(f"[seed] {await seed_one(session, manifest_path.parent, record)}")
    return 0


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python -m app.seed <manifest.json>", file=sys.stderr)
        return 2
    try:
        return asyncio.run(seed(Path(sys.argv[1]).resolve()))
    except Exception as exc:  # noqa: BLE001 - a CLI reports and exits
        print(f"[seed] failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
