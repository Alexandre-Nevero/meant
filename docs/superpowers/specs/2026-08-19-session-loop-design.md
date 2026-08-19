# Design — Sessions, attention, blocking (BUILD 3 of 4)

**Date:** 2026-08-19 · **Traces to:** build.md TASK-005/006/007 · PRD US-01, US-02, US-03 · FLOW E1–E3, E7, EV1–EV6 · SDD §1

## Problem

The extension can authenticate but does nothing. This hour makes the product exist: a session with a declared intention, passive attention recording, and blocking that dies with the session. The review page is prompt 4 and is out of scope.

## The constraint everything else follows from

An MV3 service worker is killed after ~30s idle, and `chrome.alarms` cannot tick faster than 30s. **No state lives in memory.** A session is a timestamp in `chrome.storage.local`; elapsed time is always `now − storedTimestamp`. A `setInterval` in the worker reintroduces the bug silently and it surfaces during the demo, not before.

One consequence is easy to get backwards: the worker wakes constantly, so "on startup, close any open session as `recovered`" must bind to `chrome.runtime.onStartup` alone. Bound to worker wake, it would kill a live session every 30 seconds.

## Ownership

The popup never writes session state. It sends `{type:'start'|'stop'}` and renders from storage. The worker owns the lifecycle — one writer, no races between a popup and an alarm.

## Session state — one key, seven fields

```
session = { sessionId, intention, startedAt, plannedMinutes, currentDomain, currentSince, unfocusedSince, ruleIds }
```

`unfocusedSince` is new (amendment 1 below). Without it, focus loss has to be encoded by nulling `currentDomain`, which throws away the domain the time belongs to — and a sub-60s gap must return to that domain.

## Attention model

| Trigger | Action |
|---|---|
| `tabs.onActivated`, `tabs.onUpdated` (only when `changeInfo.url` is set) | `attribute(nextDomain)` — closes the open segment, opens a new one |
| `windows.onFocusChanged` → `WINDOW_ID_NONE` | stamp `unfocusedSince`. Nothing is attributed yet |
| `windows.onFocusChanged` → a real window, or the 30s alarm | settle focus: gap > 60s → emit `away` for the gap and reset `currentSince` to now; gap ≤ 60s → do nothing, so the time stays with the domain that was open |
| 30s alarm | settle focus, flush the queue, end the session if `plannedMinutes` has elapsed |

`domain` is `new URL(tab.url).hostname`, nothing else, ever (INV-2). `POST /api/events` re-checks it and rejects any domain containing `/`, `?`, or `#` — the invariant is enforced at the boundary, not trusted at the source.

A segment of 0 seconds is dropped. Anything ≥1s is sent; filtering short visits is a display decision (SDD Q2).

## Blocking

Three hardcoded lists (PRD Q1, answered this build):

- **social** — x.com, twitter.com, facebook.com, instagram.com, reddit.com, linkedin.com, tiktok.com
- **video** — youtube.com, twitch.tv, netflix.com
- **news** — news.ycombinator.com, bbc.co.uk, cnn.com, theguardian.com

Each domain appears in `host_permissions` and in `web_accessible_resources.matches` as `*://*.<domain>/*`. Never `<all_urls>` (INV-5). On start, one dynamic rule per domain of the chosen list, `condition.requestDomains`, `resourceTypes: ["main_frame"]`, `action.type: "redirect"`. Rule ids are recorded in `session.ruleIds`.

**Rule removal is the release-blocking invariant (INV-3).** Removal runs in a `finally`, so a failing flush or a dead network cannot leave a rule alive. Recovery additionally clears *every* dynamic rule via `getDynamicRules()`, not only the recorded ids — a crash between minting ids and storing them would otherwise strand rules with no record of them.

E7 holds: an already-open blocked tab is not closed retroactively. Only new navigations redirect.

## Four amendments, stated rather than applied silently

1. **`session` gains `unfocusedSince`.** Reason above. §7.2 and §6 TASK-005 both updated.
2. **Redirect uses `redirect.url`, not `extensionPath`.** The rule redirects to `chrome.runtime.getURL('blocked.html?d=<hostname>')` so the block page knows which domain was attempted and can record `block_hit` (EV5, needed by TASK-008's count). `redirect.url` is documented to take a full URL; `extensionPath`'s support for a query string is not documented. Hostname only, so INV-2 holds.
3. **Events buffer in the existing top-level `queue`.** `attribute()` appends a `/api/events` record; the alarm's flush coalesces every event record for the session into one request and replays the rest in order. No sixth storage key, and the offline path is the one `api.js` already has.
4. **TASK-005's write scope adds `extension/popup.js`.** A session cannot start without a Start control.

## Known limitation, recorded not hidden

Starting a session requires the network — the server mints the session id. Offline start fails visibly in the popup rather than queueing. E3 covers events during a session, not session creation. Fixing it means client-generated ids, which is not this hour's work.

## Verification (manual — no test framework, build.md §1)

| # | Case | Method | Pass |
|---|---|---|---|
| T3 | Attribution across tabs | three tabs, ~1 min each, then read `event` | three `attention` rows, sane seconds |
| T4 | Worker death | `chrome://serviceworker-internals` → Stop mid-session, wait, switch tabs | session still running, time still accruing |
| T1 | Rules install | start, open a blocked domain | block page showing your own intention |
| T2 | Rules removed | stop, reopen the same domain | loads normally; `getDynamicRules()` returns `[]` |
| T6 | Offline | devtools offline, switch tabs, back online | events arrive, nothing lost |
