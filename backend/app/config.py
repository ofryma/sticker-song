from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, read from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stickers"
    # Connections the pool keeps, and how many more it may open under load. The
    # ceiling is the sum, and it has to stay under the server's max_connections
    # with room left for a migration and a psql session.
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=5, ge=0, le=50)

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "stickers"
    minio_secure: bool = False

    cors_origins: list[str] = ["http://localhost:5173"]

    # Every upload is re-encoded into this one format.
    image_format: Literal["webp", "jpeg", "png"] = "webp"
    # Lossy encoder quality (webp/jpeg); ignored for png.
    image_quality: int = Field(default=88, ge=1, le=100)
    # Largest frame we will decode. A decoded photo costs about 3 bytes a pixel
    # before any copy, so this — not the 10 MB cap on the upload — is what bounds
    # the memory one submission can take: JPEG compresses far too well for a byte
    # limit to say anything about the pixels behind it. 50 MP covers any phone.
    max_image_megapixels: int = Field(default=50, ge=1, le=500)
    # Uploads decoded at the same time. Each one holds a full bitmap for as long
    # as it takes to re-encode, so on a small host this is the difference between
    # a slow second submission and an OOM kill.
    image_concurrency: int = Field(default=2, ge=1, le=32)

    # Admin API. Empty means the admin endpoints are disabled entirely.
    admin_token: str = ""
    # Credentials for the admin management page. Both must be set for /admin/login
    # to work; the token above stays valid for scripts and curl.
    admin_username: str = ""
    admin_password: str = ""
    # How long a signed admin session token stays valid.
    admin_session_hours: int = Field(default=12, ge=1, le=168)

    # Every submission lands as a draft and is published only after review.
    # Turning this off publishes on upload, which the project deliberately avoids.
    require_review: bool = True

    # LLM review of the submitted name and sticker text. Empty key = skipped, and
    # the entry simply waits for a human.
    anthropic_api_key: str = ""
    review_model: str = "claude-opus-5"
    # Longest edge of the thumbnail served to the wall grid and the collage.
    thumbnail_max_edge: int = Field(default=640, ge=64, le=2048)
    # Cache-Control max-age for images. Keys are content-addressed, so an entry's
    # bytes never change under the same URL.
    image_cache_seconds: int = 60 * 60 * 24 * 365

    # Votes an image needs before it wins its duplicate group.
    duplicate_vote_threshold: int = 20
    # pg_trgm similarity above which two names are *suggested* as the same person.
    name_similarity_threshold: float = 0.4

    # Honour X-Forwarded-For. Safe behind a trusted proxy only; see README.
    trust_proxy_headers: bool = True

    @property
    def review_enabled(self) -> bool:
        """Whether an LLM opinion is available at all."""
        return bool(self.anthropic_api_key)

    @property
    def admin_login_enabled(self) -> bool:
        return bool(self.admin_username and self.admin_password)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
