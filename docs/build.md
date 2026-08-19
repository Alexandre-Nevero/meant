# Build Guide — Intent

**Build steward:** Alexandre Andrei Nevero
**Active phase:** Phase-1 — *the loop* (the only phase; see §4)
**Deadline:** four hours, one sitting. The clock, cut line, and demo script live in [build-intent.md](build-intent.md); this file is the work itself.
**Traces to:** [prd-intent.md](prd-intent.md) (`PRD-F#`, `US-##`) · [sdd-intent.md](sdd-intent.md) (`SDD-C#`, `V#`) · [flow-intent.md](flow-intent.md) (`EV#`, edge cases) · [sitemap-intent.md](sitemap-intent.md) (`S#`)

> **How to use this file.** Read §1 and §2, then work §5 top to bottom. Every task states what "done" means in a way that can fail. Contracts are binding; the code that satisfies them is yours to write. When this file and any other doc disagree, this file is wrong — fix it here rather than diverging in code.

---

## 1. Planning inputs

- **Core demo journey (US-01 → US-05):** declare an intention → sites blocked → attention recorded → review shows intended beside actual → answer *did you finish it* → ledger.
- **Hard constraints:** four hours · five external services maximum, three allocated (Vercel, Neon, Clerk) · no OS permissions, no admin rights, no installer · hostname only.
- **Risk register:**
  - **R1 — MV3 service worker death (30s idle).** Highest risk in the build; mitigated by TASK-005's storage-only state rule. A single `setInterval` reintroduces it silently.
  - **R2 — redirect rules need host permissions.** The block page is a redirect, so `host_permissions` must list the blocklist domains. Get this wrong and blocking appears to do nothing with no error.
  - **R3 — pairing handshake.** Token crosses process boundaries once; if TASK-003/004 mismatch, everything after fails at once.
  - **R4 — clock.** Mitigated by the cut line in `build-intent.md` §4, not by working faster.
- **Quality commands:** `npx tsc --noEmit` (fast) · `npm run build` (full). No test framework in v1 — verification is the manual matrix in §8, which is honest about what it is.
- **Browser E2E:** none. Manual, per §8.

---

## 2. Iron rules

Six invariants. An agent that "improves" any of these has introduced a bug, not a refactor.

| # | Rule | Why | Violated by |
|---|---|---|---|
| INV-1 | **No in-memory state in the service worker.** Session state lives in `chrome.storage.local`; elapsed time is always `now − storedTimestamp`, never accumulated | The worker dies after 30s idle (SDD §1) | `setInterval`, a module-level `let elapsed`, any counter |
| INV-2 | **Hostname only.** No path, query string, or page title may enter a payload or a column | The product is unsafe on a work laptop otherwise (SDD V5) | Sending `tab.url` raw, adding a `title` column "for later" |
| INV-3 | **Block rules die with their session.** Every rule added on start is removed on end, including on recovery paths | FLOW §7; a rule outliving its session is release-blocking | Early `return` before rule cleanup, cleanup only on the happy path |
| INV-4 | **No fourth external service.** Three of five are allocated | PRD §7 | Adding analytics, error tracking, a state library's cloud, a UI kit's CDN |
| INV-5 | **Host permissions are per blocked domain, never `<all_urls>`.** | SDD V4, as corrected in §7.4 | Wildcarding the manifest to make a redirect work |
| INV-6 | **Every DB query filters on `user_id`; another user's row 404s.** | SDD V3 | `where id = $1` with no ownership clause |

---

## 3. Repo layout

