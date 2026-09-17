# Idea Brief

**Project:** MEANT
**Date:** 2026-08-18
**Version:** 0.2
**Cycle:** 1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** 2026-09-16 (Q10 void, ADR-0061). Previously 2026-09-11 — doc audit corrected two items D11/D14-adjacent facts had drifted from
**Downstream:** [prd-intent.md](prd-intent.md)
**Loop closes from:** [flow-intent.md](flow-intent.md) §6 events → [prd-intent.md](prd-intent.md) §8 metrics → §10 below

> **Amendment 0.2c (2026-09-11).** D11's generated task plan was cut 2026-09-04 (D38/ADR-0048,
> `docs/prd-intent.md` amendment 0.2c) — **A7 and its kill criterion below are void**, struck
> through rather than silently left as if still testable. Q5 (companion placement) is answered:
> neither `chrome.sidePanel` nor Document PiP — a content-script overlay (ADR-0026, SDD Q3).
>
> **Amendment 0.2 (2026-08-28).** Five decisions changed the product: the primary user moved from employed to self-employed (D10), the session gained a generated task plan (D11), attention is now judged semantically by a model rather than left to the reader (D12), a companion holds presence during the session and becomes the coach in the review (D13), and inference runs in the cloud rather than on-device (D14). Sections 1–9 and 12 are rewritten. §10 and §11 are unchanged and remain open.
>
> **Working name is dead.** "Intent — Focus" ships on the App Store. The product is **MEANT**. The `docs/*-intent.md` filenames are stale; renaming is deferred so cross-links and history stay intact.

---

## 1. The Spark

| # | Field | Answer |
|---|---|---|
| 1 | One line: what it is, who it is for | A browser extension plus dashboard that makes you say what you intend to finish, turns it into a short plan, blocks what you chose to avoid, watches with you while you work, and ends by asking whether you finished it — for self-employed people whose whole workday happens inside a browser. |
| 2 | The problem, as something that happens | Tuesday 2:10pm. A freelance consultant opens Chrome to finish a client proposal. At 3:20pm there are fourteen tabs, two of them the proposal. She cannot say whether it moved, and the tab count is the only evidence of the last seventy minutes. |
| 3 | Named primary user | A self-employed, non-technical person whose work — proposals, client documents, coordination, content — happens in a browser, increasingly with AI chat as the tool she builds with. Freelancers, consultants, coaches, VAs, marketers, course creators, solo operators. Defined by behavior, not job title: anyone whose workday is browser plus AI chat. Owns her laptop and her credit card. |
| 4 | Pain moment: where and when they feel it | End of a work block, asked (by herself, a client, or a calendar) "did you finish it?" and the honest answer is "I was working on it." Then again the next morning, when the same task is still open — and nobody is paying her for the gap. |
| 5 | The insight: why now, why possible | For a browser-native worker the browser *is* the workstation, so one extension sees all four signals at once — the intention, the plan, the enforcement, and the actual attention. Every AI accountability product shipping in 2026 has to **ask** whether you were focused. This one is inside the tab and already knows. |
| 6 | If we ship only one thing | The end-of-session review: the declared intention and the plan next to the recorded attention, then one question — did you finish it? |

**Name:** MEANT
**Slug:** `meant`

---

## 2. The Problem

> **Canonical, 2026-09-15 (ADR-0055).** Everything below is consequence or evidence.
>
> **Your work surface and your distraction surface are the same browser — so nothing you own can tell
> you whether the block you just spent produced the thing it was for.**
>
> Not the calendar: it records that you booked the hour, never that the hour delivered. Not the timer:
> it counts elapsed minutes, which you already knew. Not the blocker: it cannot tell Instagram-the-job
> from Instagram-the-escape. Not your own memory: the fifteen minutes that vanished are the fifteen you
> did not notice.
>
> The cost is not the lost time. It is that tomorrow gets planned on **feelings instead of evidence**.
>
> **Falsifiers:** **P-F1** users can already answer unaided → motivation problem, not information.
> **P-F2** drift plus away under ~15% → the loss is elsewhere. **P-F3** the question gets answered and
> nothing changes next day → the ledger is a diary.
>
> **The loss is often invisible to the person losing it — a distribution fact, not a wedge.** It is the
> strongest *retention* argument: the first review showing half a session in `away` is when the problem
> becomes visible. It cannot be the *acquisition* argument — someone who does not suspect a problem does
> not search for a focus tool. **The wedge is the person who already suspects.**
>
> **Awareness is the goal; information is the mechanism (ADR-0052).** *Information → pattern → noticing*,
> with a lag in the middle.

