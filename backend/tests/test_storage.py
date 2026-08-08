"""Exercises `app.storage` against a real MinIO.

Every other integration test swaps the bucket for `FakeStorage`, which is fine
for the routes but means nothing ever runs the MinIO client itself — a broken
`put_object` call, a wrong bucket argument or a content type lost on the way
through would ship green. These tests talk to a live server instead.

They skip when nothing is listening, so `pytest` still works on a laptop with
the stack down. Set REQUIRE_STORAGE on CI, where a missing MinIO is a broken
job rather than a pass.
"""

import os
import uuid

import pytest
from minio import Minio
from minio.error import S3Error

from app import storage
from app.config import settings

pytestmark = pytest.mark.integration

# Defaults to the host port docker-compose.yml publishes for development.
TEST_ENDPOINT = os.getenv("TEST_MINIO_ENDPOINT", "localhost:9010")
TEST_ACCESS_KEY = os.getenv("TEST_MINIO_ACCESS_KEY", "minioadmin")
TEST_SECRET_KEY = os.getenv("TEST_MINIO_SECRET_KEY", "minioadmin")


def _probe(client: Minio) -> str | None:
    """None when MinIO is usable, otherwise the reason to skip."""
    try:
        client.list_buckets()
    except Exception as exc:  # noqa: BLE001 - any failure means "no MinIO"
        return f"{type(exc).__name__}: {exc}"
    return None


@pytest.fixture(scope="module")
def live_client() -> Minio:
    client = Minio(
        TEST_ENDPOINT,
        access_key=TEST_ACCESS_KEY,
        secret_key=TEST_SECRET_KEY,
        secure=False,
    )
    reason = _probe(client)
    if reason is not None:
        message = f"no MinIO at {TEST_ENDPOINT} ({reason})"
        if os.getenv("REQUIRE_STORAGE"):
            pytest.fail(f"REQUIRE_STORAGE is set but {message}")
        pytest.skip(message)
    return client


@pytest.fixture
def bucket(live_client: Minio, monkeypatch: pytest.MonkeyPatch) -> str:
    """Point `app.storage` at a throwaway bucket, and take it away afterwards.

    A fresh name per test, so a leftover object from a failed run cannot make the
    next one pass or fail for the wrong reason.
    """
    name = f"storage-test-{uuid.uuid4().hex[:12]}"
    monkeypatch.setattr(storage, "client", live_client)
    monkeypatch.setattr(settings, "minio_bucket", name)

    yield name

    if live_client.bucket_exists(name):
        for item in live_client.list_objects(name, recursive=True):
            live_client.remove_object(name, item.object_name)
        live_client.remove_bucket(name)


def test_ensure_bucket_creates_it_and_is_safe_to_repeat(
    bucket: str, live_client: Minio
) -> None:
    assert not live_client.bucket_exists(bucket)

    storage.ensure_bucket()
    assert live_client.bucket_exists(bucket)

    # Startup runs this on every boot; the second call must not raise.
    storage.ensure_bucket()
    assert live_client.bucket_exists(bucket)


def test_build_object_key_is_unique_and_keeps_the_extension() -> None:
    keys = {storage.build_object_key(".webp") for _ in range(50)}

    assert len(keys) == 50
    assert all(key.endswith(".webp") for key in keys)
    # The name is a bare UUID plus the extension: nothing from a client filename.
    assert all(uuid.UUID(key.removesuffix(".webp")) for key in keys)


def test_upload_then_download_returns_the_bytes_and_the_stored_type(bucket: str) -> None:
    storage.ensure_bucket()
    key = storage.build_object_key(".webp")

    storage.upload_image(key, b"webp-bytes", "image/webp")

    assert storage.download_image(key) == (b"webp-bytes", "image/webp")


def test_upload_handles_an_empty_body_and_a_large_one(bucket: str) -> None:
    storage.ensure_bucket()
    empty, big = storage.build_object_key(".webp"), storage.build_object_key(".webp")
    payload = os.urandom(2 * 1024 * 1024)

    storage.upload_image(empty, b"", "image/webp")
    storage.upload_image(big, payload, "image/webp")

    assert storage.download_image(empty)[0] == b""
    assert storage.download_image(big)[0] == payload


def test_download_guesses_the_type_when_none_was_stored(bucket: str) -> None:
    """Objects written before uploads were normalized carry no useful type."""
    storage.ensure_bucket()
    key = storage.build_object_key(".png")

    storage.upload_image(key, b"png-bytes", None)

    data, content_type = storage.download_image(key)
    assert data == b"png-bytes"
    # Stored as octet-stream, so the suffix is what identifies it.
    assert content_type == "image/png"


def test_download_falls_back_to_octet_stream_for_an_unknown_suffix(bucket: str) -> None:
    storage.ensure_bucket()
    key = storage.build_object_key(".sticker")

    storage.upload_image(key, b"bytes", None)

    assert storage.download_image(key) == (b"bytes", "application/octet-stream")


def test_delete_removes_the_object(bucket: str) -> None:
    storage.ensure_bucket()
    key = storage.build_object_key(".webp")
    storage.upload_image(key, b"bytes", "image/webp")

    storage.delete_image(key)

    with pytest.raises(S3Error) as raised:
        storage.download_image(key)
    assert raised.value.code == "NoSuchKey"


def test_deleting_a_missing_object_is_not_an_error(bucket: str) -> None:
    """Duplicate resolution may retry a delete, so it has to be idempotent."""
    storage.ensure_bucket()
    key = storage.build_object_key(".webp")

    storage.delete_image(key)
    storage.delete_image(key)


def test_deleting_from_a_missing_bucket_is_not_an_error(bucket: str) -> None:
    # The bucket is deliberately never created here.
    storage.delete_image(storage.build_object_key(".webp"))


def test_download_from_a_missing_bucket_raises(bucket: str) -> None:
    with pytest.raises(S3Error) as raised:
        storage.download_image("whatever.webp")
    assert raised.value.code == "NoSuchBucket"
