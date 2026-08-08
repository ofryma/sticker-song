"""Duplicate matching against a real Postgres.

The exact/fuzzy split is the safety property that matters: only exact normalized
name matches are ever deleted automatically, so the `is_exact_match` flag has to
be right. `similarity()` is pg_trgm, which is why this needs a real database.
"""

import pytest

from app.config import settings
from tests import factories

pytestmark = pytest.mark.integration


async def submit(
    client, name: str, text: str = "sticker text", ip: str = "10.0.0.1", **form
) -> dict:
    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.jpeg(), "image/jpeg")},
        data={"person_name": name, "sticker_text": text, **form},
        headers={"x-forwarded-for": ip},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_a_first_entry_has_no_duplicates(client) -> None:
    body = await submit(client, "Full Name")

    assert body["possible_duplicates"] == []
    assert body["suggested_best_id"] == body["entry"]["id"]


async def test_the_same_name_is_an_exact_match(client) -> None:
    first = await submit(client, "Full Name")
    second = await submit(client, "full   NAME")

    candidates = second["possible_duplicates"]
    assert [c["id"] for c in candidates] == [first["entry"]["id"]]
    assert candidates[0]["is_exact_match"] is True


async def test_a_different_name_is_not_a_duplicate(client) -> None:
    await submit(client, "Full Name")
    other = await submit(client, "Someone Entirely Different")

    assert other["possible_duplicates"] == []


async def test_a_near_name_is_a_fuzzy_match_not_an_exact_one(client) -> None:
    """The README's own example: worth surfacing, never worth deleting over."""
    first = await submit(client, "Yonatan Cohen")
    second = await submit(client, "Yonatn Cohen")

    candidates = second["possible_duplicates"]
    assert [c["id"] for c in candidates] == [first["entry"]["id"]]
    assert candidates[0]["is_exact_match"] is False


async def test_exact_matches_are_ordered_before_fuzzy_ones(client) -> None:
    fuzzy = await submit(client, "Yonatn Cohen")
    exact = await submit(client, "Yonatan Cohen")
    third = await submit(client, "yonatan cohen")

    candidates = third["possible_duplicates"]
    assert candidates[0]["id"] == exact["entry"]["id"]
    assert candidates[0]["is_exact_match"] is True
    assert fuzzy["entry"]["id"] in [c["id"] for c in candidates[1:]]


async def test_an_entry_is_never_its_own_duplicate(client) -> None:
    body = await submit(client, "Full Name")
    entry_id = body["entry"]["id"]

    response = await client.get(f"/entries/{entry_id}/duplicates")

    assert response.status_code == 200
    assert entry_id not in [c["id"] for c in response.json()["possible_duplicates"]]


async def test_similarity_threshold_is_respected(client, monkeypatch) -> None:
    await submit(client, "Yonatan Cohen")

    monkeypatch.setattr(settings, "name_similarity_threshold", 0.99)
    strict = await submit(client, "Yonatn Cohen")

    assert strict["possible_duplicates"] == []


async def test_duplicates_endpoint_404s_for_an_unknown_entry(client) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"

    response = await client.get(f"/entries/{unknown}/duplicates")

    assert response.status_code == 404


async def test_suggested_best_points_at_the_larger_image(client) -> None:
    small = await client.post(
        "/entries",
        files={"image": ("s.jpg", factories.jpeg(size=(20, 20)), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "text"},
        headers={"x-forwarded-for": "10.0.0.1"},
    )
    assert small.status_code == 201

    big = await client.post(
        "/entries",
        files={"image": ("b.jpg", factories.jpeg(size=(200, 200)), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "text"},
        headers={"x-forwarded-for": "10.0.0.2"},
    )
    assert big.status_code == 201
    body = big.json()

    assert body["suggested_best_id"] == body["entry"]["id"]

    # And from the small entry's point of view, the big one is still the best.
    view = await client.get(f"/entries/{small.json()['entry']['id']}/duplicates")
    assert view.json()["suggested_best_id"] == body["entry"]["id"]


async def test_upload_is_normalized_stripped_and_stored(client, storage) -> None:
    response = await client.post(
        "/entries",
        files={"image": ("photo.heic", factories.jpeg_with_exif(), "image/heic")},
        data={"person_name": "  Full   Name ", "sticker_text": "  text  "},
        headers={"x-forwarded-for": "10.0.0.9"},
    )

    assert response.status_code == 201
    entry = response.json()["entry"]
    # The lying filename and content type are ignored; orientation 6 rotates it.
    assert entry["image_object_key"].endswith(".webp")
    assert (entry["image_width"], entry["image_height"]) == (20, 40)
    assert entry["person_name"] == "Full Name"
    assert entry["sticker_text"] == "text"
    assert storage.objects[entry["image_object_key"]][1] == "image/webp"


async def test_a_non_image_is_rejected_and_nothing_is_stored(client, storage) -> None:
    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", factories.not_an_image(), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "text"},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert response.status_code == 400
    assert storage.objects == {}


async def test_an_empty_upload_is_rejected(client) -> None:
    response = await client.post(
        "/entries",
        files={"image": ("photo.jpg", b"", "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "text"},
        headers={"x-forwarded-for": "10.0.0.1"},
    )

    assert response.status_code == 400


async def test_the_image_route_serves_what_was_stored(client, storage) -> None:
    body = await submit(client, "Full Name")
    key = body["entry"]["image_object_key"]

    response = await client.get(f"/entries/{body['entry']['id']}/image")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.content == storage.objects[key][0]


async def test_entries_are_listed_newest_first(client) -> None:
    await submit(client, "First Name")
    await submit(client, "Second Name")

    response = await client.get("/entries")

    names = [entry["person_name"] for entry in response.json()]
    assert names == ["Second Name", "First Name"]
