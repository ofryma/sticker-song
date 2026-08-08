"""Contact messages: the public form and the admin list behind it.

The form is unauthenticated, so most of what is covered here is what it refuses:
a body too short to be a message, a shape that cannot be an email address, a
banned IP, an entry id belonging to somebody else's draft, and a bot that filled
in the honeypot. The rest is that an admin can find what arrived and decide it.
"""

import pytest
from sqlalchemy import func, select

from app.models import ContactMessage
from tests.test_duplicates import submit

pytestmark = pytest.mark.integration

BODY = "The name on this sticker is spelled wrong, it should be with a yod."
SENDER_IP = "198.51.100.42"


async def send(client, ip: str = SENDER_IP, **payload):
    """Post a message with sane defaults; the caller overrides what it is testing."""
    body = {"kind": "suggestion", "body": BODY, **payload}
    return await client.post("/messages", json=body, headers={"x-forwarded-for": ip})


async def sign_in(client, credentials: dict[str, str]) -> dict[str, str]:
    response = await client.post("/admin/login", json=credentials)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


@pytest.fixture
async def headers(client, admin_credentials):
    return await sign_in(client, admin_credentials)


# --- sending -----------------------------------------------------------------


@pytest.mark.parametrize("kind", ["suggestion", "bug", "entry_problem"])
async def test_every_kind_is_accepted(client, session, kind: str) -> None:
    response = await send(client, kind=kind)

    assert response.status_code == 201, response.text
    assert response.json()["kind"] == kind
    stored = await session.scalar(select(ContactMessage))
    assert stored.body == BODY
    assert stored.status == "open"


async def test_the_submitter_ip_is_recorded(client, session) -> None:
    await send(client, ip="203.0.113.19")

    assert await session.scalar(select(ContactMessage.submitter_ip)) == "203.0.113.19"


async def test_the_leftmost_forwarded_ip_is_the_one_recorded(client, session) -> None:
    """X-Forwarded-For accumulates hops; the visitor is the first entry."""
    await send(client, ip="203.0.113.19, 10.0.0.1, 10.0.0.2")

    assert await session.scalar(select(ContactMessage.submitter_ip)) == "203.0.113.19"


async def test_a_body_is_trimmed(client, session) -> None:
    await send(client, body=f"   {BODY}   ")

    assert await session.scalar(select(ContactMessage.body)) == BODY


async def test_a_too_short_body_is_refused(client) -> None:
    """The minimum length is real validation, and the page says so up front."""
    response = await send(client, body="hi")

    assert response.status_code == 422


async def test_a_too_long_body_is_refused(client) -> None:
    response = await send(client, body="x" * 4001)

    assert response.status_code == 422


async def test_an_unknown_kind_is_refused(client) -> None:
    response = await send(client, kind="complaint")

    assert response.status_code == 422


# --- the reply address -------------------------------------------------------


async def test_an_email_is_kept_when_given(client, session) -> None:
    await send(client, reply_email="someone@example.org")

    assert (
        await session.scalar(select(ContactMessage.reply_email)) == "someone@example.org"
    )


@pytest.mark.parametrize("blank", [None, "", "   "])
async def test_a_blank_email_is_stored_as_nothing(client, session, blank) -> None:
    """Optional means optional: an untouched field is not an empty string in the
    database, so a retention sweep has one thing to look for and not two."""
    response = await send(client, reply_email=blank)

    assert response.status_code == 201, response.text
    assert await session.scalar(select(ContactMessage.reply_email)) is None


@pytest.mark.parametrize(
    "address", ["not-an-address", "no@domain", "@example.org", "a@b."]
)
async def test_a_malformed_email_is_refused(client, address: str) -> None:
    response = await send(client, reply_email=address)

    assert response.status_code == 422


async def test_an_overlong_email_is_refused(client) -> None:
    response = await send(client, reply_email="a" * 250 + "@example.org")

    assert response.status_code == 422


# --- spam --------------------------------------------------------------------


async def test_the_honeypot_is_thanked_and_dropped(client, session) -> None:
    """A bot that is told it failed is a bot that gets fixed, so it gets the same
    201 a person gets — and nothing is written."""
    response = await send(client, website="http://example.com/cheap-things")

    assert response.status_code == 201
    assert await session.scalar(select(func.count(ContactMessage.id))) == 0


async def test_a_blacklisted_ip_cannot_send(client, headers) -> None:
    banned = "203.0.113.7"
    ban = await client.post(
        "/admin/blacklist",
        json={"ip": banned, "reason": "repeated abuse"},
        headers=headers,
    )
    assert ban.status_code == 201, ban.text

    response = await send(client, ip=banned)

    assert response.status_code == 403
    assert "repeated abuse" in response.json()["detail"]


# --- the linked sticker ------------------------------------------------------


