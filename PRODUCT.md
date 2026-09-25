# PRODUCT.md — MEANT

> **This file is derived. `docs/prd-intent.md` is canonical.** It is kept at the repo root only
> because tools read a root-level `PRODUCT.md` by convention — the `impeccable` design skill among
> them. Nothing here is independent truth. When this file and the PRD disagree, **the PRD is right
> and this file is stale**; say so, then regenerate this file rather than editing around the PRD.
>
> **`docs/adr/` outranks this file and the PRD both (ADR-0063).** Where an ADR disagrees with
> anything here, the ADR is right.
>
> **Status section refreshed 2026-09-16** against the code on `awareness-turn`: the drift signal is
> deleted rather than merely unbacked, the 572 `memory` rows are all test data, and an app shell
> shipped. The rest of this file was regenerated the day before and still holds.
>
> **Regenerated 2026-09-15 from PRD amendment 0.3** (ADR-0052–0064). What changed: awareness is the
> goal and information the mechanism; the user is defined by behavior with the buyer as a separate
> axis; the companion **no longer signals drift** and instead takes a one-tap label; the judge runs
> **after** the session in batches; **no page text or title is ever read**; full paths live on the
> device only.
>
> **Previously regenerated 2026-09-11 from PRD amendment 0.2d**, which folded this file's remaining unique
> content into the PRD (the defining case → §1.2, the loop and surfaces → §3.3, the business model
> → §7.1) and corrected fourteen claims against shipped code and the live database. Three of those
> corrections were errors *in this file*, listed under "Status" below so they are not reintroduced.
>
> **Second audience:** this product is also the reference build for apexhuman.ai and will be
> filmed. That constrains design — see "Constraints". The course context lives in
> [apexhuman.md](apexhuman.md) and is not product truth.

**Name:** MEANT. (Working name "Intent" retired 2026-08-18: "Intent — Focus" already ships on the App Store.)

**One line:** A browser extension and web app that makes you say what you intend to finish, blocks what you chose to avoid, sits with you while you work and notices when you drift — **silently; it never says so during the session** (ADR-0057) — and ends by asking whether you finished it.

**Who is served (ADR-0054):** anyone for whom **the work surface and the distraction surface are the same browser** — researchers, students, marketers, freelancers, operators, and the browser-resident half of anyone else's day. No job-title filter. The boundary is **browser share, reported at runtime**: where recorded attention is a small fraction of a session's wall clock, the review says what it did not see.

**Who pays (D10, unchanged):** the **self-employed** browser-native worker. Freelancers, consultants, coaches, VAs, marketers, course creators, solo operators. Owns her laptop and her card. Everyone else is served free — tracking and blocking cost nothing per user. *(Load-bearing on the freemium shape; see PRD §2 and Q6.)* **Suspended for the testing phase (ADR-0075):** every feature is free until a later ADR ends it; no code gates anything.

**Segments are deliberately unranked.** Two of the five columns needed to rank them — pain acuity and reachability — are empty for every candidate. Not choosing is the correct state.

**The problem (ADR-0055):** Your work surface and your distraction surface are the same browser — so nothing you own can tell you whether the block you just spent produced the thing it was for. Not the calendar, which records that you booked the hour and never that it delivered. Not the timer, which counts minutes you already knew about. Not the blocker, which cannot tell Instagram-the-job from Instagram-the-escape. Not your own memory: the fifteen minutes that vanished are the fifteen you did not notice.

**Awareness is the goal; information is the mechanism (ADR-0052).** *Information → pattern → noticing*, with a lag in the middle. **The review is a training loop for noticing, not a ledger.**

**The pain moment:** End of a work block, asked "did you finish it?", answering "I was working on it." For a self-employed person, that gap is unbilled.

**The one thing:** The end-of-session review. Declared intention beside recorded attention, then one question.

**What makes it different, in one sentence:** Every AI accountability product in 2026 has to *ask* whether you were focused. This one is inside the tab and already knows.

**The case that defines the product:** A social-media freelancer's Instagram *is* her work. Instagram at 11am, when she said she would finish the client deck, is drift. Instagram at 4pm, when she is scheduling posts, is the job. Same hostname, opposite meaning, four hours apart. No blocklist resolves this. ~~Reading the tab against the stated intention does.~~ **The case stands; the conclusion is stale (PRD §1.2, ADR-0035, ADR-0061):** the user declares her work and distraction sites at session start, which resolves Instagram with no model at all. What the judge is actually for is the **residual** — sites nobody declared — and **in-site ambiguity**, which is a smaller and more honest job.

**What the product measures:** Completed outcomes. Not hours, not checked steps, not a score. Hours appear only as evidence inside a single session's review.

**Business model:** Direct consumer subscription. Free is mechanical — blocking, review, ledger. Paid is the half that knows you — judge, companion, memory, coach. The paywall sits exactly where the inference cost sits. Price against Focusmate ($8/mo annual, $12/mo monthly), not against human coaches. *(PRD §7.1, D15.)*

---

## Status — what is actually built (2026-09-25)

