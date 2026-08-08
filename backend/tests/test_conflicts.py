"""Conflicts: people the archive holds more than one sticker for.

The dangerous half is the resolution — it deletes rows and images with no undo —
so most of what is pinned here is what it refuses to do.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import ImageFeedback, MemorialEntry
from app.names import normalize_person_name

pytestmark = pytest.mark.integration

NOW = datetime.now(UTC)


async def sign_in(client, credentials: dict[str, str]) -> dict[str, str]:
    response = await client.post("/admin/login", json=credentials)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


@pytest.fixture
async def headers(client, admin_credentials):
    return await sign_in(client, admin_credentials)


async def make(
    session,
    name: str,
    *,
    status: str = "published",
    pixels: tuple[int, int] = (800, 600),
    votes: int = 0,
    minutes_ago: int = 0,
) -> MemorialEntry:
    entry = MemorialEntry(
        id=uuid.uuid4(),
        status=status,
        person_name=name,
        person_name_normalized=normalize_person_name(name),
        sticker_text="sticker text",
        image_object_key=f"entries/{uuid.uuid4()}.webp",
        image_width=pixels[0],
        image_height=pixels[1],
        created_at=NOW - timedelta(minutes=minutes_ago),
    )
    session.add(entry)
    await session.commit()
    for i in range(votes):
        session.add(ImageFeedback(entry_id=entry.id, voter_ip=f"10.0.0.{i + 1}"))
    if votes:
        await session.commit()
    return entry


async def exists(session, entry_id: uuid.UUID) -> bool:
    """Ask the database rather than the session's identity map, which still holds
    rows a request deleted underneath it."""
    return (
        await session.scalar(select(MemorialEntry.id).where(MemorialEntry.id == entry_id))
        is not None
    )


async def conflicts(client, headers, **params) -> dict:
    response = await client.get("/admin/conflicts", headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


# --- the grouping ------------------------------------------------------------


async def test_only_names_carrying_more_than_one_sticker_are_a_conflict(
    client, session, headers
) -> None:
    await make(session, "Dvora Almog")
    await make(session, "Dvora Almog")
    await make(session, "Alone Here")

    page = await conflicts(client, headers)

    assert [group["person_name"] for group in page["items"]] == ["Dvora Almog"]
    assert page["items"][0]["entry_count"] == 2
    assert page["total"] == 1


async def test_a_name_spelled_two_ways_still_groups(client, session, headers) -> None:
    """Case and stray whitespace are folded by the normalized key."""
    await make(session, "Dvora Almog")
    await make(session, "  dvora   almog ")

    page = await conflicts(client, headers)

    assert page["items"][0]["entry_count"] == 2


async def test_a_near_miss_is_shown_beside_a_group_and_never_merged_into_it(
    client, session, headers
) -> None:
    await make(session, "Yonatan Ben Ami")
    await make(session, "Yonatan Ben Ami")
    await make(session, "Yonatan Ben-Ami")
    await make(session, "Yonatan Ben-Ami")

    page = await conflicts(client, headers)

    groups = {group["person_name"]: group for group in page["items"]}
    assert set(groups) == {"Yonatan Ben Ami", "Yonatan Ben-Ami"}
    # Each knows about the other, and each still counts only its own.
    for group in groups.values():
        assert group["entry_count"] == 2
        assert group["similar_names"]


async def test_rejected_entries_are_not_a_conflict(client, session, headers) -> None:
    await make(session, "Dvora Almog")
    await make(session, "Dvora Almog", status="rejected")

    assert await conflicts(client, headers) == {
        "items": [],
        "total": 0,
        "limit": 25,
        "offset": 0,
    }


async def test_a_draft_conflicts_with_what_is_already_on_the_wall(
    client, session, headers
) -> None:
    await make(session, "Dvora Almog", status="published")
    await make(session, "Dvora Almog", status="pending")

    page = await conflicts(client, headers)

    assert page["items"][0]["entry_count"] == 2


async def test_groups_carry_the_votes_across_the_whole_name(
    client, session, headers
) -> None:
    await make(session, "Dvora Almog", votes=2)
    await make(session, "Dvora Almog", votes=3)

    page = await conflicts(client, headers)

    assert page["items"][0]["vote_count"] == 5


async def test_the_list_searches_and_pages(client, session, headers) -> None:
    for name in ("Dvora Almog", "Avi Mizrahi", "Noa Shapira"):
        await make(session, name)
        await make(session, name)

    assert [
        g["person_name"] for g in (await conflicts(client, headers, q="avi"))["items"]
    ] == ["Avi Mizrahi"]
    page = await conflicts(client, headers, limit=2)
    assert len(page["items"]) == 2
    assert page["total"] == 3


# --- one conflict, in full ---------------------------------------------------


async def test_a_conflict_lists_every_sticker_with_its_votes(
    client, session, headers
) -> None:
    await make(session, "Dvora Almog", votes=1, minutes_ago=10)
    await make(session, "Dvora Almog", votes=4)

    detail = (
        await client.get(
            "/admin/conflicts/entries",
            headers=headers,
            params={"name": normalize_person_name("Dvora Almog")},
        )
    ).json()

    assert sorted(entry["vote_count"] for entry in detail["entries"]) == [1, 4]
    assert detail["person_name"] == "Dvora Almog"


async def test_the_suggestion_is_the_largest_image_with_votes_breaking_ties(
    client, session, headers
) -> None:
    small = await make(session, "Dvora Almog", pixels=(400, 300), votes=9)
    large = await make(session, "Dvora Almog", pixels=(2000, 1500))

    detail = (
        await client.get(
            "/admin/conflicts/entries",
            headers=headers,
            params={"name": normalize_person_name("Dvora Almog")},
        )
    ).json()

    assert detail["suggested_best_id"] == str(large.id)
    assert detail["suggested_best_id"] != str(small.id)


async def test_a_name_the_archive_does_not_hold_is_a_404(client, headers) -> None:
    response = await client.get(
        "/admin/conflicts/entries", headers=headers, params={"name": "nobody"}
    )

    assert response.status_code == 404


# --- resolving ---------------------------------------------------------------


async def test_resolving_keeps_the_chosen_sticker_and_destroys_the_rest(
    client, session, headers, storage
) -> None:
    winner = await make(session, "Dvora Almog", pixels=(400, 300))
    loser = await make(session, "Dvora Almog", pixels=(2000, 1500))
    winner_id, loser_id, loser_key = winner.id, loser.id, loser.image_object_key
    storage.objects[loser_key] = (b"bytes", "image/webp")

    response = await client.post(
        "/admin/conflicts/resolve",
        headers=headers,
        json={"winner_id": str(winner.id), "loser_ids": [str(loser.id)]},
    )

    assert response.status_code == 200, response.text
    assert response.json()["deleted_entry_ids"] == [str(loser_id)]
    assert not await exists(session, loser_id)
    assert await exists(session, winner_id)
    # The photograph goes with the row; an orphaned object helps nobody.
    assert loser_key in storage.deleted


async def test_the_reviewer_may_keep_a_sticker_the_suggestion_did_not_pick(
    client, session, headers
) -> None:
    """The suggestion is the biggest image; the decision is still a person's."""
    chosen = await make(session, "Dvora Almog", pixels=(400, 300), votes=7)
    biggest = await make(session, "Dvora Almog", pixels=(3000, 2000))

    response = await client.post(
        "/admin/conflicts/resolve",
        headers=headers,
        json={"winner_id": str(chosen.id), "loser_ids": [str(biggest.id)]},
    )

    assert response.status_code == 200, response.text
    assert await exists(session, chosen.id)


