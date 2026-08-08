"""What a visitor wrote, for whoever reads it.

The same shape as the review queue: a filtered page, counts for the tabs, and a
decision. A message is never deleted here — `dismissed` says somebody looked and
there was nothing to do, which is worth telling apart from nobody having looked.

Nothing notifies anyone: an admin opens /admin and the tab carries the open
count. If a takedown request must not sit unseen, that is the place to add a
webhook, and `todo.md` records the decision.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.admin_auth import require_admin
from app.db import SessionDep
from app.models import ContactMessage, MemorialEntry
from app.schemas import MessageCounts, MessagePage, MessageRead

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/messages", tags=["admin"], dependencies=[Depends(require_admin)]
)

StatusFilter = Literal["open", "resolved", "dismissed", "all"]
KindFilter = Literal["suggestion", "bug", "entry_problem", "all"]


def _conditions(status_filter: str, kind: str, q: str | None) -> list:
    """Everything the caller asked to narrow by, as SQL. Applied identically to
    the page and to the count behind it."""
    conditions = []
    if status_filter != "all":
        conditions.append(ContactMessage.status == status_filter)
    if kind != "all":
        conditions.append(ContactMessage.kind == kind)
    if q:
        conditions.append(ContactMessage.body.ilike(f"%{q.strip()}%"))
    return conditions


def _read(message: ContactMessage, person_name: str | None) -> MessageRead:
    """The row plus the two things that are not columns on it: the linked
    person's name, and whether a reply is even possible."""
    return MessageRead.model_validate(message).model_copy(
        update={
            "entry_person_name": person_name,
            "has_reply_email": message.reply_email is not None,
        }
    )


@router.get("", response_model=MessagePage)
async def list_messages(
    session: SessionDep,
    status_filter: Annotated[StatusFilter, Query(alias="status")] = "open",
    kind: KindFilter = "all",
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MessagePage:
    """One page of messages, newest first.

    The linked sticker's name is joined in rather than fetched per row: a page of
    fifty messages should cost one query, not fifty-one. An outer join, because
    a message may have no entry — or may have outlived the one it named.
    """
    conditions = _conditions(status_filter, kind, q)

    total = await session.scalar(select(func.count(ContactMessage.id)).where(*conditions))
    rows = (
        await session.execute(
            select(ContactMessage, MemorialEntry.person_name)
            .outerjoin(MemorialEntry, ContactMessage.entry_id == MemorialEntry.id)
            .where(*conditions)
            # A total order: created_at ties between messages sent in the same
            # second would otherwise let paging repeat or skip one.
            .order_by(ContactMessage.created_at.desc(), ContactMessage.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return MessagePage(
        items=[_read(message, person_name) for message, person_name in rows],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/counts", response_model=MessageCounts)
async def message_counts(session: SessionDep) -> MessageCounts:
    rows = await session.execute(
        select(ContactMessage.status, func.count(ContactMessage.id)).group_by(
            ContactMessage.status
        )
    )
    tally = dict(rows.all())
    return MessageCounts(
        open=tally.get("open", 0),
        resolved=tally.get("resolved", 0),
        dismissed=tally.get("dismissed", 0),
    )


async def _decide(
    session: SessionDep, message_id: uuid.UUID, new_status: str
) -> MessageRead:
    message = await session.get(ContactMessage, message_id)
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    message.status = new_status
    message.resolved_by = "admin"
    message.resolved_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(message)
    logger.info("contact message %s -> %s", message.id, new_status)

    person_name = None
    if message.entry_id is not None:
        entry = await session.get(MemorialEntry, message.entry_id)
        person_name = entry.person_name if entry else None
    return _read(message, person_name)


@router.post("/{message_id}/resolve", response_model=MessageRead)
async def resolve_message(session: SessionDep, message_id: uuid.UUID) -> MessageRead:
    """Somebody dealt with it."""
    return await _decide(session, message_id, "resolved")


@router.post("/{message_id}/dismiss", response_model=MessageRead)
async def dismiss_message(session: SessionDep, message_id: uuid.UUID) -> MessageRead:
    """Somebody read it and there was nothing to do."""
    return await _decide(session, message_id, "dismissed")
