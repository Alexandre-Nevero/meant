-- M9 and K6 need a place to look. Neither was computable before this table: M9 (inference
-- cost per active user per month, under 15% of price) and K6 ("above that for two consecutive
-- months, cut judge frequency or raise price") were both committed in PRD §8 with no mechanism,
-- which made K6 a kill criterion that could never fire.
--
-- Deliberately NO prompt column and NO response column, for the same reason 002-drift.sql
-- refuses a title or text column: this table records what a call COST, never what it said.
-- A migration adding either is the same release-blocking change, and it would be a worse one
-- here — an analysis payload carries the user's paths, which ADR-0059 keeps on their device.
create table if not exists inference_call (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  session_ids   uuid[] not null default '{}',   -- what the batch covered (ADR-0060)
  model         text not null,                  -- the tier is a business decision (PRD §7)
  input_tokens  int  not null,
  output_tokens int  not null,
  cost_usd      numeric(10, 6) not null,        -- 6dp: a single call is ~$0.0067
  at            timestamptz not null default now()
);

-- M9 is per user per month, so that is the shape of every read.
create index if not exists inference_call_user_at_idx on inference_call (user_id, at);
