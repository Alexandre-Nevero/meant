# User Flow

**Project:** Intent
**Date:** 2026-08-18
**Version:** 0.1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Upstream:** [prd-intent.md](prd-intent.md), [sitemap-intent.md](sitemap-intent.md)

---

## 1. Flow Inventory

| ID | Flow | Frequency | Serves |
|---|---|---|---|
| UF1 | Run a session, end to end | Several times a day — *the product* | PRD-F1..F5 |
| UF2 | First run: sign in and pair | Once | PRD-F6 |
| UF3 | Review a past session from the ledger | Occasional | PRD-F5 |

---

## 2. Primary Flow — UF1

```
Popup: type "finish the supplier report", pick a blocklist, Start
   │
   ├─▶ block rules installed          (EV2)
   ├─▶ session row created            (EV1)
   │
   ▼
Work happens. Nothing is asked of the user.
   │   active tab / URL changes ──▶ time attributed to the previous domain   (EV3)
   │   browser unfocused > 60s  ──▶ time attributed to "away"                (EV4)
   │   blocked domain opened    ──▶ block page shows the intention           (EV5)
   │
   ▼
Stop (or the chosen duration elapses)
   │
   ├─▶ block rules removed
   ├─▶ session closed                 (EV6)
   ▼
Review tab opens automatically
   "You said: finish the supplier report"
   claude.ai 41m · docs.google.com 12m · news site 9m · away 6m
   2 blocked attempts
   Did you finish it?   [ Yes ]  [ No ]
   │
   ▼                                  (EV7)
Dashboard: 3 sessions, 2 completed
```

**The whole product is this one screen at the end.** Everything before it exists to make that screen true.

---

## 3. Onboarding and First Value

| Step | Screen | Cost |
|---|---|---|
| 1 | Install the extension (unpacked in v1) | ~30s |
| 2 | Sign in on the web app (S1) | ~30s |
| 3 | Copy the pairing code (S2) into the popup (S7) | ~20s |
| 4 | Type an intention and press Start (S5) | ~10s |
| 5 | **First value:** the review at the end of the first session (S4) | one session later |

First value is one session away, not one week away. This is the strongest argument for having cut calibration from v1 — calibration's first value is weeks away, and nobody would still be here.

---

## 4. Flow Detail

### UF1 · Run a session
Preconditions: paired device, signed-in account.
Success: a session row with an intention, a set of attention rows summing to roughly the session duration, and an outcome that is `yes` or `no`.
Failure modes: see §5.

### UF2 · First run
Preconditions: extension installed.
Success: the extension holds a device token and the popup shows the idle state.
Failure: an expired or mistyped code leaves the extension unpaired with a stated reason. Codes are re-issuable without limit.

### UF3 · Review a past session
Entry from the dashboard. Identical to S4 in every respect except that the outcome may already be answered, in which case it is shown and can be changed.

---

## 5. Edge Case Matrix

| # | Case | Behavior | Why this way |
|---|---|---|---|
| E1 | Service worker terminated mid-session (happens after 30s idle — SDD §1) | State is reconstructed from persisted timestamps on next wake | Not an edge case; the normal path. A timer in memory would be wrong within a minute |
| E2 | Browser closed mid-session | On next start the session is found open and closed at its last recorded event, flagged `ended_unexpectedly` | Losing the session entirely would silently corrupt M1 and M3 |
| E3 | Network down when an event fires | Events queue in local storage and flush when the API answers | The tracker must not depend on connectivity to be honest |
| E4 | Two windows, or two profiles | Attention follows the focused window; a second Chrome profile is a separate unpaired browser and is invisible | Known blind spot. Named in A4, untested in v1 by decision |
| E5 | User dismisses the review tab | Session stored with outcome `unanswered` | Counting the dismissals is how A3 gets tested. Forcing an answer would destroy the signal |
| E6 | Session runs past midnight or for 8 hours | Recorded as one session; no auto-split in v1 | Simpler, and rare enough to accept |
| E7 | A blocked site is opened before the session starts and stays open | The tab is not closed retroactively; only new navigations are blocked | Closing tabs a user opened is more hostile than v1 has earned |
| E8 | Device token revoked or invalid | Extension returns to unpaired and stops recording; queued events are kept | Silent data loss is worse than a visible stop |

---

## 6. Instrumentation and Events

| ID | Event | Fires when | Feeds |
|---|---|---|---|
| EV1 | `session_started` | Start pressed | M1, M2 (records whether the intention was empty) |
| EV2 | `rules_installed` | Block rules registered | PRD-F2 verification |
| EV3 | `attention_recorded` | Active tab or URL changes | M4, the review |
| EV4 | `away_recorded` | Browser unfocused > 60s | M4, A1 |
| EV5 | `block_hit` | A blocked navigation is intercepted | A4, the review |
| EV6 | `session_ended` | Stop, duration elapsed, or recovery from E2 | M1 |
| EV7 | `outcome_answered` | Yes / No pressed on the review | M3, A3, the ledger |

Seven events. Every metric in PRD §8 is derivable from these; nothing here exists for curiosity.

---

## 7. Cross-Flow Rules

- Only one session may be open at a time per account. Starting a second closes the first (EV6, flagged).
- The product interrupts the user exactly once per session — the review tab. There are no other notifications in v1.
- Block rules are owned by the session. There is no path in the code by which a rule outlives the session that installed it; this is the one invariant a bug in must be treated as release-blocking.

---

## 8. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Is 60 seconds the right away threshold, or is it 30? | EV4 | Alexandre — decide from the first week's own data |

---

## Self-Check

- [x] Every `UF#` names its preconditions, success state, and failure modes
- [x] Every `EV#` feeds a metric in PRD §8
- [x] The edge case matrix covers the service worker lifecycle, browser close, offline, and dismissal
- [x] First value is reachable in one session
- [x] Registered in `docs/index.md`