**Who has it:** Self-employed, non-technical browser-native workers who have no compiler, no ticket, and no manager's deadline that proves a work block produced anything. Their unfinished work costs them money directly.

**A specific instance:** The client-proposal block above. Three of the fourteen tabs were the AI chat used to draft it; four were a news site opened during a slow model response; the rest were search results from a question that stopped being relevant twenty minutes in. Nothing in her tooling can separate the three from the eleven.

**The case a blocklist cannot handle, and which is the median case here:** A social-media freelancer's Instagram *is* her work. Blocking it breaks her. Instagram at 11am, when she said she would finish the client deck, is drift. Instagram at 4pm, when she is scheduling posts, is the job. Same person, same hostname, opposite meaning, four hours apart. No blocklist resolves this. Reading the tab against the stated intention does.

**How often:** Two to four work blocks a day, every working day.

**What it costs them:** Not primarily hours. It costs the ability to answer "did today work?" — so the next day is planned on feelings instead of evidence, the same task slips repeatedly, and for a self-employed person the slippage is unbilled.

**What they do today instead:** Willpower and tab discipline. A Pomodoro timer that measures elapsed minutes and nothing else. A site blocker installed after a bad week and uninstalled within a fortnight. A to-do list where the item stays unchecked with no record of why. Some pay $8–12/month for a stranger on a webcam (Focusmate); a few pay $300–700/month for a human coach.

**Who else has tried to solve it:** Freedom (blocking, no measurement, no outcome). Rize (measurement, no intention, no protection; hours are its headline). Session, macOS/iOS only, does the loop but is Apple-scoped and asks what you *learned*. Femma, FineStreak, Coach Call AI and the 2026 cohort of AI accountability agents do voice check-ins — **and every one of them asks you whether you were focused, because none can see the screen.** Forest and Finch prove the companion mechanic pays (Finch: reported ~10M users, ~$30–40M ARR, bootstrapped) but measure how you *feel*, not what you *finished*. The graveyard is large and consists mostly of undifferentiated blockers.

---

## 3. Why Now

> **Amended 2026-09-15 (ADR-0056). Two conditions, not three.** **(1) AI chat collapsed the work surface
> into the distraction surface** — `chatgpt.com` is the tool *and* the rabbit hole in one hostname, and
> our own database shows it at **24 of 62 recorded attention-minutes, 38.7%**. **(2) Inference became
> cheap enough to judge a tab against a sentence** — one batched on-demand analysis across ~10 sessions
> ≈ 2,700 in / 800 out tokens: **$0.0067 Haiku 4.5 · $0.0134 Sonnet 5 · $0.0335 Opus 5**, or 0.45–2.2%
> of a $12 subscription against M9's 15% budget (verified 2026-09-11).
>
> **MV3 is demoted to a *why-possible*** — true since 2024; two years is not a window. **"Distraction is
> worsening" is a *why-ever*** and is never cited as timing in any document, deck or page.

Three things changed.

AI chat tools moved *building* into the browser for people who do not code, so a non-technical worker's productive surface and their distraction surface became the same surface — indistinguishable to any OS-level observer, separable only by knowing what the person set out to do.

Manifest V3 gave extensions runtime-mutable blocking rules, so protection no longer requires a network extension, a driver, or admin rights.

And model inference became cheap and fast enough that reading one tab against one stated task is a sub-cent operation, which turns "is this drift?" from an unanswerable question into a per-tab classification.

**What was blocking this before:** enforcement and observation lived at the OS layer; and nothing could tell an on-task `claude.ai` tab from an off-task one.

**How long the window stays open:** no hard window. Any incumbent could ship a browser extension; none has, because each would have to abandon the layer their existing product is built on. The 2026 voice-agent cohort is the nearer threat — one of them bolting on an extension is a matter of months, not years, which is why memory and the companion (not the judge alone) are the defensible part.

