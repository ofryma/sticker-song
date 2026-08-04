from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, read from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stickers"

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

    # Admin API. Empty means the admin endpoints are disabled entirely.
    admin_token: str = ""

    # Votes an image needs before it wins its duplicate group.
    duplicate_vote_threshold: int = 3
    # pg_trgm similarity above which two names are *suggested* as the same person.
    name_similarity_threshold: float = 0.4

    # Honour X-Forwarded-For. Safe behind a trusted proxy only; see README.
    trust_proxy_headers: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
