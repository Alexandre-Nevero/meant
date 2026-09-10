# Product Requirements Document

**Project:** MEANT
**Date:** 2026-08-18
**Version:** 0.2
**Cycle:** 1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** 2026-09-10
**Upstream:** [idea-intent.md](idea-intent.md)
**Downstream:** [sitemap-intent.md](sitemap-intent.md), [flow-intent.md](flow-intent.md), [sdd-intent.md](sdd-intent.md)

> **Amendment 0.2b (2026-09-10).** `PRODUCT.md` was carrying facts this document had not caught up to; folded back in here, since this PRD — not the derived `PRODUCT.md` — is canonical. Three corrections and one status clarification:
> - **§3 gains 3.2**, the companion's shipped specifics (the Orbit reversal, 2026-09-05) — PRD-F10 described the witness only in the abstract; the shipped form is now recorded.
> - **§7's host-permission constraint was wrong.** It said `<all_urls>` never appears in `host_permissions`. It shipped there on 2026-09-07 (see ADR in `docs/adr/`) — corrected below.
> - **§6 gains a status line.** Every AI call in this section (plan, judge, coach, memory) remains entirely unbuilt as of this date. What shipped instead is a mechanical stand-in for the judge (`docs/index.md` D25) plus three rounds of popup/companion/navigation/timer UI work. Nothing here should read as "in progress" without that qualifier.
> - **§11 is new**: the competitive-truth table, previously only in `PRODUCT.md`.
> `PRODUCT.md` itself is now regenerated from this document rather than carrying independent facts — see its own header.

> **Amendment 0.2a (2026-08-28).** `../apexhuman.md` replaced the four-hour build constraint with a reproduction requirement. Three consequences land here, and none of them are about scope: **I9** makes the teaching tiers an architectural rule; **PRD-F14 and F15** were excusable at four hours and are not now; and §7 gains two constraints nobody had written down.
>
> **Amendment 0.2 (2026-08-28).** §3 gains six features and eight invariants. §6 is rewritten from "v1 contains no AI" to a full agent specification — that reversal is the largest single change in this document and its reason is recorded in §6.1. §7 allocates a fourth external service. §8 gains five metrics, two of which are about the agent being right and one about not going bankrupt.

---

## 1. Purpose and Value

MEANT closes the gap between what someone said they would finish and what their attention actually did. It is one browser extension plus one web app: declare the intention, turn it into a short plan, protect it, watch alongside, record what happened, and answer one question at the end — did you finish it?

The number that accumulates is completed outcomes, not hours. Hours appear only as evidence inside a single session's review. Checked tasks never accumulate at all (I8).

**What makes it different, in one sentence a customer can repeat:** every AI accountability product asks whether you were focused; this one is inside the tab and already knows.

### 1.1 Foundation (reference copy — canonical in [idea-intent.md](idea-intent.md) §1)

| # | Field | Answer |
|---|---|---|
| 1 | One line | Say what you mean to finish, get a short plan, block what you chose to avoid, be watched while you work, and answer whether you finished it |
| 2 | Problem event | 70 minutes, 14 tabs, no way to say whether the proposal moved |
| 3 | Primary user | A self-employed, non-technical browser-native worker. Own laptop, own card |
| 4 | Pain moment | End of a work block, asked "did you finish it?", answering "I was working on it" |
| 5 | Insight | One extension sees intention, plan, enforcement, and attention at once — and can read the tab, which nothing else in the category can |
| 6 | The one thing | The end-of-session review: intention and plan beside actual attention, then the question |

---

## 2. Users

| Who | Context | What they need from v1 |
|---|---|---|
| **Primary — the self-employed browser-native worker** | Own laptop, Chrome or Edge, works in documents, email, client tools, and AI chat all day. Non-technical | To find out, at the end of a block, whether the block produced the thing it was for |
| **Secondary — the builder** | Same behavior class, uses it daily | Enough friction-free daily use that A2, A3, A7, A8 and A9 get tested for real |

**Not served in v1:** anyone whose work is mostly outside a browser (IDE, terminal, native design tools). Anyone on a managed corporate endpoint where IT policy governs what may be installed — no longer the target since D10, and not designed for.