```
/
├─ app/
│  ├─ layout.tsx                       S1 shell, Clerk provider
│  ├─ page.tsx                         S1 landing / sign-in, redirects to /dashboard when signed in
│  ├─ dashboard/page.tsx               S3 ledger
│  ├─ pair/page.tsx                    S2 pairing code
│  ├─ review/[sessionId]/
│  │  ├─ page.tsx                      S4 review + outcome
│  │  └─ answer.tsx                    client boundary, the two answer buttons
│  └─ api/
│     ├─ pair/route.ts                 POST  mint code            (Clerk session)
│     ├─ pair/claim/route.ts           POST  claim code → token   (public + code)
│     ├─ events/route.ts               POST  batched events       (device token)
│     └─ sessions/
│        ├─ route.ts                   POST  start session        (device token)
│        └─ [id]/
│           ├─ route.ts                PATCH end session          (device token)
│           └─ outcome/route.ts        PATCH answer outcome       (Clerk session)
├─ lib/
│  ├─ db.ts                            Neon client, single export
│  ├─ device-auth.ts                   Bearer token → device row, or null
│  └─ schema.sql                       SDD §3.1, applied by hand
├─ proxy.ts                            Clerk; device-token routes excluded (Next 16: middleware.ts → proxy.ts)
├─ extension/
│  ├─ manifest.json                    MV3
│  ├─ sw.js                            service worker (SDD-C1)
│  ├─ popup.html / popup.js            S5 / S6 / S7 (SDD-C2)
│  ├─ blocked.html / blocked.js        S8 (SDD-C3)
│  ├─ blocklists.js                    three hardcoded arrays
│  └─ api.js                           fetch wrapper: base URL, token header, offline queue
└─ docs/
```

Twenty-two files. If a file appears that is not on this list, it needs a reason.

---

## 4. Phase table

| Phase | Goal | Entry | Exit | Status |
|---|---|---|---|---|
| Phase-1 — the loop | The demo journey runs end to end | Providers provisioned (TASK-001) | §8 T1, T2, T4, T7 pass and the demo runs twice consecutively | active |

FMD's guidance for a solo short build is that one phase is usually the whole build, so the task ledger stays inline in §5 rather than in a separate `docs/plans/` file. A second phase opens only if v1 ships and the loop survives two weeks of real use.

---

## 5. Task ledger

`TASK-###` are stable. `T#` is the matching slot in [build-intent.md](build-intent.md) §2.

| ID | Task | Slot | Depends on | Write scope | Status |
|---|---|---|---|---|---|
| TASK-001 | Provision and schema | T1 | — | `lib/schema.sql`, env | done |
| TASK-002 | Next.js shell + Clerk + empty dashboard | T2 | 001 | `app/layout.tsx`, `app/page.tsx`, `app/dashboard/`, `proxy.ts` | done |
| TASK-003 | Pairing API + page | T3 | 002 | `app/api/pair/**`, `app/pair/` | done |
| TASK-004 | Extension skeleton + pairing | T4 | 003 | `extension/manifest.json`, `popup.*`, `api.js` | done |
| TASK-005 | Session start/stop | T5 | 004 | `extension/sw.js`, `extension/api.js`, `extension/popup.js`, `app/api/sessions/**` | done |
| TASK-006 | Attention recording | T6 | 005 | `extension/sw.js`, `app/api/events/` | done |
| TASK-007 | Blocking + block page | T7 | 005 | `extension/sw.js`, `blocked.*`, `blocklists.js`, manifest | done |
| TASK-008 | Review page + outcome | T8 | 006 | `app/review/`, `app/api/sessions/[id]/outcome/` | done |
| TASK-009 | Dashboard ledger | T9 | 008 | `app/dashboard/` | done |
| TASK-010 | Verification + rehearsal | T10 | all | — | blocked |

---

## 6. Build units

### TASK-001 · Provision and schema
**Files:** `lib/schema.sql`, `.env.local` (pulled, never committed)
**Do:** `vercel link` → add Neon and Clerk from the Vercel Marketplace → `vercel env pull` → apply `lib/schema.sql` (verbatim from SDD §3.1) to the Neon branch.
**Contract:** `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` present locally. Four tables exist: `device`, `pairing_code`, `session`, `event`.
**Stack currency:** take the Clerk App Router setup and the Neon client snippet from their current docs at this moment. Do not write either from memory; both change.
**Done when:** a scratch query against `session` returns zero rows without erroring.

