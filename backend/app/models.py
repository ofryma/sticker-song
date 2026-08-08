import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


#: A submission is a draft until a human publishes it. Nothing reaches the wall
#: without passing through `published`, and `rejected` is kept rather than deleted
#: so the same entry is not re-reviewed after a resubmission.
ENTRY_STATUSES = ("pending", "published", "rejected")


class MemorialEntry(Base):
    __tablename__ = "memorial_entries"
    # The review queue pages through one status in date order; the wall orders by
    # date alone. Both would otherwise scan and sort the whole table.
    __table_args__ = (
        Index("ix_memorial_entries_status_created_at", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    # Filled in when a reviewer acts: who decided, when, and why.
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # The LLM's read on the submitted text: "ok" | "flag" | "error". Advisory only —
    # it never publishes or rejects on its own.
    llm_verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)
    llm_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    person_name: Mapped[str] = mapped_column(String(255))
    # Normalized form of person_name; the grouping key for duplicate detection.
    person_name_normalized: Mapped[str] = mapped_column(String(255), index=True)
    sticker_text: Mapped[str] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_object_key: Mapped[str] = mapped_column(String(512))
    # Small copy of the same photo, for the wall grid and the collage. Nullable:
    # entries written before thumbnails existed fall back to the full image.
    thumb_object_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitter_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BlacklistedIp(Base):
    """An IP barred from submitting, with the reason it was barred."""

    __tablename__ = "blacklisted_ips"

    ip: Mapped[str] = mapped_column(String(45), primary_key=True)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ImageFeedback(Base):
    """A vote meaning "this image is the best one for this person"."""

    __tablename__ = "image_feedback"
    __table_args__ = (UniqueConstraint("entry_id", "voter_ip", name="uq_feedback_voter"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("memorial_entries.id", ondelete="CASCADE"),
        index=True,
    )
    voter_ip: Mapped[str] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


#: What a visitor is writing about. `entry_problem` is the one that matters most —
#: a wrong name, a bad transcription, the wrong person, or a family asking for a
#: sticker to come down.
MESSAGE_KINDS = ("suggestion", "bug", "entry_problem")
#: A message waits as `open` until somebody has dealt with it. `dismissed` is for
#: what needed no action, so the two are told apart afterwards.
MESSAGE_STATUSES = ("open", "resolved", "dismissed")


class ContactMessage(Base):
    """Something a visitor wrote to whoever keeps the archive."""

    __tablename__ = "contact_messages"
    # The admin list pages through one status in date order, exactly as the
    # review queue does.
    __table_args__ = (
        Index("ix_contact_messages_status_created_at", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    kind: Mapped[str] = mapped_column(String(16), index=True)
    body: Mapped[str] = mapped_column(Text)
    # The sticker being written about, when there is one. SET NULL rather than
    # CASCADE: a message about an entry has to outlive the entry, because the
    # likeliest reason the entry is gone is that this message asked for it.
    entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("memorial_entries.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    # Optional, and only ever used to write back.
    reply_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    submitter_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    resolved_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
