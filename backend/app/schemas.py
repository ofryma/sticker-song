import uuid
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    IPvAnyAddress,
    computed_field,
    field_validator,
)


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


class ReviewPage(BaseModel):
    """One page of the review queue, with the size of the full result set.

    `total` counts everything the filters match, not what is on this page, so the
    review page can show how far the queue runs without loading it.
    """

    items: list[MemorialEntryReview]
    total: int
    limit: int
    offset: int


class ConflictGroup(BaseModel):
    """One person carrying more than one sticker.

    Grouped on the normalized name, which is what resolution keys off.
    `similar_names` are near-matches that are *not* in this group — shown so a
    reviewer can spot a spelling that split one person in two, never merged
    automatically.
    """

    normalized_name: str
    person_name: str
    entry_count: int
    vote_count: int
    similar_names: list[str]
    latest_at: datetime


class ConflictGroupPage(BaseModel):
    items: list[ConflictGroup]
    total: int
    limit: int
    offset: int


class ConflictEntry(MemorialEntryReview):
    """One sticker inside a conflict, with the votes people gave its photograph."""

    vote_count: int


class ConflictDetail(BaseModel):
    normalized_name: str
    person_name: str
    entries: list[ConflictEntry]
    #: Highest-resolution image, votes breaking ties. A suggestion, not a choice.
    suggested_best_id: uuid.UUID | None


class ConflictResolution(BaseModel):
    """Keep one sticker for this person and destroy the ones named here.

    The losers are listed explicitly rather than inferred: nothing is deleted
    that the reviewer was not looking at when they decided.
    """

    winner_id: uuid.UUID
    loser_ids: list[uuid.UUID] = Field(min_length=1)


class ConflictResolved(BaseModel):
    winner_id: uuid.UUID
    deleted_entry_ids: list[uuid.UUID]


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


class NameMatchResponse(BaseModel):
    """What the archive already holds under a name, looked up before an upload.

    Ordered exactly like the duplicates of a saved entry — exact names first,
    then the near ones. `has_exact_match` is the strong signal: a near match is
    worth showing and never worth acting on by itself.
    """

    person_name: str
    matches: list[DuplicateCandidate]
    has_exact_match: bool


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


MessageKind = Literal["suggestion", "bug", "entry_problem"]
MessageStatus = Literal["open", "resolved", "dismissed"]

#: Short enough that nobody labours over it, long enough that "hi" and a bot's
#: single word do not get through. The contact page says so before anyone hits it.
MESSAGE_MIN_BODY = 20
MESSAGE_MAX_BODY = 4000


class MessageCreate(BaseModel):
    """Something a visitor wants to tell us."""

    kind: MessageKind
    body: str = Field(min_length=MESSAGE_MIN_BODY, max_length=MESSAGE_MAX_BODY)
    #: The sticker being written about, when the message came from an entry.
    entry_id: uuid.UUID | None = None
    #: Optional, and only ever used to write back.
    reply_email: str | None = Field(default=None, max_length=254)
    #: Honeypot. A person never sees this field, so anything in it came from a
    #: script. Never stored — see `routers.messages.create_message`.
    website: str = Field(default="", max_length=254)

    @field_validator("reply_email")
    @classmethod
    def _tidy_email(cls, value: str | None) -> str | None:
        """A blank field means no address; a shape that cannot be an address is
        an error worth telling the visitor about.

        Deliberately not `EmailStr`: that pulls in `email-validator` as a runtime
        dependency to catch typos we would find out about anyway when a reply
        bounces. An address is optional here, and a wrong one costs one reply.
        """
        if value is None or not value.strip():
            return None
        address = value.strip()
        local, separator, domain = address.partition("@")
        if not separator or not local or "." not in domain or domain.endswith("."):
            raise ValueError("That does not look like an email address")
        return address


class MessageAccepted(BaseModel):
    """Deliberately thin: there is nothing to show a visitor but our thanks."""

    id: uuid.UUID
    kind: str


class MessageRead(BaseModel):
    """A message as an admin sees it.

    `reply_email` and `submitter_ip` are not here on purpose. Neither is any use
    on the admin page — a reply is written by hand, out of band — and neither
    needs to travel to a browser to sit in a table.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    body: str
    status: str
    entry_id: uuid.UUID | None
    #: Joined in for the drawer, so the linked sticker has a name and not an id.
    entry_person_name: str | None = None
    has_reply_email: bool = False
    resolved_by: str | None
    resolved_at: datetime | None
    created_at: datetime


class MessagePage(BaseModel):
    items: list[MessageRead]
    total: int
    limit: int
    offset: int


class MessageCounts(BaseModel):
    open: int
    resolved: int
    dismissed: int


class BlacklistCreate(BaseModel):
    ip: IPvAnyAddress
    reason: str = Field(min_length=1)


class BlacklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ip: str
    reason: str
    created_at: datetime
