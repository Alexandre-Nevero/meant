# CONTEXT.md — what we are actually building, and for whom

**Owner:** Alexandre Andrei Nevero
**Date:** 2026-08-28
**Status:** Draft
**Relates to:** [PRODUCT.md](PRODUCT.md), [docs/index.md](docs/index.md)

> This document exists because the constraint in every other document is wrong. `docs/build-intent.md` says "four hours, one builder." That was true of one sitting in August and has been silently governing every decision since. It no longer applies to us. It applies to somebody else, later, and differently.

---

## 1. The frame, corrected

| | Old (wrong since 2026-08-28) | New |
|---|---|---|
| Who builds it | One builder, four hours | Us, for as long as it takes |
| What governs scope | The clock | Whether a beginner can rebuild it alone in 4–8 hours |
| What it is | A demo | A **reference product** — the worked example a paying student learns from |
| What ships | Code | Code **plus a manual plus a video of it being built** |
| Why it must be good | It has to survive a two-minute pitch | It has to survive being copied by a stranger with no help |

**The single sentence that governs everything below:** we are not building a product with a time limit, we are building a product with a **reproduction requirement**.

Those are different constraints and they cut in opposite directions. A time limit says *build less*. A reproduction requirement says *build whatever you want, but every part must be either rebuildable, pasteable, or invisible.* That distinction is the whole document.

---

## 2. Apex Human — what we know

Researched 2026-08-28 from apexhuman.ai. Marked where it is quoted, inferred, or unknown.

**Positioning (quoted):**
- "Build your first product using AI. No-code needed."
- "Go from prompt to profit by building and launching an AI product without code."
- "A real, working product (not a slide deck)."
- "Not a simulation or a case study."
- "Do I need any coding or technical background? **None at all.**"
- Students leave with a product "they built, deployed, and can actually show — to clients, employers, or investors," described elsewhere as "an income-generating venture."

**Existing tracks:** AI Sales Team · AI Influencer · AI Tutorial Center · AI Music Label · AI Video Game.

**Two delivery shapes, and they are not the same product:**

| Shape | Evidence | Shape of the constraint |
|---|---|---|
| **Onsite cohort** | AI Tutorial Center: "100% onsite," "4 sessions," "1:00 PM to 5:00 PM" → **16 hours**, senior developers in the room | Generous. Depth is affordable. Someone can unblock you |
| **Online self-paced** | AI Influencer: "a detailed how-to-build manual and direct access to the Apex Human team," session window 3:30–5:30 PM | **Brutal. Alone, asynchronous, no one watching you fail.** This is our target |

**Our 4–8 hours is the online solo path.** Design for that and the onsite cohort gets depth for free. Design for the cohort and the solo student drowns.

**Operational facts that change our budget:**
- "Additional tools and subscriptions are **provided before the session begins**." Apex pre-provisions accounts. That is the single biggest gift to the 4–8 hours and we should design assuming it, then verify it.
- Hardware floor stated: **macOS 13+ or Windows 10+**. Notably no RAM or disk floor — which independently confirms D14 (cloud inference, not on-device Gemini Nano, which needs 22GB free and 16GB RAM).
- Deliverable includes a **Certificate of Completion**.

**Backing:** Eden / ED3N Ventures, described as Southeast Asia's leading venture builder.

**Unknown, and worth finding out:** price; cohort size; whether the manual is markdown, video, or both; how much of the 16 onsite hours is building versus presenting; whether the online student gets the same manual as the onsite one. **Pricing matters most** — it sets how much a student's time is worth and therefore how much friction they will tolerate.

---

## 3. Primary audiences

| Segment | What they want from the artifact | What breaks it for them |
|---|---|---|
| **Students / universities** | A portfolio piece, a grade, a finish line | Anything ungradeable, or a build with no clean "done" |
| **Entrepreneurs** | A business, not an exercise. Who pays, how much, how to get customer one | A product with no visible revenue model |
| **Solopreneurs** | Something they can run alone, cheaply, forever | Running costs that scale faster than they can sell |
| **SMEs** | Something they can re-point at their own internal problem | A product so specific it cannot be adapted |

**These four only fit one artifact if the manual has a "make it yours" chapter.** Otherwise three of the four segments finish having built a focus app they personally do not want. That chapter is not optional and it is not marketing — it is what converts one reference product into four outcomes.

Concretely, MEANT re-points as: an accountability tool a **university** gives a study cohort · a client-facing proof-of-work tool for an **agency** · a self-accountability product a **solopreneur** sells to people like them · an internal focus tool an **SME** runs for its own team (which is the one case where the manager-view line in `IDEA §9` must be restated, not quietly crossed).

---

## 4. The three artifacts

We are building three things, and only the first is code.

