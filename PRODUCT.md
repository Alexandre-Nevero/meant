# PRODUCT.md — MEANT

> Derived from `docs/` (idea, prd, sitemap, flow, sdd), not from a fresh interview. Every line traces to a doc; nothing here is invented. Canonical product truth stays in `docs/`.
> **Second audience:** this product is also the reference build for apexhuman.ai and will be filmed. That constrains design — see "Constraints" below. The course context itself lives in [context.md](context.md) and is not product truth.
> **Reflects amendment 0.2 (2026-08-28).** Prior version described a product with no AI, an employed user, and no companion. All three changed.

**Name:** MEANT. (Working name "Intent" retired 2026-08-18: "Intent — Focus" already ships on the App Store.)

**One line:** A browser extension and web app that makes you say what you intend to finish, turns it into a short plan, blocks what you chose to avoid, sits with you while you work and notices when you drift, and ends by asking whether you finished it.

**Primary user:** A **self-employed**, non-technical browser-native worker. Freelancers, consultants, coaches, VAs, marketers, course creators, solo operators. Defined by behavior, not job title: anyone whose workday is browser plus AI chat. Owns her laptop and her credit card. *(Changed at 0.2 — the previous persona was employed on a managed corporate endpoint, and could neither buy the product nor be sold to without turning it into the monitoring tool this product refuses to be.)*

**The pain moment:** End of a work block, asked "did you finish it?", answering "I was working on it." For a self-employed person, that gap is unbilled.

**The one thing:** The end-of-session review. Declared intention and plan beside recorded attention, then one question.

**What makes it different, in one sentence:** Every AI accountability product in 2026 has to *ask* whether you were focused. This one is inside the tab and already knows.

**The case that defines the product:** A social-media freelancer's Instagram *is* her work. Instagram at 11am, when she said she would finish the client deck, is drift. Instagram at 4pm, when she is scheduling posts, is the job. Same hostname, opposite meaning, four hours apart. No blocklist resolves this. Reading the tab against the stated intention does.

**What the product measures:** Completed outcomes. Not hours, not checked steps, not a score. Hours appear only as evidence inside a single session's review.

**Business model:** Direct consumer subscription. **Free is mechanical** — blocking, review, ledger. **Paid is the half that knows you** — plan, judge, companion, memory, coach. The paywall sits exactly where the inference cost sits.

**Platforms:** Chrome and Edge extension (macOS and Windows, identical) plus a Next.js web app on Vercel, Clerk sign-in, Neon Postgres, Vercel AI Gateway.

---

## The loop

| Phase | Who it is | What happens |
|---|---|---|
| **Start** | — | You type what you meant to do. The session starts in under 200ms. The plan — 1 to 5 steps — arrives a few seconds later, having blocked nothing |
| **During** | **Witness** | It faces your work. It turns to face you when you drift. It marks steps silently. It accepts one tap and never a word typed. It celebrates nothing |
| **Review** | **Coach** | Intention, plan, attention, the drifts and the returns — then the question. This is where it speaks, and where anything good is said |
| **Over time** | **Memory** | It learns your domains, your patterns, your estimate accuracy. It gates the judge, so it asks less every week. It stays quiet until it has enough evidence to be right |

Same creature throughout. The register changes with the moment, never the entity.

---

## Invariants (PRD §3.1)

Breaking one is a bug, not a preference.

| # | Rule |
|---|---|
| I1 | The companion's state is never a function of the outcome answer. `Yes` and `Not yet` leave it identical |
| I2 | No celebration during a session. Positive feedback exists only in the review |
| I3 | The coach responds to the evidence, never to the answer |
| I4 | Memory gates the judge. A classified domain is not re-judged |
| I5 | The coach may only suggest actions the product can execute |
| I6 | No pattern is stated below the evidence threshold |
| I7 | Page text is read for judging and never stored, logged, queued, or retained |
| I8 | Checked steps never enter the ledger. Only the outcome answer counts |
| I9 | Every feature above the mechanical loop is independently removable — judge, companion, memory, coach, in any combination |

**Why I1, I2 and I8 exist rather than the obvious alternative:** rewarding focus was the first instinct and it is wrong twice over. Engagement-contingent reward undermines intrinsic motivation (d ≈ −0.40, 128 experiments). And celebration raises arousal, which impairs performance on novel or complex work — which is the only kind of work this audience does. Both citations are in IDEA §5, C9 and C11.

---

## Constraints that shape design

- No OS permissions, no admin rights, no installer.
- `<all_urls>` never appears in `host_permissions`. It exists only as `optional_host_permissions`, requested when the user turns on deep judging, and declinable forever.
- Hostname only, in storage. Page title and page text are read in flight for one classification and stored nowhere.
- Nothing waits on a model. Not the session start, not a block, not a page load.
- Four of five external services allocated. The fifth would buy voice, and voice is out of scope.
- The product must remain shippable with any of its four upper features switched off — judge, companion, memory, coach (I9). Each seam is exercised, not asserted.
- **It will be filmed being built.** Every step must produce a *visible* change on screen; empty and error states are seen first by every viewer, not last; the moments worth watching must be visual rather than logged. This is why the drift signal is a gaze and not a notification.
- **Every external service costs a rebuilding student 10–15 minutes.** The fifth integration slot is more expensive than the budget suggests.
- Nothing on the build path may require a Chrome Web Store review. Unpacked must be genuinely usable.

---

## Surfaces

| Surface | Mode | Seen |
|---|---|---|
| Extension popup (idle / running / unpaired) | Operate | Dozens of times a day |
| Companion (S9) | Accompany | Continuously, and noticed at most three times a session |
| Block page | Operate | A few times a day, at a moment of friction |
| Session review | Understand | Once per session — *the product* |
| Dashboard ledger | Understand | Daily |
| Landing page | Persuade | Once |

---

## The companion, specifically

- **Aliveness is breathing and blinking.** A slow scale/opacity cycle plus a rare irregular blink. Sub-perceptual, always on, never reads as animation.
- **State is gaze and posture, never action.** Facing your work is the good state — it is a posture, not an event, which is how there can be a positive state without a reward. Turning to face you is the drift signal. One rotation. No sound, no words, no colour change.
- **Motion budget:** three noticeable movements per 25-minute session, none in the first 60 seconds. Breathing and blinking do not count.
- **It is a coach, not a pet.** This audience screen-shares with clients.
- **It reads at 80–120px** in a side panel or a floating window, and gaze must read at that size — and at video resolution, on a phone, for someone following a build along.
- **One tap on it** says what it can see and where that goes. The companion is the consent surface, not the anaesthetic that makes being watched feel warm.
- **Note for design:** the toolkit calls the mark *"a real chart, not a logo shaped like one."* A chart cannot have gaze. If the companion is the mark, the mark stops being a chart. Take that fork deliberately. `.m-mark[data-state]` already declares five states including `drifting`, which nothing in the code has ever set.

---

## Competitive truth

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