### TASK-002 · Shell, auth, empty dashboard
**Files:** `app/layout.tsx`, `app/page.tsx`, `app/dashboard/page.tsx`, `proxy.ts`, `lib/db.ts`
**Contract:**
- `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`, root file, same `clerkMiddleware()` export) protects everything **except** `/`, `/api/pair/claim`, `/api/sessions/*`, `/api/events`. Those four are device-token routes and must never see a Clerk redirect — a redirect returns HTML to a `fetch()` and produces a JSON parse error that reads like a bug three tasks later. Note: bare `clerkMiddleware()` establishes auth context but does not itself redirect; protection for `/dashboard` today is enforced in-page via `auth()` + `redirect('/')`. TASK-003/008's Clerk-authenticated routes (`/pair`, `POST /api/pair`, `PATCH .../outcome`) each need their own `auth()`/`auth.protect()` guard — the proxy does not gate them for free.
- `lib/db.ts` exports exactly one thing: a query function. No ORM, no schema DSL.
- `app/page.tsx` redirects to `/dashboard` when signed in.
**Done when (US-06 partial):** sign in from `/` lands on `/dashboard`, which renders its empty state.

### TASK-003 · Pairing
**Files:** `app/api/pair/route.ts`, `app/api/pair/claim/route.ts`, `app/pair/page.tsx`
**Contract:**
- `POST /api/pair` — Clerk session. Inserts a `pairing_code` row: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `expires_at = now() + 10 min`. Returns `{ code, expiresAt }`.
- `POST /api/pair/claim` — body `{ code }`. Claim atomically: `update pairing_code set claimed_at = now() where code = $1 and claimed_at is null and expires_at > now()` and **check the affected row count**; zero rows → 401. On success insert `device` with `token_hash = sha256(token)` and return `{ deviceId, token }`. The plaintext token is returned here and nowhere else, ever.
- `app/pair/page.tsx` calls `/api/pair` on load and displays the code and its expiry.
**Done when (US-06):** a valid code returns a token and writes a `device` row; the same code claimed twice returns 401 the second time.

### TASK-004 · Extension skeleton and pairing
**Files:** `extension/manifest.json`, `extension/popup.html`, `extension/popup.js`, `extension/api.js`
**Contract:**
- `manifest.json`: `manifest_version: 3`, `permissions: ["declarativeNetRequest", "tabs", "storage", "alarms"]`, `background.service_worker: "sw.js"`, `action.default_popup: "popup.html"`. Host permissions and `web_accessible_resources` are added in TASK-007, not here.
- `api.js` exports `post(path, body, { method = 'POST', queue: shouldQueue = true })`: prefixes the API base URL, attaches `Authorization: Bearer <token>` from `chrome.storage.local`, and on network failure pushes `{ method, path, body, at }` onto a `queue` array in storage instead of throwing (E3) — unless the caller opts out with `queue: false` (the pairing claim: a replayed claim can only 401, and there is nowhere to put a token from a queued response).
- `popup.js` renders one of three states from storage: unpaired (S7) → paired-idle (S5) → running (S6). No framework, no bundler (build-intent B1).
**Done when:** pasting a code into the unpaired popup stores a token and flips the popup to the idle state.

### TASK-005 · Session start and stop
**Files:** `extension/sw.js`, `extension/popup.js`, `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`, `lib/device-auth.ts`
**Contract:**
- `lib/device-auth.ts` exports `deviceFromRequest(req)`: reads the Bearer token, hashes it, returns the `device` row or `null`. Every device-token route calls it first and returns 401 on null, **before** reading the body.
- `POST /api/sessions` — body `{ intention, plannedMinutes, blocklist, startedAt }` → `{ sessionId }`. An empty intention is valid and is stored as `''` (US-01, A2).
- `PATCH /api/sessions/:id` — body `{ endedAt, endReason }`, where `endReason ∈ {stopped, elapsed, superseded, recovered}`. Verify the session belongs to the token's device.
- `sw.js` holds session state in `chrome.storage.local` under one key:
  `{ sessionId, intention, startedAt, plannedMinutes, currentDomain, currentSince, unfocusedSince, ruleIds }` — **INV-1: nothing else, nowhere else.**
