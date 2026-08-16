"""The Telegram nudge that tells a reviewer a submission is waiting.

Two properties matter. The message must never carry the photograph or break on a
name with an angle bracket in it, and — far more important — a Telegram that is
misconfigured, slow or down must cost a contributor nothing at all.
"""

import json
import uuid

import httpx
import pytest

from app import notify
from app.config import settings
from tests import factories

ENTRY_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")


def _serve(monkeypatch, handler) -> None:
    """Answer notify's requests with `handler`, over a real httpx client."""
    monkeypatch.setattr(
        notify,
        "_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


def _configure(monkeypatch, public_url: str = "https://stkrmem.example/") -> None:
    monkeypatch.setattr(settings, "telegram_bot_token", "123:abc")
    monkeypatch.setattr(settings, "telegram_chat_id", "-1001234567890")
    monkeypatch.setattr(settings, "public_url", public_url)


@pytest.fixture
def telegram(monkeypatch) -> list[dict]:
    """A configured channel, and the requests that reach it.

    A real httpx client over a mock transport, so the payload is encoded exactly
    the way Telegram would receive it.
    """
    _configure(monkeypatch)
    sent: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append({"url": str(request.url), **json.loads(request.content)})
        return httpx.Response(200, json={"ok": True})

    _serve(monkeypatch, handler)
    return sent


@pytest.fixture
def unreachable_telegram(monkeypatch) -> None:
    _configure(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("telegram is unreachable")

    _serve(monkeypatch, handler)


async def test_nothing_is_sent_without_a_channel(monkeypatch) -> None:
    monkeypatch.setattr(settings, "telegram_bot_token", "")
    monkeypatch.setattr(settings, "telegram_chat_id", "")

    assert await notify.send("hello") is False


async def test_half_a_configuration_is_no_configuration(monkeypatch) -> None:
    monkeypatch.setattr(settings, "telegram_bot_token", "123:abc")
    monkeypatch.setattr(settings, "telegram_chat_id", "")

    assert settings.telegram_enabled is False


async def test_a_new_entry_announces_the_name_and_the_text(telegram) -> None:
    await notify.new_entry(ENTRY_ID, "Full Name", "sticker text")

    (message,) = telegram
    assert message["chat_id"] == "-1001234567890"
    assert message["url"] == "https://api.telegram.org/bot123:abc/sendMessage"
    assert "Full Name" in message["text"]
    assert "sticker text" in message["text"]
    assert "waiting for review" in message["text"]


async def test_the_message_opens_with_its_glyph(telegram) -> None:
    """The channel is read at a glance, so the first character has to mean
    something: an inbox for the one thing here that needs a person."""
    await notify.new_entry(ENTRY_ID, "Full Name", "sticker text")

    assert telegram[0]["text"].startswith("<b>📥")


async def test_the_review_page_is_a_button(telegram) -> None:
    """A tap target, not a line of link text: the reviewer is on a phone."""
    await notify.new_entry(ENTRY_ID, "Full Name", "sticker text")

    (row,) = telegram[0]["reply_markup"]["inline_keyboard"]
    assert row == [{"text": "Review", "url": "https://stkrmem.example/admin"}]
    # The button carries the link, so the message body no longer needs one.
    assert "<a href" not in telegram[0]["text"]


async def test_no_public_url_means_no_button_and_no_link(telegram, monkeypatch) -> None:
    monkeypatch.setattr(settings, "public_url", "")

    await notify.new_entry(ENTRY_ID, "Full Name", "sticker text")

    assert "reply_markup" not in telegram[0]
    assert "<a href" not in telegram[0]["text"]


async def test_a_plain_http_url_falls_back_to_a_link(telegram, monkeypatch) -> None:
    """Telegram refuses a non-https button and rejects the whole message with it,
    so a development PUBLIC_URL must not be able to cost the notification."""
    monkeypatch.setattr(settings, "public_url", "http://localhost:5173")

    await notify.new_entry(ENTRY_ID, "Full Name", "sticker text")

    assert "reply_markup" not in telegram[0]
    assert '<a href="http://localhost:5173/admin">Review</a>' in telegram[0]["text"]


async def test_markup_in_a_submission_cannot_break_the_message(telegram) -> None:
    await notify.new_entry(ENTRY_ID, "<b>Name</b>", "text & <i>more</i>")

    text = telegram[0]["text"]
    assert "&lt;b&gt;Name&lt;/b&gt;" in text
    assert "text &amp; &lt;i&gt;more&lt;/i&gt;" in text


async def test_a_very_long_sticker_text_is_trimmed(telegram) -> None:
    await notify.new_entry(ENTRY_ID, "Full Name", "word " * 500)

    assert len(telegram[0]["text"]) < 4096


async def test_a_message_carries_what_somebody_wrote(telegram) -> None:
    await notify.new_message(ENTRY_ID, "suggestion", "the wall could hold more")

    (message,) = telegram
    assert message["text"].startswith("<b>✉️ New message — Suggestion</b>")
    assert "the wall could hold more" in message["text"]
    (row,) = message["reply_markup"]["inline_keyboard"]
    assert row == [{"text": "Read", "url": "https://stkrmem.example/admin"}]


async def test_a_message_says_whether_a_reply_is_possible(telegram) -> None:
    await notify.new_message(
        ENTRY_ID, "entry_problem", "that is my brother", reply_email="a@b.com"
    )

    text = telegram[0]["text"]
    assert "A problem with a sticker" in text
    assert "Reply to: a@b.com" in text


async def test_a_message_without_an_address_says_nothing_about_one(telegram) -> None:
    await notify.new_message(ENTRY_ID, "bug", "the page will not load")

    assert "Reply to" not in telegram[0]["text"]


async def test_markup_in_a_message_cannot_break_it(telegram) -> None:
    await notify.new_message(ENTRY_ID, "bug", "<b>x</b> & more")

    assert "&lt;b&gt;x&lt;/b&gt; &amp; more" in telegram[0]["text"]


async def test_a_very_long_message_is_trimmed(telegram) -> None:
    await notify.new_message(ENTRY_ID, "suggestion", "word " * 500)

    assert len(telegram[0]["text"]) < 4096


async def test_a_telegram_failure_is_swallowed(unreachable_telegram) -> None:
    assert await notify.send("hello") is False


async def test_a_rejected_message_is_swallowed(monkeypatch) -> None:
    """A wrong chat id: Telegram answers 400, and the caller hears about it calmly."""
    _configure(monkeypatch)
    _serve(
        monkeypatch,
        lambda request: httpx.Response(400, json={"description": "chat not found"}),
    )

    assert await notify.send("hello") is False


@pytest.mark.integration
async def test_a_draft_is_announced(client, review_required, telegram) -> None:
    await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "sticker text"},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert len(telegram) == 1
    assert "Full Name" in telegram[0]["text"]


@pytest.mark.integration
async def test_an_entry_published_on_arrival_is_not_announced(client, telegram) -> None:
    """With REQUIRE_REVIEW off nothing needs a person: the entry is already on the
    wall, and a reviewer sees their own decisions in the admin page as they make
    them. The channel is for what is waiting, so this is silence by design."""
    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "sticker text"},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert response.json()["awaiting_review"] is False
    assert telegram == []


