"""IP blacklist: the admin API, and the block it puts on writes.

The blacklist is the only moderation tool the MVP has, so both halves are
covered — that `/admin` is unreachable without the token, and that a banned IP is
refused on every write while reads stay open.
"""

import pytest

from app.config import settings
from tests import factories
from tests.test_duplicates import submit

pytestmark = pytest.mark.integration

TOKEN = "test-admin-token"
BANNED_IP = "203.0.113.7"


@pytest.fixture(autouse=True)
def _admin_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "admin_token", TOKEN)


def auth() -> dict[str, str]:
    return {"x-admin-token": TOKEN}


async def ban(client, ip: str = BANNED_IP, reason: str = "spam") -> None:
    response = await client.post(
        "/admin/blacklist", json={"ip": ip, "reason": reason}, headers=auth()
    )
    assert response.status_code == 201, response.text


# --- the admin gate ----------------------------------------------------------


async def test_admin_needs_a_token(client) -> None:
    response = await client.get("/admin/blacklist")

    assert response.status_code == 401


async def test_a_wrong_token_is_rejected(client) -> None:
    response = await client.get(
        "/admin/blacklist", headers={"x-admin-token": "not-the-token"}
    )

    assert response.status_code == 401


async def test_admin_is_disabled_when_no_token_is_configured(client, monkeypatch) -> None:
    """An unset ADMIN_TOKEN must not degrade into an open admin API."""
    monkeypatch.setattr(settings, "admin_token", "")

    response = await client.get("/admin/blacklist", headers=auth())

    assert response.status_code == 503


# --- managing the list -------------------------------------------------------


async def test_banning_then_listing(client) -> None:
    await ban(client, reason="repeated abuse")

    response = await client.get("/admin/blacklist", headers=auth())

    assert response.status_code == 200
    assert [(row["ip"], row["reason"]) for row in response.json()] == [
        (BANNED_IP, "repeated abuse")
    ]


async def test_banning_twice_updates_the_reason(client) -> None:
    await ban(client, reason="first reason")
    await ban(client, reason="second reason")

    rows = (await client.get("/admin/blacklist", headers=auth())).json()

    assert len(rows) == 1
    assert rows[0]["reason"] == "second reason"


async def test_a_malformed_ip_is_rejected(client) -> None:
    response = await client.post(
        "/admin/blacklist", json={"ip": "not-an-ip", "reason": "x"}, headers=auth()
    )

    assert response.status_code == 422


async def test_an_empty_reason_is_rejected(client) -> None:
    response = await client.post(
        "/admin/blacklist", json={"ip": BANNED_IP, "reason": ""}, headers=auth()
    )

    assert response.status_code == 422


async def test_unbanning(client) -> None:
    await ban(client)

    removed = await client.delete(f"/admin/blacklist/{BANNED_IP}", headers=auth())

    assert removed.status_code == 204
    assert (await client.get("/admin/blacklist", headers=auth())).json() == []


async def test_unbanning_an_ip_that_was_never_banned_404s(client) -> None:
    response = await client.delete("/admin/blacklist/198.51.100.1", headers=auth())

    assert response.status_code == 404


# --- the block on writes -----------------------------------------------------


async def test_a_banned_ip_cannot_submit(client, storage) -> None:
    await ban(client, reason="repeated abuse")

    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "text"},
        headers={"x-forwarded-for": BANNED_IP},
    )

    assert response.status_code == 403
    assert "repeated abuse" in response.json()["detail"]
    # Refused before anything touched the bucket.
    assert storage.objects == {}


async def test_a_banned_ip_cannot_vote(client) -> None:
    entry = (await submit(client, "Full Name"))["entry"]
    await ban(client)

    response = await client.post(
        f"/entries/{entry['id']}/feedback", headers={"x-forwarded-for": BANNED_IP}
    )

    assert response.status_code == 403


async def test_a_banned_ip_can_still_read(client) -> None:
    entry = (await submit(client, "Full Name"))["entry"]
    await ban(client)
    banned = {"x-forwarded-for": BANNED_IP}

    assert (await client.get("/entries", headers=banned)).status_code == 200
    assert (
        await client.get(f"/entries/{entry['id']}", headers=banned)
    ).status_code == 200
    assert (
        await client.get(f"/entries/{entry['id']}/image", headers=banned)
    ).status_code == 200


async def test_banning_one_ip_does_not_block_another(client) -> None:
    await ban(client)

    body = await submit(client, "Full Name", ip="198.51.100.55")

    assert body["entry"]["id"]


async def test_the_leftmost_forwarded_ip_is_the_one_matched(client) -> None:
    """X-Forwarded-For accumulates hops; the client is the first entry."""
    await ban(client)

    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "text"},
        headers={"x-forwarded-for": f"{BANNED_IP}, 10.0.0.1, 10.0.0.2"},
    )

    assert response.status_code == 403


async def test_the_submitter_ip_is_recorded(client, session) -> None:
    from sqlalchemy import select

    from app.models import MemorialEntry

    await submit(client, "Full Name", ip="198.51.100.99")

    stored = await session.scalar(select(MemorialEntry.submitter_ip))
    assert stored == "198.51.100.99"
