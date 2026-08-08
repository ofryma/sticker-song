"""contact messages

A way for a visitor to reach whoever keeps the archive: a suggestion, a problem
with the site, or a problem with a particular sticker. The last of those is why
`entry_id` is ON DELETE SET NULL rather than CASCADE -- a message asking for a
sticker to come down must survive the sticker coming down.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contact_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("memorial_entries.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reply_email", sa.String(length=254), nullable=True),
        sa.Column("submitter_ip", sa.String(length=45), nullable=True),
        sa.Column(
            "status", sa.String(length=16), server_default="open", nullable=False
        ),
        sa.Column("resolved_by", sa.String(length=64), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_contact_messages_kind", "contact_messages", ["kind"])
    op.create_index("ix_contact_messages_entry_id", "contact_messages", ["entry_id"])
    op.create_index("ix_contact_messages_status", "contact_messages", ["status"])
    op.create_index("ix_contact_messages_created_at", "contact_messages", ["created_at"])
    # The admin list pages through one status in date order.
    op.create_index(
        "ix_contact_messages_status_created_at",
        "contact_messages",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_contact_messages_status_created_at", table_name="contact_messages")
    op.drop_index("ix_contact_messages_created_at", table_name="contact_messages")
    op.drop_index("ix_contact_messages_status", table_name="contact_messages")
    op.drop_index("ix_contact_messages_entry_id", table_name="contact_messages")
    op.drop_index("ix_contact_messages_kind", table_name="contact_messages")
    op.drop_table("contact_messages")
