"""Conflicts: people the archive holds more than one sticker for.

Two contributors photograph the same sticker on the same wall a week apart, and
the archive ends up with one person twice. The public side already resolves this
by vote — see `entries.submit_feedback` — but a vote needs people, and a reviewer
looking at both photographs can simply decide.

Grouping is on the normalized name, the same key resolution deletes by. Names
that merely *look* alike travel with a group as `similar_names` and are never
merged into it: a fuzzy match is good enough to show a person and nowhere near
good enough to destroy what may be somebody else's entry.
"""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, text

from app.admin_auth import require_admin
from app.config import settings
from app.db import SessionDep
from app.models import ImageFeedback, MemorialEntry
from app.routers.entries import delete_entry_objects
from app.schemas import (
    ConflictDetail,
    ConflictEntry,
    ConflictGroup,
    ConflictGroupPage,
    ConflictResolution,
    ConflictResolved,
    MemorialEntryReview,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/conflicts", tags=["admin"], dependencies=[Depends(require_admin)]
)

#: Rejected entries are already out of the archive; a conflict between them and
#: anything else is not one a reviewer needs to settle.
IN_ARCHIVE = MemorialEntry.status.in_(("pending", "published"))

VOTE_COUNT = (
    select(func.count(ImageFeedback.id))
    .where(ImageFeedback.entry_id == MemorialEntry.id)
    .scalar_subquery()
)


def _pixels(entry: MemorialEntry) -> int:
    return (entry.image_width or 0) * (entry.image_height or 0)


async def _similar_names(session: SessionDep, keys: list[str]) -> dict[str, list[str]]:
    """For each group key, the near-matching names that are not in it.

    One round trip for the whole page: the keys are unnested and joined against
    the distinct names in the table.
    """
    if not keys:
        return {}
    rows = await session.execute(
        text(
            """
            SELECT k.key, n.person_name_normalized
            FROM unnest(CAST(:keys AS text[])) AS k(key)
            JOIN (
                SELECT DISTINCT person_name_normalized
                FROM memorial_entries
                WHERE status IN ('pending', 'published')
            ) AS n
              ON n.person_name_normalized <> k.key
             AND similarity(n.person_name_normalized, k.key) > :threshold
            ORDER BY k.key, n.person_name_normalized
            """
        ),
        {"keys": keys, "threshold": settings.name_similarity_threshold},
    )
    similar: dict[str, list[str]] = {key: [] for key in keys}
    for key, name in rows.all():
        similar[key].append(name)
    return similar


@router.get("", response_model=ConflictGroupPage)
async def list_conflicts(
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ConflictGroupPage:
    """Every person the archive holds more than one sticker for, most first."""
    conditions = [IN_ARCHIVE]
    if q:
        conditions.append(MemorialEntry.person_name.ilike(f"%{q.strip()}%"))

    grouped = (
        select(
            MemorialEntry.person_name_normalized.label("normalized"),
            func.count(MemorialEntry.id).label("entries"),
            func.max(MemorialEntry.created_at).label("latest"),
        )
        .where(*conditions)
        .group_by(MemorialEntry.person_name_normalized)
        .having(func.count(MemorialEntry.id) > 1)
    )

    total = await session.scalar(select(func.count()).select_from(grouped.subquery()))
    rows = (
        await session.execute(
            grouped.order_by(
                func.count(MemorialEntry.id).desc(),
                func.max(MemorialEntry.created_at).desc(),
                MemorialEntry.person_name_normalized,
            )
            .limit(limit)
            .offset(offset)
        )
    ).all()

    keys = [row.normalized for row in rows]
    similar = await _similar_names(session, keys)
    # The name as somebody wrote it, and the votes across the group. One query
    # for the page rather than one per group.
    members = (
        await session.execute(
            select(
                MemorialEntry.person_name_normalized,
                MemorialEntry.person_name,
                MemorialEntry.created_at,
                VOTE_COUNT,
            )
            .where(IN_ARCHIVE, MemorialEntry.person_name_normalized.in_(keys))
            .order_by(MemorialEntry.created_at.desc())
        )
    ).all()

    display: dict[str, str] = {}
    votes: dict[str, int] = dict.fromkeys(keys, 0)
    for normalized, name, _created, vote_count in members:
        display.setdefault(normalized, name)
        votes[normalized] += vote_count or 0

    return ConflictGroupPage(
        items=[
            ConflictGroup(
                normalized_name=row.normalized,
                person_name=display.get(row.normalized, row.normalized),
                entry_count=row.entries,
                vote_count=votes.get(row.normalized, 0),
                similar_names=similar.get(row.normalized, []),
                latest_at=row.latest,
            )
            for row in rows
        ],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/entries", response_model=ConflictDetail)
async def conflict_entries(
    session: SessionDep, name: Annotated[str, Query(min_length=1, max_length=255)]
) -> ConflictDetail:
    """Every sticker held for one person, newest first, with its votes.

    `name` is the normalized key from the list — it travels as a query parameter
    because a person's name is not safe in a path segment.
    """
    rows = (
        await session.execute(
            select(MemorialEntry, VOTE_COUNT)
            .where(IN_ARCHIVE, MemorialEntry.person_name_normalized == name)
            .order_by(MemorialEntry.created_at.desc())
        )
    ).all()
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No entries for that name")

    entries = [
        ConflictEntry(
            # The URLs are computed on the way out; feeding them back in is not.
            **MemorialEntryReview.model_validate(entry).model_dump(
                exclude={"image_url", "thumb_url"}
            ),
            vote_count=votes or 0,
        )
        for entry, votes in rows
    ]
    best = max(rows, key=lambda row: (_pixels(row[0]), row[1] or 0))[0]

    return ConflictDetail(
        normalized_name=name,
        person_name=rows[0][0].person_name,
        entries=entries,
        suggested_best_id=best.id,
    )


@router.post("/resolve", response_model=ConflictResolved)
async def resolve_conflict(
    session: SessionDep, payload: ConflictResolution
) -> ConflictResolved:
    """Keep the sticker the reviewer chose and destroy the rest of its group.

    Permanent, rows and images alike — the same ending the public vote reaches,
    reached by a person instead. Every loser must carry the winner's normalized
    name, so a mis-scoped call cannot delete a different person's entry.
    """
    winner = await session.get(MemorialEntry, payload.winner_id)
    if winner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    if payload.winner_id in payload.loser_ids:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "The chosen sticker cannot also be removed"
        )

    losers = list(
        await session.scalars(
            select(MemorialEntry)
            .where(MemorialEntry.id.in_(payload.loser_ids))
            .with_for_update()
        )
    )
    if len(losers) != len(set(payload.loser_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    for loser in losers:
        if loser.person_name_normalized != winner.person_name_normalized:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Every sticker removed must carry the same name as the one kept",
            )

    deleted: list[uuid.UUID] = []
    for loser in losers:
        # Object first: a crash then leaves an orphaned object rather than a row
        # pointing at nothing.
        await delete_entry_objects(loser)
        logger.info(
            "conflict resolved by admin: winner=%s deleted=%s object=%s",
            winner.id,
            loser.id,
            loser.image_object_key,
        )
        deleted.append(loser.id)

    # Core DELETE so Postgres cascades the feedback rows.
    await session.execute(delete(MemorialEntry).where(MemorialEntry.id.in_(deleted)))
    await session.commit()
    return ConflictResolved(winner_id=winner.id, deleted_entry_ids=deleted)