- `popup.js`'s idle state gains the intention field, duration select, and blocklist choice, and dispatches `{ type: 'start', intention, plannedMinutes, blocklist }`; the running state gains a Stop control dispatching `{ type: 'stop' }` — a session cannot start without a Start control.
- On startup, `sw.js` checks for an open session and closes it with `recovered` (E2).
**Done when (US-01):** start then stop writes one session row with correct timestamps; killing the worker from `chrome://serviceworker-internals` mid-session and returning does not lose it (T4).

### TASK-006 · Attention recording
**Files:** `extension/sw.js`, `app/api/events/route.ts`
**Contract:**
- Listeners: `tabs.onActivated`, `tabs.onUpdated` (only when `changeInfo.url` is set), `windows.onFocusChanged`, `alarms.onAlarm` (30s — the minimum period).
- One shared handler, `attribute(nextDomain | null)`: computes `now − currentSince`, pushes `{ kind, domain, seconds, at }` onto the queue, sets `currentDomain`/`currentSince`. `kind` is `away` when the browser is unfocused (`windowId === chrome.windows.WINDOW_ID_NONE`) for more than 60 seconds, otherwise `attention`.
- `domain` is `new URL(tab.url).hostname` — **INV-2**. Nothing else from the URL is read, stored, or logged.
- Events buffer in the existing top-level `queue` key as `/api/events` records (`{ method, path, body, at }`, same shape TASK-004 defined) — there is no sixth storage key. The alarm flushes the queue: it coalesces every buffered event record for a session into one `POST /api/events` request, replays any other queued record (e.g. a queued session start) in order, and ends the session when `plannedMinutes` has elapsed.
- The flush is the only writer that shrinks the queue, and it must re-read the queue immediately before writing it back — `chrome.storage.local` read-modify-write is not atomic, and an alarm handler and an open popup can both call `post()` while offline.
- `POST /api/events` — body `{ sessionId, events: [...] }`. Rejects any event whose `domain` contains `/`, `?`, or `#`. This is INV-2 enforced at the boundary rather than trusted at the source.
**Done when (US-03):** three tabs of roughly a minute each produce three `attention` rows with sane seconds; going offline mid-session loses nothing (T6).

### TASK-007 · Blocking and the block page
**Files:** `extension/sw.js`, `extension/blocklists.js`, `extension/blocked.html`, `extension/blocked.js`, `extension/manifest.json`
**Contract:**
- `blocklists.js` exports three named arrays of hostnames. Hardcoded (build-intent §3).
- **Manifest additions, and the reason for them:** a `redirect` action is an *unsafe* rule and requires host permissions for the request URL, and the redirect target must be listed in `web_accessible_resources` — verified against the Chrome docs, 2026-08-18. So `host_permissions` lists every domain that appears in any blocklist (`"*://*.youtube.com/*"`, …) and nothing more (**INV-5**), and `blocked.html` is web-accessible for those same matches.
- On start: `declarativeNetRequest.updateDynamicRules({ addRules })`, one rule per blocked domain, `condition.requestDomains`, `action.type: "redirect"` to `redirect.url = chrome.runtime.getURL('blocked.html?d=<hostname>')` — not `extensionPath`, so the block page can record `block_hit` (EV5) with the attempted hostname: `redirect.url` is documented to take a full URL, `extensionPath`'s query-string support is not. Hostname only, so INV-2 holds. Rule ids are recorded in storage.
- On end, **including every recovery and error path (INV-3):** `updateDynamicRules({ removeRuleIds })` using the recorded ids.
- `blocked.js` reads the current session from storage and shows the intention and remaining time. No bypass control exists (SDD-C3).
**Done when (US-02):** a blocked domain redirects to a page showing your own intention during a session, and loads normally after it ends (T1, T2).

### TASK-008 · Review and outcome
**Files:** `app/review/[sessionId]/page.tsx`, `app/api/sessions/[id]/outcome/route.ts`
**Contract:**
- Server component: one `group by domain, kind` over `event`, ordered by seconds descending; `away` shown as its own row (FLOW Q1 provisional); `block_hit` shown as a count.
- Ownership: the session's `user_id` must equal the Clerk user's, else 404 (**INV-6**).
- `PATCH /api/sessions/:id/outcome` — Clerk session, body `{ outcome: 'yes' | 'no' }`, sets `answered_at`. The extension never writes an outcome.
- Dismissing without answering leaves `unanswered` — deliberate; it is how A3 gets tested (E5).
- `sw.js` opens `chrome.tabs.create({ url: <appUrl>/review/<id> })` on session end.
**Done when (US-04):** the review opens by itself at session end, shows intention beside per-domain seconds, and answering persists.

