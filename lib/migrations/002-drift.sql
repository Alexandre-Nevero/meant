alter table session add column if not exists work_sites      text[] not null default '{}';
alter table session add column if not exists blocked_domains text[] not null default '{}';
alter table session add column if not exists cycle_work_min  int;    -- null = no cycles
alter table session add column if not exists cycle_break_min int;
alter table event   add column if not exists label text;  -- work | distract | neutral | unknown

-- event.kind gains 'break' alongside attention | away | block_hit. No constraint change needed;
-- kind has always been free text.

create table if not exists judgment (
  id           bigserial primary key,
  session_id   uuid not null references session(id) on delete cascade,
  domain       text not null,              -- hostname only, as ever
  label        text not null,              -- work | distract | neutral | unknown
  source       text not null,              -- own | session | blocked | standing | memory | judge
  verdict      text,                       -- serves | drifts | unclear (null unless source='judge')
  confidence   real,
  signalled    boolean not null default false,   -- M7 divides by this
  gate         text,                       -- break|blocked|corrected|grace|dwell|refractory|budget|below-floor
  corrected_to text,                       -- null unless overridden. THIS COLUMN IS THE TRAINING SET
  at           timestamptz not null
);
create index if not exists judgment_session_idx on judgment (session_id);
-- Deliberately no title column and no text column. See SDD §5.1. A migration adding one is the
-- single change that turns this product into surveillance, and it is release-blocking.

create table if not exists memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null,               -- domain_class | list | pref
  key         text not null,               -- hostname, or 'work_sites' | 'distract_sites'
  value       jsonb not null,              -- domain_class: {work_n, distract_n, neutral_n, last_at}
  evidence_n  int  not null default 1,
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, key)
);
create index if not exists memory_user_kind_idx on memory (user_id, kind);
