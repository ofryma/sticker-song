"""The draft step, the admin queue, and thumbnails.

The property that matters here: nothing a contributor uploads is publicly readable
until a reviewer publishes it. Every read path is checked against that — the wall
listing, the entry, the image, the thumbnail, and duplicate suggestions.
"""

import pytest

from app import storage as storage_module
from tests import factories

pytestmark = pytest.mark.integration

SUBMITTER = "10.0.0.1"
STRANGER = "203.0.113.9"


async def submit(client, name: str = "Full Name", ip: str = SUBMITTER) -> dict:
    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(size=(1200, 900)), "image/jpeg")},
        data={"person_name": name, "sticker_text": "sticker text"},
        headers={"x-forwarded-for": ip},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def sign_in(client, credentials: dict[str, str]) -> dict[str, str]:
    response = await client.post("/admin/login", json=credentials)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


# --- the draft step ----------------------------------------------------------


async def test_a_submission_starts_as_a_draft(client, review_required) -> None:
    body = await submit(client)

    assert body["awaiting_review"] is True


async def test_a_draft_is_not_on_the_wall(client, review_required) -> None:
    await submit(client)

    listed = (await client.get("/entries")).json()

    assert listed == []


async def test_a_stranger_cannot_read_a_draft(client, review_required) -> None:
    entry = (await submit(client))["entry"]
    stranger = {"x-forwarded-for": STRANGER}

    for path in ("", "/image", "/thumb"):
        response = await client.get(f"/entries/{entry['id']}{path}", headers=stranger)
        assert response.status_code == 404, path


async def test_the_submitter_still_sees_their_own_draft(client, review_required) -> None:
    """The thank-you screen shows the contributor the entry they just added."""
    entry = (await submit(client))["entry"]
    mine = {"x-forwarded-for": SUBMITTER}

    assert (await client.get(f"/entries/{entry['id']}", headers=mine)).status_code == 200
    assert (
        await client.get(f"/entries/{entry['id']}/image", headers=mine)
    ).status_code == 200


async def test_a_draft_is_never_suggested_as_a_duplicate(client, review_required) -> None:
    await submit(client, "Full Name", ip="10.0.0.7")

    second = await submit(client, "Full Name", ip=SUBMITTER)

    assert second["possible_duplicates"] == []


async def test_a_draft_cannot_be_voted_for(client, review_required) -> None:
    entry = (await submit(client))["entry"]

    response = await client.post(
        f"/entries/{entry['id']}/feedback", headers={"x-forwarded-for": STRANGER}
    )

    assert response.status_code == 409


# --- review decisions --------------------------------------------------------


async def test_publishing_puts_the_entry_on_the_wall(
    client, review_required, admin_credentials
) -> None:
    entry = (await submit(client))["entry"]
    headers = await sign_in(client, admin_credentials)

    published = await client.post(
        f"/admin/entries/{entry['id']}/publish", headers=headers
    )

    assert published.status_code == 200
    assert published.json()["status"] == "published"
    listed = (await client.get("/entries")).json()
    assert [row["id"] for row in listed] == [entry["id"]]


async def test_rejecting_keeps_the_row_but_not_the_wall(
    client, review_required, admin_credentials
) -> None:
    entry = (await submit(client))["entry"]
    headers = await sign_in(client, admin_credentials)

    rejected = await client.post(
        f"/admin/entries/{entry['id']}/reject",
        headers=headers,
        json={"note": "not a memorial sticker"},
    )

    assert rejected.status_code == 200
    body = rejected.json()
    assert body["status"] == "rejected"
    assert body["review_note"] == "not a memorial sticker"
    assert (await client.get("/entries")).json() == []


async def test_the_queue_lists_pending_entries_only(
    client, review_required, admin_credentials
) -> None:
    waiting = (await submit(client, "Waiting Name"))["entry"]
    published = (await submit(client, "Published Name", ip="10.0.0.8"))["entry"]
    headers = await sign_in(client, admin_credentials)
    await client.post(f"/admin/entries/{published['id']}/publish", headers=headers)

    queue = await client.get("/admin/entries", headers=headers)

    assert [row["id"] for row in queue.json()] == [waiting["id"]]
    counts = (await client.get("/admin/entries/counts", headers=headers)).json()
    assert counts == {"pending": 1, "published": 1, "rejected": 0}


async def test_a_reviewer_reads_a_drafts_image(
    client, review_required, admin_credentials
) -> None:
    entry = (await submit(client))["entry"]
    headers = await sign_in(client, admin_credentials)

    response = await client.get(f"/admin/entries/{entry['id']}/image", headers=headers)

    assert response.status_code == 200
    assert response.headers["cache-control"].startswith("public, max-age=")


async def test_deleting_removes_the_row_and_both_objects(
    client, review_required, admin_credentials, storage
) -> None:
    entry = (await submit(client))["entry"]
    headers = await sign_in(client, admin_credentials)

    response = await client.delete(f"/admin/entries/{entry['id']}", headers=headers)

    assert response.status_code == 204
    key = entry["image_object_key"]
    assert sorted(storage.deleted) == sorted([key, storage_module.build_thumb_key(key)])
    assert (await client.get("/admin/entries/counts", headers=headers)).json()[
        "pending"
    ] == 0


