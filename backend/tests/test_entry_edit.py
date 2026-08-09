"""Correcting an entry from the review page.

A misread name or a mistyped word is the commonest thing wrong with a
submission, and holding the whole entry back over it loses the person rather
than the mistake. These tests pin what a correction may touch, what it leaves
alone, and what happens to the photograph it replaces.
"""

import uuid

import pytest

from app.models import MemorialEntry
from app.names import normalize_person_name
from tests import factories

pytestmark = pytest.mark.integration


async def sign_in(client, credentials: dict[str, str]) -> dict[str, str]:
    response = await client.post("/admin/login", json=credentials)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


@pytest.fixture
async def headers(client, admin_credentials):
    return await sign_in(client, admin_credentials)


async def make(session, **over) -> MemorialEntry:
    name = over.pop("person_name", "Some Name")
    entry = MemorialEntry(
        id=uuid.uuid4(),
        status=over.pop("status", "pending"),
        person_name=name,
        person_name_normalized=normalize_person_name(name),
        sticker_text=over.pop("sticker_text", "words from the sticker"),
        image_object_key=over.pop("image_object_key", "kept.webp"),
        **over,
    )
    session.add(entry)
    await session.commit()
    return entry


async def edit(client, headers, entry_id, patch) -> dict:
    response = await client.patch(
        f"/admin/entries/{entry_id}", headers=headers, json=patch
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_corrects_the_name_and_the_words(client, headers, session):
    entry = await make(session, person_name="Sme  Name")

    edited = await edit(
        client,
        headers,
        entry.id,
        {"person_name": "Some Name", "sticker_text": "what it really says"},
    )

    assert edited["person_name"] == "Some Name"
    assert edited["sticker_text"] == "what it really says"


async def test_name_correction_refiles_the_entry(client, headers, session):
    """The grouping key follows the name, or a corrected spelling leaves the
    entry filed under the wrong person for duplicate detection."""
    entry = await make(session, person_name="Wrong Spelling")

    await edit(client, headers, entry.id, {"person_name": "Right  Spelling"})

    await session.refresh(entry)
    # Tidied for display, folded for grouping.
    assert entry.person_name == "Right Spelling"
    assert entry.person_name_normalized == "right spelling"


async def test_leaves_untouched_fields_alone(client, headers, session):
    """A form that touched a name cannot quietly blank a location it never
    showed: only the keys actually sent are written."""
    entry = await make(session, latitude=32.08, longitude=34.78)

    edited = await edit(client, headers, entry.id, {"person_name": "Another Name"})

    assert edited["latitude"] == 32.08
    assert edited["longitude"] == 34.78
    assert edited["sticker_text"] == "words from the sticker"


async def test_clears_a_location_that_is_sent_as_null(client, headers, session):
    entry = await make(session, latitude=32.08, longitude=34.78)

    edited = await edit(client, headers, entry.id, {"latitude": None, "longitude": None})

    assert edited["latitude"] is None
    assert edited["longitude"] is None


async def test_keeps_the_note_and_the_status(client, headers, session):
    """Editing is not deciding: a published entry stays on the wall."""
    entry = await make(session, status="published")

    edited = await edit(client, headers, entry.id, {"review_note": "  name corrected "})

    assert edited["review_note"] == "name corrected"
    assert edited["status"] == "published"


@pytest.mark.parametrize(
    "patch",
    [
        {"person_name": ""},
        {"person_name": "   "},
        {"sticker_text": "  "},
        {"latitude": 950},
        {"longitude": -400},
        {"status": "published"},  # deciding is not editing
    ],
)
async def test_refuses_what_an_entry_cannot_be(client, headers, session, patch):
    entry = await make(session)

    response = await client.patch(
        f"/admin/entries/{entry.id}", headers=headers, json=patch
    )

    assert response.status_code == 422, response.text


async def test_editing_needs_the_credential(client, session, admin_credentials):
    entry = await make(session)

    response = await client.patch(
        f"/admin/entries/{entry.id}", json={"person_name": "Anyone At All"}
    )

    assert response.status_code == 401


async def test_missing_entry_is_a_404(client, headers):
    response = await client.patch(
        f"/admin/entries/{uuid.uuid4()}", headers=headers, json={"person_name": "X Y"}
    )

    assert response.status_code == 404


# --- the photograph ----------------------------------------------------------


async def replace(client, headers, entry_id, data: bytes):
    return await client.put(
        f"/admin/entries/{entry_id}/image",
        headers=headers,
        files={"image": ("straightened.jpg", data, "image/jpeg")},
    )


async def test_replaces_the_photograph_and_destroys_the_old_one(
    client, headers, session, storage
):
    """The one it replaces goes only once the row points at the new one."""
    created = await client.post(
        "/entries",
        data={"person_name": "Some Name", "sticker_text": "words"},
        files={"image": ("first.jpg", factories.jpeg(size=(40, 20)), "image/jpeg")},
    )
    assert created.status_code == 201, created.text
    entry_id = created.json()["entry"]["id"]
    before = set(storage.objects)

    response = await replace(client, headers, entry_id, factories.jpeg(size=(80, 60)))

    assert response.status_code == 200, response.text
    body = response.json()
    # The replacement is re-encoded exactly as a submission is, so the recorded
    # size is the stored image's rather than the file that was handed over.
    assert (body["image_width"], body["image_height"]) == (80, 60)
    assert body["image_bytes"] > 0
    # Old objects destroyed, new ones in the bucket.
    assert before & set(storage.objects) == set()
    assert set(before).issubset(set(storage.deleted))
    assert len(storage.objects) == 2  # the image and its thumbnail


async def test_a_replacement_that_is_not_an_image_changes_nothing(
    client, headers, session, storage
):
    entry = await make(session, image_object_key="kept.webp")
    storage.objects["kept.webp"] = (b"pretend", "image/webp")

    response = await replace(client, headers, entry.id, factories.not_an_image())

    assert response.status_code == 400
    await session.refresh(entry)
    assert entry.image_object_key == "kept.webp"
    assert "kept.webp" not in storage.deleted


async def test_replacing_needs_the_credential(client, session, admin_credentials):
    entry = await make(session)

    response = await client.put(
        f"/admin/entries/{entry.id}/image",
        files={"image": ("x.jpg", factories.jpeg(), "image/jpeg")},
    )

    assert response.status_code == 401
