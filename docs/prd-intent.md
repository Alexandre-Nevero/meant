# Product Requirements Document

**Project:** MEANT
**Date:** 2026-08-18
**Version:** 0.2
**Cycle:** 1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** 2026-09-16 (amendment 0.3a)
**Upstream:** [idea-intent.md](idea-intent.md)
**Downstream:** [sitemap-intent.md](sitemap-intent.md), [flow-intent.md](flow-intent.md), [sdd-intent.md](sdd-intent.md)

> **Amendment 0.3a (2026-09-16).** A second pass over 0.3, auditing the *whole* document rather
> than the sections the ADRs named. Amendment 0.3 rewrote PRD-F9 and PRD-F10 but left the same
> decisions un-applied further down: **§3.2's ring table**, **US-09**, **US-10** (a correction
> story for a flag that no longer exists), **§6.2's Judge row**, **§6.3's precision-floor and
> one-tap-correction rules**, and two **§7** constraints still described live drift signalling and
> a page-text judge. All corrected in place. Nothing new was decided here; this is the same log,
> applied where it had been missed.
>
> **Amendment 0.3 (2026-09-15).** A strategy sitting, recorded as **ADR-0052 through ADR-0064**.
> Per **ADR-0063**, `docs/adr/` is now the most up-to-date record in the repository: where an ADR
> and this document disagree, **the ADR is right and this document is stale.** This amendment is a
> reconciliation of that log, not an independent source.
>
> **What changed, by section:**
> - **§1** gains the canonical problem statement with falsifiers (ADR-0055). **§1.2's *case* stands;
>   its *conclusion* is stale** — ADR-0035's per-session declaration resolves the Instagram case at
>   session start with no model, so "reading the tab is what resolves it" is no longer true (ADR-0061).
> - **§2** is rewritten (ADR-0054): the user is defined by behavior, the **buyer is a separate axis**,
>   and segments are deliberately **left unranked** because two of the five columns needed to rank them
>   are empty. Boundary moves from job title to **browser share, reported at runtime**.
> - **§3 PRD-F9 and PRD-F10** are rewritten. The judge runs **after** the session, batched, on demand
>   (ADR-0060). The companion **loses drift signalling** (ADR-0057) and **becomes an input device**
>   (ADR-0058).
> - **§3.1**: **I7 is amended** (ADR-0059 — paths are stored on-device); **I2 becomes absolute**, its
>   one named exception having died with the drift signal.
> - **§6 gains §6.5** — what the judge reads, folded up from the now-void SDD §5.2 (ADR-0061).
> - **§10**: **Q4, Q7 and Q9 are void** (not answered — they have no referent). **Q12 is resolved**
>   (ADR-0058). **Q11's evidence is withdrawn** (ADR-0053 — the pattern is n=2, not n=5).
> - **§11** gains a staleness banner. It was last verified 2026-08-28.
>
> Two further decisions land upstream in IDEA: **ADR-0055** (problem) and **ADR-0056** (why-now).
> **ADR-0064** governs the coach's preset corpus.
>
> **Amendment 0.2d (2026-09-11).** `PRODUCT.md` folded in and the document audited against
> *shipped code and the live database*, not against other docs. Fourteen corrections, listed at
> their sites. The four that change meaning rather than wording:
> - **§6's status line was wrong in the pessimistic direction.** It claimed no `judgment` or
>   `memory` table exists. Both have existed since 2026-09-04. What is true is narrower and
>   worse: `judgment` has **never received a row from any code path**, and every one of the 572
>   `memory` rows is `kind='list'` — `domain_class` has never been written at all.
> - **The drift signal is not memory-backed.** `PRODUCT.md` described it as using dwell time,
>   refractory windows and per-domain evidence. `updateCompanion()` (`extension/sw.js:214`) is a
>   static blocklist-membership test plus a 60s grace and a 3-per-25-minute budget. **Nine of the
>   eleven constants in `lib/thresholds.ts` have zero readers in the repo** — `DWELL_MS`,
>   `REFRACTORY_MS`, `SIGNAL_BUDGET`, `SIGNAL_WINDOW_MS`, `MEMORY_MIN_EVIDENCE`,
>   `MEMORY_MIN_AGREEMENT`, `CONFIDENCE_FLOOR`, `DAILY_JUDGMENT_CAP`, `PATTERN_MIN_SESSIONS`.
>   `sw.js` re-declares its own copies rather than importing them.
> - **I3 and I6 are amended, not deleted** (D50, D51). Both were written to protect real things
>   and both over-reached into forbidding the product from using its own data. The corrected
>   forms are at their rows in §3.1.
> - **Three external services are allocated, not four.** `PRODUCT.md` carried a pre-D21 count
>   from when Clerk was separate from Neon. §7's table is right; the summary was wrong.
> Also new: **§1.2** (the defining case), **§3.3** (the loop and the surfaces), **§7.1** (the
> business model, promoted from a `PRODUCT.md` paragraph to a recorded decision), and **Q11**.
>
> **Amendment 0.2c (2026-09-11).** A real, uncomfortable finding, from a doc audit — recorded
> plainly rather than quietly patched: `docs/superpowers/plans/2026-09-04-drift-and-cycles.md`
> made 17 real product decisions (D26–D42) and shipped real code for them (`lib/thresholds.ts`,
> the `judgment`/`memory` tables, `event.label`) — but that plan's own Task 20, which was
> supposed to write those decisions into `docs/index.md` §6 and fix this PRD accordingly, was
> **never executed** (its checkboxes are all unchecked). The decisions sat undiscoverable inside
> a 153KB plan file for a week. This amendment is that overdue reconciliation:
> - **PRD-F8 (the generated task plan) is cut, not built** (D38) — struck through below, along
>   with its dependents `US-07`, `M6`, and the plan-related clauses of `PRD-F10`/`US-09`. The
>   live per-domain band replaces its stated purpose with no model call.
> - The judge (PRD-F9) judges the **intention sentence**, never a step — there is no step.
> - The companion's acceptance criteria (US-09) still described the retired gaze design;
>   corrected to the shipped Orbit ring behavior (ADR-0026).
> - D26–D42 are now in `docs/index.md` §6 and `docs/adr/` (ADR-0033–0049).
> This is also a live example of the exact failure mode `context-engineering-advisor` warns
> about: a decision made in a chaotic research/implementation context (the plan) must be
> compacted into the canonical record before that context is set aside — skipping the Reset
> step of Research→Plan→Reset→Implement is what let this go undiscovered.

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

