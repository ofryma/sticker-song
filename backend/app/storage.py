import io
import mimetypes
import uuid

from minio import Minio
from minio.error import S3Error

from app.config import settings

client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure,
)


def ensure_bucket() -> None:
    """Create the bucket if it does not already exist."""
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)


def build_object_key(extension: str) -> str:
    """Key for a normalized image. The extension comes from `app.images`, never
    from the client's filename."""
    return f"{uuid.uuid4()}{extension}"


def upload_image(object_key: str, data: bytes, content_type: str | None) -> None:
    client.put_object(
        settings.minio_bucket,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )


def delete_image(object_key: str) -> None:
    """Remove an object. A missing object is not an error, so retries are safe."""
    try:
        client.remove_object(settings.minio_bucket, object_key)
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchBucket"}:
            raise


def download_image(object_key: str) -> tuple[bytes, str]:
    """Bytes plus the content type the object was stored with.

    The stored type is authoritative; the suffix is only a fallback for objects
    written before uploads were normalized (`mimetypes` does not know every
    image suffix on every platform).
    """
    response = client.get_object(settings.minio_bucket, object_key)
    try:
        data = response.read()
        content_type = response.headers.get("Content-Type") or ""
    finally:
        response.close()
        response.release_conn()
    if not content_type or content_type == "application/octet-stream":
        content_type = (
            mimetypes.guess_type(object_key)[0] or "application/octet-stream"
        )
    return data, content_type
