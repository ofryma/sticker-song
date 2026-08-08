"""Filtering, sorting and paging the review queue.

All three are the database's job: with thousands of stickers, answering "the
flagged ones from this week, by name, page three" by sending the whole archive to
the browser is the expensive way to answer it. These tests pin the answers.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models import MemorialEntry
from app.names import normalize_person_name

pytestmark = pytest.mark.integration

NOW = datetime.now(UTC)


async def sign_in(client, credentials: dict[str, str]) -> dict[str, str]:
    response = await client.post("/admin/login", json=credentials)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def make(
    session,
    name: str,
    *,
    status: str = "pending",
    text: str = "sticker text",
    verdict: str | None = None,
    days_ago: float = 0,
) -> MemorialEntry:
    """A row written straight to the table: these tests are about the query, and
    an upload cannot choose its own created_at."""
    entry = MemorialEntry(
        id=uuid.uuid4(),
        status=status,
        person_name=name,
        person_name_normalized=normalize_person_name(name),
        sticker_text=text,
        llm_verdict=verdict,
        image_object_key=f"entries/{name}.webp",
        created_at=NOW - timedelta(days=days_ago),
    )
    session.add(entry)
    await session.commit()
    return entry


async def queue(client, headers, **params) -> dict:
    response = await client.get("/admin/entries", headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def names(page: dict) -> list[str]:
    return [row["person_name"] for row in page["items"]]


@pytest.fixture
async def headers(client, admin_credentials):
    return await sign_in(client, admin_credentials)


# --- filtering ---------------------------------------------------------------


async def test_free_text_searches_the_name_and_the_transcription(
    client, session, headers
) -> None:
    await make(session, "Dvora Almog", text="planted an olive tree")
    await make(session, "Yonatan Ben-Ami", text="played the oud")

    assert names(await queue(client, headers, q="dvora")) == ["Dvora Almog"]
    assert names(await queue(client, headers, q="OUD")) == ["Yonatan Ben-Ami"]
    assert names(await queue(client, headers, q="nobody")) == []


async def test_the_search_matches_hebrew_as_typed(client, session, headers) -> None:
    await make(session, "דוד כהן", text="אח גדול, תמיד ראשון להתנדב")
    await make(session, "מיכל לוי")

    assert names(await queue(client, headers, q="כהן")) == ["דוד כהן"]
    assert names(await queue(client, headers, q="להתנדב")) == ["דוד כהן"]


async def test_a_window_holds_open_to_the_moment_it_is_asked(
    client, session, headers
) -> None:
    await make(session, "Today", days_ago=0)
    await make(session, "Three days", days_ago=3)
    await make(session, "Two weeks", days_ago=14)

    assert names(await queue(client, headers, added_within_days=1)) == ["Today"]
    week = names(await queue(client, headers, added_within_days=7))
    assert set(week) == {"Today", "Three days"}


async def test_the_read_filter_separates_flagged_clear_and_unread(
    client, session, headers
) -> None:
    await make(session, "Flagged", verdict="flag")
    await make(session, "Clear", verdict="ok")
    await make(session, "Unread")

    assert names(await queue(client, headers, read="flag")) == ["Flagged"]
    assert names(await queue(client, headers, read="ok")) == ["Clear"]
    assert names(await queue(client, headers, read="unread")) == ["Unread"]
    assert len(names(await queue(client, headers, read="any"))) == 3


async def test_filters_narrow_together(client, session, headers) -> None:
    await make(session, "Wanted", verdict="flag", days_ago=1, text="olive")
    await make(session, "Too old", verdict="flag", days_ago=40, text="olive")
    await make(session, "Not flagged", verdict="ok", days_ago=1, text="olive")
    await make(session, "Other words", verdict="flag", days_ago=1, text="something")

    page = await queue(
        client, headers, q="olive", read="flag", added_within_days=7, status="all"
    )

    assert names(page) == ["Wanted"]


# --- sorting -----------------------------------------------------------------


async def test_waiting_entries_come_oldest_first_by_default(
    client, session, headers
) -> None:
    """A submission should not wait behind newer ones."""
    await make(session, "Newest", days_ago=0)
    await make(session, "Oldest", days_ago=10)

    assert names(await queue(client, headers)) == ["Oldest", "Newest"]


async def test_everything_else_comes_newest_first(client, session, headers) -> None:
    await make(session, "Newest", status="published", days_ago=0)
    await make(session, "Oldest", status="published", days_ago=10)

    assert names(await queue(client, headers, status="published")) == [
        "Newest",
        "Oldest",
    ]


async def test_sorting_by_name_ignores_case_and_stray_space(
    client, session, headers
) -> None:
    await make(session, "  bet Name")
    await make(session, "Alef Name")
    await make(session, "Gimel Name")

    page = await queue(client, headers, sort="name", order="asc")

    assert names(page) == ["Alef Name", "  bet Name", "Gimel Name"]


async def test_sorting_by_state_puts_what_needs_a_decision_first(
    client, session, headers
) -> None:
    await make(session, "Held back", status="rejected")
    await make(session, "On the wall", status="published")
    await make(session, "Waiting", status="pending")

    page = await queue(client, headers, status="all", sort="status", order="asc")

    assert names(page) == ["Waiting", "On the wall", "Held back"]


async def test_sorting_by_read_puts_the_flagged_first_and_the_unread_last(
    client, session, headers
) -> None:
    await make(session, "Unread")
    await make(session, "Clear", verdict="ok")
    await make(session, "Flagged", verdict="flag")

    page = await queue(client, headers, sort="read", order="asc")

    assert names(page) == ["Flagged", "Clear", "Unread"]


# --- paging ------------------------------------------------------------------


async def test_a_page_carries_the_size_of_the_whole_result(
    client, session, headers
) -> None:
    for i in range(5):
        await make(session, f"Name {i}", days_ago=i)

    page = await queue(client, headers, limit=2)

    assert len(page["items"]) == 2
    assert (page["total"], page["limit"], page["offset"]) == (5, 2, 0)


async def test_paging_walks_every_row_once(client, session, headers) -> None:
    """Entries sharing a sort key still page cleanly: the order is total."""
    for i in range(7):
        await make(session, f"Name {i}", status="published", verdict="ok")

    seen: list[str] = []
    for offset in (0, 3, 6):
        seen += names(
            await queue(
                client,
                headers,
                status="published",
                sort="read",
                limit=3,
                offset=offset,
            )
        )

    assert sorted(seen) == sorted(f"Name {i}" for i in range(7))


async def test_the_total_counts_what_the_filters_match_not_the_page(
    client, session, headers
) -> None:
    for i in range(4):
        await make(session, f"Flagged {i}", verdict="flag")
    await make(session, "Clear", verdict="ok")

    page = await queue(client, headers, read="flag", limit=1)

    assert page["total"] == 4
    assert len(page["items"]) == 1


async def test_an_impossible_page_is_empty_rather_than_an_error(
    client, session, headers
) -> None:
    await make(session, "Only one")

    page = await queue(client, headers, offset=500)

    assert page["items"] == []
    assert page["total"] == 1