async def test_resolving_will_not_delete_a_different_persons_entry(
    client, session, headers
) -> None:
    winner = await make(session, "Dvora Almog")
    await make(session, "Dvora Almog")
    stranger = await make(session, "Someone Else")

    response = await client.post(
        "/admin/conflicts/resolve",
        headers=headers,
        json={"winner_id": str(winner.id), "loser_ids": [str(stranger.id)]},
    )

    assert response.status_code == 400
    assert await exists(session, stranger.id)


async def test_the_kept_sticker_cannot_also_be_removed(client, session, headers) -> None:
    winner = await make(session, "Dvora Almog")
    await make(session, "Dvora Almog")

    response = await client.post(
        "/admin/conflicts/resolve",
        headers=headers,
        json={"winner_id": str(winner.id), "loser_ids": [str(winner.id)]},
    )

    assert response.status_code == 400
    assert await exists(session, winner.id)


async def test_resolving_takes_the_votes_with_it(client, session, headers) -> None:
    winner = await make(session, "Dvora Almog")
    loser = await make(session, "Dvora Almog", votes=3)

    await client.post(
        "/admin/conflicts/resolve",
        headers=headers,
        json={"winner_id": str(winner.id), "loser_ids": [str(loser.id)]},
    )

    remaining = await client.get(
        "/admin/conflicts", headers=headers, params={"q": "dvora"}
    )
    assert remaining.json()["items"] == []


async def test_conflicts_refuse_an_anonymous_caller(client, admin_credentials) -> None:
    assert (await client.get("/admin/conflicts")).status_code == 401
    assert (
        await client.post(
            "/admin/conflicts/resolve",
            json={"winner_id": str(uuid.uuid4()), "loser_ids": [str(uuid.uuid4())]},
        )
    ).status_code == 401
