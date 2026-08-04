"""Voting, and the deletion it triggers.

This is the only irreversible path in the app: reaching the threshold destroys
rows and images with no undo. The tests pin down exactly what gets deleted —
exact normalized-name matches only — and, just as importantly, what does not.
"""

import pytest
from sqlalchemy import func, select

from app import storage as storage_module
from app.config import settings
from app.models import ImageFeedback, MemorialEntry
from tests.test_duplicates import submit

pytestmark = pytest.mark.integration

VOTERS = ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"]


async def vote(client, entry_id: str, ip: str):
    return await client.post(
        f"/entries/{entry_id}/feedback", headers={"x-forwarded-for": ip}
    )


async def count_entries(session) -> int:
    return await session.scalar(select(func.count(MemorialEntry.id)))


@pytest.fixture(autouse=True)
def _threshold(monkeypatch) -> None:
    """Pin the threshold: the default is env-driven and every count asserts on it."""
    monkeypatch.setattr(settings, "duplicate_vote_threshold", 3)


# --- counting ----------------------------------------------------------------


async def test_a_first_vote_is_counted_and_resolves_nothing(client) -> None:
    entry = (await submit(client, "Full Name"))["entry"]

    body = (await vote(client, entry["id"], VOTERS[0])).json()

    assert body["vote_count"] == 1
    assert body["threshold"] == 3
    assert body["resolved"] is False
    assert body["deleted_entry_ids"] == []


async def test_votes_from_different_ips_accumulate(client) -> None:
    entry = (await submit(client, "Full Name"))["entry"]

    counts = [
        (await vote(client, entry["id"], ip)).json()["vote_count"] for ip in VOTERS[:3]
    ]

    assert counts == [1, 2, 3]


async def test_the_same_ip_cannot_vote_twice(client, session) -> None:
    entry = (await submit(client, "Full Name"))["entry"]
    await vote(client, entry["id"], VOTERS[0])

    repeat = await vote(client, entry["id"], VOTERS[0])

    assert repeat.status_code == 409
    assert await session.scalar(select(func.count(ImageFeedback.id))) == 1


async def test_voting_for_an_unknown_entry_404s(client) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"

    response = await vote(client, unknown, VOTERS[0])

    assert response.status_code == 404


# --- resolution --------------------------------------------------------------


async def test_reaching_the_threshold_deletes_the_exact_duplicate(
    client, session, storage
) -> None:
    loser = (await submit(client, "Full Name", ip="10.0.0.1"))["entry"]
    winner = (await submit(client, "FULL NAME", ip="10.0.0.2"))["entry"]

    for ip in VOTERS[:2]:
        assert (await vote(client, winner["id"], ip)).json()["resolved"] is False
    final = (await vote(client, winner["id"], VOTERS[2])).json()

    assert final["vote_count"] == 3
    assert final["resolved"] is True
    assert final["deleted_entry_ids"] == [loser["id"]]

    # The row is gone...
    assert await session.get(MemorialEntry, loser["id"]) is None
    assert await count_entries(session) == 1
    # ...and so are both of its objects: the image and its thumbnail.
    loser_key = loser["image_object_key"]
    assert sorted(storage.deleted) == sorted(
        [loser_key, storage_module.build_thumb_key(loser_key)]
    )
    assert loser["image_object_key"] not in storage.objects
    # The winner is untouched.
    assert winner["image_object_key"] in storage.objects


async def test_a_fuzzy_match_is_never_deleted(client, session, storage) -> None:
    """The property that keeps a different person's entry from being destroyed."""
    near = (await submit(client, "Yonatn Cohen", ip="10.0.0.1"))["entry"]
    winner = (await submit(client, "Yonatan Cohen", ip="10.0.0.2"))["entry"]
    # Confirm the two really are a fuzzy pair, or this test proves nothing.
    view = await client.get(f"/entries/{winner['id']}/duplicates")
    candidates = view.json()["possible_duplicates"]
    assert [c["id"] for c in candidates] == [near["id"]]
    assert candidates[0]["is_exact_match"] is False

    for ip in VOTERS[:3]:
        body = (await vote(client, winner["id"], ip)).json()

    assert body["resolved"] is False
    assert body["deleted_entry_ids"] == []
    assert await session.get(MemorialEntry, near["id"]) is not None
    assert storage.deleted == []


async def test_an_unrelated_entry_is_never_deleted(client, session) -> None:
    other = (await submit(client, "Someone Else", ip="10.0.0.1"))["entry"]
    winner = (await submit(client, "Full Name", ip="10.0.0.2"))["entry"]

    for ip in VOTERS[:3]:
        await vote(client, winner["id"], ip)

    assert await session.get(MemorialEntry, other["id"]) is not None


