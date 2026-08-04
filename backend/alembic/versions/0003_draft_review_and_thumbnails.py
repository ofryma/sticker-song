"""draft review state, llm verdict, thumbnails

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-04

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "memorial_entries",
        sa.Column("status", sa.String(length=16), nullable=True),
    )
    # Everything already in the archive was public before review existed; keep it
    # visible rather than hiding the wall behind a review queue on deploy day.
    op.execute("UPDATE memorial_entries SET status = 'published'")
    op.alter_column(
        "memorial_entries",
        "status",
        nullable=False,
        server_default="pending",
    )
    op.create_index("ix_memorial_entries_status", "memorial_entries", ["status"])

    op.add_column("memorial_entries", sa.Column("review_note", sa.Text(), nullable=True))
    op.add_column(
        "memorial_entries", sa.Column("reviewed_by", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "memorial_entries",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "memorial_entries", sa.Column("llm_verdict", sa.String(length=16), nullable=True)
    )
    op.add_column("memorial_entries", sa.Column("llm_reason", sa.Text(), nullable=True))
    op.add_column(
        "memorial_entries",
        sa.Column("llm_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Nullable on purpose: existing rows have no thumbnail and the image endpoint
    # falls back to the full-size object for them.
    op.add_column(
        "memorial_entries",
        sa.Column("thumb_object_key", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("memorial_entries", "thumb_object_key")
    op.drop_column("memorial_entries", "llm_checked_at")
    op.drop_column("memorial_entries", "llm_reason")
    op.drop_column("memorial_entries", "llm_verdict")
    op.drop_column("memorial_entries", "reviewed_at")
    op.drop_column("memorial_entries", "reviewed_by")
    op.drop_column("memorial_entries", "review_note")
    op.drop_index("ix_memorial_entries_status", table_name="memorial_entries")
    op.drop_column("memorial_entries", "status")