**A boundary that must not blur.** There are two populations in this project and only one of them is in this document. **MEANT's user** is the self-employed browser-native worker above. **The student** — the entrepreneur, solopreneur, SME operator or undergraduate who rebuilds MEANT from the manual — is the subject of `../apexhuman.md`, not of this PRD. A feature that exists to serve the student is a course feature and belongs there. The only place the student legitimately reaches into this document is §3.1 I9 and §7, where their constraints genuinely bind the architecture.

---

## 3. Features and Priorities

| ID | Feature | Priority | Serves | Notes |
|---|---|---|---|---|
| PRD-F1 | Declare an intention and start a session | Must | A2, IDEA §4 | One text field, optional duration. Start is **instant** — nothing may block it |
| PRD-F2 | Block a chosen list of sites for the length of the session | Must | A4 | Dynamic MV3 rules, added on start, removed on end. Fires locally with no model in the path |
| PRD-F3 | Record attention passively while the session runs | Must | A1 | Seconds per domain, plus away time |
| PRD-F4 | End-of-session review | Must | A3 — *this is the one thing* | Intention, plan, time per domain, drift-and-returns, blocked attempts, then: did you finish it? |
| PRD-F5 | History — the outcome ledger | Must | IDEA §1.6 | Sessions with their outcome. Completion rate is the headline; no hours headline, no score, anywhere |
| PRD-F6 | Account and device pairing | Must (infrastructure) | A5 | Sign in on the web app; paste a one-time code into the extension |
| PRD-F7 | Edit the blocklist | Should | — | Three built-in lists plus add/remove a domain |
| **PRD-F8** | **Task plan generated from the intention** | Must | A7, C10, C13, C14 | 1–5 steps, generated **after** the session starts. Editable, deletable. Gives the judge something concrete to judge against |
| **PRD-F9** | **Attention judged against the current task** | Must | A8, C15 | Returns serves / drifts / unclear. **Two input tiers (SDD §5.2): T-A judges on hostname + title with no new permission; T-B adds page text behind an opt-in permission the user grants at the moment they enable it.** Gated by memory (I4). The differentiating feature |
| **PRD-F10** | **The companion — presence during the session** | Must | A9, C11, C12 | Faces your work; turns to face you on drift. Marks tasks silently. Accepts one tap, never typing |
| **PRD-F11** | **Memory — what it knows about you across sessions** | Must | Retention; also cost control (I4) | Domain classifications, drift patterns, estimate accuracy. Speaks only above an evidence threshold (I6) |
| **PRD-F12** | **The coach — review conversation and suggestions** | Should | C9, C16 | The same creature, after the session. Celebrates the return, the completion, the answering. Suggests only what it can execute (I5) |
| **PRD-F13** | **Personal blocklist derived from observed drift** | Should | Differentiation | "This site costs you 40 minutes a week, and only during writing sessions." Cannot be copied without the data |
| **PRD-F14** | **The judge's eval set and its reported accuracy** | Must | A8, M7, K4 | A seed set of labelled (intention, task, page) cases plus every user correction (EV15), scored on demand. **M7 and K4 are currently unmeasurable without it — a metric with no mechanism is a wish.** Was excusable at four hours; is not now |
| **PRD-F15** | **Forget what you know about me, and delete my account** | Must | SDD §9.3 | Two levels: clear `memory` for this user, and delete the account with all its data. **Memory deliberately outlives the sessions that produced it, so the product created this obligation itself.** Flagged as a gap through 0.1 and 0.2 and excused by the clock both times |

### 3.1 Invariants

These are product rules, not preferences. Breaking one is a bug.