| # | Artifact | Audience | Success test |
|---|---|---|---|
| **A1** | **The reference product** | Us, then the camera | It is genuinely good. A stranger would pay for it. Not a demo |
| **A2** | **The rebuild manual** | A beginner, alone, 4–8 hours | Someone with no coding background finishes without asking a question |
| **A3** | **The build video** | The same beginner | They can follow along in real time and understand *why*, not only *what* |

A1 has no time limit. **A2 and A3 are where the 4–8 hours lives**, and they constrain A1 only through §5 and §6.

Sequence: build A1 properly → derive A2 from what we actually did → record A3. Not the reverse. A manual written before the build is a manual full of steps that do not work.

---

## 5. The real constraint is not lines of code

The instinct is to ask "how much can a student build in 4–8 hours?" That is the wrong question, because the student is not typing the code — an agent is. Typing is free now.

**What costs a non-technical student time:**

| Cost | Why it hurts them and not us |
|---|---|
| **Decision points** | They cannot judge between two options, so every choice becomes a stall |
| **Silent failures** | Something didn't work and nothing said so. They proceed on sand |
| **Unreadable errors** | A stack trace is not information to them. It is a wall |
| **Two-place truths** | An env var *and* a schema *and* a deploy must agree. Any one wrong looks identical to all three wrong |
| **Agent drift** | The agent does something subtly wrong and they cannot tell |

So the budget is not measured in code. It is measured in **decision points and failure modes**. A 5,000-line product with zero decisions and visible checkpoints is easier than a 400-line one with six choices and a silent failure.

### The 4–8 hours, budgeted honestly

| Block | Realistic | Notes |
|---|---|---|
| Tools, accounts, keys | 30–60 min | Near zero **if** Apex pre-provisions as advertised. Verify this |
| First deploy, working | 20–30 min | Where people quit. Must happen early and must be visible |
| Schema applied and verified | 15 min | |
| Sign-in working | 20–30 min | |
| Extension loaded and paired | **30–45 min** | The classic killer: two surfaces must agree before anything works |
| **Actual product features** | **90–180 min** | **This is all that's left** |
| Final deploy and check | 20 min | |
| Slack for things going wrong | 30–90 min | Unbounded. The real variance |

**Roughly 1.5–3 hours of the 4–8 is feature work.** Everything else is plumbing, and plumbing is where beginners die. Any plan that ignores this ships a manual nobody completes.

---

## 6. Three tiers, and the rule that assigns them

The reference product is bigger than the rebuild. That is fine and it is the honest way to fit a large product into a small budget — provided every part is assigned deliberately.

| Tier | What the student does | Time | The rule |
|---|---|---|---|
| **T1 — Build** | Follows steps, sees it work | 90–180 min | Only things they would be **proud to have built and could explain to a customer** |
| **T2 — Paste** | Copies a file, reads why it exists | ~30 min | Where the lesson is **comprehension, not authorship** |
| **T3 — Provided** | Never opens it | 0 min | Where there is **no lesson at all** |

Copy-paste is a legitimate teaching move when the lesson is elsewhere. Pretending a beginner should author an MV3 service worker's timestamp reconstruction is not rigour, it is vanity.

### Proposed assignment for MEANT

| Tier | Contents | Why here |
|---|---|---|
| **T1 — they build** | Intention → session → **review → the outcome question**. The judge: one route, one prompt, one verdict. The companion's gaze states. The ledger | The review is the product (`IDEA §1.6`). The judge is the AI lesson and the thing they will show people. The gaze is 30 minutes and it is the moment the build becomes *theirs* |
| **T2 — they paste** | Service worker lifecycle and attention attribution · pairing token flow · block-rule install/remove | Each is a real engineering idea worth understanding and a bad use of a beginner's only three hours. The manual explains the 30-second death; it does not ask them to discover it |
| **T3 — provided** | `schema.sql` · design tokens · the companion's artwork and animation · blocklists · the judge's system prompt as a starting file | No lesson. Handing these over costs nothing and buys back an hour |

**The test for T1:** if a student could not proudly explain a piece to a potential customer, it does not belong in T1. That single test is what keeps the manual from becoming a typing exercise.

---

## 7. Rules this imposes on how we build

These bind A1 even though A1 has no time limit.

