# Product Requirements Document

**Project:** Intent
**Date:** 2026-08-18
**Version:** 0.1
**Cycle:** 1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Upstream:** [idea-intent.md](idea-intent.md)
**Downstream:** [sitemap-intent.md](sitemap-intent.md), [flow-intent.md](flow-intent.md), [sdd-intent.md](sdd-intent.md)

---

## 1. Purpose and Value

Intent closes the gap between what someone said they would finish and what their attention actually did. It is one browser extension plus one web app: declare the intention, protect it, record what happened, and answer one question at the end — did you finish it?

The number that accumulates is completed outcomes, not hours. Hours appear only as evidence inside a single session's review.

### 1.1 Foundation (reference copy — canonical in [idea-intent.md](idea-intent.md) §1)

| # | Field | Answer |
|---|---|---|
| 1 | One line | A browser extension plus dashboard that makes you say what you intend to finish, blocks what you chose to avoid, records where your attention went, and ends by asking whether you finished it |
| 2 | Problem event | 70 minutes, 14 tabs, no way to say whether the report moved |
| 3 | Primary user | A browser-native worker — corporate administrator, coordinator, AI-assisted builder |
| 4 | Pain moment | End of a work block, asked "did you finish it?", answering "I was working on it" |
| 5 | Insight | For a browser-native worker the browser is the whole workstation, so one extension sees intention, enforcement, and attention at once — no OS permissions, no admin rights |
| 6 | The one thing | The end-of-session review: intention beside actual attention, then did you finish it |

---

## 2. Users

| Who | Context | What they need from v1 |
|---|---|---|
| **Primary — the browser-native worker** | Corporate laptop, Chrome or Edge, no admin rights, works in documents, email, and AI chat all day | To find out, at the end of a block, whether the block produced the thing it was for |
| **Secondary — the builder** | Same behavior class, own machine, uses it daily | Enough friction-free daily use that A2 and A3 get tested for real |

**Not served in v1:** anyone whose work is mostly outside a browser (IDE, terminal, native design tools). v1 would see a fraction of their day and be confidently wrong about the rest.

---

## 3. Features and Priorities

| ID | Feature | Priority | Serves | Notes |
|---|---|---|---|---|
| PRD-F1 | Declare an intention and start a session | Must | A2, IDEA §4 | One text field, optional duration. Nothing else. |
| PRD-F2 | Block a chosen list of sites for the length of the session | Must | A4 | Dynamic MV3 rules, added on start, removed on end |
| PRD-F3 | Record attention passively while the session runs | Must | A1, IDEA §1.6 | Seconds per domain, plus away time |
| PRD-F4 | End-of-session review | Must | A3 — *this is the one thing* | Intention, time per domain, blocked attempts, then: did you finish it? |
| PRD-F5 | History — the outcome ledger | Must | IDEA §1.6 | Sessions listed with their outcome. Completion rate is the headline; total hours is not shown as a headline anywhere |
| PRD-F6 | Account and device pairing | Must (infrastructure) | A5 | Sign in on the web app; paste a one-time code into the extension |
| PRD-F7 | Edit the blocklist | Should | — | Three built-in lists plus add/remove a domain. Cut first if time runs out |

**Explicitly not features:** any ranking, score, streak, badge, or leaderboard. Calibration and rewards were cut in the 2026-08-18 design session and stay cut for v1 (IDEA §4).

---

## 4. User Stories and Acceptance Criteria

**US-01 — Declare (PRD-F1)**
As a browser-native worker, I want to state what I intend to finish before I start, so the session has something to be judged against.
- Given the extension popup is open and the device is paired, when I type an intention and press Start, then a session begins and its start time is recorded.
- Given the intention field is empty, when I press Start, then the session starts anyway and is recorded with an empty intention. *(Deliberate: A2 is only testable if empty intentions are possible and counted.)*

**US-02 — Protect (PRD-F2)**
As someone who has just committed to a task, I want the sites I chose to be unreachable while I work.
- Given a session is running with a blocklist, when I navigate to a blocked domain, then the request is blocked and a page shows my current intention and the time remaining.
- Given a session ends by any means, when the session record is closed, then every dynamic block rule added by that session is removed.

**US-03 — Observe (PRD-F3)**
As a user, I want the time to be recorded without me starting anything.
- Given a session is running, when the active tab changes or its URL changes, then the elapsed time is attributed to the previously active domain.
- Given the browser loses focus for more than 60 seconds, when focus returns, then that period is attributed to `away`, not to the last domain.
- Given the extension service worker is terminated mid-session, when it wakes, then the session state is reconstructed from stored timestamps with no loss beyond the current interval.

**US-04 — Review (PRD-F4)**
As a user, I want the session to end with a comparison and one question.
- Given a session ends, when the review opens, then it shows the intention, seconds per domain in descending order, away time, blocked attempts, and a yes/no question.
- Given the review is open, when I answer, then the outcome is stored against the session and the review closes.
- Given the review is open, when I dismiss it without answering, then the session is stored with outcome `unanswered` and counts against review completion in M3.

**US-05 — Ledger (PRD-F5)**
As a user, I want to see whether I finish what I say I will.
- Given at least one completed session, when I open the dashboard, then I see each session with its intention, duration, top domain, and outcome, plus a completion rate over all answered sessions.
- Given zero sessions, when I open the dashboard, then I see an empty state that explains what will appear here.

