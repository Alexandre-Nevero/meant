# Solution Design Document

**Project:** Intent
**Date:** 2026-08-18
**Version:** 0.1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Upstream:** [prd-intent.md](prd-intent.md), [sitemap-intent.md](sitemap-intent.md), [flow-intent.md](flow-intent.md)

---

## 1. Architecture Vision

Three pieces, one direction of data flow.

```
Chrome / Edge extension (MV3)                Vercel (Next.js App Router)         Neon Postgres
┌──────────────────────────┐                 ┌──────────────────────┐            ┌────────────┐
│ service worker           │  Bearer token   │ /api/sessions        │            │ device     │
│  · tabs.onActivated      │ ───────────────▶│ /api/events          │ ─────────▶ │ pairing_   │
│  · tabs.onUpdated        │   batched       │ /api/pair[/claim]    │            │   code     │
│  · windows.onFocusChanged│   every 30s     │                      │            │ session    │
│  · alarms (30s tick)     │                 │ /dashboard  (S3)     │            │ event      │
│  · declarativeNetRequest │                 │ /review/[id](S4)     │            └────────────┘
│  · chrome.storage.local  │                 │ /pair       (S2)     │
│ popup (S5/S6/S7)         │◀── opens tab ───│  Clerk session       │
│ block page (S8)          │                 └──────────────────────┘
└──────────────────────────┘
```

**The load-bearing constraint of the whole design:** an MV3 service worker is killed after 30 seconds of inactivity, and `chrome.alarms` cannot tick faster than 30 seconds *(verified: developer.chrome.com, service worker lifecycle, 2026-08-18)*. Therefore **no state lives in memory.** A session is a start timestamp in `chrome.storage.local`; elapsed time is always computed, never counted. Every design decision below follows from that one fact.

---

## 2. Components

| ID | Component | Responsibility | Does not |
|---|---|---|---|
| SDD-C1 | Service worker | Own session state in `chrome.storage.local`; attribute time on tab/focus events; install and remove block rules; batch and flush events | Hold a timer, hold a token in memory, decide anything about categories |
| SDD-C2 | Popup | Declare intention, pick blocklist, start, stop, pair | Display history — that is the web app's job |
| SDD-C3 | Block page | Show the intention and remaining time | Offer any bypass. There is no "5 more minutes" button in v1 |
| SDD-C4 | API routes | Authenticate (Clerk session for pages, device token for the extension), validate, write | Aggregate or compute — the review computes from raw rows |
| SDD-C5 | Web UI | Dashboard, review, pairing | Track anything |
| SDD-C6 | Schema | Four tables, below | — |

---

## 3. Data

### 3.1 Schema

```sql
create table device (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,               -- Clerk user id
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
```

Four tables. Well under the ~12 that would justify a separate data-model document (AGENTS §11.2), so the schema lives here.

**`domain` is a hostname and nothing more.** Not the path, not the query string, not the page title. The review needs `claude.ai`, not `claude.ai/chat/8f2…`, and storing the second would make this product unsafe to run on a work laptop — which would kill the primary persona. This is a product decision expressed as a column type.

### 3.2 Migrations and Integrity

- One `schema.sql`, applied by hand for v1. No migration tool inside the four hours.
- `event.session_id` cascades on delete, so deleting a session deletes its evidence — which is what a user asking to delete a session means.
- Time is stored as `timestamptz` throughout; the client sends absolute timestamps and the server never invents one.

---

## 4. Interfaces

### 4.1 Endpoints