# --- the LLM note ------------------------------------------------------------


async def test_a_draft_carries_the_models_note(
    client, review_required, admin_credentials, monkeypatch
) -> None:
    """The verdict is written onto the draft, where the reviewer sees it."""
    from app import review as review_module
    from app.routers import entries as entries_module

    async def fake_analyze(person_name: str, sticker_text: str):
        assert person_name == "Full Name"
        assert sticker_text == "sticker text"
        return review_module.Analysis(verdict="flag", reason="looks like a placeholder")

    monkeypatch.setattr(entries_module.review, "analyze", fake_analyze)

    entry = (await submit(client))["entry"]

    headers = await sign_in(client, admin_credentials)
    reviewed = (await client.get(f"/admin/entries/{entry['id']}", headers=headers)).json()
    assert reviewed["llm_verdict"] == "flag"
    assert reviewed["llm_reason"] == "looks like a placeholder"
    assert reviewed["llm_checked_at"] is not None
    # Advisory only: the entry is still a draft, waiting for a person.
    assert reviewed["status"] == "pending"


async def test_a_failing_model_does_not_cost_the_submission(
    client, review_required, admin_credentials, monkeypatch
) -> None:
    async def exploding_analyze(person_name: str, sticker_text: str):
        raise RuntimeError("the API is down")

    monkeypatch.setattr("app.review.analyze", exploding_analyze, raising=True)

    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "sticker text"},
        headers={"x-forwarded-for": SUBMITTER},
    )

    # The upload succeeded and the draft is in the queue, note or no note.
    assert response.status_code == 201
    headers = await sign_in(client, admin_credentials)
    queue = (await client.get("/admin/entries", headers=headers)).json()
    assert [row["llm_verdict"] for row in queue] == [None]


async def test_no_api_key_means_no_note(client, review_required, monkeypatch) -> None:
    from app import review as review_module
    from app.config import settings

    monkeypatch.setattr(settings, "anthropic_api_key", "")

    assert await review_module.analyze("Full Name", "sticker text") is None


# --- admin authentication ----------------------------------------------------


async def test_the_queue_refuses_an_anonymous_caller(client, admin_credentials) -> None:
    assert (await client.get("/admin/entries")).status_code == 401


async def test_the_wrong_password_does_not_sign_in(client, admin_credentials) -> None:
    response = await client.post(
        "/admin/login", json={"username": "reviewer", "password": "wrong"}
    )

    assert response.status_code == 401


async def test_the_static_token_still_works(client, admin_credentials) -> None:
    """Scripts and curl keep using X-Admin-Token."""
    response = await client.get(
        "/admin/entries", headers={"X-Admin-Token": "test-admin-token"}
    )

    assert response.status_code == 200


async def test_a_token_query_parameter_authorizes_an_image_tag(
    client, review_required, admin_credentials
) -> None:
    """An <img> cannot send a header, so the review page passes the token in the URL."""
    entry = (await submit(client))["entry"]
    signed_in = await sign_in(client, admin_credentials)
    token = signed_in["Authorization"].removeprefix("Bearer ")

    response = await client.get(f"/admin/entries/{entry['id']}/thumb?token={token}")

    assert response.status_code == 200


async def test_a_forged_session_token_is_rejected(client, admin_credentials) -> None:
    response = await client.get("/admin/entries?token=99999999999.deadbeef")

    assert response.status_code == 401


async def test_admin_is_disabled_without_credentials(client, monkeypatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "admin_token", "")
    monkeypatch.setattr(settings, "admin_username", "")
    monkeypatch.setattr(settings, "admin_password", "")

    assert (await client.get("/admin/entries")).status_code == 503


# --- thumbnails --------------------------------------------------------------


async def test_a_thumbnail_is_stored_and_smaller_than_the_image(client, storage) -> None:
    entry = (await submit(client))["entry"]
    thumb_key = storage_module.build_thumb_key(entry["image_object_key"])

    assert thumb_key in storage.objects
    full_bytes, _ = storage.objects[entry["image_object_key"]]
    thumb_bytes, _ = storage.objects[thumb_key]
    assert len(thumb_bytes) < len(full_bytes)


async def test_the_thumb_route_serves_the_thumbnail(client, storage) -> None:
    entry = (await submit(client))["entry"]
    thumb_key = storage_module.build_thumb_key(entry["image_object_key"])

    response = await client.get(f"/entries/{entry['id']}/thumb")

    assert response.status_code == 200
    assert response.content == storage.objects[thumb_key][0]


async def test_the_thumb_route_falls_back_to_the_full_image(
    client, session, storage
) -> None:
    """Entries written before thumbnails existed have no thumb key."""
    from app.models import MemorialEntry

    entry = (await submit(client))["entry"]
    row = await session.get(MemorialEntry, entry["id"])
    row.thumb_object_key = None
    await session.commit()

    response = await client.get(f"/entries/{entry['id']}/thumb")

    assert response.status_code == 200
    assert response.content == storage.objects[entry["image_object_key"]][0]


async def test_the_entry_exposes_a_thumb_url(client) -> None:
    entry = (await submit(client))["entry"]

    assert entry["thumb_url"] == f"/entries/{entry['id']}/thumb"