| # | Invariant | Why | Source |
|---|---|---|---|
| **I1** | The companion's state is never a function of the outcome answer. `Yes` and `Not yet` leave it identical | A pet that suffers when you answer honestly is a machine for producing false yeses. A3 is the assumption everything rests on | C9; design toolkit's identical-buttons rule |
| **I2** | No celebration during a session. Positive feedback exists only in the review | Two independent reasons: engagement-contingent reward undermines motivation, and celebration raises arousal, which impairs complex work | C9, C11, C12 |
| **I3** | The coach responds to the evidence, never to the answer. It says the same things whether you answered `Yes` or `Not yet` | Keeps the outcome question safe to answer honestly while still allowing a coach to exist | Follows from I1 |
| **I4** | Memory gates the judge. A domain already classified for this user's intention class is not re-judged | It is the accuracy story and the margin story in one feature | A11, M9 |
| **I5** | The coach may only suggest actions the product can execute | Structurally prevents "have you tried the Pomodoro technique," the most commoditized output in 2026 | C15 |
| **I6** | The coach states no pattern below the evidence threshold | A pattern from three sessions is astrology, and being wrong about *you* costs far more than being wrong about a tab | Q7 |
| **I7** | Page text is read for judging and never stored, logged, or retained. Only `{domain, verdict, confidence}` persists | Replaces the old "never send" rule with one that actually holds under cloud inference. This is the anti-surveillance control | SDD V5 (amended) |
| **I8** | Checked tasks never enter the ledger. Only the outcome answer counts | Sub-goal completion "could breed self-congratulation," which is a more sophisticated version of the exact pain this product exists to attack | C13 |
| **I9** | **Every feature above the mechanical loop is independently removable.** The product must run, ship, and be worth using with the judge off, the companion off, memory off, the coach off, or any combination | **This is the teaching tiers made structural.** A beginner rebuilds a subset and pastes the rest (`../apexhuman.md` §6); if the pieces do not detach, the subset does not run, and the manual cannot exist. It is also the K4 escape hatch generalised: any of these features may turn out to be wrong, and none of them may take the product down with it | `../apexhuman.md` §6, §7 rule 3; K4 |

**Explicitly not features:** any ranking, score, streak, badge, leaderboard, productivity percentage, or hours headline. Any conversation with the companion during a session. Any celebration of `Yes` over `Not yet`. Moralizing about a bad session. Storing what the judge reads. Nagging for a declined permission. Anything an employer would want displayed. A suggestion the product cannot execute (I5).

### 3.2 The companion, as shipped (the Orbit reversal, 2026-09-05)

PRD-F10 above states the requirement in the abstract — presence, turning on drift, one tap, no words. The companion's **visual form** reversed after this PRD was written and is recorded here, not re-litigated: the 0.2 spec called it "a coach, not a pet," gaze/posture only, 80–120px, no on-screen acknowledgment of a returned drift. Mid-build, the owner chose a supplied reference ("Orbit") over that spec instead, on the explicit basis that the documented spec should update to match the shipped code, not the other way round. Full reasoning: `docs/dead-ends.md` ("The companion's design reversed…") and the ADR in `docs/adr/`.

**What shipped instead:**
- **It is a pet, not a coach.** A 28px orbital dot, bottom-right by default, draggable. Presence over posture — the opposite framing of the superseded spec.
- **State is ring presence and style, never color.** Resting: dot only. Focus: solid ring. Drift: the same ring, dashed. Clay is the only accent color at any state, so state reads as a shape change, never a status light (holds I1 — the ring never varies with the outcome answer).
- **Return gets one visible acknowledgment**, deliberately: a 0.6s ring-collapse pulse on the drift-to-focus transition, then the ring settles. A narrow, named exception to "nothing good happens on screen during a session" (I2) — scoped to the witness settling, not to an outcome celebration.
- **Aliveness is a continuous, slow breathe (~1.6s) on the dot**, not a rare blink.
- Built as `extension/companion-overlay.js`, a self-contained Shadow DOM injected at `<all_urls>` — not `.m-mark`'s primitives, and not `chrome.sidePanel` (superseded; see the host-permission correction in §7 and the ADR log).

---

## 4. User Stories and Acceptance Criteria

**US-01 — Declare (PRD-F1)**
As a self-employed worker, I want to state what I intend to finish before I start.
- Given the popup is open and paired, when I type an intention and press Start, then a session begins **within 200ms** and its start time is recorded.
- Given I press Start, when the plan is still generating, then the session is already running and nothing is waiting on the model.
- Given the intention field is empty, when I press Start, then the session starts and is recorded with an empty intention, and the companion states that it cannot judge drift without one.

**US-02 — Protect (PRD-F2)**
- Given a session is running with a blocklist, when I navigate to a blocked domain, then the request is blocked and a page shows my current intention and the time remaining. No model call is in this path.
- Given a session ends by any means, when the record is closed, then every dynamic block rule added by that session is removed.

**US-03 — Observe (PRD-F3)**
- Given a session is running, when the active tab changes, then elapsed time is attributed to the previous domain.
- Given the browser loses focus for more than 60 seconds, when focus returns, then that period is attributed to `away`.
- Given the service worker is terminated mid-session, when it wakes, then state is reconstructed from stored timestamps with no loss beyond the current interval.

