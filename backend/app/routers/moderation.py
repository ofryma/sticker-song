"""Review queue: the endpoints behind the admin management page.

Every submission arrives as a draft. These routes let a reviewer read the queue,
publish an entry onto the wall, reject one, or take an entry down permanently.
The LLM's opinion travels with each draft as a note; the decision is always the
reviewer's.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select

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
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/entries", tags=["admin"], dependencies=[Depends(require_admin)]
)

StatusFilter = Literal["pending", "published", "rejected", "all"]


@router.get("", response_model=list[MemorialEntryReview])
async def list_for_review(
    session: SessionDep,
    status_filter: Annotated[StatusFilter, Query(alias="status")] = "pending",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MemorialEntry]:
    """The queue. Oldest first for pending — a submission should not wait behind
    newer ones — and newest first for everything else."""
    query = select(MemorialEntry)
    if status_filter != "all":
        query = query.where(MemorialEntry.status == status_filter)
    order = (
        MemorialEntry.created_at.asc()
        if status_filter == "pending"
        else MemorialEntry.created_at.desc()
    )
    result = await session.scalars(query.order_by(order).limit(limit).offset(offset))
    return list(result)


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
