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