**US-04 — Review (PRD-F4)**
- Given a session ends, when the review opens, then it shows the intention, the plan with what moved, seconds per domain in descending order, away time, drift-and-return count, blocked attempts, and a yes/no question.
- Given the review is open, when I answer, then the outcome is stored and the review closes.
- Given I dismiss the review without answering, then the session is stored with outcome `unanswered` and counts against M3.

**US-05 — Ledger (PRD-F5)**
- Given at least one completed session, when I open the dashboard, then I see each session with its intention, duration, top domain, and outcome, plus a completion rate over answered sessions.
- Given any state of the data, when I open the dashboard, then no total-hours figure and no percentage-focused score appears anywhere.

**US-06 — Pair (PRD-F6)**
- Given I am signed in, when I open the pairing screen, then a short code is displayed with a stated expiry.
- Given the extension is unpaired, when I paste a valid code, then it stores a token and subsequent events are attributed to my account.

**US-07 — Plan (PRD-F8)**
As someone about to start, I want the intention broken into steps so starting feels possible.
- Given a session has started with a non-empty intention, when the plan returns, then 1–5 steps appear in the popup and the companion surface without interrupting anything.
- Given a step is wrong, when I edit or delete it, then the change persists and the judge uses the amended plan from that point.
- Given the model returns nothing or errors, when the session continues, then the session is unaffected and the review shows no plan rather than an empty one.

**US-08 — Judge (PRD-F9)**
As a user, I want the product to know whether where I am serves what I said.
- Given a session is running with at least one open task, when the active tab changes to a domain memory has not classified, then the tab is judged and a verdict is recorded.
- Given the domain is already classified for this intention class, when the tab changes, then **no model call is made** and the stored classification is used (I4).
- Given a verdict is `drifts`, when confidence is below the precision floor (Q4), then the companion does not signal.
- Given I have not granted page access, when a session runs, then judging still happens on hostname and title (tier T-A) and the product never nags me for the permission again.
- Given I am offered page access, when the prompt appears, then it appears at the moment I enable deep judging — never at install — and the companion has already stated in one sentence what is read and that nothing is stored.
- Given I grant page access and later revoke it in Chrome, when the next session starts, then the product falls back to tier T-A silently and nothing errors.

**US-09 — Be witnessed (PRD-F10)**
- Given a session is running and nothing is wrong, when I glance at the companion, then it is facing my work, breathing, and has not moved in a way I would notice.
- Given a drift is detected above the floor, when the companion responds, then it turns to face me and does nothing else — no sound, no words, no colour change.
- Given a session is running, when any positive event occurs (a task completed, a return from drift), then **nothing happens on screen until the review** (I2).
- Given the first 60 seconds of a session, when anything at all is detected, then the companion does not move.

**US-10 — Correct it (PRD-F9, PRD-F11)**
As a user, I want to fix the agent when it is wrong, in one tap.
- Given the companion has marked a task done, when I un-mark it, then the mark is reversed and the correction is stored as a label.
- Given a tab was judged `drifts` and it was work, when I tap "that was work," then the session record is corrected and memory records the classification so it is not asked again.
- Given any correction, when the review renders, then it reflects the corrected state, never the original verdict.

**US-11 — Be known (PRD-F11)**
- Given enough sessions to clear the evidence threshold, when I open the review or dashboard, then the coach states a pattern about me in one sentence.
- Given fewer sessions than the threshold, when I open the review, then the coach states no pattern at all and does not hedge one.

**US-12 — Be coached (PRD-F12, PRD-F13)**
- Given a review is open, when the coach speaks, then it names what it observed, and its wording does not vary with whether I answered `Yes` or `Not yet` (I3).
- Given the coach makes a suggestion, when it is shown, then it carries a button that performs it — and no suggestion is shown that the product cannot perform (I5).
- Given a domain has accumulated drift across sessions, when the coach offers to add it to my personal blocklist, then accepting adds it and it takes effect on the next session.

---

## 5. Out of Scope for This Release

