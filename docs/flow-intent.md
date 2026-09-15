# User Flow

**Project:** MEANT
**Date:** 2026-08-18
**Version:** 0.2
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** 2026-09-11
**Upstream:** [prd-intent.md](prd-intent.md), [sitemap-intent.md](sitemap-intent.md)

> **Amendment 0.2c (2026-09-11).** PRD-F8 (the plan) was cut 2026-09-04 (ADR-0048/D38) and this
> document never caught up: EV8/EV9/EV10/EV14 are struck through below (they never fire), E12 is
> void, and EV15 is narrowed to the judge-correction it still describes. See `docs/prd-intent.md`
> amendment 0.2c for the full reconciliation this mirrors.
>
> **Amendment 0.2 (2026-08-28).** UF1 gains the plan, the judge, and the companion. Eight events added. Four edge cases added, all of them about the new dependency failing or the new permission being declined — the paths most likely to be skipped and most certain to happen.

---

## 1. Flow Inventory

| ID | Flow | Frequency | Serves |
|---|---|---|---|
| UF1 | Run a session, end to end | Several times a day — *the product* | PRD-F1..F5, F8..F12 |
| UF2 | First run: sign in and pair | Once | PRD-F6 |
| UF3 | Review a past session from the ledger | Occasional | PRD-F5 |
| **UF4** | **Enable deep judging and grant page access** | **Once, and only if the user chooses to** | **PRD-F9, SDD §5.2** |

---

## 2. Primary Flow — UF1

```
Popup: type "finish the client proposal", pick a blocklist, Start
   │
   ├─▶ session row created            (EV1)      ◀── returns in <200ms
   ├─▶ block rules installed          (EV2)
   ├─▶ companion opens, facing the work
   │
   ▼
   [PRD-F8, the plan, was cut 2026-09-04 (ADR-0048/D38) — EV8/EV9 never fire]
Work happens. Nothing is asked of the user. Nothing is celebrated.
   │   active tab / URL changes ──▶ time attributed to previous domain      (EV3)
   │                            └─▶ memory hit?  verdict, no model call     (EV11)
   │                                memory miss? judge, then cache it       (EV11)
   │   verdict = drifts, above the floor, past 60s
   │                            ──▶ companion turns to face you             (EV12)
   │   you come back                                                        (EV13)
   │   [no step-marking — PRD-F8 cut; EV14 never fires]
   │   you un-mark it           ──▶ correction stored as a label            (EV15)
   │   browser unfocused > 60s  ──▶ time attributed to "away"               (EV4)
   │   blocked domain opened    ──▶ block page shows the intention          (EV5)
   │
   ▼
Stop (or the chosen duration elapses)
   │
   ├─▶ block rules removed
   ├─▶ companion closes
   ├─▶ session closed                 (EV6)
   ▼
Review tab opens automatically
   "You said: finish the client proposal"
   ✓ outline the scope   ✓ write the pricing section   ○ send it
   claude.ai 41m · docs.google.com 12m · news site 9m · away 6m
   2 blocked attempts · drifted twice, back within 90s both times
   The coach speaks: what it saw, and one suggestion with a button      (EV16, EV17)
   Did you finish it?   [ Yes ]  [ Not yet ]
   │
   ▼                                  (EV7)
Dashboard: 3 sessions, 2 completed
```

**The whole product is this one screen at the end.** Everything before it — the plan, the blocking, the judging, the companion — exists to make that screen true. None of it counts on its own: checked steps never enter the ledger (I8), and the coach says the same things whether the answer is Yes or Not yet (I3).

---

## 3. Onboarding and First Value

| Step | Screen | Cost |
|---|---|---|
| 1 | Install the extension (unpacked in v1) | ~30s |
| 2 | Sign in on the web app (S1) | ~30s |
| 3 | Copy the pairing code (S2) into the popup (S7) | ~20s |
| 4 | Type an intention and press Start (S5) | ~10s |
| 5 | **First value:** the review at the end of the first session (S4) | one session later |

First value is one session away, not one week away.

**Nothing anywhere in the product asks for page access. Updated 2026-09-15 (ADR-0061):** the tiers are gone and there is no permission prompt to place, early or late. The judge runs after the session on hostname, path, dwell, sequence and the declared sites — **it never reads page text or page titles.** The paragraph this replaces argued for deferring the prompt until after first value; the prompt no longer exists, which is strictly better than a well-timed one.

**Second value, and the reason they stay, is weeks away by design:** memory. Calibration was cut from 0.1 for exactly this reason and returns at 0.2 as PRD-F11 — but it is deliberately not the first thing anyone sees, and the coach stays silent about patterns until the evidence threshold clears (I6).

---

## 4. Flow Detail

### UF1 · Run a session
Preconditions: paired device, signed-in account.
Success: a session row with an intention, a plan (or an honest `failed`), attention rows summing to roughly the session duration, judgments for the domains visited, and an outcome that is `yes` or `no`.
Failure modes: see §5. Note that E9 through E12 all degrade the session rather than ending it — a session that produced no verdicts is still a valid session.

### UF2 · First run
Preconditions: extension installed.
Success: the extension holds a device token and the popup shows the idle state.
Failure: an expired or mistyped code leaves the extension unpaired with a stated reason. Codes are re-issuable without limit.

### UF3 · Review a past session
Entry from the dashboard. Identical to S4 in every respect except that the outcome may already be answered, in which case it is shown and can be changed.

