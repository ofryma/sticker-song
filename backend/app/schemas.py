import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress, computed_field


class MemorialEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    person_name: str
    sticker_text: str
    latitude: float | None
    longitude: float | None
    image_object_key: str
    image_width: int | None
    image_height: int | None
    image_bytes: int | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def image_url(self) -> str:
        """Path the frontend can use directly in an <img> tag."""
        return f"/entries/{self.id}/image"

    @computed_field
    @property
    def thumb_url(self) -> str:
        """Small copy, for grids and the collage. Falls back to the full image
        server-side when an older entry has no thumbnail."""
        return f"/entries/{self.id}/thumb"


class MemorialEntryReview(MemorialEntryRead):
    """An entry as a reviewer sees it: the draft state and the LLM's opinion."""

    status: str
    review_note: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    llm_verdict: str | None
    llm_reason: str | None
    llm_checked_at: datetime | None
    submitter_ip: str | None


class ReviewCounts(BaseModel):
    pending: int
    published: int
    rejected: int


class ReviewDecision(BaseModel):
    """Why a reviewer published or rejected. Optional, and kept on the entry."""

    note: str | None = Field(default=None, max_length=2000)


class AdminLogin(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AdminSession(BaseModel):
    token: str
    expires_at: datetime


class DuplicateCandidate(MemorialEntryRead):
    vote_count: int
    # True when the normalized names match exactly. Only exact matches are ever
    # deleted automatically; fuzzy hits are suggestions for a human to judge.
    is_exact_match: bool


class EntryCreateResponse(BaseModel):
    entry: MemorialEntryRead
    possible_duplicates: list[DuplicateCandidate]
    # Highest-resolution image among the new entry and its candidates.
    suggested_best_id: uuid.UUID
    # True while the entry is a draft: kept, but not yet on the wall.
    awaiting_review: bool


class DuplicateListResponse(BaseModel):
    entry: MemorialEntryRead
    possible_duplicates: list[DuplicateCandidate]
    suggested_best_id: uuid.UUID


class FeedbackResponse(BaseModel):
    entry_id: uuid.UUID
    vote_count: int
    threshold: int
    resolved: bool
    deleted_entry_ids: list[uuid.UUID]


class BlacklistCreate(BaseModel):
    ip: IPvAnyAddress
    reason: str = Field(min_length=1)


class BlacklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ip: str
    reason: str
    created_at: datetime
