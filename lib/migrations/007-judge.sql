-- ADR-0077, ADR-0080. An analysis is a stored artifact identified by the exact set of
-- sessions it covers, not a query that re-runs. session_ids is written sorted (the route
-- sorts before insert and before lookup) so two requests naming the same sessions in a
-- different order are recognised as the same analysis, not two.
--
-- Deliberately no path column and no text column here either — same rule as
-- 002-drift.sql:24. An analysis identifies WHICH sessions were judged, never what was seen.
create table if not exists analysis (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  session_ids uuid[] not null,
  model       text not null,
  created_at  timestamptz not null default now()
);

-- The uniqueness ADR-0077 requires: re-opening the same session set must find this row,
-- never insert a second one. Postgres array equality is element-wise and order-sensitive,
-- which is exactly why the route sorts session_ids before every insert and every lookup.
create unique index if not exists analysis_user_sessions_idx on analysis (user_id, session_ids);

-- Nullable: existing judgment rows (there are none yet, confirmed live) and any future
-- tap-sourced row have no analysis behind them.
alter table judgment add column if not exists analysis_id uuid references analysis(id);
create index if not exists judgment_analysis_idx on judgment (analysis_id);