### ~~UF4 · Enable deep judging~~ — **VOID 2026-09-15 (ADR-0061)**
This flow described granting `chrome.permissions.request()` to unlock a page-text judging tier.
**No such tier exists and no such prompt is ever shown.** The judge runs after the session on
hostname, path, dwell, sequence, the declared work/distraction sites and the outcome answer, and
page text is never read at all. There is nothing to enable, decline, or revoke. **E10 is void with
it.**

**Replaced by nothing, deliberately.** The scariest screen in the funnel is gone rather than
well-timed — which also removes a decision point, a failure mode and a step from the rebuild manual
(`apexhuman.md` rule 2, *"zero decisions on the rebuild path"*).

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
| **E9** | AI Gateway unreachable, or over the V8 daily ceiling | No new verdicts, companion present but never turning, coach silent. Blocking, attention, review, ledger and the outcome question all work | The product must survive its own fourth service. This is the K4 escape hatch and it is tested (T10), not hoped for |
| ~~**E10**~~ | ~~User declines or revokes broad page access~~ | **VOID 2026-09-15 (ADR-0061).** No page-access permission is ever requested, so neither state can occur | The principle it protected — never nag for a declined permission — survives as a rule with nothing left to apply to |
| **E11** | A verdict arrives after the user has already changed tabs again | Discarded, not shown | Signalling drift on a tab someone already left is the worst false positive available — it proves the thing is not watching, only guessing |
| ~~E12~~ | ~~Plan generation fails or returns nothing~~ | **Void — PRD-F8 (the plan) was cut 2026-09-04 (ADR-0048/D38), never built** | — |

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
| EV7 | `outcome_answered` | Yes / Not yet pressed on the review | M3, A3, the ledger |
| ~~EV8~~ | ~~`plan_requested`~~ | **Cut with PRD-F8 (ADR-0048/D38) — never fires** | — |
| ~~EV9~~ | ~~`plan_ready`~~ | **Cut with PRD-F8 — never fires** | — |
| ~~EV10~~ | ~~`plan_edited`~~ | **Cut with PRD-F8 — never fires** | — |
| **EV11** | `judgment_recorded` | A tab is classified, by model or by memory | **M7, M9** — carries `source`, so cost and cache-hit rate are one query |
| **EV12** | `drift_signalled` | The companion turns | M7 (denominator: judgments actually shown), N8 |
| **EV13** | `return_detected` | Attention comes back after a signalled drift | **M10** — and the thing the coach celebrates |
| ~~EV14~~ | ~~`task_marked`~~ | **Cut with PRD-F8 — there is no step to mark** | — |
| **EV15** | `judgment_corrected` | The user says "that was work" (the un-mark half is cut with `task_marked`; the drift-correction half is real, PRD-F9/US-10) | **M7** — every one of these is a training label |
| **EV16** | `suggestion_offered` | The coach proposes an executable action | I5 |
| **EV17** | `suggestion_accepted` | The button is pressed | PRD-F13 |

Seventeen events. Every metric in PRD §8 is derivable from these; nothing here exists for curiosity. EV11 and EV15 together are the whole of M7, which is the metric that decides whether the judge is allowed to keep speaking (K4).

---

## 7. Cross-Flow Rules

- Only one session may be open at a time per account. Starting a second closes the first (EV6, flagged).
- The product interrupts the user exactly once per session — the review tab. There are no other notifications in v1. **The companion turning is not an interruption and must never become one: no sound, no words, no colour change, no focus steal.**
- Block rules are owned by the session. There is no path in the code by which a rule outlives the session that installed it; a bug here is release-blocking.
- **Nothing waits on a model.** Start does not wait for the plan; a block does not wait for a verdict; a stale verdict is discarded (E11).
- **Nothing good happens on screen during a session** (I2). Every positive event — a completed step, a return from drift — is recorded and shown only in the review.
- **The companion's motion budget is three noticeable movements per 25 minutes, none in the first 60 seconds** (N8). Breathing and blinking are not movements.

---

## 8. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Is 60 seconds the right away threshold, or is it 30? | EV4 | Alexandre — decide from the first week's own data |
| **Q2** | Does the companion turn back after a return (EV13), and is that itself a movement against the budget? Turning back is the natural counterpart to turning away, and it is also the closest thing to celebration that could survive I2 | EV12, EV13, N8, I2 | **Provisionally answered: turns back, free.** `sw.js#updateCompanion` returns to `settled` the moment the next domain isn't drift, uncounted against the 3-per-25-min budget — the budget bounds arousal, and settling lowers it. Explicitly provisional: if a 25-minute recording shows the return turn reading as fussy, drop it for a silent timer instead (design plan, Phase 3) |
| **Q3** | Is a drift that the user resolves in under ~10 seconds worth signalling at all, or is the signal itself the interruption? | EV12, A9 | Alexandre — from the first week's own data |

---

## Self-Check

- [x] Every `UF#` names its preconditions, success state, and failure modes
- [x] Every `EV#` feeds a metric in PRD §8, an invariant, or a kill criterion
- [x] The edge case matrix covers the new dependency failing (E9) and the new permission being declined (E10)
- [x] No flow puts a model between a user and a page
- [x] The edge case matrix covers the service worker lifecycle, browser close, offline, and dismissal
- [x] First value is reachable in one session
- [x] Registered in `docs/index.md`