**The problem, canonical (ADR-0055).** Everything in this document is a response to this:

> **Your work surface and your distraction surface are the same browser — so nothing you own can
> tell you whether the block you just spent produced the thing it was for.**
>
> Not the calendar: it records that you booked the hour, never that the hour delivered. Not the
> timer: it counts elapsed minutes, which you already knew. Not the blocker: it cannot tell
> Instagram-the-job from Instagram-the-escape, so you either break your work or you do not block
> it. Not your own memory: the fifteen minutes that vanished are the fifteen you did not notice.
>
> The cost is not the lost time. It is that tomorrow gets planned on **feelings instead of
> evidence**, so the same task slips again — and for someone self-employed, the slippage is unbilled.

**Falsifiers.** **P-F1:** target users can already answer "did that block deliver?" unaided → this
is a motivation problem, not an information one. **P-F2:** drift plus away is under ~15% → the loss
is not where we say it is. **P-F3:** users answer the question reliably and nothing about the next
day changes → the ledger is a diary. *(P-F3 is the one our own six sessions could already be
failing, and it has never been checked.)*

**Awareness is the goal; information is the mechanism (ADR-0052).** The chain is
*information → pattern → noticing*, and it has a lag in the middle. **The review is not a ledger —
it is a training loop for noticing.** Self-control and accountability are targeted but secondary,
and lose to awareness where they conflict. Blocking is the named exception: a blocked site records
the reach and never the duration, so every blocked site is one the product stops learning about.

MEANT closes the gap between what someone said they would finish and what their attention actually did. It is one browser extension plus one web app: declare the intention, protect it, watch alongside, record what happened, and answer one question at the end — did you finish it?

The number that accumulates is completed outcomes, not hours. Hours appear only as evidence inside a single session's review. Checked tasks never accumulate at all (I8).

**What makes it different, in one sentence a customer can repeat:** every AI accountability product asks whether you were focused; this one is inside the tab and already knows.

### 1.1 Foundation (reference copy — canonical in [idea-intent.md](idea-intent.md) §1)

| # | Field | Answer |
|---|---|---|
| 1 | One line | Say what you mean to finish, block what you chose to avoid, be watched while you work, and answer whether you finished it |
| 2 | Problem event | 70 minutes, 14 tabs, no way to say whether the proposal moved |
| 3 | Primary user | A self-employed, non-technical browser-native worker. Own laptop, own card |
| 4 | Pain moment | End of a work block, asked "did you finish it?", answering "I was working on it" |
| 5 | Insight | One extension sees intention, plan, enforcement, and attention at once — and can read the tab, which nothing else in the category can |
| 6 | The one thing | The end-of-session review: intention beside actual attention, then the question |

### 1.2 The case that defines the product

*Folded from `PRODUCT.md`, 2026-09-11. It belongs here: §6.1's reversal argument depends on it.*

A social-media freelancer's Instagram **is** her work. Instagram at 11am, when she said she would
finish the client deck, is drift. Instagram at 4pm, when she is scheduling posts, is the job. Same
hostname, opposite meaning, four hours apart. **No blocklist resolves this.** Reading the tab
against the stated intention does.

**The pain moment, stated in its costed form:** end of a work block, asked "did you finish it?",
answering "I was working on it." For a self-employed person, that gap is **unbilled**. That is why
the *buyer* is self-employed (D10, narrowed by ADR-0054 to the buyer axis only) — the same gap, for
an employee, costs them nothing they can feel.

> **The case stands; the conclusion is stale (2026-09-15, ADR-0061).** This section concludes
> *"No blocklist resolves this. Reading the tab against the stated intention does."* The first
> sentence is true. **The second is no longer the product's answer.** ADR-0035 asks the user, at the
> start of every session, which sites are work today and which pull them away — which resolves
> Instagram-at-11am-versus-4pm at declaration time, with no model call and no page reading.
>
> **The judge therefore needs a narrower and more honest justification**, and §6.5 states it: the
> **residual** (sites the user never thought to declare) and **in-site ambiguity** (which part of a
> large site — `chatgpt.com/c/…` versus `/gpts`). That is a real job. It is not this case.
>
> One consequence worth naming: ADR-0035's three-question flow is **built in the UI and
> disconnected from the database** — `work_sites` and `blocked_domains` are non-empty in **0 of
> 3,668 session rows**, because `app/api/sessions/route.ts` never inserts them. The design that
> resolves the defining case has never once run.

---

## 2. Users

**Rewritten 2026-09-15 (ADR-0054).** The *user* and the *buyer* are two axes, not one. D10 narrowed
both at once because the old persona had no legal buyer; only the buyer half of that narrowing survives.

**Who is served — behavioral, no job titles.** Anyone for whom **the work surface and the distraction
surface are the same browser.**

| Who | Context | What they need from v1 |
|---|---|---|
| **The paying core — the self-employed browser-native worker** (D10, unchanged as *buyer*) | Own laptop, Chrome or Edge, works in documents, email, client tools, and AI chat all day. Non-technical | To find out, at the end of a block, whether the block produced the thing it was for — and, being self-employed, the gap is unbilled |
| **Served free — researchers, students, operators, marketers, and the browser-resident half of anyone else's day** | Same behavior class, no card or no budget | The same mechanical loop. Free tracking and blocking cost nothing per user, and these sessions are the corpus the paid analysis is evaluated against |
| **Secondary — the builder** | Same behavior class, uses it daily | Enough friction-free daily use that A2, A3, A8 and A9 get tested for real |

