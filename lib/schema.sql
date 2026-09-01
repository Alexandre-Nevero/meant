create table device (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,               -- Neon Auth user id
  token_hash   text not null unique,        -- sha256 of the device token; the token itself is never stored
  label        text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create table pairing_code (
  code       text primary key,              -- 6 chars, ambiguity-free alphabet
  user_id    text not null,
  expires_at timestamptz not null,          -- now() + 10 minutes
  claimed_at timestamptz
);

create table session (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  device_id       uuid not null references device(id),
  intention       text not null default '', -- empty is legal and is the point (A2)
  planned_minutes int,                      -- null = runs until stopped
  blocklist       text[] not null default '{}',
  started_at      timestamptz not null,
  ended_at        timestamptz,
  end_reason      text,                     -- stopped | elapsed | superseded | recovered
  outcome         text not null default 'unanswered',  -- yes | no | unanswered
  answered_at     timestamptz
);
create index on session (user_id, started_at desc);

create table event (
  id         bigserial primary key,
  session_id uuid not null references session(id) on delete cascade,
  kind       text not null,   -- attention | away | block_hit
  domain     text,            -- hostname only. never a full URL, never a page title
  seconds    int,             -- null for block_hit
  at         timestamptz not null
);
create index on event (session_id);
