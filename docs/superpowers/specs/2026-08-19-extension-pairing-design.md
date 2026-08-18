# Design — Extension pairing (BUILD 2 of 4)

**Date:** 2026-08-19 · **Traces to:** build.md TASK-003, TASK-004 · PRD US-06 · SDD V1, V2, §4.2

## Problem

The extension has no identity. Prompt 1 shipped a signed-in web app and an empty `device` table. This hour gives the extension a credential attributable to a real Clerk account, and gives every later request a transport that survives being offline. No session logic.

Extension auth decision (build.md §11): **pairing code**. Sync host was rejected because it requires Plasmo, `PLASMO_PUBLIC_CLERK_*`, host permissions on the Clerk Frontend API, and extension-ID registration in `allowed_origins`, all against build-intent B1.

## Flow

```
/pair (Clerk session)  --POST /api/pair-->        pairing_code row, 10 min TTL
       shows 6 chars
              user types code into popup
popup  --POST /api/pair/claim {code}-->  atomic claim -> device row (sha256 token)
       <-- { deviceId, token }  (only transmission of the plaintext, ever)
       token in chrome.storage.local -> popup flips unpaired -> idle
```

## Components

| Unit | Does | Does not |
|---|---|---|
| `POST /api/pair` | Clerk session; mints a code, returns `{ code, expiresAt }` | Know anything about devices |
| `POST /api/pair/claim` | Public + code. Atomic claim, mints token, inserts `device` | Trust a Clerk session; the extension has none |
| `app/pair/page.tsx` | Calls `/api/pair` on mount, shows code + expiry | Poll for claim status |
| `extension/api.js` | `post(path, body)`: base URL, Bearer header, queue on network failure | Throw on network failure |
| `extension/popup.js` | Three states from storage: unpaired, idle, running | Start or stop a session (prompt 3) |
| `extension/manifest.json` | MV3, four permissions, popup, module service worker | Declare blocklist hosts (TASK-007) |
| `extension/sw.js` | Empty placeholder so the manifest loads | Anything (TASK-005) |

## Contracts

**Code:** 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `expires_at = now() + 10 min`.

**Claim, atomic and honest about it:**

```sql
update pairing_code set claimed_at = now()
 where code = $1 and claimed_at is null and expires_at > now()
 returning user_id
```

Zero rows returned → 401. The returning row count *is* the affected row count, so nothing is inferred. `user_id` comes from that row — the claim never reads a Clerk session.

**Token (SDD V1):** `randomBytes(32).toString('base64url')`; stored as `sha256` hex in `device.token_hash`; returned once, at claim.

**Storage keys (build.md §7.2):** `token`, `apiBase`, `session`, `queue`.

## Two amendments, stated rather than applied silently

1. **Host permission for the API origin, now, not in TASK-007.** MV3 blocks cross-origin fetch from extension pages and workers without a host permission (developer.chrome.com — extension network requests). Without it, pairing cannot work at all. `host_permissions: ["http://localhost:3000/*"]` only; the prod origin joins it when a deployment exists. INV-5 is intact — the ban is on `<all_urls>`, not on the extension's own backend.
2. **`queue` holds `{ path, body, at }` records, not raw events.** §7.2 said events. A generic `post()` cannot queue two shapes, and an offline `POST /api/sessions` would otherwise have nowhere to go. TASK-006's flush replays records verbatim.

Both land in build.md §7.2 / §11.

## Errors

| Case | Behavior |
|---|---|
| Wrong, expired, or already-claimed code | 401 `{ error }`; popup says so and stays unpaired (US-06) |
| Network down at claim | Claim is not queued — pairing is interactive. Popup shows the failure |
| Network down at any other `post()` | Payload appended to `queue`, `post()` resolves `{ queued: true }` |
| Missing Bearer on a device route | 401 before the body is read |

## Not in scope

Session start/stop, attention events, blocking, unpair UI, device labels, multi-device.

## Verification (manual — no test framework in v1, build.md §1)

1. `/pair` shows a code; popup accepts it; popup flips to idle; `select user_id from device` matches the Clerk user.
2. Same code claimed twice → second is 401 (`curl` twice).
3. Popup devtools offline → `post('/api/events', …)` resolves and `chrome.storage.local.queue` grows by one.