async def test_an_entry_can_be_named(client, session) -> None:
    entry = (await submit(client, "Full Name"))["entry"]

    response = await send(client, kind="entry_problem", entry_id=entry["id"])

    assert response.status_code == 201, response.text
    stored = await session.scalar(select(ContactMessage.entry_id))
    assert str(stored) == entry["id"]


async def test_an_unknown_entry_is_refused(client) -> None:
    response = await send(
        client, kind="entry_problem", entry_id="00000000-0000-0000-0000-000000000001"
    )

    assert response.status_code == 404


async def test_somebody_elses_draft_is_not_visible(client, review_required) -> None:
    """The field must not become a way to find out which drafts exist."""
    entry = (await submit(client, "Full Name", ip="10.0.0.1"))["entry"]

    response = await send(client, ip="10.0.0.2", entry_id=entry["id"])

    assert response.status_code == 404


async def test_a_message_outlives_the_entry_it_named(client, session, headers) -> None:
    """The likeliest reason an entry is gone is that this message asked for it."""
    entry = (await submit(client, "Full Name"))["entry"]
    await send(client, kind="entry_problem", entry_id=entry["id"])

    removed = await client.delete(f"/admin/entries/{entry['id']}", headers=headers)
    assert removed.status_code == 204

    message = await session.scalar(select(ContactMessage))
    assert message is not None
    assert message.entry_id is None


# --- the admin list ----------------------------------------------------------


async def test_the_list_needs_a_credential(client, admin_credentials) -> None:
    """What a visitor wrote is not public. With credentials configured and none
    presented, that is a 401 — an unconfigured admin gives 503 instead, which
    `test_blacklist.py` covers."""
    response = await client.get("/admin/messages")

    assert response.status_code == 401


async def test_the_list_shows_what_arrived(client, headers) -> None:
    entry = (await submit(client, "Full Name"))["entry"]
    await send(client, kind="entry_problem", entry_id=entry["id"], reply_email="a@b.org")

    page = (await client.get("/admin/messages", headers=headers)).json()

    assert page["total"] == 1
    (item,) = page["items"]
    assert item["kind"] == "entry_problem"
    assert item["body"] == BODY
    assert item["entry_person_name"] == "Full Name"
    assert item["has_reply_email"] is True
    # Neither of these belongs in a browser.
    assert "reply_email" not in item
    assert "submitter_ip" not in item


async def test_the_list_filters_by_kind_and_searches_the_body(client, headers) -> None:
    await send(client, kind="bug", body="The wall does not load on my phone at all.")
    await send(client, kind="suggestion", body="You could add a map of where each is.")

    by_kind = (await client.get("/admin/messages?kind=bug", headers=headers)).json()
    by_text = (await client.get("/admin/messages?q=map", headers=headers)).json()

    assert by_kind["total"] == 1
    assert by_kind["items"][0]["kind"] == "bug"
    assert by_text["total"] == 1
    assert "map" in by_text["items"][0]["body"]


async def test_the_total_counts_the_filter_and_not_the_page(client, headers) -> None:
    for index in range(3):
        await send(client, body=f"{BODY} number {index}")

    page = (await client.get("/admin/messages?limit=1", headers=headers)).json()

    assert page["total"] == 3
    assert len(page["items"]) == 1


async def test_the_counts_match_the_rows(client, headers) -> None:
    await send(client)
    second = (await send(client)).json()
    await client.post(f"/admin/messages/{second['id']}/resolve", headers=headers)

    counts = (await client.get("/admin/messages/counts", headers=headers)).json()

    assert counts == {"open": 1, "resolved": 1, "dismissed": 0}


# --- deciding ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("action", "expected"), [("resolve", "resolved"), ("dismiss", "dismissed")]
)
async def test_deciding_records_who_and_when(client, headers, action, expected) -> None:
    message = (await send(client)).json()

    response = await client.post(
        f"/admin/messages/{message['id']}/{action}", headers=headers
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == expected
    assert body["resolved_by"] == "admin"
    assert body["resolved_at"] is not None


async def test_a_decided_message_leaves_the_default_view(client, headers) -> None:
    message = (await send(client)).json()
    await client.post(f"/admin/messages/{message['id']}/resolve", headers=headers)

    default = (await client.get("/admin/messages", headers=headers)).json()
    resolved = (
        await client.get("/admin/messages?status=resolved", headers=headers)
    ).json()

    assert default["total"] == 0
    assert resolved["total"] == 1


async def test_deciding_twice_is_not_an_error(client, headers) -> None:
    """A reviewer clicking resolve on something already resolved has made no
    mistake worth an error page."""
    message = (await send(client)).json()

    first = await client.post(f"/admin/messages/{message['id']}/resolve", headers=headers)
    second = await client.post(
        f"/admin/messages/{message['id']}/dismiss", headers=headers
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "dismissed"


async def test_deciding_a_message_that_is_not_there(client, headers) -> None:
    response = await client.post(
        "/admin/messages/00000000-0000-0000-0000-000000000001/resolve", headers=headers
    )

    assert response.status_code == 404