@pytest.mark.integration
async def test_a_contact_message_is_announced(client, telegram) -> None:
    await client.post(
        "/messages",
        json={"kind": "bug", "body": "The wall does not load on my phone at all."},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    (message,) = telegram
    assert "Something broken" in message["text"]
    assert "The wall does not load on my phone" in message["text"]


@pytest.mark.integration
async def test_a_bot_that_trips_the_honeypot_announces_nothing(client, telegram) -> None:
    """Nothing was kept, so there is nothing for anyone to read: the channel stays
    for what a person actually wrote."""
    response = await client.post(
        "/messages",
        json={
            "kind": "bug",
            "body": "The wall does not load on my phone at all.",
            "website": "http://spam.example",
        },
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert response.status_code == 201
    assert telegram == []


@pytest.mark.integration
async def test_an_unreachable_telegram_does_not_cost_a_message(
    client, unreachable_telegram
) -> None:
    response = await client.post(
        "/messages",
        json={"kind": "suggestion", "body": "A thought about the archive itself."},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert response.status_code == 201


@pytest.mark.integration
async def test_an_unreachable_telegram_does_not_cost_the_submission(
    client, review_required, unreachable_telegram
) -> None:
    """The notification runs as a background task, after the response has gone out,
    so anything thrown here would surface as a phantom error on a request that
    already succeeded."""
    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "sticker text"},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert response.status_code == 201