Read this before treating any feature below as shipped.

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


- **No model call exists anywhere in the product.** Verified by grep across `app`, `lib`,
  `extension`, `package.json`: zero matches for any gateway or provider SDK. The judge, memory-as-
  classifier, and coach (PRD §6) are unbuilt.
- **The `judgment` and `memory` tables exist** (`lib/migrations/002-drift.sql`, 2026-09-04).
  `judgment` has never received a row from any code path. **Corrected 2026-09-16: the 572 `memory`
  rows are all `kind='list'` *and they all belong to test users*** — this file previously cited the
  count as if it were evidence of anything. `domain_class` has never been written.
- **The drift signal is deleted, not merely unbacked** (ADR-0057, 2026-09-15). The prior version of
  this section described `updateCompanion()` (`extension/sw.js:214`) as a live static
  blocklist-membership test with a 60s grace and a 3-per-25-minute budget. **It no longer runs.**
  Detection continues silently; only the signal is gone, and roughly five of the nine unread
  constants in `lib/thresholds.ts` became deletable with it.
- **The companion takes one tap** — *"this isn't the work"* (ADR-0058). It is the only write path
  memory has, and the only reason `judgment.corrected_to`, commented *"THIS COLUMN IS THE TRAINING
  SET"*, has a future.
- **An app shell shipped 2026-09-15.** Before it there was no navigation between signed-in surfaces
  and **no way to sign out at all**. It is the one surface with no artboard.
- **The generated task plan (PRD-F8) is cut, not unbuilt** — a product decision (D38/ADR-0048).
- **Three external services are allocated, not four** — a prior version of this file said four,
  carried over from before D21 consolidated auth onto Neon. Vercel (1), Neon Postgres + Auth (2),
  Vercel AI Gateway (3, **allocated but not yet integrated**). Two slots remain.