| Method | Route | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/pair` | Clerk session | — | `{ code, expiresAt }` |
| POST | `/api/pair/claim` | none + code | `{ code }` | `{ deviceId, token }` — the only time the token is ever transmitted |
| POST | `/api/sessions` | device token | `{ intention, plannedMinutes, blocklist, startedAt }` | `{ sessionId }` |
| PATCH | `/api/sessions/:id` | device token | `{ endedAt, endReason }` | `{ ok }` |
| POST | `/api/events` | device token | `{ sessionId, events: [{kind, domain, seconds, at}] }` | `{ accepted }` |
| PATCH | `/api/sessions/:id/outcome` | Clerk session | `{ outcome }` | `{ ok }` |

The outcome is answered from the web app, so it uses the Clerk session — the extension never writes an outcome.

### 4.2 Sequences

**Pairing.** `/pair` mints a code → user pastes it into the popup → extension calls `/api/pair/claim` → server verifies the code is unclaimed and unexpired, creates a `device` row with `sha256(token)`, marks the code claimed, returns the token once → extension stores it in `chrome.storage.local`.

**A session.** Popup start → `POST /api/sessions` → `updateDynamicRules` adds one block rule per domain → `chrome.storage.local` holds `{sessionId, startedAt, currentDomain, currentSince}`. On every `tabs.onActivated` / `tabs.onUpdated` / `windows.onFocusChanged`, the worker computes `now − currentSince`, queues an `attention` (or `away`) event, and resets `currentSince`. A 30-second alarm flushes the queue and closes the session if `plannedMinutes` has elapsed. Stop → flush → `PATCH /api/sessions/:id` → `updateDynamicRules` removes the session's rules → `chrome.tabs.create('/review/{id}')`.

**Recovery (E2).** On startup the worker reads `chrome.storage.local`; if a session is open, it closes it at the last recorded event with `end_reason = 'recovered'`.

### 4.3 Third-Party Services

| Service | Used for | Failure behavior | Budget |
|---|---|---|---|
| Vercel | Hosting, API routes | Extension queues events locally and retries (E3) | 1 of 5 |
| Neon Postgres | All persistence | API returns 5xx; extension keeps queueing | 2 of 5 |
| Clerk | Web sign-in only | Web app unusable; the extension keeps recording against its stored token | 3 of 5 |

Two slots unallocated. Adding a fourth service to v1 requires cutting something else.

---

## 5. Security and Authorization

| # | Control | Rule |
|---|---|---|
| V1 | Device token | 32 random bytes, base64url. Stored as `sha256` server-side; transmitted exactly once, at claim |
| V2 | Pairing code | 6 characters from an alphabet without `0/O/1/I`; single use; expires in 10 minutes; claiming is atomic (`update … where claimed_at is null and expires_at > now()` and check the affected row count) |
| V3 | Row ownership | Every query filters on `user_id`. A session belonging to another user returns 404, never 403 |
| V4 | Extension permissions | `declarativeNetRequest`, `tabs`, `storage`, `alarms`, plus **host permissions for the blocklist domains only** — a `redirect` action is an unsafe rule and requires host access for the request URL, and `blocked.html` must be in `web_accessible_resources` (verified 2026-08-18). Never `<all_urls>`; no content scripts; no `webRequest`. *(Amended 2026-08-18 — see [build.md](build.md) §7.4.)* |
| V5 | Payload minimisation | The extension may only send hostname, kind, seconds, and timestamps. There is no code path that can send a full URL, a page title, or page content |
| V6 | Transport | HTTPS only; the API rejects a request with no valid `Authorization` header without queueing or logging its body |

**The abuse case that matters most here is the product itself.** A tool that records where attention goes is one schema change away from being surveillance. V5 is the control that keeps that change from being accidental, and it belongs in code review, not in a policy document.

---

## 6. AI and Agent Architecture

None. v1 contains no model calls (PRD §6). Nothing leaves the account's own rows, so there is no prompt-injection surface, no data-egress surface, and no inference cost.

---

## 7. Non-Functional Requirements

| # | Requirement | Target | Why |
|---|---|---|---|
| N1 | Attention attribution loss | < 30 seconds per gap | Bounded by the alarm period; unavoidable given the service worker lifecycle |
| N2 | Event flush interval | 30 seconds | The minimum `chrome.alarms` period |
| N3 | Block rule installation | < 200ms after Start | A visible lag makes the commitment feel fake |
| N4 | Review load | < 1s for a session with ~200 events | Aggregation happens in one SQL group-by |
| N5 | Offline tolerance | Unlimited queueing in `chrome.storage.local` | The tracker's honesty must not depend on the network |

---

## 8. Verification

### 8.1 Case matrix

| # | Case | Method | Pass |
|---|---|---|---|
| T1 | Start creates a session and installs rules | Manual: start, then open a blocked domain | Block page appears with the intention on it |
| T2 | Stop removes every rule | Manual: stop, reopen the same domain | Page loads normally |
| T3 | Time is attributed across tab switches | Manual: three tabs, ~1 min each, then review | Three domains, roughly the right seconds |
| T4 | Service worker death does not lose the session | `chrome://serviceworker-internals` → Stop, wait, switch tabs | Session still running; time continues to accrue |
| T5 | Browser close mid-session recovers | Quit and reopen | Session closed with `end_reason = 'recovered'` |
| T6 | Offline queueing | Devtools offline, switch tabs, back online | Events arrive; nothing lost |
| T7 | Cross-account isolation | Open another user's `/review/[id]` | 404 |
| T8 | Expired pairing code | Wait 11 minutes, claim | Rejected, extension stays unpaired |

