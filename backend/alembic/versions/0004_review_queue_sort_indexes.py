"""index for the review queue's paging

The queue pages through one status in date order. `created_at` has carried its
own index since 0001, but a filter on status followed by a sort on date reads
better from a composite — a sequential scan and a sort of the whole table is
fine at a hundred stickers and not at ten thousand.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-08

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The queue's own shape: one status, newest or oldest first.
    op.create_index(
        "ix_memorial_entries_status_created_at",
        "memorial_entries",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_memorial_entries_status_created_at", "memorial_entries")