- **The landing page still claims the product reads the page** (`app/page.tsx:107`, *"It reads the
  page. It stores nothing"*). **ADR-0061 made that false**: no page text or title is ever read. The
  copy needs replacing with ADR-0059's truth — paths on the device, `{domain, verdict, confidence}`
  server-side — and until it is, the most prominent privacy claim in the product is stale.
- **About 37 minutes of real observed browser attention exists, from one person.** Everything
  strategic rests on that number (ADR-0053). Two claims repeated for days turned out wrong when
  queried — an "n=5, clean split" was n=2, and the 572 memory rows above are test data.

---

## The loop

| Phase | Who it is | What happens |
|---|---|---|
| **Start** | — | You type what you meant to do. The session starts in under 200ms, having blocked nothing yet |
| **During** | **Witness** | Its ring is solid, breathing. **It never goes dashed and never signals drift** (ADR-0057). Hover reveals the intention; one tap says *"this isn't the work"* (ADR-0058). Never a word typed. It celebrates nothing |
| **Review** | **Coach** | Intention, attention, away, blocked attempts — then the question. This is where it speaks, and where anything good is said |
| **Over time** | **Memory** | *Specified, not built.* Today it holds only your configured lists |

Same creature throughout. The register changes with the moment, never the entity.

---

## Invariants (PRD §3.1)

Breaking one is a bug, not a preference.

| # | Rule |
|---|---|
| I1 | The companion's state is never a function of the outcome answer. `Yes` and `Not yet` leave it identical |
| I2 | No celebration during a session. Positive feedback exists only in the review. **Absolute since 2026-09-15 (ADR-0057)** — its one named exception, the return-pulse, died with the drift signal. A *receipt* for a user-initiated tap is not positive feedback |
| I3 | The coach attaches no **valence** to the outcome answer — never praises `Yes`, never reproaches `Not yet`. *(Amended 2026-09-11, D51: it may freely reason **from** the answer. The earlier "says the same things either way" forbade using the most informative column in the schema.)* |
| I4 | Memory gates the judge. A classified domain is not re-judged. *(Q12 resolved 2026-09-15 — the companion's one-tap label is memory's write path. Labels are per-visit; memory forms only on repetition, never at n=1. ADR-0058, ADR-0062.)* |
| I5 | The coach may only suggest actions the product can execute |
| I6 | No pattern is stated below the evidence threshold. *(Amended 2026-09-11, D50: the threshold gates **inference**, never **description**. Showing someone their own rows is not a pattern claim and has no floor.)* |
| I7 | **Amended 2026-09-15 (ADR-0059, ADR-0061).** **Page text and titles are never read at all.** Full paths live in extension local storage only, never in the database, and transit transiently at analysis time. `event.domain` stays hostname-only |
| I8 | Checked steps never enter the ledger. Only the outcome answer counts |
| I9 | Every feature above the mechanical loop is independently removable — judge, companion, memory, coach, in any combination |

**Why I1, I2 and I8 exist rather than the obvious alternative:** rewarding focus was the first instinct and it is wrong twice over. Engagement-contingent reward undermines intrinsic motivation (d ≈ −0.40, 128 experiments). And celebration raises arousal, which impairs performance on novel or complex work — which is the only kind of work this audience does. Both citations are in IDEA §5, C9 and C11.

---

## Constraints that shape design

- No OS permissions, no admin rights, no installer.
- `<all_urls>` appears in `host_permissions` (shipped 2026-09-07). The content script already ran
  at `<all_urls>`, and `declarativeNetRequest`'s `redirect` needs host permission for the domain it
  redirects — a per-domain optional flow would prompt on every new blocked site. One honest upfront
  grant is better UX for a feature that fundamentally needs it.
- **Corrected 2026-09-16 (ADR-0059, ADR-0061).** ~~Page title and page text are read in flight and stored nowhere.~~ **They are never read.** Hostname only in the database; **full paths on the device only**, transiting transiently at analysis time.
- Nothing waits on a model. Not the session start, not a block, not a page load.
- The product must remain shippable with any of its four upper features switched off (I9).
- **It will be filmed being built.** Every step must produce a *visible* change on screen; empty and
  error states are seen first by every viewer, not last.
- **Every external service costs a rebuilding student 10–15 minutes.** The remaining two slots are
  more expensive than the count suggests.
- Nothing on the build path may require a Chrome Web Store review. Unpacked must be genuinely usable.

---

## Surfaces

| Surface | Mode | Seen |
|---|---|---|
| Extension popup (idle / running / unpaired) | Operate | Dozens of times a day |
| Companion | Accompany | Continuously, and **never noticed unless the user touches it** (ADR-0057; this cell read "noticed at most three times a session" when it still signalled) |
| Block page | Operate | A few times a day, at a moment of friction |
| Session review | Understand | Once per session — *the product* |
| Dashboard ledger | Understand | Daily |
| Landing page | Persuade | Once |

The frequency column is a design constraint, not a statistic: it is why the popup animates nothing and why the review is the only surface allowed a moment.

---

## The companion, specifically (PRD §3.2 — the Orbit reversal, 2026-09-05)

- **It is a pet, not a coach.** A minimal orbital dot at the edge of the page — 28px, bottom-right
  by default, draggable. Presence over posture.
- **State is ring presence, not color.** Resting: dot only, no ring. Running: a solid ring.
  ~~Drift: the same ring, dashed.~~ **Removed 2026-09-15 (ADR-0057)** — there is one state while a
  session runs. Clay is the only accent the companion ever uses, at any state, so state reads as a
  shape change, not a status light.
- **It is an input (ADR-0058).** Hover reveals the intention; one tap says *"this isn't the work"*
  and writes a per-visit label (ADR-0062). A 160ms ring-collapse acknowledges the tap; under
  reduced motion the ring instead goes opaque and thickens, discretely, for 600ms.
- ~~**Return gets one visible acknowledgment.**~~ **Removed 2026-09-15 (ADR-0057)** — the
  ring-collapse existed to acknowledge a return *from drift*, and there is no drift signal to return
  from. I2 is absolute again. **The motion is reused** as the receipt for the one-tap label (ADR-0058),
  retimed to 160ms feedback speed (#50).
- **Aliveness is breathing, not blinking.** A continuous slow scale/opacity cycle (~1.6s).
- **It reads at 28px** — ambient presence, not a focal element.
- Built as `extension/companion-overlay.js`, a self-contained Shadow DOM. It is no longer built from
  `.m-mark`'s primitives, so the toolkit's "a real chart, not a logo shaped like one" framing no
  longer describes it. Resolved by separation, not by a fork inside one class.

---

## Competitive truth

> **Last verified 2026-08-28 and not re-checked since.** This table carries the most perishable asset
> in the strategy — the claim that every competitor has to *ask*. Treat each row as a dated hypothesis.
> **It omits the general AI assistant** (ChatGPT, Claude), already resident on the user's surface.

| Product | Has | Lacks |
|---|---|---|
| Freedom | Blocking | Measurement, intention, outcome |
| Rize | Measurement, AI categorisation | Intention, protection; hours are its headline |
| Session (Apple only) | The full loop | Browser-native attention; asks what you *learned*, not what you *finished* |
| Femma, FineStreak, Coach Call AI, Nudge, Centered | Voice check-ins, nudges, consequences | **Sight. Every one of them has to ask** |
| Forest, Finch | The companion mechanic, proven commercially | Measure how you *feel*, not what you *finished* |

---

## What the product must never do

Reward hours. Show a productivity score. Celebrate one answer over the other. Celebrate anything at all while you are working. Moralize about a bad afternoon. Store what it reads. Nag for a permission that was declined. Display anything an employer would want. Let you talk to it instead of working. Suggest something it cannot do.

---

## The riskiest thing we believe (IDEA §6, A9)

That a calm presence *facilitates* rather than *inhibits* complex work. The research is genuinely split — of thirteen studies of virtual observers, four found inhibition and three found facilitation.

If we are wrong, every metric in this product would improve while the user's actual work got worse: more time on task, fewer drifts, worse deck. Nothing in our own data would catch it. It has to be tested against something outside the data, and that test does not exist yet.