### 8.2 Standing abuse cases

- A rule that outlives its session (FLOW §7 invariant) — **release-blocking** if it ever occurs.
- Any payload containing a path, query string, or title (V5) — release-blocking.

### 8.3 Release criteria

The two-minute demo path in IDEA §4 runs twice consecutively without a reload, and T1, T2, T4, and T7 pass. Nothing else gates v1.

---

## 9. Data and Compliance

### 9.1 Data register

| Data | Where | Sensitivity | Retention |
|---|---|---|---|
| Clerk user id, email | Clerk + `device.user_id` | Identifying | Life of the account |
| Intention text | `session.intention` | **User-authored, may name real work, clients, or projects** | Life of the account; deletable per session |
| Hostnames + seconds | `event` | Behavioral | Life of the session row |
| Device token hash | `device.token_hash` | Credential | Until unpaired |

### 9.2 Processors
Vercel (hosting), Neon (database), Clerk (identity). All three see data; none is a sub-processor of the others.

### 9.3 User rights and obligations
Deleting a session deletes its events by cascade. v1 has no account-deletion UI — a real gap, recorded here rather than hidden, and the first thing to add if this ever leaves the builder's own machine.

### 9.4 Escalation flags
If this is ever installed on an employer-owned device by anyone other than the builder, the intention field becomes the risk, not the hostnames — free text about real work stored on third-party infrastructure. That is a conversation before a feature.

---

## 10. Operations

Vercel preview and production; `schema.sql` applied by hand; Neon's own backups; rollback is a Vercel deployment rollback plus removing the unpacked extension. No on-call, no alerting, no dashboards — one user.

---

## 11. Stack Currency

| Fact | Source | Checked |
|---|---|---|
| `declarativeNetRequest.updateDynamicRules` mutates rules at runtime; `declarativeNetRequest` permission covers block rules without full host access; 30,000 safe-rule ceiling | developer.chrome.com — declarativeNetRequest reference | 2026-08-18 |
| Reading `tab.url` needs `tabs` or host permissions; `tabs.onActivated` / `onUpdated` are the attention signals | developer.chrome.com — chrome.tabs reference | 2026-08-18 |
| Service worker dies after 30s idle; `chrome.alarms` minimum period 30s (Chrome 120+) | developer.chrome.com — service worker lifecycle | 2026-08-18 |
| `redirect` rules are "unsafe": they require host permissions for the request URL, and a redirect to an extension page requires that page in `web_accessible_resources` | developer.chrome.com — declarativeNetRequest reference | 2026-08-18 |

Re-check all three before the build; MV3 details move.

---

## 12. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Does the block rule set use `requestDomains` or URL-filter matching? *(Provisional: `requestDomains` — simplest, and domain-level is all v1 blocks.)* | SDD-C1 | Alexandre |
| Q2 | Does the extension send events for a domain visited for under 3 seconds, or drop them as noise? *(Provisional: send; filtering is a display decision, and raw data can be re-aggregated later.)* | SDD-C1 | Alexandre |

---

## Self-Check

- [x] Every `SDD-C#` traces to a `PRD-F#`
- [x] The schema supports every metric in PRD §8 with no additional table
- [x] Every third-party service names its failure behavior
- [x] The service worker lifecycle constraint is stated once and every affected design follows from it
- [x] Security controls include the product's own abuse case, not only external attackers
- [x] Stack claims carry a source and a date
- [x] Registered in `docs/index.md`

> **Build sequence:** the four-hour task order, cut line, and demo script live in [build-intent.md](build-intent.md).