---

## 4. The One Thing

**Minimum demonstrable value:** *(Corrected 2026-09-16 — the generated steps were cut, ADR-0048.)* A session review that shows "you said you would finish the client proposal; you spent 41 minutes in the AI chat, 12 in the document, 9 on a news site; twice you drifted and came back within ninety seconds; did you finish it?" — and a history where the answer to that question, not the hours, is the number that accumulates.

**How we would show it in two minutes:** Install → type "finish the client proposal" → session starts instantly → open a blocked site, get the block page showing the intention back → work; the companion sits there, one solid breathing ring, and **one tap on it says "this isn't the work"** → session ends → review: intention, attention, the returns → answer "not yet" → ledger shows three sessions, two completed. **(Corrected 2026-09-16: the three generated steps were cut with PRD-F8, ADR-0048; "turns to face you when you drift" was the gaze design, replaced 2026-09-05 and the signal deleted 2026-09-15 — ADR-0026, ADR-0057, ADR-0058.)**

**What has to be true for that to work:** The user's work is genuinely inside the browser. They will type one sentence before working. "Did you finish it?" is answerable for their real work. The generated plan is more often useful than misleading. The judge is right often enough to be allowed to interrupt.

**What we are deliberately not building:** desktop/OS-level tracking, app blocking, scheduled sessions, Locked Mode, multi-device sync, teams, manager views, voice, and any conversation with the companion *during* a session.

**Previously cut, now in scope, with reasons:** calibration and a reward layer were cut on 2026-08-18 because both needed weeks of data. Calibration returns as **memory** (§F11) — it is the retention mechanism and the thing that makes the companion not-Clippy. The reward layer returns only in the strictly bounded form permitted by C9 and C11: no celebration during a session, and in the review only the *return*, the *completion*, and the *answering* — never hours, never a streak, never one answer over the other.

---

## 5. Load-Bearing Claims

