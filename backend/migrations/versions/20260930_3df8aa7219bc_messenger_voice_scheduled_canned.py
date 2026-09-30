"""messenger voice scheduled canned

Revision ID: 3df8aa7219bc
Revises: 2ce9ccfe3651
Create Date: 2026-09-30 18:22:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3df8aa7219bc'
down_revision: Union[str, Sequence[str], None] = '2ce9ccfe3651'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'canned_responses',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('coach_id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=128), nullable=False),
        sa.Column('shortcut', sa.String(length=64), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('canned_responses', schema=None) as batch_op:
        batch_op.create_index('ix_canned_responses_coach_id', ['coach_id'], unique=False)
        batch_op.create_index('ix_canned_responses_created_at', ['created_at'], unique=False)

    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('scheduled_for', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('is_delivered', sa.Boolean(), server_default='1', nullable=False))
        batch_op.create_index('ix_messages_scheduled_for', ['scheduled_for'], unique=False)
        batch_op.create_index('ix_messages_is_delivered', ['is_delivered'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.drop_index('ix_messages_is_delivered')
        batch_op.drop_index('ix_messages_scheduled_for')
        batch_op.drop_column('is_delivered')
        batch_op.drop_column('scheduled_for')

    with op.batch_alter_table('canned_responses', schema=None) as batch_op:
        batch_op.drop_index('ix_canned_responses_created_at')
        batch_op.drop_index('ix_canned_responses_coach_id')
    op.drop_table('canned_responses')
