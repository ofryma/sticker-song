"""Telegram notifications for the people who look after the archive.

One channel carries the operational news: a submission has arrived and is waiting
for a reviewer. Deploys and reachability are announced by CI, which talks to the
same channel over the same bot without going through this process.

Everything here is **best effort**. A contributor's upload must never fail, or
even slow down, because Telegram was unreachable — so nothing raises, every call
is made after the response has gone out, and a failure is a log line.

With no ``TELEGRAM_BOT_TOKEN``/``TELEGRAM_CHAT_ID`` the whole module is inert.
"""

import html
import logging
import uuid

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

API_ROOT = "https://api.telegram.org"
TIMEOUT = httpx.Timeout(10.0)
# Telegram refuses a message over 4096 characters. Sticker text is the only
# unbounded field, so it is what gets trimmed, well short of the real ceiling.
MAX_TEXT = 700


def _trim(value: str, limit: int) -> str:
    value = " ".join(value.split())
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _client() -> httpx.AsyncClient:
    """The client one message is sent with. A seam the tests replace."""
    return httpx.AsyncClient(timeout=TIMEOUT)


async def send(text: str, buttons: list[tuple[str, str]] | None = None) -> bool:
    """Post one HTML message to the channel. Never raises; returns whether it landed.

    `buttons` is (label, url) pairs, laid out as one row under the message.
    """
    if not settings.telegram_enabled:
        return False

    url = f"{API_ROOT}/bot{settings.telegram_bot_token}/sendMessage"
    payload: dict = {
        "chat_id": settings.telegram_chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if buttons:
        payload["reply_markup"] = {
            "inline_keyboard": [[{"text": label, "url": link} for label, link in buttons]]
        }
    try:
        async with _client() as client:
            response = await client.post(url, json=payload)
        if response.status_code != 200:
            # The body says which of the two settings is wrong — a bad token, or a
            # chat the bot was never added to — so it is worth having in the log.
            logger.warning(
                "telegram sendMessage %s: %s", response.status_code, response.text[:300]
            )
            return False
    except Exception as exc:  # noqa: BLE001 - notification only, already responded
        logger.warning("telegram send failed: %s: %s", type(exc).__name__, exc)
        return False
    return True


def _admin_url() -> str:
    """Where the reviewer goes. Empty when PUBLIC_URL is not configured."""
    if not settings.public_url:
        return ""
    return f"{settings.public_url.rstrip('/')}/admin"


async def new_entry(entry_id: uuid.UUID, person_name: str, sticker_text: str) -> None:
    """Announce a submission that is waiting for a reviewer.

    The one thing this channel is for: something needs a person. An entry that is
    published the moment it arrives needs nobody, and is announced by nothing —
    see the call site in `routers/entries.py`.

    Deliberately text only: the photograph has not been looked at by anyone yet,
    and an unreviewed image does not go into a phone's notification tray. The name
    and the transcription are what tell a reviewer whether this needs them now.
    """
    # The glyph, so the channel can be read at a glance without it being read as a
    # flourish. The deploy and uptime messages carry their own, in the workflows.
    body = (
        "<b>📥 New submission — waiting for review</b>\n\n"
        f"<b>{html.escape(_trim(person_name, 120))}</b>\n"
        f"{html.escape(_trim(sticker_text, MAX_TEXT))}"
    )

    # A tap target rather than a line of link text — the reviewer is on a phone.
    # Telegram only accepts an https button, and refuses the whole message if the
    # url is anything else, so a development PUBLIC_URL of http://localhost falls
    # back to a plain link instead of costing the notification.
    admin = _admin_url()
    buttons = [("Review", admin)] if admin.startswith("https://") else None
    if admin and buttons is None:
        body += f'\n\n<a href="{html.escape(admin, quote=True)}">Review</a>'

    if await send(body, buttons):
        logger.info("telegram: announced entry %s", entry_id)