| # | Claim | Label | Source | Checked on | If wrong |
|---|---|---|---|---|---|
| C1 | An MV3 extension can add and remove blocking rules at runtime via `declarativeNetRequest.updateDynamicRules`. Limits far above our needs (30,000 safe rules). | Verified | developer.chrome.com — declarativeNetRequest reference | 2026-08-18 | Blocking falls back to content-script redirects: slower, uglier, easier to bypass. |
| C2 | Reading a tab's URL requires `tabs` or host permissions; `tabs.onActivated` / `onUpdated` signal attention changes. | Verified | developer.chrome.com — chrome.tabs reference | 2026-08-18 | The passive-tracking link does not exist and the product collapses to a blocker. |
| C3 | An MV3 service worker is terminated after 30s idle; `chrome.alarms` minimum period is 30s. Session state must be reconstructed from timestamps. | Verified | developer.chrome.com — service worker lifecycle | 2026-08-18 | Timing code is simpler than planned; no downside. |
| C4 | Rize requires Accessibility plus Screen Recording, and Automation or a browser extension, to capture window titles and URLs on macOS. | Verified | docs.rize.io — Tracking Websites | 2026-08-18 | The "no permission prompts" advantage shrinks. |
| C5 | Corporate managed endpoints commonly deny local admin rights. | Unverified; **no longer load-bearing** | Mechanism documented; no adoption figure retrieved | 2026-08-18 | Irrelevant since D10 — the persona owns her machine. Browser-only now rests on §3, not on admin rights. |
| C6 | Session (stayinsession.com) ships intention + blocking + a post-session review, macOS/iOS only, and asks what you *learned*. | Verified | stayinsession.com, homepage read | 2026-08-18 | — |
| C7 | ~70% of people miss self-set deadlines, often by 2× (planning fallacy). | Unverified; needs check | Secondary summaries; Buehler et al. 1994 not read | 2026-08-18 | Memory's cold-start prior is wrong. Deferred impact — memory speaks only above an evidence threshold (I6). |
| C8 | Chrome ships a Prompt API running Gemini Nano locally; extensions use permission `aiLanguageModel`; requires ~22GB free disk and 16GB RAM or >4GB VRAM, desktop only. | Verified (version ambiguous) | developer.chrome.com — Prompt API, extensions Prompt API | 2026-08-28 | The on-device upgrade path (D14) closes. Cloud remains, unaffected for v2. |
| C9 | Extrinsic rewards undermine intrinsic motivation: engagement-contingent d = −0.40, completion-contingent d = −0.36, performance-contingent d = −0.28 across 128 experiments. Verbal/informational feedback does not undermine and can enhance. | Verified | Deci, Koestner & Ryan 1999, *Psych. Bulletin* — PDF read | 2026-08-28 | The ban on in-session celebration (I2) is over-cautious. Cheap to relax later; expensive to have shipped wrong. |
| C10 | Implementation intentions (if-then plans) raise goal attainment by d ≈ 0.65 across 94 tests; later work widens the range to 0.27–0.66. | Verified | Gollwitzer & Sheeran 2006, meta-analysis | 2026-08-28 | The plan step is decoration rather than mechanism. |
| C11 | Social facilitation (Zajonc 1965): the mere presence of an observer raises arousal, improving performance on well-learned tasks and **impairing** it on novel or complex ones. | Verified | Zajonc drive theory, standard summaries | 2026-08-28 | The companion could be made livelier without cost. Currently the single strongest constraint on its design. |
| C12 | Virtual observers reproduce the effect but unreliably: of 13 studies, 3 showed facilitation, 4 inhibition, 1 both. Moderated by arousal — lower arousal, better performance. | Verified | Mini-review of virtual social facilitation; *Virtual Reality* 2024 | 2026-08-28 | The companion's calmness requirement is weaker than assumed. |
| C13 | Sub-goals reduce perceived difficulty and increase persistence, with the strongest effect at goal **initiation**. Caveat from the same literature: sub-goal attainment "could breed self-congratulation and encourage relaxation," interfering with the overall goal. | Verified | Step by step: sub-goals as a source of motivation (2017) | 2026-08-28 | Either the plan does not help, or checked tasks are safe to count. I8 exists because of the caveat. |
| C14 | Of everything that lifts inner work life, the strongest single factor is making progress on meaningful work, even a small step. 12,000 daily diaries, 238 people. | Verified | Amabile & Kramer, *The Progress Principle* / HBR 2011 | 2026-08-28 | The plan's motivational rationale weakens; its rationale as judge-scaffolding survives. |
| C15 | The 2026 AI-accountability cohort (Femma, FineStreak, Coach Call AI, Nudge, Rize's distraction blocker, Centered) all detect or check in **without visibility into the page**. | Verified | Product pages and category round-ups | 2026-08-28 | The core differentiation claim fails and positioning must be rewritten. |
| C16 | Certified ADHD coaches charge $150–250/session, executive-function coaches $200–350+, packages $300–700/month, uncovered by insurance. Focusmate charges $8/mo annual, $12/mo monthly. | Verified | Coaching-cost round-ups; Focusmate pricing | 2026-08-28 | The price ceiling is lower than assumed. |
| C17 | Finch: ~10M users and ~$30–40M ARR, bootstrapped, direct-to-consumer. 4.9★ on ~712k App Store ratings. | Ratings verified; **ARR unverified** (blog-sourced) | App store listings; review blog | 2026-08-28 | The companion mechanic's commercial proof is weaker. Do not quote the ARR externally. |
| C18 | Chrome Web Store review runs from under an hour to several weeks; a new developer account with broad permissions should plan for the slow track. | Verified | developer.chrome.com — review process; 2026 review-time reports | 2026-08-28 | Distribution timing for any cohort is wrong. |
| C19 | `activeTab` is granted by only four user gestures and *"is revoked when the user navigates away."* It therefore **cannot** read page content on a tab change. Reading text automatically requires broad host permissions. | Verified | developer.chrome.com — activeTab | 2026-08-28 | The judge could read every page with today's manifest, the two-tier design (SDD §5.2) is unnecessary, and the install funnel is simpler than assumed. |
| C20 | `optional_host_permissions` are granted by the user at runtime via `chrome.permissions.request()`, not at install. | Verified | developer.chrome.com — declare permissions | 2026-08-28 | **Moot since ADR-0061** — no optional permission is requested anywhere in the product. |
| **C21** | **Self-interruption is a major, under-studied component of task switching.** 889 hours of observed task-switching from 36 individuals across three information-work organizations. It is a function of organizational environment and individual differences **and of external interruptions already experienced**; open-plan raises it. **People are significantly more likely to self-interrupt in order to *return to* a central working sphere (Mean 23%) than to a peripheral or other one (17%, 19%)**, and to return to solitary work (23%) over a communication event (16%). | Verified — primary PDF read | Dabbish, Mark & González, CHI 2011, *"Why Do I Keep Interrupting Myself?"* (`ics.uci.edu/~gmark/`) | 2026-09-15 | **Not all self-interruption is drift.** A meaningful share is people returning to their real work — which independently supports `neutral` as a first-class label (ADR-0047) and warns against reading every switch as failure. |
| **C22** | Mark's ~47-second average dwell on a screen before switching, and the ~23–25 minute return-to-task cost. | **Reported, NOT verified** — primary source not yet read (`ics.uci.edu/~gmark/chi08-mark.pdf`) | search summary | 2026-09-15 | **Do not quote until read.** A search on 2026-09-15 surfaced an inflated variant of this figure — *"2026 Carnegie Mellon, 3,800 workers, 26.8 minutes, $1.2 trillion"* — from SEO content farms. **That variant is not to be cited** (ADR-0064). |

---

## 6. Assumptions

| ID | Assumption | Confidence | If it is wrong | How we would find out | Tested by |
|---|---|---|---|---|---|
| A1 | The target user's working day is overwhelmingly inside the browser. | High | The timeline is a fragment and every comparison misleads | More than ~2h/day recorded with the browser unfocused | Away time (EV4) |
| A2 | People will type one sentence of intention before starting, and keep doing it. | Medium | The loop has no left-hand side; the product degrades to a tracker | Under 70% of sessions started with a non-empty intention after week 1 | M2 |
| A3 | "Did you finish it?" is answerable for this user's real work. | Medium-high | The outcome ledger — the thesis — cannot be built on this question | More than 30% of reviews skipped or ambiguous | M3 |
| A4 | Blocking a chosen list inside the browser is enough protection. | Low | Protection is theater and the "protected" line is a lie | Blocked attempts followed by a gap in recorded activity | Blocked-attempt count vs away time |
| A5 | Requiring sign-in before the first session does not kill adoption. | Medium | The funnel dies before anyone sees the loop | Installs that never produce a first session | M5 |
| A6 | The intention→outcome link reads as a different product, not a lighter Rize. | Medium | The positioning fails even if the build succeeds | First audience describes it as "Rize but simpler" | Demo feedback, verbatim |
| ~~A7~~ | ~~A generated plan is kept more often than it is discarded.~~ | **Void — the plan (PRD-F8) was cut 2026-09-04, D38/ADR-0048; nothing to test** | — | ~~M6~~ (also cut) |
| **A8** | The judge is right often enough to be allowed to signal. | **Low — riskiest** | A companion that misreads you with a face on it is Clippy, and users resent a face | User corrections (EV10) exceed the precision floor | M7 |
| **A9** | A calm presence facilitates rather than inhibits complex work (C11, C12). | Low | The product makes people stay on task and do worse work — a failure they cannot articulate and will churn over | Self-reported work quality falls, or sessions end early more often with the companion on than off | Companion on/off comparison |
| **A10** | This audience pays ~$9/month for the half that knows them. | Medium | No revenue, and the course's promise fails with it | Free-to-paid conversion under 3% after 8 weeks | M8 |
| **A11** | Inference cost per active user stays a small fraction of price. | Medium | Gross margin inverts — the standard way a consumer AI subscription dies | Cost per active user exceeds 15% of subscription revenue | M9 |

**The one we would be most embarrassed to be wrong about:** **A9.** A3 was the old answer and remains serious, but A9 is worse because it is invisible: the metrics would look *better* (more time on task, fewer drifts) while the user's actual work got worse. Nothing in the product's own data would catch it. It has to be tested against something outside the data.

**Accepted without a test:** A4 in v1 — measuring browser-switching from inside one browser remains near-impossible.

---

## 7. Signals and Kill Criteria

**Early signals of life:**

| Signal | Threshold | By when | Measured by |
|---|---|---|---|
| Builder uses it on real work, unprompted | 10 sessions with real intentions | 2026-09-15 | Session count |
| The review tells someone something they did not know | 3 of 5 test users say so, unprompted | 2026-09-30 | Verbatim feedback |
| Intention step survives contact | ≥70% of sessions have a non-empty intention | 2026-09-30 | M2 |
| ~~The plan is kept, not deleted~~ | **Void — A7/M6 cut with PRD-F8 (D38)** | — | — |
| The judge is trusted | correction rate below the precision floor | 2026-09-30 | M7 |

**Kill criteria:**

| # | Condition | Measured by | Decision if true |
|---|---|---|---|
| K1 | The builder stops using it within two weeks of v1 | Session count by date | Stop |
| K2 | Over 50% of sessions started with an empty intention | M2 | Pivot — the declaration is friction, not value |
| K3 | Review completion under 50% | M3 | Pivot — the outcome question is not answerable as posed |
| **K4** | Users correct the judge on more than a third of the tabs it judges | M7 | Turn the judge off and ship the mechanical product. A wrong companion is worse than none |
| **K5** | Testers report that work quality drops with the companion on | Companion on/off comparison | Remove the in-session presence. A9 falsified; the coach survives, the witness does not |
| **K6** | Inference cost per active user exceeds 15% of price for two consecutive months | M9 | Cut judge frequency or raise price. Do not ship at negative margin |

**Who calls it:** Alexandre Andrei Nevero.
**When we look:** 2026-09-30.

---

## 8. Foundation Gate Verdict

| | |
|---|---|
| Run on | 2026-08-28 (re-run for amendment 0.2; original 2026-08-18) |
| Cycle | 1 |
| Verdict | PROCEED WITH FIXES |
| Fields that failed | None — all six §1 fields remain concrete under the new persona |
| Contradicted claims | C5 is no longer load-bearing; browser-only is re-justified on §3, not on admin rights |
| Carried forward as TBD | ~~Companion placement~~ (answered — see Q5). The precision floor for A8 → PRD §8. The evidence threshold for I6 → PRD §8. Free/paid boundary → PRD |
| Blocking questions | None |

**Why FIXES rather than a clean PROCEED:** A8 and A9 are both Low confidence and both sit under features that are now central. Neither blocks the build; both must have a measurement in place before the companion ships to anyone but the builder.

---

## 9. What This Is Not

| Not this | Why not | Revisit |
|---|---|---|
| Employee monitoring | The data is for the person who generated it. Never sold, shared, or made visible to an employer | Never |
| A timesheet / billable-hours tool | Hours are the metric this product exists to demote | Never |
| A productivity score | A number people optimise instead of the work, and the single change that would make this employer-desirable | Never |
| An OS-level blocker | Weeks of signing work; outside the browser thesis | When browser-only proves the loop |
| A screenshot or keystroke recorder | Page text is read to judge one tab and is never stored. See SDD V5 (amended) | Never |
| A team or manager dashboard | Changes who the data serves, which changes the product | Never (as currently framed) |
| A chatbot you talk to while working | Talking to your focus tool is the highest-quality procrastination available. Conversation exists only in the review | Never during a session |
| A clinical or therapeutic tool | The audience overlaps heavily with undiagnosed ADHD. The product observes and reports; it does not diagnose, treat, or advise on health | Only with clinical partnership and review |

**Not for:** ~~People whose work is mostly outside a browser — designers in native tools, developers in
an IDE, anyone in a terminal.~~ **Amended 2026-09-15 (ADR-0054).** The warning is kept; the job-title
exclusion is dropped. The risk was never the title — it is being "confidently wrong about the rest." So
the product stops being confident about what it did not watch: **where recorded browser attention is a
small fraction of a session's wall clock, the review states what it did not see.** The user self-qualifies
inside one session, on evidence.

**Still not for, permanently:** employers, at any tier, in any form (the rows above).

---

## 10. The Return Loop

Empty until v1 ships to someone other than the builder. Expected, not a gap.

---

## 11. Cycle Log

| Cycle | Opened | Gate verdict | Shipped | Closed | Decision | Headline learning |
|---|---|---|---|---|---|---|
| 1 | 2026-08-18 | PROCEED WITH FIXES | not yet | open | pending | pending |
| 1 (amended) | 2026-08-28 | PROCEED WITH FIXES | not yet | open | pending | Every AI accountability product in 2026 has to ask whether you were focused. Being inside the tab is the whole asset (C15) |

---

## 12. Open Questions

| # | Question | Blocks | Owner | Needed by |
|---|---|---|---|---|
| ~~Q1~~ | ~~Does Session ship the full loop?~~ **Answered 2026-08-18: yes, on Apple platforms.** Its review asks what you *learned*; ours asks whether you *finished*, and that answer accumulates | Positioning | Alexandre | done |
| ~~Q2~~ | ~~Hosting / database / auth providers?~~ **Answered: Vercel, Neon, Clerk (D7).** A fourth is now allocated to AI Gateway (D14). **Clerk later replaced by Neon Auth (D21, 2026-09-01), consolidating auth onto the database vendor** | SDD §2 | Alexandre | done |
| ~~Q3~~ | ~~Where do default blocklists come from?~~ **Answered: three hardcoded lists in v1, plus a personal list derived from observed drift (PRD-F13)** | PRD | Alexandre | done |
| ~~Q4~~ | ~~What counts as "away"?~~ **Answered: browser unfocused > 60s (SDD §3)** | SDD §3 | Alexandre | done |
| ~~Q5~~ | ~~Where does the companion live?~~ **Answered 2026-09-01/05: neither `chrome.sidePanel` nor Document PiP — a content-script Shadow DOM overlay at `<all_urls>` (ADR-0026, SDD Q3, resolved).** | SDD, SITEMAP S9 | done | — |
| **Q6** | What precision must the judge reach before it is allowed to signal a drift? A number, not a feeling | A8, K4, M7 | Alexandre | Before the companion signals anything |
| **Q7** | How many sessions of evidence before the coach may state a pattern (I6)? | A9, I6 | Alexandre | Before the coach speaks |
| **Q8** | Where is the free/paid line, exactly? Provisional: free is mechanical (blocking, review, ledger); paid is the half that knows you (plan, judge, companion, memory, coach) | A10, M8 | Alexandre | Before pricing is shown |
| **Q9** | How is A9 tested at all, given the product's own metrics would look better if it were false? | A9, K5 | Alexandre | Before the companion ships beyond the builder |
| ~~Q10~~ | ~~Does judging on hostname + page title alone clear the precision floor?~~ **VOID 2026-09-16 (ADR-0061).** Page titles are never read, and there is no permission prompt to design — `<all_urls>` ships unconditionally (ADR-0027) and the judge runs after the session, when the page is gone (ADR-0060). **Live replacement: is hostname + on-device path accurate enough to be worth showing?** Measurable offline against stored sessions, with no prompt and no new permission | A8, Q6 | Alexandre | Before the judge is built |

---

## Self-Check

**Outbound (before updating the PRD):**

- [x] §1 all six fields concrete; none is a category, a slogan, or empty
- [x] §1 field 3 names a role in a context, specific enough to find one person this week
- [x] §1 field 5 says something the problem statement does not already say
- [x] §1 field 6 is one thing, and it is still the review
- [x] §2 describes one specific instance, plus the case a blocklist cannot handle
- [x] §2 names what people do today instead, with prices
- [x] §4 the minimum demonstrable value could be shown in two minutes
- [x] §4 names what was previously cut and is now in scope, with the reason
- [x] §5 no claim labeled Verified without a source actually retrieved; C17's ARR explicitly marked unverified
- [x] §5 every Unverified claim the build depends on appears in §6 or §12
- [x] §6 every `A#` names a falsifier and a way to find out
- [x] §6 the riskiest assumption is named (A9) and the reason it is hard to catch is stated
- [x] §7 every kill criterion has a measurable signal and a named decider
- [x] §8 gate verdict recorded with date and cycle
- [x] §9 records the new never-do lines that the new features create
- [x] Registered in `docs/index.md` with matching version, status, and cycle
