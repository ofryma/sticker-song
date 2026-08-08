"""Shared fixtures.

Two tiers of test live here. Pure unit tests (`test_names.py`, `test_images.py`,
`test_suggest_best.py`) need nothing but the package. Integration tests need a
real Postgres because duplicate detection is built on `pg_trgm.similarity()` and
the vote-deletion path relies on `ON DELETE CASCADE` — neither has a SQLite
equivalent worth faking. When no database is reachable those tests skip rather
than fail, so `pytest` is still useful on a laptop with nothing running.
"""

import asyncio
import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.main import app
from app.models import Base

# A dedicated database: the integration tests create and drop every table in it.
# Defaults to the host port docker-compose.yml publishes for development.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5442/stickers_test",
)
MAINTENANCE_URL = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
TEST_DB_NAME = TEST_DATABASE_URL.rsplit("/", 1)[1]


async def _create_database_if_missing() -> None:
    """CREATE DATABASE needs autocommit and its own connection."""
    engine = create_async_engine(MAINTENANCE_URL, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            exists = await conn.scalar(
                text("select 1 from pg_database where datname = :name"),
                {"name": TEST_DB_NAME},
            )
            if not exists:
                await conn.execute(text(f'create database "{TEST_DB_NAME}"'))
    finally:
        await engine.dispose()


async def _probe() -> str | None:
    """None when Postgres is usable, otherwise the reason to skip."""
    try:
        await _create_database_if_missing()
    except Exception as exc:  # noqa: BLE001 - any failure means "no database"
        return f"{type(exc).__name__}: {exc}"

    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        async with engine.begin() as conn:
            # similarity() comes from pg_trgm; creating it needs a superuser,
            # which both the compose image and the CI service container give us.
            await conn.execute(text("create extension if not exists pg_trgm"))
    except Exception as exc:  # noqa: BLE001
        return f"{type(exc).__name__}: {exc}"
    finally:
        await engine.dispose()
    return None


@pytest.fixture(scope="session")
def database_skip_reason() -> str | None:
    return asyncio.new_event_loop().run_until_complete(_probe())


@pytest_asyncio.fixture
async def db_engine(database_skip_reason: str | None):
    if database_skip_reason is not None:
        message = f"no Postgres at {TEST_DATABASE_URL} ({database_skip_reason})"
        # On CI a missing database is a broken job, not a reason to pass quietly.
        if os.getenv("REQUIRE_DATABASE"):
            pytest.fail(f"REQUIRE_DATABASE is set but {message}")
        pytest.skip(message)

    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def session(db_engine) -> AsyncIterator:
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture(autouse=True)
def publish_on_upload(monkeypatch) -> None:
    """Most tests are about duplicates, votes and images — behaviour that only
    applies to published entries. They upload and then read back, so the draft step
    is turned off for them; `test_review.py` turns it on where it is the subject.
    """
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "require_review", False)


@pytest.fixture
def review_required(monkeypatch) -> None:
    """Restore the production default: every submission lands as a draft."""
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "require_review", True)


@pytest.fixture
def admin_credentials(monkeypatch) -> dict[str, str]:
    """Configure admin sign-in and hand back the credentials."""
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "admin_username", "reviewer")
    monkeypatch.setattr(app_settings, "admin_password", "correct-horse")
    monkeypatch.setattr(app_settings, "admin_token", "test-admin-token")
    return {"username": "reviewer", "password": "correct-horse"}


class FakeStorage:
    """In-memory stand-in for MinIO, recording what the routes did to it."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.deleted: list[str] = []

    def upload_image(self, key: str, data: bytes, content_type: str | None) -> None:
        self.objects[key] = (data, content_type or "application/octet-stream")

    def download_image(self, key: str) -> tuple[bytes, str]:
        return self.objects[key]

    def delete_image(self, key: str) -> None:
        # Mirrors the real client: deleting a missing object is not an error.
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.fixture
def storage(monkeypatch) -> FakeStorage:
    fake = FakeStorage()
    from app import storage as storage_module

    for name in ("upload_image", "download_image", "delete_image"):
        monkeypatch.setattr(storage_module, name, getattr(fake, name))
    return fake


@pytest_asyncio.fixture
async def client(
    db_engine, storage: FakeStorage, monkeypatch
) -> AsyncIterator[AsyncClient]:
    """The real app, wired to the test database and the fake bucket.

    Each request gets its own session, exactly as `get_session` does in
    production — the routes commit and then read back, so sharing one session
    with the test body would hide transaction bugs.
    """
    from app import db as db_module
    from app.db import get_session

    factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override() -> AsyncIterator:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    # Background work (the LLM note) opens its own session off db.SessionFactory
    # rather than the request dependency, so point that at the test database too.
    monkeypatch.setattr(db_module, "SessionFactory", factory)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()
