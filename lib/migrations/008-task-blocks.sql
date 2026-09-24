-- RELEASE ORDERING, and `npm run migrate` is manual: APPLY THIS BEFORE DEPLOYING THE APP THAT
-- WRITES IT. Deploy first and every POST /api/sessions throws on the missing column. (ADR-0084)
--
-- One session, several tasks: each task is an ordinary session row, and every task in one block
-- carries the block's id, which is the first task's id. Null on every row written before this
-- migration; after it, a single-task session is a block of one and carries its own id.
--
-- Client-supplied, like session.id itself. Every read also filters by user_id, so a forged
-- value can only ever group the caller's own rows.
alter table session add column if not exists block_id uuid;
create index if not exists session_block_idx on session (block_id);

-- event.kind gains 'paused' alongside attention | away | block_hit | label. kind is free text;
-- no constraint changes.
