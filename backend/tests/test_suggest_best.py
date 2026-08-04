"""`_suggest_best` — which image is offered as the best one for a person.

Pure ranking logic, so it is tested without a database. It picks the highest
resolution and breaks ties on votes.
"""

import uuid
from datetime import UTC, datetime

from app.routers.entries import _pixels, _suggest_best
from app.schemas import DuplicateCandidate, MemorialEntryRead


def _entry(width: int | None, height: int | None) -> MemorialEntryRead:
    now = datetime.now(UTC)
    return MemorialEntryRead(
        id=uuid.uuid4(),
        person_name="Full Name",
        sticker_text="text",
        latitude=None,
        longitude=None,
        image_object_key="key.webp",
        image_width=width,
        image_height=height,
        image_bytes=100,
        created_at=now,
        updated_at=now,
    )


def _candidate(
    width: int | None, height: int | None, votes: int = 0, exact: bool = True
) -> DuplicateCandidate:
    base = _entry(width, height).model_dump(exclude={"image_url"})
    return DuplicateCandidate(**base, vote_count=votes, is_exact_match=exact)


def test_pixels_treats_missing_dimensions_as_zero() -> None:
    assert _pixels(_entry(None, None)) == 0
    assert _pixels(_entry(10, None)) == 0
    assert _pixels(_entry(10, 20)) == 200


def test_the_entry_itself_wins_when_it_has_no_rivals() -> None:
    entry = _entry(100, 100)

    assert _suggest_best(entry, []) == entry.id


def test_higher_resolution_wins() -> None:
    entry = _entry(100, 100)
    bigger = _candidate(400, 400)

    assert _suggest_best(entry, [_candidate(50, 50), bigger]) == bigger.id


def test_the_entry_keeps_the_win_when_it_is_the_largest() -> None:
    entry = _entry(400, 400)

    assert _suggest_best(entry, [_candidate(100, 100)]) == entry.id


def test_votes_break_a_resolution_tie() -> None:
    entry = _entry(100, 100)
    voted = _candidate(100, 100, votes=5)

    assert _suggest_best(entry, [_candidate(100, 100), voted]) == voted.id


def test_an_equal_candidate_with_no_votes_does_not_displace_the_entry() -> None:
    entry = _entry(100, 100)

    assert _suggest_best(entry, [_candidate(100, 100)]) == entry.id


def test_resolution_outranks_votes() -> None:
    entry = _entry(100, 100)
    big = _candidate(400, 400, votes=0)

    assert _suggest_best(entry, [big, _candidate(10, 10, votes=99)]) == big.id


def test_candidates_without_dimensions_never_win_over_a_sized_entry() -> None:
    entry = _entry(10, 10)

    assert _suggest_best(entry, [_candidate(None, None, votes=50)]) == entry.id
