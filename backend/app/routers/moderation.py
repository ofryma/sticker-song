"""Review queue: the endpoints behind the admin management page.

Every submission arrives as a draft. These routes let a reviewer read the queue,
publish an entry onto the wall, reject one, or take an entry down permanently.
The LLM's opinion travels with each draft as a note; the decision is always the
reviewer's.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, func, or_, select

from app import review
from app.admin_auth import require_admin
from app.config import settings
from app.db import SessionDep
from app.models import MemorialEntry
from app.routers.entries import (
    _get_entry_or_404,
    delete_entry_objects,
    serve_object,
)
from app.schemas import (
    MemorialEntryReview,
    ReviewCounts,
    ReviewDecision,
    ReviewPage,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/entries", tags=["admin"], dependencies=[Depends(require_admin)]
)

StatusFilter = Literal["pending", "published", "rejected", "all"]
#: What the automatic reader said, as something to filter on. "unread" is the
#: absence of a verdict, which no equality test would catch.
ReadFilter = Literal["any", "flag", "ok", "error", "unread"]
SortField = Literal["added", "name", "status", "read"]
SortOrder = Literal["asc", "desc"]

#: Both of these sort by meaning rather than by alphabet: what still needs a
#: decision comes before what has had one, and what was flagged before what was
#: not. Anything unknown — including an unread entry — sorts last.
STATUS_ORDER = case(
    {"pending": 0, "published": 1, "rejected": 2},
    value=MemorialEntry.status,
    else_=3,
)
READ_ORDER = case(
    {"flag": 0, "ok": 1, "error": 2},
    value=MemorialEntry.llm_verdict,
    else_=3,
)
SORT_COLUMNS = {
    "added": MemorialEntry.created_at,
    # The normalized form, so "David" and "david " land next to each other.
    "name": MemorialEntry.person_name_normalized,
    "status": STATUS_ORDER,
    "read": READ_ORDER,
}


def _conditions(
    status_filter: str, q: str | None, read: str, added_within_days: int | None
) -> list:
    """Everything the caller asked to narrow by, as SQL. Applied identically to
    the page and to the count behind it."""
    conditions = []
    if status_filter != "all":
        conditions.append(MemorialEntry.status == status_filter)
    if q:
        # ILIKE rather than pg_trgm: a reviewer types a fragment of a name or of
        # the transcription and expects a substring match, not a fuzzy one.
        like = f"%{q.strip()}%"
        conditions.append(
            or_(
                MemorialEntry.person_name.ilike(like),
                MemorialEntry.sticker_text.ilike(like),
            )
        )
    if read == "unread":
        conditions.append(MemorialEntry.llm_verdict.is_(None))
    elif read != "any":
        conditions.append(MemorialEntry.llm_verdict == read)
    if added_within_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=added_within_days)
        conditions.append(MemorialEntry.created_at >= cutoff)
    return conditions


@router.get("", response_model=ReviewPage)
async def list_for_review(
    session: SessionDep,
    status_filter: Annotated[StatusFilter, Query(alias="status")] = "pending",
    q: Annotated[str | None, Query(max_length=200)] = None,
    read: ReadFilter = "any",
    added_within_days: Annotated[int | None, Query(ge=1, le=3650)] = None,
    sort: SortField = "added",
    order: SortOrder | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReviewPage:
    """One page of the queue, narrowed and ordered by the database.

    Filtering and paging happen here rather than in the browser: with thousands
    of stickers, sending the whole archive so the review page can hide most of it
    is the expensive way to answer a question Postgres can answer directly.

    Without an explicit `order`, the default reads the way a reviewer works:
    oldest first for what is waiting — a submission should not wait behind newer
    ones — and newest first for everything else.
    """
    if order is None:
        order = "asc" if sort == "added" and status_filter == "pending" else "desc"
    conditions = _conditions(status_filter, q, read, added_within_days)

    column = SORT_COLUMNS[sort]
    direction = column.asc() if order == "asc" else column.desc()
    # A total order, so paging never repeats or skips a row when the sort key
    # ties — as it does for every entry sharing a status.
    ordering = (direction, MemorialEntry.created_at.desc(), MemorialEntry.id)

    total = await session.scalar(select(func.count(MemorialEntry.id)).where(*conditions))
    rows = await session.scalars(
        select(MemorialEntry)
        .where(*conditions)
        .order_by(*ordering)
        .limit(limit)
        .offset(offset)
    )
    return ReviewPage(
        items=[MemorialEntryReview.model_validate(row) for row in rows],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/counts", response_model=ReviewCounts)
async def review_counts(session: SessionDep) -> ReviewCounts:
    rows = await session.execute(
        select(MemorialEntry.status, func.count(MemorialEntry.id)).group_by(
            MemorialEntry.status
        )
    )
    tally = dict(rows.all())
    return ReviewCounts(
        pending=tally.get("pending", 0),
        published=tally.get("published", 0),
        rejected=tally.get("rejected", 0),
    )


async def _decide(
    session: SessionDep, entry_id: uuid.UUID, new_status: str, note: str | None
) -> MemorialEntry:
    entry = await _get_entry_or_404(session, entry_id)
    entry.status = new_status
    entry.review_note = (note or "").strip() or None
    entry.reviewed_by = "admin"
    entry.reviewed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(entry)
    logger.info("entry %s -> %s", entry.id, new_status)
    return entry


@router.get("/{entry_id}", response_model=MemorialEntryReview)
async def get_for_review(session: SessionDep, entry_id: uuid.UUID) -> MemorialEntry:
    return await _get_entry_or_404(session, entry_id)


@router.post("/{entry_id}/publish", response_model=MemorialEntryReview)
async def publish_entry(
    session: SessionDep, entry_id: uuid.UUID, payload: ReviewDecision | None = None
) -> MemorialEntry:
    """Put the entry on the wall."""
    note = payload.note if payload else None
    return await _decide(session, entry_id, "published", note)


@router.post("/{entry_id}/reject", response_model=MemorialEntryReview)
async def reject_entry(
    session: SessionDep, entry_id: uuid.UUID, payload: ReviewDecision | None = None
) -> MemorialEntry:
    """Keep the row out of the archive without destroying it, so the same
    submission is not silently re-reviewed if it arrives again."""
    note = payload.note if payload else None
    return await _decide(session, entry_id, "rejected", note)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(session: SessionDep, entry_id: uuid.UUID) -> None:
    """Permanent takedown: row and images, with no undo.

    For content that must not be retained at all — a wrongly attributed person, a
    photograph somebody asked to have removed. Prefer `reject` for ordinary
    queue decisions.
    """
    entry = await _get_entry_or_404(session, entry_id)
    # Objects first, so a crash leaves an orphaned object rather than a row
    # pointing at nothing.
    await delete_entry_objects(entry)
    await session.delete(entry)
    await session.commit()
    logger.info("entry %s deleted permanently by admin", entry_id)


@router.post("/{entry_id}/analyze", response_model=MemorialEntryReview)
async def analyze_entry(session: SessionDep, entry_id: uuid.UUID) -> MemorialEntry:
    """Re-run the LLM read on an entry — useful for drafts submitted before the API
    key was configured, or after the review prompt changes."""
    entry = await _get_entry_or_404(session, entry_id)
    if not settings.review_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "LLM review is disabled: ANTHROPIC_API_KEY is not set",
        )
    analysis = await review.analyze(entry.person_name, entry.sticker_text)
    if analysis is not None:
        entry.llm_verdict = analysis.verdict
        entry.llm_reason = analysis.reason
        entry.llm_checked_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(entry)
    return entry


@router.get("/{entry_id}/image")
async def review_image(session: SessionDep, entry_id: uuid.UUID) -> Response:
    """A draft's photo, for the reviewer. Regardless of status — that is the whole
    point of reviewing it. Accepts the credential as a `token` query parameter too,
    because an `<img>` tag cannot send a header."""
    entry = await _get_entry_or_404(session, entry_id)
    return await serve_object(entry.image_object_key)


@router.get("/{entry_id}/thumb")
async def review_thumb(session: SessionDep, entry_id: uuid.UUID) -> Response:
    entry = await _get_entry_or_404(session, entry_id)
    return await serve_object(entry.thumb_object_key or entry.image_object_key)