| Not building | Why | Revisit |
|---|---|---|
| Voice | A fifth service and a whole surface. Text at the review is enough to test the coach. **Reason strengthened by `../apexhuman.md`:** every external service costs a *student* 10–15 minutes of provisioning out of a 4–8 hour budget, so the fifth slot is far more expensive than the integration budget alone suggests | After A9 and A10 hold |
| Conversation during a session | Talking to your focus tool is premium procrastination, and unbounded tokens | Never during a session |
| On-device inference | Chosen against in D14: two code paths is the thing that stops a build shipping. **Reason strengthened by `../apexhuman.md`:** that argument was about *our* build; it now applies to every student's build, on hardware Apex does not spec a RAM or disk floor for. The Prompt API path (C8) stays open as an upgrade | v2, as a privacy upgrade, once one path works |
| Desktop / OS-level tracking and app blocking | Outside the browser thesis | When browser-only proves the loop |
| Scheduled sessions, Locked Mode | Commitment devices belong on a product people already use daily | v2+ |
| Sync across devices and browsers, Firefox/Safari | One browser, one profile is enough to test every assumption | Later |
| Team, manager, or coach-for-clients views | Changes who the data serves, which changes the product | Never as currently framed |
| A productivity score of any kind | The single change that would make this employer-desirable | Never |

---

## 6. AI / Agent Specification

**Status, as of 2026-09-10: nothing below is built.** No `task`, `judgment`, or `memory` table exists; no model call fires anywhere in the shipped product. Rounds 4–6 (`docs/superpowers/specs/`) shipped popup, companion, navigation, and timer UI — none of it the AI stack. In its place, `docs/index.md` D25 shipped a mechanical stand-in for the judge: the companion signals drift when the active tab's domain matches a known distraction category the session didn't choose to block, computed with no model in the path. This exercises the judge's seam (I9) by construction, and is not a step toward this section — it is a placeholder that must be removed, not extended, when PRD-F9 actually ships.

### 6.1 Why this section reversed

Version 0.1 said: *"v1 contains no AI, no model calls, and no LLM,"* on the grounds that classification *"would put browsing history in a prompt, which §7 forbids."*

That reasoning had one premise: judging requires exporting and retaining browsing data. The premise is now false in the way that matters. Text is sent for a single classification and is never stored, logged, or retained anywhere (I7, SDD V5 amended). What persists is a verdict, and a verdict is smaller than the hostname already stored.

The reversal is also forced by the product itself: **the case that defines this product — the same hostname being work at 4pm and drift at 11am — is unanswerable without reading the tab.** Version 0.1 shipped a product that could not solve its own central example.

### 6.2 The three model calls

| Call | When | Input | Output | Bounded by |
|---|---|---|---|---|
| **Plan** | Once, just after a session starts | The intention sentence, plus memory of how this user words tasks | 1–5 short steps | One call per session |
| **Judge** | On tab change, only for domains memory has not classified (I4) | Current task text + hostname + a hard-capped extract of visible page text | `serves` / `drifts` / `unclear`, plus confidence | Memory gating; text cap; never on the block path |
| **Coach** | In the review only | Session record, plan, verdicts, corrections, and memory above the evidence threshold | Observations and executable suggestions | One session's context; review surface only |

### 6.3 Rules the agent operates under

- **Never in the latency path of a block.** Blocking is a local domain match. A model is never between a user and a page.
- **Never persists what it reads.** I7. The `judgment` table has no text column, by design.
- **Never speaks below the floor.** Drift is signalled only above the precision floor (Q6); patterns only above the evidence threshold (Q7).
- **Never suggests what it cannot do.** I5.
- **Never celebrates while you work.** I2.
- **Wrong is correctable in one tap**, and every correction is a training label (US-10).

### 6.4 What it is not

Not a chatbot. Not a classifier of *you*. Not a health, clinical, or diagnostic instrument, despite an audience that overlaps heavily with undiagnosed ADHD (IDEA §9). It classifies one tab against one sentence the user wrote, and it reports what it saw.

---

## 7. Dependencies, Constraints, and Assumptions

**Dependencies**

| What | Why | Integration budget |
|---|---|---|
| Vercel | Hosting for the web app and API | 1 of 5 |
| Neon (Postgres + Auth) | Sessions, tasks, judgments, memory, outcomes, pairing, and web sign-in — one vendor since D21 | 2 of 5 |
| **Vercel AI Gateway** | **All three model calls. Chosen for one integration, model fallback, observability, and zero data retention (I7)** | **3 of 5** |
| Chrome / Edge (MV3) | The extension runtime | — |

Two slots remain — D21 freed one by consolidating auth onto Neon. Spending either requires cutting something else. Voice would spend one; voice is out of scope (§5).

**Constraints**

