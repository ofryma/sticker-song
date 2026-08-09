"""The name lookup the wizard makes before anything is uploaded.

Same matching as `test_duplicates.py`, asked one step earlier: a contributor
types a name and finds out that the archive already remembers this person, while
there is still nothing to throw away. Needs a real Postgres for `pg_trgm`.
"""

import pytest

from app.config import settings
from tests import factories
from tests.test_duplicates import submit

pytestmark = pytest.mark.integration


async def matches(client, name: str) -> dict:
    response = await client.get("/entries/matches", params={"name": name})
    assert response.status_code == 200, response.text
    return response.json()


async def test_an_unknown_name_matches_nothing(client) -> None:
    await submit(client, "Full Name")

    body = await matches(client, "Someone Entirely Different")

    assert body["matches"] == []
    assert body["has_exact_match"] is False


async def test_the_same_name_is_found_before_any_upload(client) -> None:
    first = await submit(client, "Full Name")

    body = await matches(client, "  full   NAME ")

    assert [m["id"] for m in body["matches"]] == [first["entry"]["id"]]
    assert body["has_exact_match"] is True
    # Echoed back in display form, so the screen can name the person.
    assert body["person_name"] == "full NAME"


async def test_a_near_name_is_offered_without_claiming_an_exact_match(client) -> None:
    first = await submit(client, "Yonatan Cohen")

    body = await matches(client, "Yonatn Cohen")

    assert [m["id"] for m in body["matches"]] == [first["entry"]["id"]]
    assert body["matches"][0]["is_exact_match"] is False
    assert body["has_exact_match"] is False


async def test_matches_carry_what_the_comparison_needs(client) -> None:
    await client.post(
        "/entries",
        files={"image": ("b.jpg", factories.jpeg(size=(200, 120)), "image/jpeg")},
        data={"person_name": "Full Name", "sticker_text": "the words"},
        headers={"x-forwarded-for": "10.0.0.4"},
    )

    match = (await matches(client, "Full Name"))["matches"][0]

    assert match["sticker_text"] == "the words"
    assert (match["image_width"], match["image_height"]) == (200, 120)
    assert match["thumb_url"] == f"/entries/{match['id']}/thumb"
    assert match["vote_count"] == 0


async def test_exact_names_come_before_near_ones(client) -> None:
    await submit(client, "Yonatn Cohen", ip="10.0.0.5")
    exact = await submit(client, "Yonatan Cohen", ip="10.0.0.6")

    body = await matches(client, "yonatan cohen")

    assert body["matches"][0]["id"] == exact["entry"]["id"]
    assert len(body["matches"]) == 2


async def test_the_similarity_threshold_is_respected(client, monkeypatch) -> None:
    await submit(client, "Yonatan Cohen")

    monkeypatch.setattr(settings, "name_similarity_threshold", 0.99)

    assert (await matches(client, "Yonatn Cohen"))["matches"] == []


async def test_a_draft_awaiting_review_is_not_offered(client, monkeypatch) -> None:
    """Somebody else's unreviewed submission is not public information."""
    monkeypatch.setattr(settings, "require_review", True)
    await submit(client, "Full Name")

    body = await matches(client, "Full Name")

    assert body["matches"] == []
    assert body["has_exact_match"] is False


async def test_an_empty_name_is_a_bad_request(client) -> None:
    response = await client.get("/entries/matches", params={"name": ""})

    assert response.status_code == 422


async def test_a_name_of_only_whitespace_matches_nothing(client) -> None:
    """Normalizes to nothing, so there is no key to search on — not an error."""
    await submit(client, "Full Name")

    body = await matches(client, "   ")

    assert body["matches"] == []
    assert body["person_name"] == ""
