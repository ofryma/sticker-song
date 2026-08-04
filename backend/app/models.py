import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
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


class MemorialEntry(Base):
    __tablename__ = "memorial_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    person_name: Mapped[str] = mapped_column(String(255))
    # Normalized form of person_name; the grouping key for duplicate detection.
    person_name_normalized: Mapped[str] = mapped_column(String(255), index=True)
    sticker_text: Mapped[str] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_object_key: Mapped[str] = mapped_column(String(512))
    image_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitter_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
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