- No OS permissions, no admin rights, no installer.
- **Corrected 2026-09-10:** `<all_urls>` appears in `host_permissions`, unconditionally, shipped 2026-09-07 (this line previously said the opposite and was stale against shipped code — see `docs/adr/` and `docs/dead-ends.md`). The content script (the companion) already ran at `<all_urls>`; `declarativeNetRequest`'s `redirect` action needs host permission for whatever domain it blocks, and a `optional_host_permissions` flow would mean a new permission prompt every time the user names a fresh site to block — worse UX than one honest upfront grant for a feature that fundamentally needs it. Not a new category of trust beyond what the content script already required. SDD V4/§5.2 need the same correction.
- No screenshots, no keystrokes. Page text is read transiently for one classification and never stored (I7).
- The model tier chosen inside the gateway is a **business-model decision**, not a quality decision. See M9.
- **Every external service costs a student 10–15 minutes of provisioning.** Four of five allocated is roughly 40–60 minutes of a 4–8 hour rebuild before a line of product code exists. The integration budget was a taste constraint at 0.1; it is now arithmetic (`../apexhuman.md` §5).
- **This product will be filmed being built.** That is a design constraint, not a marketing one: every build step must produce a **visible** change on screen, because console output is bad television and worse teaching. Empty states and error states are seen *first* by every viewer rather than last. The moments worth watching must be visual — which is one more reason the companion's gaze, and not a log line, is the drift signal.
- **Nothing on the rebuild path may require a Chrome Web Store review.** Review runs days to weeks (C18). The product must be real and working while loaded unpacked; publishing is an epilogue, never a step.
- **Windows and macOS identically.** Apex states a macOS 13+ / Windows 10+ floor and no RAM or disk floor. Any macOS-only convenience is banned.

**Assumptions** — carried from [idea-intent.md](idea-intent.md) §6: A1–A6 plus A7 (the plan is kept), A8 (the judge is accurate enough), A9 (a calm presence does not inhibit complex work — the riskiest), A10 (they pay), A11 (margin survives).

---

## 8. Success Metrics

| ID | Metric | Target | Source | Tests |
|---|---|---|---|---|
| M1 | Sessions started by the builder in the first two weeks | ≥ 10 with real intentions | Session records | K1 |
| M2 | Share of sessions with a non-empty intention | ≥ 70% | Session records | A2, K2 |
| M3 | Share of ended sessions with the outcome answered | ≥ 50% | Session records | A3, K3 |
| M4 | Away time as a share of session time | < 25% | Attention records | A1 |
| **M5** | Install-to-first-session rate | ≥ 60% | Device + session records | A5 |
| **M6** | Share of generated task sets surviving the session un-deleted | ≥ 60% | `task.removed_at` | A7 |
| **M7** | Judge precision — 1 − (corrections ÷ judgments shown to the user) | ≥ the floor set in Q6 | `judgment.corrected_to` | A8, K4 |
| **M8** | Free-to-paid conversion after 8 weeks | ≥ 3% | Billing | A10 |
| **M9** | Inference cost per active user per month, as a share of subscription price | < 15% | Gateway spend ÷ active users | A11, K6 |
| **M10** | Drift-return rate — share of drift events followed by a return within 2 minutes | reported, no target in v1 | `judgment` + attention | Feeds the review's celebration (§6.2 coach) |

M1–M4, M6, M7 and M10 are `SELECT`s against tables the product needs anyway. M8 and M9 need billing and gateway spend, which arrive with the fourth service.

**Reproduction rate is deliberately absent.** Whether a student rebuilds MEANT in 4–8 hours measures the *manual*, not the product. It belongs in `../apexhuman.md`, and putting it here would be the first step toward optimising the product for the course rather than for its user.

**A9 is not on this list, and that is the point.** If a calm presence inhibits complex work, every metric here would improve while the user's actual output got worse. A9 can only be tested against something outside this data (Q9).

---

## 9. Implementation, Rollout, and Rollback

- **Rollout:** extension loaded unpacked for the builder; Chrome Web Store for anyone else, on the assumption of a slow review track for a new developer account with `tabs` plus host permissions (C18). Plan weeks, not days.
- **Order of build:** the review first, because everything else is evidence for it. Then declare, judge, plan, companion, correction, memory, personal blocklist, coach. `build-intent.md` describes the completed four-hour sitting and is a historical record, not the plan for this work; a new run-of-show is required.
- **Rollback:** the extension is removed and every dynamic block rule dies with it.
- **Four seams, not one (I9).** 0.2 required the product to stay shippable with the judge off. That is now the weakest of four required detachments:

