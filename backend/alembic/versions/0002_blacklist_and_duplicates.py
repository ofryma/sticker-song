"""ip blacklist, image feedback, duplicate detection columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-04

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Fuzzy name matching (similarity()) for duplicate *suggestions*.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.add_column(
        "memorial_entries",
        sa.Column("person_name_normalized", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "memorial_entries", sa.Column("image_width", sa.Integer(), nullable=True)
    )
    op.add_column(
        "memorial_entries", sa.Column("image_height", sa.Integer(), nullable=True)
    )
    op.add_column(
        "memorial_entries", sa.Column("image_bytes", sa.Integer(), nullable=True)
    )
    op.add_column(
        "memorial_entries", sa.Column("submitter_ip", sa.String(length=45), nullable=True)
    )

    # Backfill existing rows, then enforce NOT NULL. This mirrors
    # app.names.normalize_person_name (minus NFKC, which SQL cannot express --
    # rows written by the app are already NFKC-folded).
    op.execute(
        """
        UPDATE memorial_entries
        SET person_name_normalized =
            lower(btrim(regexp_replace(person_name, '\\s+', ' ', 'g')))
        """
    )
    op.alter_column("memorial_entries", "person_name_normalized", nullable=False)

    op.create_index(
        "ix_memorial_entries_person_name_normalized",
        "memorial_entries",
        ["person_name_normalized"],
    )
    op.create_index(
        "ix_memorial_entries_name_trgm",
        "memorial_entries",
        ["person_name_normalized"],
        postgresql_using="gin",
        postgresql_ops={"person_name_normalized": "gin_trgm_ops"},
    )

    op.create_table(
        "blacklisted_ips",
        sa.Column("ip", sa.String(length=45), primary_key=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "image_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("memorial_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("voter_ip", sa.String(length=45), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("entry_id", "voter_ip", name="uq_feedback_voter"),
    )
    op.create_index("ix_image_feedback_entry_id", "image_feedback", ["entry_id"])


def downgrade() -> None:
    op.drop_index("ix_image_feedback_entry_id", table_name="image_feedback")
    op.drop_table("image_feedback")
    op.drop_table("blacklisted_ips")
    op.drop_index("ix_memorial_entries_name_trgm", table_name="memorial_entries")
    op.drop_index(
        "ix_memorial_entries_person_name_normalized", table_name="memorial_entries"
    )
    op.drop_column("memorial_entries", "submitter_ip")
    op.drop_column("memorial_entries", "image_bytes")
    op.drop_column("memorial_entries", "image_height")
    op.drop_column("memorial_entries", "image_width")
    op.drop_column("memorial_entries", "person_name_normalized")