async def test_the_winner_is_never_deleted_with_no_duplicates(
    client, session, storage
) -> None:
    winner = (await submit(client, "Full Name"))["entry"]

    for ip in VOTERS[:3]:
        body = (await vote(client, winner["id"], ip)).json()

    assert body["resolved"] is False
    assert await session.get(MemorialEntry, winner["id"]) is not None
    assert storage.deleted == []


async def test_every_exact_duplicate_goes_at_once(client, session, storage) -> None:
    losers = [
        (await submit(client, "Full Name", ip=f"10.0.0.{i}"))["entry"]
        for i in range(1, 4)
    ]
    winner = (await submit(client, "  full   name  ", ip="10.0.0.9"))["entry"]

    for ip in VOTERS[:3]:
        body = (await vote(client, winner["id"], ip)).json()

    assert sorted(body["deleted_entry_ids"]) == sorted(x["id"] for x in losers)
    assert await count_entries(session) == 1
    expected = [x["image_object_key"] for x in losers]
    expected += [storage_module.build_thumb_key(key) for key in expected]
    assert sorted(storage.deleted) == sorted(expected)


async def test_the_losers_feedback_rows_cascade(client, session) -> None:
    """`ON DELETE CASCADE` has to clear the loser's votes, or the FK blocks it."""
    loser = (await submit(client, "Full Name", ip="10.0.0.1"))["entry"]
    winner = (await submit(client, "Full Name", ip="10.0.0.2"))["entry"]
    assert (await vote(client, loser["id"], VOTERS[3])).status_code == 200

    for ip in VOTERS[:3]:
        body = (await vote(client, winner["id"], ip)).json()

    assert body["deleted_entry_ids"] == [loser["id"]]
    remaining = await session.scalars(select(ImageFeedback.entry_id))
    assert {str(row) for row in remaining} == {winner["id"]}


async def test_a_deleted_entry_is_gone_from_the_api(client) -> None:
    loser = (await submit(client, "Full Name", ip="10.0.0.1"))["entry"]
    winner = (await submit(client, "Full Name", ip="10.0.0.2"))["entry"]

    for ip in VOTERS[:3]:
        await vote(client, winner["id"], ip)

    assert (await client.get(f"/entries/{loser['id']}")).status_code == 404
    listed = (await client.get("/entries")).json()
    assert [entry["id"] for entry in listed] == [winner["id"]]


async def test_voting_past_the_threshold_deletes_nothing_more(
    client, session, storage
) -> None:
    await submit(client, "Full Name", ip="10.0.0.1")
    winner = (await submit(client, "Full Name", ip="10.0.0.2"))["entry"]
    for ip in VOTERS[:3]:
        await vote(client, winner["id"], ip)
    already_deleted = list(storage.deleted)

    extra = (await vote(client, winner["id"], VOTERS[3])).json()

    assert extra["vote_count"] == 4
    assert extra["deleted_entry_ids"] == []
    assert storage.deleted == already_deleted
    assert await count_entries(session) == 1


async def test_a_higher_threshold_delays_resolution(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "duplicate_vote_threshold", 4)
    await submit(client, "Full Name", ip="10.0.0.1")
    winner = (await submit(client, "Full Name", ip="10.0.0.2"))["entry"]

    for ip in VOTERS[:3]:
        third = (await vote(client, winner["id"], ip)).json()
    assert third["resolved"] is False

    fourth = (await vote(client, winner["id"], VOTERS[3])).json()
    assert fourth["resolved"] is True


async def test_each_entry_has_its_own_vote_tally(client) -> None:
    first = (await submit(client, "First Name", ip="10.0.0.1"))["entry"]
    second = (await submit(client, "Second Name", ip="10.0.0.2"))["entry"]

    await vote(client, first["id"], VOTERS[0])
    body = (await vote(client, second["id"], VOTERS[0])).json()

    assert body["vote_count"] == 1


async def test_vote_counts_are_reported_on_duplicate_candidates(client) -> None:
    voted = (await submit(client, "Full Name", ip="10.0.0.1"))["entry"]
    await vote(client, voted["id"], VOTERS[0])
    other = (await submit(client, "Full Name", ip="10.0.0.2"))["entry"]

    view = await client.get(f"/entries/{other['id']}/duplicates")

    candidates = view.json()["possible_duplicates"]
    assert [(c["id"], c["vote_count"]) for c in candidates] == [(voted["id"], 1)]