| Seam off | What remains | Who needs this seam |
|---|---|---|
| Judge | Blocking, attention, review, ledger | K4 — if the judge is wrong too often, it goes and the product lives |
| Companion | Everything except in-session presence | K5 — if a calm presence inhibits complex work (A9), the witness goes and the coach survives |
| Memory | Everything, judged fresh every time, coach silent on patterns | Cost control failure (K6), and a user who taps "forget what you know about me" (PRD-F15) |
| Coach | Everything except the review's observations and suggestions | A student rebuilding the T1 subset (`../apexhuman.md` §6) |

Each seam must be exercised, not asserted. A feature that cannot be switched off has not been built to spec.

---

## 10. Open Questions

| # | Question | Blocks | Owner | Needed by |
|---|---|---|---|---|
| ~~Q1~~ | ~~Which three built-in blocklists ship?~~ **Three hardcoded lists; personal list is PRD-F13** | PRD-F7 | Alexandre | done |
| ~~Q2~~ | ~~Is away time shown in the review?~~ **Shown — it is the honest half of A1** | PRD-F4 | Alexandre | done |
| ~~Q3~~ | ~~Fixed duration or run until stopped?~~ **Optional duration; no duration runs until stopped** | PRD-F1 | Alexandre | done |
| **Q4** | What is the precision floor below which the companion may not signal? | PRD-F9, M7, K4 | Alexandre | Before the companion signals |
| **Q5** | How many sessions of evidence before the coach may state a pattern? | PRD-F11, I6 | Alexandre | Before the coach speaks |
| **Q6** | Free/paid boundary. Provisional: free is mechanical (block, review, ledger); paid is the half that knows you (plan, judge, companion, memory, coach) | M8, A10 | Alexandre | Before pricing is shown |
| **Q7** | What is the hard cap on page-text extract sent per judgment, in characters? | I7, M9 | Alexandre | Before tier T-B ships |
| **Q10** | How large must PRD-F14's seed eval set be before M7 means anything? A precision figure from twenty cases is the same astrology as a pattern from three sessions (I6) | PRD-F14, M7 | Alexandre | Before the judge's accuracy is shown to anyone |
| **Q9** | Does tier T-A (hostname + title) clear the precision floor on its own? If it does, tier T-B never ships and the broad-permission prompt disappears from the product entirely. **Measure T-A before building T-B** | PRD-F9, M7, funnel | Alexandre | Before any permission prompt is designed |
| **Q8** | Does an empty intention disable the judge entirely, or does it judge against nothing? *(Provisional: disabled, and the companion says so)* | US-01, PRD-F9 | Alexandre | Before the judge ships |

---

## 11. Competitive Truth

| Product | Has | Lacks |
|---|---|---|
| Freedom | Blocking | Measurement, intention, outcome |
| Rize | Measurement, AI categorisation | Intention, protection; hours are its headline |
| Session (Apple only) | The full loop | Browser-native attention; asks what you *learned*, not what you *finished* |
| Femma, FineStreak, Coach Call AI, Nudge, Centered | Voice check-ins, nudges, consequences | **Sight. Every one of them has to ask** |
| Forest, Finch | The companion mechanic, proven commercially | Measure how you *feel*, not what you *finished* |

---

## Self-Check

- [x] Every `PRD-F#` traces to an `A#` or to IDEA §4
- [x] Every user story has acceptance criteria that could fail
- [x] Every invariant in §3.1 names the claim or assumption it protects
- [x] §5 names what is not being built and why
- [x] §6 states plainly that it reversed §6 of v0.1, and why — rather than quietly replacing it
- [x] §8 metrics are measurable from data the product stores, except M8/M9 which name their source
- [x] §8 names the assumption its own metrics cannot test (A9)
- [x] §7 records the integration budget and what is left
- [x] §9 states the four seams that must each be exercised, not asserted (I9)
- [x] §2 states the boundary between MEANT's user and the course's student
- [x] §8 states which measurement deliberately does not live here, and why
- [x] §6 states plainly what is and is not built as of the last reconciled date (0.2b)
- [x] §7's host-permission constraint matches shipped code, not the superseded design
- [x] Registered in `docs/index.md`