1. **Every step has a visible pass/fail inside 60 seconds.** If a student cannot tell whether it worked, it is not a step, it is a trap.
2. **Zero decisions on the rebuild path.** Every choice is pre-made and recorded in `docs/index.md §6`. The manual says *do this*; alternatives live in a sidebar, never in the flow.
3. **Fail forward.** No step may block the steps after it. A student whose judge does not work must still reach the review — which is exactly why `PRD §9` requires the product to stay shippable with the judge switched off.
4. **Deploy on day one, not at the end.** First deploy is the highest-quit moment. Move it to the front, when they still have energy.
5. **One provisioning block, verified once.** All accounts and keys up front, with a single "does this work?" check before any product code exists.
6. **No step needs three things to be simultaneously true.** Where that is unavoidable (pairing), it becomes T2 paste plus a verification command.
7. **Cheap to run, forever.** A solopreneur cannot carry a bill that scales faster than their sales. This is why memory gates the judge (`I4`) and why the spend ceiling exists (`SDD V8`) — those are course requirements as much as product ones.
8. **Nothing in the build path may require a store review.** Chrome Web Store review runs days to weeks (`IDEA C18`). The student's product must be real and working while unpacked; publishing is an epilogue chapter, not a step.
9. **Windows and macOS, identically.** Stated Apex floor. Any macOS-only convenience is banned from the manual.
10. **Every dead end we hit gets written down.** Our debugging is the manual's troubleshooting chapter, and it is worth more than the happy path. **Keep a running log from the first commit** — it cannot be reconstructed afterwards.

---

## 8. What is now unconstrained

Things previously cut for the clock that no longer have a reason to be cut. Each still has to earn T1/T2/T3 placement, but "there wasn't time" is no longer an argument:

- Proper migrations instead of hand-applied SQL (`D18`)
- Tests around the pure functions — attribution, gap calculation, session recovery
- An eval set for the judge, which is how `M7` and `K4` become measurable rather than aspirational
- The design system actually existing (`design/` was never produced; `design-toolkit.md` is deleted in the working tree)
- Error states, empty states, and the first-run experience — the things a beginner's product always lacks and a real one cannot
- Account deletion and "forget what you know about me," which `SDD §9.3` has flagged as a gap through two versions

---

## 9. The builder's own learning goal

Stated intent: *"I would want to learn as well while building these."* That is a real constraint on how we work, not a footnote — it changes whether I explain as I go or simply produce.

**Working default until it is narrowed:** explain the *why* at every decision, in the moment, at the depth a non-technical builder can follow — because that explanation is also the script for A3. Explaining twice is waste; explain once, on camera.

Candidates, ranked by how much they transfer to anything else built after this:

| # | Skill | Why it is worth the hours |
|---|---|---|
| 1 | **Evals — knowing whether the AI is right** | The most transferable AI-engineering skill of 2026 and the one almost nobody teaches. It is also `M7`, so it is already required |
| 2 | **Unit economics of an AI product** | Cost per user, gateway spend, why the paywall sits where the cost sits. The thing that separates a product from a demo |
| 3 | **Directing an agent to build a real multi-surface product** | Where the work goes wrong, how to notice, how to correct — the actual meta-skill Apex Human sells |
| 4 | **Browser extension architecture (MV3)** | Genuinely deep, genuinely rare, and it constrains everything in this build |
| 5 | **Shipping: store review, permissions, distribution** | The least glamorous and the most often skipped |

**Open — Alexandre to rank.** The ranking changes how much I stop and explain, and where.

---

## 10. Explicitly out of scope for this document

Pricing for the reference product itself, the manual's chapter structure, the video's format and length, and whether MEANT ships to the Chrome Web Store as a real product under our name. All downstream. This document exists to fix the constraint, not to plan the work.

---

## 11. Open questions

| # | Question | Blocks | Needed by |
|---|---|---|---|
| C1 | Does Apex pre-provision Vercel, Neon, Clerk and AI Gateway accounts, as their copy implies? **This is worth 30–60 minutes of every student's budget** | The whole §5 budget | Before writing A2 |
| C2 | Is the online student's manual the same artifact as the onsite cohort's, or a reduced one? | A2's scope | Before writing A2 |
| C3 | What does Apex charge? It sets how much friction a student will tolerate before quitting | Tone and depth of A2 | Before writing A2 |
| C4 | Is the audience predominantly Southeast Asian? If so, expect more Windows, older machines, and different payment rails — all of which further confirm D14 | Hardware assumptions, T3 contents | Before the first build session |
| C5 | Which of the five skills in §9 does Alexandre want most? | How much I stop and explain | Before the first build session |
| C6 | Does the video follow the real build, or a clean re-run afterwards? The first is honest and long; the second is watchable and slightly fake. **Most build-along content lies about this** | A3's format, and rule 10 | Before recording anything |
| C7 | Is there a hard "done" for a student — a certificate criterion, a deployed URL, a passing check? Students and universities need a finish line the other two segments do not | A2's final chapter | Before writing A2 |

---

## Self-check

- [x] States which constraint was wrong and what replaces it
- [x] Every claim about Apex Human is quoted, inferred, or marked unknown
- [x] Distinguishes the two Apex delivery shapes and names which one binds
- [x] The 4–8 hours is budgeted against real friction, not against code volume
- [x] Every part of the product has a tier and a rule that assigns it
- [x] The rules in §7 are testable, not aspirations
- [x] Names what the clock was hiding (§8)
- [x] Records the builder's own goal as a constraint on method
- [x] Open questions name what they block