### TASK-009 · Dashboard ledger
**Files:** `app/dashboard/page.tsx`
**Contract:** sessions descending by `started_at` — intention, duration, top domain, outcome. Completion rate over answered sessions is the one headline number. **Total hours is not displayed as a headline anywhere** (PRD-F5). Empty state explains what will appear.
**Done when (US-05):** three sessions visible with outcomes and a completion rate.

### TASK-010 · Verification and rehearsal
Run §8. Rehearse the demo script (build-intent §5) twice with no reload. Record what was cut in build-intent §7.

---

## 7. Shared contracts

### 7.1 API

| Method | Route | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/pair` | Clerk | — | `{ code, expiresAt }` |
| POST | `/api/pair/claim` | code | `{ code }` | `{ deviceId, token }` \| 401 |
| POST | `/api/sessions` | Bearer | `{ intention, plannedMinutes, blocklist, startedAt }` | `{ sessionId }` |
| PATCH | `/api/sessions/:id` | Bearer | `{ endedAt, endReason }` | `{ ok }` |
| POST | `/api/events` | Bearer | `{ sessionId, events: [{ kind, domain, seconds, at }] }` | `{ accepted }` |
| PATCH | `/api/sessions/:id/outcome` | Clerk | `{ outcome }` | `{ ok }` |

Errors are `{ error: string }` with 400 (bad body), 401 (bad or missing credential), 404 (not yours / not found). No 403 anywhere — SDD V3.

### 7.2 `chrome.storage.local` keys

| Key | Shape | Written by |
|---|---|---|
| `token` | `string` | TASK-004 |
| `apiBase` | `string` | TASK-004 |
| `deviceId` | `string` | TASK-004 |
| `session` | `{ sessionId, intention, startedAt, plannedMinutes, currentDomain, currentSince, unfocusedSince: number \| null, ruleIds: number[] }` \| `null` | TASK-005, 006, 007 |
| `queue` | `Array<{ method, path, body, at }>` | TASK-004 |

Five keys. `session` is the whole of INV-1 — if elapsed time is ever read from anywhere else, the rule is broken. `unfocusedSince` was added by TASK-006: focus loss has to be timed without discarding the domain the time belongs to. `queue` holds queued `post()` calls, not raw events — TASK-006's flush replays these records verbatim.

### 7.3 Event kinds

`attention` (domain, seconds) · `away` (no domain, seconds) · `block_hit` (domain, no seconds). Three. Adding a fourth means adding a metric to PRD §8 first.

### 7.4 Correction to SDD V4

SDD V4 said no host permissions. That is wrong for a redirect-based block page: unsafe rules require host access for the request URL, and the redirect target must be web-accessible. The corrected rule is INV-5 — per-domain host permissions matching the hardcoded blocklists, never `<all_urls>`. SDD §5 has been amended.

---

## 8. Verification map

| Case (SDD §8.1) | Proved by | Blocking? |
|---|---|---|
| T1 start installs rules | TASK-007 | **yes** |
| T2 stop removes every rule | TASK-007 | **yes — INV-3** |
| T3 attribution across tab switches | TASK-006 | no |
| T4 worker death loses nothing | TASK-005 | **yes — INV-1** |
| T5 browser close recovers | TASK-005 | no |
| T6 offline queueing | TASK-004 (`api.js`) | no |
| T7 cross-account isolation | TASK-008 | **yes — INV-6** |
| T8 expired pairing code | TASK-003 | no |

Release needs T1, T2, T4, T7 plus the demo running twice (SDD §8.3).

---

## 9. Do not

| Don't | Instead | Why |
|---|---|---|
| `setInterval` / accumulate elapsed time | Compute from `startedAt` | INV-1 — worker dies at 30s |
| `webRequest` blocking | `declarativeNetRequest` | Not available to MV3 for blocking |
| `<all_urls>` host permission | Per-domain, from the blocklists | INV-5, and it is what makes the extension reviewable |
| Store `tab.url` or `tab.title` | `new URL(url).hostname` | INV-2 |
| Add Redux/Zustand/Prisma/an ORM/a UI kit | `chrome.storage.local`, raw SQL, plain CSS | Four hours; INV-4 |
| Add error tracking or analytics "quickly" | The `event` table already answers every metric | INV-4 |
| Show total hours on the dashboard | Completion rate | PRD-F5 — hours are the metric this product demotes |
| Force an answer on the review | Allow dismissal, record `unanswered` | E5 — forcing it destroys the A3 signal |

---

## 10. Run evidence

| When | Task | Event | Evidence |
|---|---|---|---|
| 2026-08-18 | TASK-001 | Neon + Clerk provisioned via `vercel integration add`; `lib/schema.sql` applied to live DB | `select tablename from pg_tables where schemaname='public'` → `device, pairing_code, session, event`; `select * from session` → 0 rows, no error |
| 2026-08-18 | TASK-002 | Shell + Clerk auth + `proxy.ts` + empty dashboard landed | `npx tsc --noEmit` exit 0; `npm run build` exit 0; `curl -i -X POST localhost:3000/api/events` → `401`, `content-type: application/json`, `{"error":"unauthorized"}`, no `location:` header |
| 2026-08-19 | TASK-003 | Pairing API + page landed, commits `2eb1524`, `1b78ac1`, `7bc5171` | `npx tsc --noEmit` exit 0; seeded code `TEST23` claimed once → response included a `deviceId` and a `token` field (values not recorded here — plaintext token is never persisted anywhere, SDD V1); same code claimed again → `{"error":"unauthorized"}` (401), confirming the atomic claim rejects a double claim; unauthenticated `POST /api/pair` → 401; `/pair` served 200 HTML |
| 2026-08-19 | TASK-004 | Extension skeleton + pairing landed, commit `b32cbb6` | `node --check extension/api.js` and `popup.js` both OK; `python3 -m json.tool` on `manifest.json` OK; `host_permissions` is `["http://localhost:3000/*"]` only, no wildcard; read-verified `queue.push({ method, path, body, at })` shape in `api.js` and that a thrown `fetch` (network failure only) is what reaches the queue, not a 401 response |

| 2026-08-19 | TASK-005 | Device auth + `POST /api/sessions` + `PATCH /api/sessions/:id` landed, commit `a6b43cd` | `npx tsc --noEmit` exit 0 (re-run 2026-08-19, still exit 0); read-verified `deviceFromRequest` is called and its null case returns 401 before `req.json()` in all three routes; read-verified `PATCH .../:id`'s `where` clause carries `device_id` and `user_id` together with `ended_at is null`, so a foreign or already-ended session 404s |
| 2026-08-19 | TASK-005 | `sw.js` start/stop + `popup.js` idle/running controls landed, commit `239652a` | `node --check extension/sw.js && node --check extension/popup.js` — both parse; `grep -nE 'setInterval\|setTimeout\|^let \|^var ' extension/sw.js` → no match, only the "sw.js clean" fallback line printed, confirming no timer or module-level mutable state in the worker (INV-1) |
| 2026-08-19 | TASK-006 | `POST /api/events` route landed, commit `a6b43cd`; attribution/away/flush landed in `sw.js`, commit `3e0afbf` | read-verified the route rejects the whole batch (400, no insert) on any event whose `domain` matches `/[/?#]/`; `grep -c 'chrome.storage.local.get' extension/sw.js` → 4 reads, confirming state is re-read rather than trusted from a stale variable; `node --check extension/sw.js` parses; queue/flush code read-verified to coalesce per-session and replay non-event records in order |
| 2026-08-19 | TASK-007 | Blocklists, block page, manifest landed, commit `87a026a`; rule install/removal wired into `sw.js`, commit `e5e9cd5` | `node --check extension/blocklists.js && node --check extension/blocked.js` — both parse; `python3 -c "import json; ..."` → 15 host permissions (14 blocklist domains + localhost), `"all_urls" in json.dumps(m)` → `False`; `grep -n 'removeAllRules' extension/sw.js` → appears in `endSession`'s `finally`, in `onInstalled`, and in `onStartup`'s else branch — not only on the happy path (INV-3) |

Outstanding, human-only (not yet run — do not read as passing): signed-in `/pair` showing a real code; load-unpacked pairing flipping the popup to idle with a `device` row attributed to the real Clerk user; a devtools-offline `post()` queuing instead of throwing; **T1** start installs rules in a real browser; **T2** stop removes every rule in a real browser; **T3** attribution across real tab switches; **T4** killing the worker mid-session from `chrome://serviceworker-internals` and confirming nothing is lost; **T6** offline queueing observed in devtools. None of these were run this session — no dev server or loaded extension was live — and none are recorded as passing.

Also outstanding, not human-only but not run this session for lack of a live dev server/DB: Task 1's Step 5–7 live-route checks (curl against `:3000`, seeding a pairing code, confirming row counts in Neon) and Task 1–5's end-to-end demo rehearsal. Only the static checks above (parse, grep, tsc, JSON shape) were actually executed.

| 2026-08-19 | TASK-008 | Review page + outcome route landed, commit `c809425` | Dev server started locally for this check only: `curl -s -o /dev/null -w 'no-clerk-session:%{http_code}\n' -X PATCH localhost:3000/api/sessions/00000000-0000-0000-0000-000000000000/outcome -H 'content-type: application/json' -d '{"outcome":"yes"}'` → `no-clerk-session:401`, proving the route sits inside the Clerk matcher; seeded a foreign session (`user_someone_else`, device `hash_review_check`) via a direct Neon insert — id `313b9b93-7505-482e-b726-d467c7395c44` — left in place because the human browser 404 check (T7) has not run yet; read-verified the ownership `where … and user_id = ${userId}` clause and the UUID guard in `route.ts` and `page.tsx` |
| 2026-08-19 | TASK-009 | Dashboard ledger landed, commit `73ab0d3` | `select outcome, count(*) from session group by outcome` against live Neon → `[{ outcome: 'unanswered', count: 1 }]` (only the seeded foreign row exists; no `yes`/`no` rows yet to check the rate arithmetic against, so `N of M` is unverified with real answered data — code path read-verified against the same `filter (where outcome = 'yes')` / `filter (where outcome in ('yes','no'))` shape used in the review page); `grep -niE 'total|hours|hrs' app/dashboard/page.tsx` → no match, printed `no hours figure in the ledger` |
| 2026-08-19 | TASK-005/006/007 (Task 3 of this plan) | `sw.js` opens the review after session end, commit `3086472` | `node --check extension/sw.js` parses; `grep -nE 'setInterval\|setTimeout' extension/sw.js` → no match, printed `no timers in sw.js`; `grep -n -A4 'finally' extension/sw.js` → `removeAllRules()`, `chrome.alarms.clear`, `chrome.storage.local.set({ session: null })` are the only three statements in the `finally`; `chrome.tabs.create` is read-verified to sit after the `finally` block, gated on `endReason === 'stopped' \|\| 'elapsed'` — INV-3 intact |

**Outstanding, release-blocking, not run by anyone this session — do not read any of these as passing:** T1 (rules install), T2 (every rule removed), T4 (worker death loses nothing), T7 (cross-account isolation, browser half — the foreign session above is seeded and waiting for it), and the full two-run demo rehearsal. No agent in this session has a browser or a Clerk session; all five require a human.

Fact-only. Fill during the build; leave prediction out of it.

---

## 11. Change log

| Date | Change |
|---|---|
| 2026-08-18 | Created. SDD V4 corrected in §7.4 (redirect rules need per-domain host permissions). |
| 2026-08-18 | Pairing code chosen over Clerk's Chrome-extension sync host: sync host requires Plasmo + `PLASMO_PUBLIC_CLERK_*` env vars + `host_permissions` on the Clerk Frontend API + registering the extension ID in `allowed_origins`, which contradicts the no-bundler build intent (B1). Pairing code is fully spec'd in §6 TASK-003 with zero toolchain. No spike run. |
| 2026-08-18 | `middleware.ts` → `proxy.ts`: Next.js 16.3.1 renamed the file convention (nextjs.org/docs/app/api-reference/file-conventions/proxy, Clerk's Next.js docs follow suit). §3 and §6/TASK-002 updated. Same `clerkMiddleware()` export, root-level file, new name only. |
| 2026-08-19 | Host permission for `http://localhost:3000/*` moved from TASK-007 to TASK-004, because MV3 blocks cross-origin fetch from extension pages without it, so pairing cannot work at all. INV-5 is intact — the ban is on `<all_urls>`, not on the extension's own backend. The production origin joins when a deployment exists. |
| 2026-08-19 | The `queue` storage key holds `{ method, path, body, at }` records rather than raw events, because a generic `post()` cannot queue two shapes and an offline `POST /api/sessions` would otherwise have nowhere to go. TASK-006's flush replays records verbatim. |
| 2026-08-19 | §7.2 amended: `session` gains `unfocusedSince: number \| null`. Focus loss has to be timed without discarding the domain the time belongs to. |
| 2026-08-19 | §6 TASK-007 amended: the redirect target is `redirect.url = chrome.runtime.getURL('blocked.html?d=<hostname>')`, not `extensionPath`, so `blocked.js` can record `block_hit` (EV5) with the attempted hostname — `redirect.url` takes a full URL, `extensionPath`'s query-string support is not documented. Hostname only, INV-2 intact. |
| 2026-08-19 | §6 TASK-006 amended: events buffer in the existing top-level `queue` as `/api/events` records; the flush coalesces every event record for a session into one request and replays the rest in order. No sixth storage key. |
| 2026-08-19 | §5/§6 TASK-005 amended: write scope gains `extension/popup.js` (a session cannot start without a Start control). TASK-005, TASK-006, TASK-007 flipped to done and TASK-008 to ready — verified against the landed code in commits `a6b43cd`, `87a026a`, `239652a`, `3e0afbf`, `e5e9cd5`. |
| 2026-08-19 | PRD Q1 answered: three blocklists, 14 domains total — social (x.com, twitter.com, facebook.com, instagram.com, reddit.com, linkedin.com, tiktok.com), video (youtube.com, twitch.tv, netflix.com), news (news.ycombinator.com, bbc.co.uk, cnn.com, theguardian.com). Hardcoded in `extension/blocklists.js`. |
| 2026-08-19 | Known limitation: starting a session requires the network. `POST /api/sessions` mints the session id server-side, and `startSession` returns `{ ok: false, offline }` when that call fails — there is no offline path for session start (only for events/end, via the queue). |
| 2026-08-19 | `app/review/[sessionId]/answer.tsx` joins §3's file list: the two answer buttons need a client boundary, and the page stays a server component. |
| 2026-08-19 | `sw.js` opens the review for `stopped` and `elapsed` only — a `recovered` session ends during browser startup and a `superseded` one because another just began. The tab opens after cleanup, so INV-3 is untouched. |
| 2026-08-19 | The review's gap label is total away time. §9's sample derives it from an on-task/drift split, but build-intent §3 cut categories, so that split cannot be computed honestly. `away` is a recorded event kind, not a judgment about a domain. |
| 2026-08-19 | `You didn't say what you meant to do.` is invented copy for the empty-intention case, in design-toolkit §8's voice, flagged for the design session to ratify. US-01 makes empty intentions legal and A2 needs them counted. |

---

## Self-Check

- [x] Every `TASK-###` names files, a contract, and a done-when that can fail
- [x] Every done-when traces to a `US-##` or an SDD §8.1 case
- [x] The six invariants appear before any task, and each is attributed to the doc it came from
- [x] Shared contracts appear once; no task restates an endpoint shape
- [x] The one correction to an upstream doc is stated, not silently applied
- [x] No file appears in a task that is absent from §3
- [x] Registered in `docs/index.md`
