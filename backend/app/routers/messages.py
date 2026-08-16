"""Contact: the one way a visitor can write to whoever keeps the archive.

Distinct from `entries.submit_feedback`, which is a vote on which photograph is
the best one for a person and answers exactly that question. This is prose: a
suggestion, something broken, a wrong name, or a family asking for a sticker to
come down. It is unauthenticated and public, so it carries the same guards as a
submission — the IP blacklist, a cap on every field, and the IP recorded through
`TRUST_PROXY_HEADERS`.
"""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, status

from app import notify
from app.blacklist import AllowedIpDep
from app.db import SessionDep
from app.models import ContactMessage
from app.routers.entries import _get_visible_or_404
from app.schemas import MessageAccepted, MessageCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageAccepted, status_code=status.HTTP_201_CREATED)
async def create_message(
    session: SessionDep,
    client_ip: AllowedIpDep,
    payload: MessageCreate,
    background: BackgroundTasks,
) -> MessageAccepted:
    """Take a message and keep it for an admin to read.

    Spam is held off by three cheap things rather than a third-party captcha: the
    rate limit at the edge, the honeypot below, and a minimum body length. A
    captcha would be another dependency and would hand a visitor's IP to somebody
    else, which is a poor trade for a form this quiet.
    """
    if payload.website.strip():
        # The honeypot caught it. Answer exactly as if it had worked: a script
        # told it failed is a script that gets fixed.
        logger.info("contact honeypot tripped from %s", client_ip)
        return MessageAccepted(id=uuid.uuid4(), kind=payload.kind)

    entry_id = None
    if payload.entry_id is not None:
        # 404s for a draft somebody else wrote, so this field cannot be used to
        # find out which ids exist.
        entry = await _get_visible_or_404(session, payload.entry_id, client_ip)
        entry_id = entry.id

    message = ContactMessage(
        kind=payload.kind,
        body=payload.body.strip(),
        entry_id=entry_id,
        reply_email=payload.reply_email,
        submitter_ip=client_ip,
        status="open",
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    logger.info("contact message %s (%s) entry=%s", message.id, message.kind, entry_id)

    # After the response, so an unreachable Telegram costs the visitor nothing.
    # Honeypot submissions never reach here — the channel is for people.
    background.add_task(
        notify.new_message,
        message.id,
        message.kind,
        message.body,
        message.reply_email,
        entry_id,
    )
    return MessageAccepted(id=message.id, kind=message.kind)