**Segments are deliberately unranked.** A scorecard across seven candidate groups and five tests
(work is in the browser · the loss is felt · owns the card · $12 is trivial · findable cheaply) left
**two columns blank for every row**: relative pain acuity and reachability. Those two decide the
ranking. Pain acuity is closable only by talking to people; reachability by desk research. **Not
choosing is the correct state, not a deferral** — an earlier attempt to record a ranking filled both
columns with reasoning and was withdrawn.

**The boundary is browser share, reported at runtime — not a title filter.** IDEA §9's warning was
never about titles; it is that the product "would see a fraction of their day and be confidently
wrong about the rest." So it stops guessing: **where recorded browser attention is a small fraction
of a session's wall clock, the review states what it did not see.** A developer whose day is pull
requests, docs and AI chat is served; one who spent four hours in an IDE is told plainly that the
product watched twenty minutes. *(Build obligation: `lib/review-data.ts` computes no unrecorded-time
field — wall clock minus recorded attention minus `away`.)*

**Not served in v1:** anyone on a managed corporate endpoint where IT policy governs what may be
installed — not the target since D10. **Employers, permanently and at any tier** (IDEA §9).

**ADR-0054 is load-bearing on the freemium shape and unsafe without it.** Serving a population that
cannot pay is only safe because free tracking and blocking have near-zero marginal cost and the
paywall sits on the inference cost (§7.1). **Any change to Q6 that narrows the free tier or moves the
paywall off inference re-creates D10's no-buyer problem and must re-open ADR-0054.**

**A boundary that must not blur.** There are two populations in this project and only one of them is in this document. **MEANT's user** is the self-employed browser-native worker above. **The student** — the entrepreneur, solopreneur, SME operator or undergraduate who rebuilds MEANT from the manual — is the subject of `../apexhuman.md`, not of this PRD. A feature that exists to serve the student is a course feature and belongs there. The only place the student legitimately reaches into this document is §3.1 I9 and §7, where their constraints genuinely bind the architecture.

---

## 3. Features and Priorities

| ID | Feature | Priority | Serves | Notes |
|---|---|---|---|---|
| PRD-F1 | Declare an intention and start a session | Must | A2, IDEA §4 | One text field, optional duration. Start is **instant** — nothing may block it |
| PRD-F2 | Block a chosen list of sites for the length of the session | Must | A4 | Dynamic MV3 rules, added on start, removed on end. Fires locally with no model in the path |
| PRD-F3 | Record attention passively while the session runs | Must | A1 | Seconds per domain, plus away time |
| PRD-F4 | End-of-session review | Must | A3 — *this is the one thing* | Intention, time per domain, away, blocked attempts, then: did you finish it? **Shipped subset (2026-09-11): intention, band, top-3 domains, away, blocked attempts, the question. Drift-and-return counts are specified but not built — `lib/review-data.ts` computes no such field** |
| PRD-F5 | History — the outcome ledger | Must | IDEA §1.6 | Sessions with their outcome. **Counts, spelled as words** are the headline ("seven this month. five finished") — never a rate. A completion *rate* is a percentage and §3.1 bans one; the 0.2 wording said "completion rate is the headline" and contradicted its own invariant. Corrected 2026-09-11 to match `app/dashboard/page.tsx`. No hours headline, no score, anywhere |
| PRD-F6 | Account and device pairing | Must (infrastructure) | A5 | Sign in on the web app; paste a one-time code into the extension |
| PRD-F7 | Edit the blocklist | Should | — | Three built-in lists plus add/remove a domain |
| ~~PRD-F8~~ | ~~Task plan generated from the intention~~ | **Cut** (ADR-0048/D38, 2026-09-04) | A7, C10, C13, C14 | The live per-domain band and the cycle read give a sense of progress with no model call, no table, and no checklist (ADR-0049/D42) — the stated purpose this feature existed for. `I8` already keeps checked steps out of the ledger for the same reason a plan invites self-congratulation. The judge (PRD-F9) judges against the **sentence**, not a step — never gate it on a plan. `US-07`, `EV8`–`EV10`, `M6`, and the `task` table are cut with it (confirmed: no `task` table exists in `lib/migrations/`) |
| **PRD-F9** | **Attention judged against the intention — after the session, in batches, on demand** | Must | A8, C15 | Returns serves / drifts / unclear. **Rewritten 2026-09-15 (ADR-0060, ADR-0061).** Runs when the user asks for an analysis, never per tab. **The two input tiers are gone: it never reads page text or page titles.** Inputs are hostname, path, dwell, sequence, time of day, declared work/distraction sites, and the outcome answer — see §6.3. Gated by memory (I4). **Judges against the intention sentence, never a step or plan (PRD-F8 is cut)**. Its job is narrower than §1.2 implies: the **residual** (sites never declared) and **in-site ambiguity**, not the Instagram case, which ADR-0035 resolves at session start |
| **PRD-F10** | **The companion — presence, and the user's one-tap input** | Must | A9, C11, C12 | **Rewritten 2026-09-15 (ADR-0057, ADR-0058).** It **no longer signals drift** — no dashed ring, no live judgement, nothing pushed at the user. It reveals the intention on hover (already shipped, `companion-overlay.js:266`) and accepts **one tap meaning "this isn't the work"**, which writes a per-visit label (ADR-0062). A self-report cannot be a false positive. **Never marks "tasks" — there are none (PRD-F8 cut)** |
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
| **I2** | No celebration during a session. Positive feedback exists only in the review. **Absolute since 2026-09-15 (ADR-0057): its one named exception — ADR-0026's return-pulse — died with the drift signal it acknowledged.** A *receipt* for a user-initiated tap is not positive feedback and is permitted (ADR-0058) | Two independent reasons: engagement-contingent reward undermines motivation, and celebration raises arousal, which impairs complex work | C9, C11, C12 |
| **I3** | The coach attaches no **valence** to the outcome answer — it never praises `Yes` nor reproaches `Not yet`. **Amended 2026-09-11 (D51): it may freely *reason from* the answer.** The 0.2 wording ("says the same things whether you answered `Yes` or `Not yet`") forbade using the single most informative column in the schema | Keeps the outcome question safe to answer honestly. The moment `Not yet` earns a lecture, everyone answers `Yes` and the only honest column dies. That risk is valence, not use | Follows from I1 |
| **I4** | Memory gates the judge. A domain already classified for this user's intention class is not re-judged | It is the accuracy story and the margin story in one feature | A11, M9 |
| **I5** | The coach may only suggest actions the product can execute | Structurally prevents "have you tried the Pomodoro technique," the most commoditized output in 2026 | C15 |
| **I6** | The coach states no pattern below the evidence threshold. **Amended 2026-09-11 (D50): the threshold gates *inference*, never *description*.** Showing the user their own rows is not a pattern claim and has no floor; asserting a regularity about them does, and keeps one | A pattern from three sessions is astrology, and being wrong about *you* costs far more than being wrong about a tab. But gating description too means a paying user sees nothing for eight sessions, which is the same product as no product | Q5 |
| **I7** | **Amended 2026-09-15 (ADR-0059, ADR-0061).** **Page text and page titles are never read at all** — not stored, not transited, not requested. **Full paths are recorded in extension local storage only, never in the database**, and transit transiently to the model at analysis time; only `{domain, verdict, confidence}` persists server-side. `event.domain` stays hostname-only (D8) | Was written for live cloud inference on page text. That architecture is gone; the anti-surveillance control now bites on *paths*, which are **worse than titles** — a path is a durable handle to a specific private document | SDD V5, `002-drift.sql:24` |
| **I8** | Checked tasks never enter the ledger. Only the outcome answer counts | Sub-goal completion "could breed self-congratulation," which is a more sophisticated version of the exact pain this product exists to attack | C13 |
| **I9** | **Every feature above the mechanical loop is independently removable.** The product must run, ship, and be worth using with the judge off, the companion off, memory off, the coach off, or any combination | **This is the teaching tiers made structural.** A beginner rebuilds a subset and pastes the rest (`../apexhuman.md` §6); if the pieces do not detach, the subset does not run, and the manual cannot exist. It is also the K4 escape hatch generalised: any of these features may turn out to be wrong, and none of them may take the product down with it | `../apexhuman.md` §6, §7 rule 3; K4 |