**US-06 — Pair (PRD-F6)**
As a new user, I want the extension connected to my account in under a minute.
- Given I am signed in on the web app, when I open the pairing screen, then a short code is displayed with a stated expiry.
- Given the extension is unpaired, when I paste a valid code, then the extension stores a token and every subsequent event is attributed to my account.
- Given a code is expired or wrong, when I paste it, then the extension says so and stays unpaired.

---

## 5. Out of Scope for This Release

| Not building | Why | Revisit |
|---|---|---|
| Calibration (predicting a task's real duration from your own history) | Needs weeks of data before it can say anything true | v2, once the ledger has real sessions |
| Rewards, streaks, scores | Extrinsic rewards on hours are the metric this product exists to demote; scoped narrowly or not at all | v2, and only on outcomes and estimate accuracy |
| Desktop / OS-level tracking and app blocking | Admin rights the target user does not have; weeks of signing work the build does not have | When browser-only proves the loop |
| Scheduled sessions, Locked Mode | Commitment devices belong on a product people already use daily | v2+ |
| Sync across devices and browsers, Firefox/Safari | One browser, one profile, one machine is enough to test every assumption | Later |
| Any AI classification of activity | Would require sending browsing data off-device; contradicts §7 constraints | Only with a local model or explicit opt-in |
| Team or manager views | Changes who the data serves, which changes the product | Never as currently framed |

---

## 6. AI / Agent Specification

**v1 contains no AI, no model calls, and no LLM.** Categorization is intention-relative and mechanical: a domain is *blocked*, *away*, or *other*, and the review shows raw domains for the user to interpret. This is a deliberate rejection of the "classify activity with an LLM" pattern — it would put browsing history in a prompt, which §7 forbids, and it would spend the build's most contested minutes on the least defensible feature.

---

## 7. Dependencies, Constraints, and Assumptions

**Dependencies**

| What | Why | Integration budget |
|---|---|---|
| Vercel | Hosting for the web app and API | 1 of 5 |
| Neon Postgres | Sessions, events, outcomes, pairing tokens | 2 of 5 |
| Clerk | Sign-in on the web app | 3 of 5 |
| Chrome / Edge (MV3) | The extension runtime; no store publication needed for v1 (loaded unpacked) | — |

**Constraints**

- Four hours, one builder. Anything not on the critical path to the demo is cut.
- Five external services maximum; two remain unallocated and should stay that way.
- No OS permissions, no admin rights, no installer. If a feature needs one, it is not v1.
- No screenshots, no keystrokes, no page content. URL, domain, title, and timestamps only.

**Assumptions** — carried from [idea-intent.md](idea-intent.md) §6: A1 (work is in the browser), A2 (people will declare), A3 (outcome is binary), A4 (in-browser blocking is enough — untested in v1 by decision), A5 (sign-in does not kill the funnel), A6 (reads as different from Rize).

---

## 8. Success Metrics

| ID | Metric | Target | Source | Tests |
|---|---|---|---|---|
| M1 | Sessions started by the builder in the first two weeks | ≥ 10 with real intentions | Session records | K1 |
| M2 | Share of sessions with a non-empty intention | ≥ 70% | Session records | A2, K2 |
| M3 | Share of ended sessions with the outcome question answered | ≥ 50% | Session records | A3, K3 |
| M4 | Away time as a share of session time | < 25% | Attention records | A1 |

Every one of these is a `SELECT` against tables that already exist for the product to function. No analytics service is required, and none is in the integration budget.

---

## 9. Implementation, Rollout, and Rollback

- **Rollout:** extension loaded unpacked in Chrome or Edge; web app deployed to Vercel. No store review, no installer, no user beyond the builder and a handful of testers.
- **Order of build:** see `build-intent.md`. The cut line is defined there — if time runs out, PRD-F7 goes first, then PRD-F2.
- **Rollback:** the extension is removed from `chrome://extensions` and every dynamic block rule dies with it. There is nothing on the user's machine to uninstall and no OS state to restore. This is a direct consequence of the browser-only decision.

---

## 10. Open Questions

| # | Question | Blocks | Owner | Needed by |
|---|---|---|---|---|
| Q1 | Which three built-in blocklists ship, and with which domains? | PRD-F7 | Alexandre | Build hour 3 |
| Q2 | Is away time shown as its own row in the review, or hidden? *(Provisional answer: shown — it is the honest half of A1.)* | PRD-F4 | Alexandre | Build hour 3 |
| Q3 | Does a session have a fixed duration, or does it run until stopped? *(Provisional: optional duration; no duration means it runs until stopped.)* | PRD-F1 | Alexandre | Build hour 1 |

---

## Self-Check

- [x] Every `PRD-F#` traces to an `A#` or to IDEA §4
- [x] Every user story has acceptance criteria that could fail
- [x] §5 names what is not being built and why, not just what is
- [x] §8 metrics are measurable from data the product already stores
- [x] §7 records the integration budget and what is left
- [x] No feature introduces a permission, an installer, or an external service beyond the four named
- [x] Registered in `docs/index.md`