**Explicitly not features:** any ranking, score, streak, badge, leaderboard, productivity percentage, or hours headline. Any conversation with the companion during a session. Any celebration of `Yes` over `Not yet`. Moralizing about a bad session. Storing what the judge reads. Nagging for a declined permission. Anything an employer would want displayed. A suggestion the product cannot execute (I5).

### 3.2 The companion, as shipped (the Orbit reversal, 2026-09-05)

PRD-F10 above states the requirement in the abstract — presence, one tap, no words (**"turning on drift" was struck 2026-09-16, ADR-0057**). The companion's **visual form** reversed after this PRD was written and is recorded here, not re-litigated: the 0.2 spec called it "a coach, not a pet," gaze/posture only, 80–120px, no on-screen acknowledgment of a returned drift. Mid-build, the owner chose a supplied reference ("Orbit") over that spec instead, on the explicit basis that the documented spec should update to match the shipped code, not the other way round. Full reasoning: `docs/dead-ends.md` ("The companion's design reversed…") and the ADR in `docs/adr/`.

**What shipped instead:**
- **It is a pet, not a coach.** A 28px orbital dot, bottom-right by default, draggable. Presence over posture — the opposite framing of the superseded spec.
- **State is ring presence, never color.** Resting: dot only. Running: a solid ring. **Corrected 2026-09-16 (ADR-0057): there is no drift state and no dashed ring.** Clay is the only accent color at any state, so state reads as a shape change, never a status light (holds I1 — the ring never varies with the outcome answer).
- ~~**Return gets one visible acknowledgment**, deliberately: a 0.6s ring-collapse pulse on the drift-to-focus transition.~~ **Removed 2026-09-15 (ADR-0057).** It acknowledged a return *from drift*, and there is no drift signal to return from, so I2 loses its one named exception and is absolute again. **The motion is reused** (ADR-0058) as the receipt for the one-tap label — the same ring-collapse, retimed to 160ms feedback speed (#50) and caused by the user rather than by the product. Reduced motion gets its own, static receipt: the ring goes opaque and thickens for 600ms rather than animating.
- **It is an input, not only a presence (ADR-0058).** Hover reveals the intention (`companion-overlay.js:266`); one tap means *"this isn't the work"* and writes a per-visit label (ADR-0062). This is the whole of what the companion does with drift now: it lets the person say it, and never says it first.
- **Aliveness is a continuous, slow breathe (~1.6s) on the dot**, not a rare blink.
- Built as `extension/companion-overlay.js`, a self-contained Shadow DOM injected at `<all_urls>` — not `.m-mark`'s primitives, and not `chrome.sidePanel` (superseded; see the host-permission correction in §7 and the ADR log).

---

### 3.3 The loop, and the surfaces it runs on

*Folded from `PRODUCT.md`, 2026-09-11.*

Same creature throughout. The register changes with the moment, never the entity.

| Phase | Who it is | What happens |
|---|---|---|
| **Start** | — | You type what you meant to do. The session starts in under 200ms, having blocked nothing yet |
| **During** | **Witness** | **Corrected 2026-09-15 (ADR-0057/0058).** Its ring is solid, breathing. **It never goes dashed and never signals drift.** Hover reveals the intention; one tap says *"this isn't the work"*. Never a word typed. It celebrates nothing |
| **Review** | **Coach** | Intention, attention, away, blocked attempts — then the question. This is where it speaks, and where anything good is said |
| **Over time** | **Memory** | *Specified, not built.* It is to learn your domains and your patterns, and to gate the judge so it asks less every week. Today it holds only your configured lists |

| Surface | Mode | Seen |
|---|---|---|
| Extension popup (idle / running / unpaired) | Operate | Dozens of times a day |
| Companion (§3.2) | Accompany | Continuously, and noticed at most three times a session |
| Block page | Operate | A few times a day, at a moment of friction |
| Session review | Understand | Once per session — *the product* |
| Dashboard ledger | Understand | Daily |
| Landing page | Persuade | Once |

That frequency column is a design constraint, not a statistic: it is why the popup animates nothing
and why the review is the only surface allowed a moment.

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
- Given `chrome.idle` reports the system idle, when activity resumes, then that period is attributed to `away` — except where the foreground tab is `audible`, which stays attention on its domain. **(Corrected 2026-09-11: the 0.2 wording said "browser loses focus for more than 60 seconds", superseded by ADR-0034.)**
- Given the service worker is terminated mid-session, when it wakes, then state is reconstructed from stored timestamps with no loss beyond the current interval.

**US-04 — Review (PRD-F4)**
- Given a session ends, when the review opens, then it shows the intention, seconds per domain in descending order, away time, blocked attempts, and a yes/no question. **(Corrected 2026-09-11: "the plan with what moved" is void with PRD-F8; "drift-and-return count" is specified but unbuilt — no field for it exists in `lib/review-data.ts`.)**
- Given the review is open, when I answer, then the outcome is stored and the review closes.
- Given I dismiss the review without answering, then the session is stored with outcome `unanswered` and counts against M3.

**US-05 — Ledger (PRD-F5)**
- Given at least one completed session, when I open the dashboard, then I see each session with its intention, its attention band, and its outcome, plus a count of answered and finished sessions this month spelled as words. **(Corrected 2026-09-11 against `app/dashboard/page.tsx`: duration and top domain are not rendered, and "a completion rate" would be the percentage §3.1 bans.)**
- Given any state of the data, when I open the dashboard, quantities render: attended time, counts, shares, and change against the previous period (ADR-0068). Nothing renders a composite productivity score, and no figure carries a colour that grades it.

**US-06 — Pair (PRD-F6)**
- Given I am signed in, when I open the pairing screen, then a short code is displayed with a stated expiry.
- Given the extension is unpaired, when I paste a valid code, then it stores a token and subsequent events are attributed to my account.

**~~US-07 — Plan (PRD-F8)~~ — cut with PRD-F8 (ADR-0048/D38).** Its acceptance criteria are void; do not implement.

**US-08 — Judge (PRD-F9)**
As a user, I want the product to know whether where I am serves what I said.
- ~~Given a session is running, when the active tab changes…~~ **Superseded 2026-09-15 (ADR-0060): the judge does not run during a session at all.** It runs after the session, in batches, when the user asks. **(Still not "at least one open task" — there is no task; PRD-F8 is cut.)**
- Given the domain is already classified for this intention class, when the tab changes, then **no model call is made** and the stored classification is used (I4).
- Given a verdict is `drifts`, when confidence is below the precision floor (Q4), then the companion does not signal.
- ~~Given I have not granted page access…~~ ~~Given I am offered page access…~~ ~~Given I grant page access and later revoke it…~~ — **all three VOID 2026-09-15 (ADR-0061).** No page-access permission is ever requested, so none of these states can be entered. Replaced by:
- Given a session has ended, when I ask for an analysis, then its visits are judged in a batch from hostname, on-device path, dwell, sequence, the declared work and distraction sites, and my outcome answer — and **no page text or page title is read at any point**.
- Given I never ask for an analysis, when I open a past session, then it is fully viewable, free and unjudged.

**US-09 — Be witnessed (PRD-F10)**
- Given a session is running and nothing is wrong, when I glance at the companion, then it is a solid ring, breathing, and has not moved in a way I would notice. **(Corrected 2026-09-11 — "facing my work" described the pre-Orbit gaze design; the shipped Orbit companion signals by ring style, not orientation. See ADR-0026.)**
- ~~Given a drift is detected above the floor, when the companion responds, then its ring goes from solid to dashed…~~ **VOID 2026-09-16 (ADR-0057).** Drift is still *detected* and recorded; it is never *signalled*. Replaced by:
- Given a drift is detected, when I look at the companion, then **nothing about it has changed** — the detection reaches me in the review, or when I ask for an analysis, and never during the work.
- Given a session is running, when any positive event occurs, then **nothing happens on screen until the review** (I2), **with no exception** — ADR-0026's return-pulse died with the signal it acknowledged.
- Given I tap the companion, then a 160ms ring-collapse acknowledges it (600ms, non-moving, under reduced motion) and nothing else happens: no words, no colour change, no count. **A receipt is not celebration**, and without one I cannot tell the tap registered.
- Given the first 60 seconds of a session, when anything at all is detected, then the companion does not move.

**US-10 — ~~Correct it~~ Say it yourself (PRD-F10, PRD-F11)**
**Rewritten 2026-09-16 (ADR-0057, ADR-0058).** As a user, I want to tell it what the work is not — in one tap, unprompted.
- ~~Given a tab was judged `drifts` and it was work, when I tap "that was work"…~~ **VOID.** Nothing is flagged live, so there is nothing to correct. The correction UI this story specified **was never built**, and its absence is the reason ADR-0057 removed the signal: a false positive that cannot be reported is a cost the user pays with no way out.
- Given I am on a site that is not the work, when I tap the companion, then a per-visit label is recorded (ADR-0062) and the ring collapses once to acknowledge it.
- Given I tap, when the review renders, then my own labels are shown as mine — **a self-report is not a verdict and must never be displayed as one**.
- Given I label the same domain repeatedly, when memory forms, then it forms on the repetition and never at n=1 (ADR-0062, I4).

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

**Status refreshed 2026-09-25 (ADR-0079 to ADR-0088). This block supersedes the older status notes
below wherever they disagree.**

- **Three model calls exist, all Groq (ADR-0072).** The coach (`app/api/coach/chat`,
  `openai/gpt-oss-120b`, ADR-0079); the judge (`app/api/judge/analyze`, same model, ADR-0080); and
  the intention-preset classifier (`app/api/presets/classify`, `openai/gpt-oss-20b`, ADR-0083),
  which runs only when no keyword matches.
- **The judge is built, measured, and hidden.** It failed its eval (ADR-0085, ADR-0086): on the
  held-out split of a 48-session synthetic set (`eval/judge-cases.json`) it beat the no-model
  baseline on accuracy (0.544 against 0.369), but only 44 of the 60 verdicts it would have shown
  were right (0.733 against a 0.80 bar). The popup's "Try the judge" is built behind
  `JUDGE_RENDERS = false` (`extension/lib/judge-view.js`), so nothing calls the route from the
  shipped UI. Re-run with `npm run eval:judge`.
- **Memory is written** from the companion's tap (`app/api/events`) and, when the judge runs, from
  its verdicts (ADR-0078). Those verdicts are still filtered at the unmeasured 0.70 floor, which
  ADR-0086 flags.
- **Every AI feature can be switched off** in `/settings` (companion, judge, coach; ADR-0087).
  **Forget what you know about me** and **Delete my account** exist (PRD-F15, ADR-0087).
- **Every feature is free** (ADR-0075). **MEANT is not deployed**: it runs locally as the
  reference build (ADR-0088).
- One session can hold several tasks (ADR-0084), the intention pre-fills what to block (ADR-0083),
  and the popup opens itself to ask at the end (ADR-0082).

**Status, as of 2026-09-11: no model call fires anywhere in the shipped product** — verified by grep for gateway/provider SDK across `app`, `lib`, `extension`, and `package.json`: zero matches. **The earlier claim that no `judgment` or `memory` table exists was wrong**; both shipped in `lib/migrations/002-drift.sql` on 2026-09-04. `judgment` has never received a row from any code path (nothing writes it), and all 572 `memory` rows are `kind='list'` — `domain_class` has never been written, because ADR-0039 admits only user taps and no correction UI ships. No `task` table exists, correctly, with PRD-F8 cut. Rounds 4–6 (`docs/superpowers/specs/`) shipped popup, companion, navigation, and timer UI — none of it the AI stack. In its place, `docs/index.md` D25 shipped a mechanical stand-in for the judge: the companion signals drift when the active tab's domain matches a known distraction category the session didn't choose to block, computed with no model in the path. This exercises the judge's seam (I9) by construction, and is not a step toward this section — it is a placeholder that must be removed, not extended, when PRD-F9 actually ships.

### 6.1 Why this section reversed

Version 0.1 said: *"v1 contains no AI, no model calls, and no LLM,"* on the grounds that classification *"would put browsing history in a prompt, which §7 forbids."*

That reasoning had one premise: judging requires exporting and retaining browsing data. The premise is now false in the way that matters. Text is sent for a single classification and is never stored, logged, or retained anywhere (I7, SDD V5 amended). What persists is a verdict, and a verdict is smaller than the hostname already stored.

The reversal is also forced by the product itself: **the case that defines this product — the same hostname being work at 4pm and drift at 11am — is unanswerable without reading the tab.** Version 0.1 shipped a product that could not solve its own central example.

### 6.2 The model calls

**Two, not three — the Plan call is cut with PRD-F8 (D38/ADR-0048). A third, at declaration time, is *proposed* and not decided: see Q11 in §10.**

| Call | When | Input | Output | Bounded by |
|---|---|---|---|---|
| **Judge** | **Corrected 2026-09-16 (ADR-0060, ADR-0061).** ~~On tab change~~ — **after the session, in a batch, when the user asks**; only for domains memory has not classified (I4) | The intention sentence + hostname + **on-device path** + dwell, sequence, time of day, the declared work/distraction sites, and the outcome answer. ~~a hard-capped extract of visible page text~~ — **no page text, no page title, ever** | `serves` / `drifts` / `unclear`, plus confidence | Memory gating; **never in a session**; never on the block path. See §6.5 |
| **Coach** | In the review only | Session record, plan, verdicts, corrections, and memory above the evidence threshold | Observations and executable suggestions | One session's context; review surface only |

### 6.3 Rules the agent operates under

- **Never in the latency path of a block.** Blocking is a local domain match. A model is never between a user and a page.
- **Never persists what it reads.** I7. The `judgment` table has no text column, by design.
- **Never speaks below the floor.** ~~Drift is signalled only above the precision floor (Q6)~~ — **void 2026-09-16 (ADR-0057): drift is never signalled at all**, so the precision floor has nothing to gate on screen. What remains and still binds: patterns only above the evidence threshold (Q5), which gates *inference*, never *description* (I6, ADR-0050).
- **Never suggests what it cannot do.** I5.
- **Never celebrates while you work.** I2.
- ~~**Wrong is correctable in one tap**, and every correction is a training label (US-10).~~ **Rewritten 2026-09-16 (ADR-0058):** nothing is asserted live, so nothing needs correcting live. The tap is now an **unprompted self-report**, which is a better label than a correction — it cannot be a false positive, and it does not depend on the product being wrong first.

### 6.4 What it is not

Not a chatbot. Not a classifier of *you*. Not a health, clinical, or diagnostic instrument, despite an audience that overlaps heavily with undiagnosed ADHD (IDEA §9). It classifies one tab against one sentence the user wrote, and it reports what it saw.

---

### 6.5 What the judge reads — folded up from the void SDD §5.2 (ADR-0061, 2026-09-15)

SDD §5.2 specified two input tiers: **T-A** (hostname + page title, no new permission) and **T-B**
(plus a capped text extract behind an opt-in permission). **That structure is void**, for three
independent reasons, any one sufficient:

1. **The judge now runs after the session** (ADR-0060). Page text and titles cannot be read post-hoc
   — the page is gone. T-B is not optional; it is **impossible**.
2. **Full paths are stored on-device** (ADR-0059), so the disambiguation T-B existed to supply now
   arrives from the path, after the fact, at no privacy cost beyond what browser history already holds.
3. **`<all_urls>` shipped unconditionally on 2026-09-07** (ADR-0027) for `declarativeNetRequest`'s
   redirect, so the permission argument §5.2 was built on no longer describes the manifest.

**The one input set. Read from local storage after a session ends:**

| Read | Source | Persisted server-side? |
|---|---|---|
| Hostname | `event.domain` | Yes — hostname only, unchanged since D8 |
| **Path** | extension local storage | **Never.** Transits transiently at analysis time (I7, amended) |
| Dwell, sequence, time of day | `event.seconds`, `event.at` | Yes |
| Declared work and distraction sites | `session.work_sites`, `session.blocked_domains` | Yes — *currently written in 0 of 3,668 rows* |
| User labels | `event.label` (ADR-0062) | Yes |
| The outcome answer | `session.outcome` | Yes — and ADR-0051 permits reasoning from it |

**Page text and page titles are never read. There is no optional-permission prompt anywhere in the
product.** For a non-technical buyer that removes the most alarming screen in the funnel; for
`apexhuman.md` it removes a decision point, a failure mode and a step from the manual.

**What the judge is actually for**, now that §1.2's case is resolved at declaration time: the
**residual** — sites the user never thought to declare — and **in-site ambiguity**, which part of a
large site a visit belongs to. Both are real. Neither is the defining case.

**And some of what was wanted from "AI" does not need it.** *"Your finished sessions averaged 9
minutes on `chatgpt.com`; your unfinished ones averaged 31"* is arithmetic over the outcome column:
no model, no page text, no cost. **Build the arithmetic before the judge.**

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
- No screenshots, no keystrokes. ~~Page text is read transiently for one classification and never stored (I7).~~ **Corrected 2026-09-16 (ADR-0061): page text and page titles are never read.** What the judge reads is hostname, **on-device path** (ADR-0059), dwell, sequence, time of day, the declared sites and the outcome answer.
- The model tier chosen inside the gateway is a **business-model decision**, not a quality decision. See M9.
- **Every external service costs a student 10–15 minutes of provisioning.** Four of five allocated is roughly 40–60 minutes of a 4–8 hour rebuild before a line of product code exists. The integration budget was a taste constraint at 0.1; it is now arithmetic (`../apexhuman.md` §5).
- **This product will be filmed being built.** That is a design constraint, not a marketing one: every build step must produce a **visible** change on screen, because console output is bad television and worse teaching. Empty states and error states are seen *first* by every viewer rather than last. The moments worth watching must be visual — ~~which is one more reason the companion's gaze, and not a log line, is the drift signal~~. **Corrected 2026-09-16:** the gaze was replaced in September (ADR-0026) and the drift signal was deleted (ADR-0057). The visible moment the camera gets is now **the review**, and the tap the person chooses to make — not something the product does at them.
- **Nothing on the rebuild path may require a Chrome Web Store review.** Review runs days to weeks (C18). The product must be real and working while loaded unpacked; publishing is an epilogue, never a step.
- **Windows and macOS identically.** Apex states a macOS 13+ / Windows 10+ floor and no RAM or disk floor. Any macOS-only convenience is banned.

### 7.1 Business model (D15, promoted from `PRODUCT.md` 2026-09-11)

Direct consumer subscription. **Free is mechanical** — blocking, review, ledger. **Paid is the half
that knows you** — judge, companion, memory, coach. The paywall sits exactly where the inference
cost sits, which is the only pricing shape that survives M9.

> **Suspended for the testing phase (ADR-0075, 2026-09-22).** Every feature this section calls
> paid is free until a later ADR ends the suspension, and no code gates any feature. The paywall's
> placement at the inference cost is not revisited; it is what resumes when the phase ends.

**The price ceiling is lower than the coaching comparison suggests.** IDEA §5 C16: certified ADHD
coaches charge $150–250 per session and packages run $300–700/month, but the software this competes
with for a subscription slot is Focusmate at **$8/mo annual, $12/mo monthly**. Price against the
software, not against the humans.

**Open against this:** see Q6. Any freemium shape that limits the *ledger* — by retention window,
by day, by session count — moves the paywall off the inference cost and breaks the sentence above.
That is allowed, but it is a different pricing thesis and must be recorded as one, not slipped in
as a packaging tweak.

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
| ~~M6~~ | ~~Share of generated task sets surviving the session un-deleted~~ | **Cut with PRD-F8** (ADR-0048/D38) | ~~`task.removed_at`~~ — no `task` table exists | A7 |
| **M7** | Judge precision — 1 − (corrections ÷ judgments shown to the user) | ≥ the floor set in Q6 | `judgment.corrected_to` | A8, K4 |
| **M8** | Free-to-paid conversion after 8 weeks | ≥ 3% | Billing | A10 |
| **M9** | Inference cost per active user per month, as a share of subscription price | < 15% | Gateway spend ÷ active users | A11, K6 |
| **M10** | Drift-return rate — share of drift events followed by a return within 2 minutes | reported, no target in v1 | `judgment` + attention | Feeds the review's celebration (§6.2 coach) |

**M1–M4 are currently unmeasurable, 2026-09-11.** The Playwright suite writes to the same Neon
database as real usage: 3,668 session rows across 3,651 distinct `user_id`s, of which the
plausibly-human set (ended, longer than two minutes) is **10 rows belonging to one user**. M2 reads
100% because every test writes an intention. Any metric, dashboard, or cross-session pattern built
on these tables must filter test data first, or it is measuring the test suite. Historical
`event.domain` rows additionally predate `bareHostname()`'s `www.`-stripping and protocol filter,
so they double-count (`facebook.com` / `www.facebook.com`) and contain extension IDs.

M1–M4, M6, M7 and M10 are `SELECT`s against tables the product needs anyway. M8 and M9 need billing and gateway spend, which arrive with the fourth service.

**Reproduction rate is deliberately absent.** Whether a student rebuilds MEANT in 4–8 hours measures the *manual*, not the product. It belongs in `../apexhuman.md`, and putting it here would be the first step toward optimising the product for the course rather than for its user.

**A9 is not on this list, and that is the point.** If a calm presence inhibits complex work, every metric here would improve while the user's actual output got worse. A9 can only be tested against something outside this data (Q9).

---

## 9. Implementation, Rollout, and Rollback

- **Rollout:** extension loaded unpacked for the builder; Chrome Web Store for anyone else, on the assumption of a slow review track for a new developer account with `tabs` plus host permissions (C18). Plan weeks, not days.
- **Order of build:** the review first, because everything else is evidence for it. Then declare, judge, companion, correction, memory, personal blocklist, coach. **("plan" struck — PRD-F8 cut.)** `build-intent.md` describes the completed four-hour sitting and is a historical record, not the plan for this work; a new run-of-show is required.
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
| ~~Q4~~ | ~~What is the precision floor below which the companion may not signal?~~ **VOID 2026-09-15 (ADR-0057) — not answered. The companion no longer signals, so the question has no referent.** A precision floor may return for what the *review* is allowed to assert, which is a different question and will get a different number | — | — | void |
| **Q5** | How many sessions of evidence before the coach may state a pattern? | PRD-F11, I6 | Alexandre | Before the coach speaks |
| **Q6** | Free/paid boundary. Provisional (D15): free is mechanical (block, review, ledger); paid is the half that knows you (judge, companion, memory, coach). **"plan" struck — PRD-F8 is cut.** Still open: whether the free tier is limited by *time window* rather than by feature, which would move the paywall off the inference cost and break D15's stated logic | M8, A10 | Alexandre | Before pricing is shown |
| ~~Q7~~ | ~~What is the hard cap on page-text extract sent per judgment?~~ **VOID 2026-09-15 (ADR-0061) — no page text is ever read.** Replaced by a live question: **what is the local-path retention TTL?** Time-based, because on-demand analysis may never run for a free-tier user | I7, PRD-F15 | Alexandre | Before paths are stored |
| **Q10** | How large must PRD-F14's seed eval set be before M7 means anything? A precision figure from twenty cases is the same astrology as a pattern from three sessions (I6) | PRD-F14, M7 | Alexandre | Before the judge's accuracy is shown to anyone |
| ~~Q9~~ | ~~Does tier T-A clear the precision floor on its own?~~ **VOID 2026-09-15 (ADR-0061) — the tiers are gone and no permission prompt exists to design.** Its *spirit* survives as a live question: **is hostname + path accurate enough to be worth showing?** That is now measurable offline against stored sessions, with no permission and no funnel risk | PRD-F9, M7 | Alexandre | Before the judge's output is shown |
| **Q11** | **Evidence withdrawn 2026-09-15 (ADR-0053): the pattern this rested on is n=2, not the n=5 a prior session recorded. Treat as unevidenced.** **Does a third model call belong at *declaration* time** — reading the intention sentence against this user's history of sentence-shape versus outcome, and offering a rewrite before the timer starts? Proposed 2026-09-11. It is the only intervention point that changes what happens next rather than describing what happened, and it fires once per session rather than per tab. Unresolved: whether the correlation it depends on is real (n=5 today) | §6.2, PRD-F12, M9 | Alexandre | Before the coach is scoped |
| ~~Q12~~ | ~~Memory cannot fill: ADR-0039 admits only user taps and no correction UI ships.~~ **Resolved 2026-09-15 (ADR-0058, ADR-0062).** The companion's one-tap label is a user tap, so memory fills through ordinary use with no judge and no correction UI. Labels are written **per visit** (`event.label`); memory forms only when a label recurs past `MEMORY_MIN_EVIDENCE`/`MEMORY_MIN_AGREEMENT` — **not at n=1**, which would break §1.2 | I4, M9, K6 | Alexandre | done |
| **Q8** | Does an empty intention disable the judge entirely, or does it judge against nothing? *(Provisional: disabled, and the companion says so)* | US-01, PRD-F9 | Alexandre | Before the judge ships |

---

## 11. Competitive Truth

> **Last verified 2026-08-28. Not re-checked since — and this table carries the single most
> perishable asset in the strategy** (ADR-0056): the claim that every AI accountability product has
> to *ask* whether you were focused. Treat every row as a dated hypothesis. The two fastest-moving
> rows — the 2026 voice-agent cohort, and Rize's positioning — are the likeliest to have rotted.
> **The threat this table omits is the general AI assistant** (ChatGPT, Claude): already resident on
> the surface the user lives on, already carrying memory, lacking only a blocking layer and a reason
> to want one.

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
- [x] A cut feature (PRD-F8) is marked cut with its reasoning, not silently removed — its
      dependents (`US-07`, `M6`, `PRD-F10`/`US-09`'s task-marking clauses) are each named (0.2c)
- [x] Registered in `docs/index.md`
