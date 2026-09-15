# Document Index — MEANT

**Project:** MEANT (`meant`)
**Owner:** Alexandre Andrei Nevero
**Last updated:** 2026-09-11 (design.md moved into docs/)
**Suite:** FMD Lite 1.1.0 (doc suite shape) — decision log and `AGENTS.md` adopted the newer
private FMD factory's conventions (`docs/adr/`, ADR format) on 2026-09-10; the `*-intent.md`
doc set itself was not migrated to that factory's template names, to avoid breaking the ~30
files that link them by current filename

---

## 1. Core suite

| Doc | File | Version | Status | Cycle | Updated |
|---|---|---|---|---|---|
| Idea Brief | [idea-intent.md](idea-intent.md) | 0.2c | Draft | 1 | 2026-09-11 |
| PRD | [prd-intent.md](prd-intent.md) | 0.2c | Draft | 1 | 2026-09-11 |
| Sitemap | [sitemap-intent.md](sitemap-intent.md) | 0.2c | Draft | 1 | 2026-09-11 |
| User Flow | [flow-intent.md](flow-intent.md) | 0.2c | Draft | 1 | 2026-09-11 |
| SDD | [sdd-intent.md](sdd-intent.md) | 0.2c | Draft | 1 | 2026-09-11 |

### 1.1 Spawned documents

| Doc | File | ID prefix | Parent | Version | Status | Created |
|---|---|---|---|---|---|---|
| Build Run-of-Show | [build-intent.md](build-intent.md) | `T#` | sdd-intent.md | 0.1 | **Historical** | 2026-08-18 |
| Build Guide | [build.md](build.md) | `TASK-###`, `INV-#` | sdd-intent.md | 0.1 | **Historical** | 2026-08-18 |
| Design Toolkit | [design-toolkit.md](design-toolkit.md) | — | ../PRODUCT.md | 0.1 | **Restored, 2026-09-01 (D22)** | 2026-08-18 |

**Both build documents are records of the completed four-hour sitting, not plans for the 0.2 work.** `build-intent.md` says so itself: "this document is dead the moment the four hours end." They were deliberately left unamended so the record of what actually shipped stays intact. **Work at 0.2 needs a new run-of-show, and it does not exist yet.**

---

## 2. ID namespaces in use

| Prefix | Owned by | Identifies |
|---|---|---|
| `A#` | IDEA §6 | Assumptions |
| `L#` | IDEA §10.4 | Learnings |
| `C#` | IDEA §5 | Load-bearing claims |
| `K#` | IDEA §7 | Kill criteria |
| `PRD-F#`, `US-##`, `M#` | PRD | Features, user stories, metrics |
| `S#` | SITEMAP | Screens / surfaces |
| `UF#`, `EV#` | USER-FLOW | Flows, instrumented events |
| `SDD-C#`, `V#`, `N#` | SDD | Components, security controls, non-functional requirements |
| `T#` (SDD §8) | SDD | Verification cases. **Collides with build-intent's `T#`; always cite the section** |
| `I#` | PRD §3.1 | **Product invariants (new at 0.2)** |
| `D#` | index §6 | Decisions taken outside a document |
| `T#` (build) | build-intent.md | Time slots in the four-hour sitting |
| `TASK-###` | build.md | Build tasks (stable) |
| `INV-#` | build.md | Build invariants |

---

## 3. Build context

| | |
|---|---|
| Form factor | Chrome/Edge extension (MV3) + web app with sign-in, a database, and one model gateway |
| Time budget | **No limit on our build.** The binding constraint is reproduction: a non-technical student, alone and online, must rebuild a defined subset in 4–8 hours. See `../apexhuman.md` §5 and §6 |
| Purpose | **A reference product for apexhuman.ai** — the worked example that students, entrepreneurs, solopreneurs and SMEs learn from. Ships as three artifacts: the product, a rebuild manual, and a build video |
| External services | Five maximum; **three allocated**: Vercel (hosting), Neon (database + auth, D21), Vercel AI Gateway (inference). Two unallocated |
| Platforms | Wherever Chrome/Edge runs — macOS and Windows identically |
| Business model | Direct consumer subscription. Free is mechanical; paid is the half that knows you (D15) |
| Cut from v1, still cut | Voice, in-session conversation, on-device inference, desktop/OS tracking, app blocking, scheduling, Locked Mode, sync, teams, any score |
| **Un-cut at 0.2** | **Calibration, returning as memory (PRD-F11). Positive reinforcement, returning in the strictly bounded form permitted by I2 — review only, never during a session** |

---

## 3.1 Design and execution artifacts

| File | What it is |
|---|---|
| `../apexhuman.md` | **Course and delivery context (new 2026-08-28).** Who the reference product is for, the two Apex Human delivery shapes, the honest 4–8 hour student budget, and the three-tier rule that assigns every part of the build. **It replaces the "four hours, one builder" constraint that `build-intent.md` has been silently exporting to every other document** |
| `PRODUCT.md` | Product context for design tooling, derived from these docs |
| `docs/design-toolkit.md` | The committed visual world as a specification. **Restored 2026-09-01 (D22)** — `design/tokens.css` and `design/canvas/` exist, the class contract is implemented. Superseded by `docs/design.md` as the read-first index over this file, `tokens.css`, and the canvas |
| `docs/design.md` | **Read-first index (2026-09-01+, moved into `docs/` 2026-09-11 — was at repo root) over `design/canvas/`, `design/tokens.css`, and `docs/design-toolkit.md`** — the accessibility contrast checks and the class-contract quick reference live only here |
| `docs/adr/` | **Decision changelog (2026-09-10).** Append-only, one file per decision; supersedes §6 below as the point of entry for new decisions — see `docs/adr/README.md` |
| `design/canvas/` | **The seven artboards, and visual truth.** They outrank `design-toolkit.md` and `tokens.css` when they disagree |
| `docs/superpowers/plans/2026-09-15-foundations.md` | **The near-term plan. Week 2 builds (#18, #28, #25, #40); Week 3 verifies #8-#13 then builds (#20, #19).** Stops the e2e suite writing to production, makes M9/K6 computable before the first model call, accumulates memory from the companion's labels, and builds PRD-F15's two erasure levels. Task 5 opens with a decision gate: `companionEnabled` lives in `chrome.storage.local` and a web page cannot write there |
| `docs/superpowers/plans/2026-09-15-awareness-turn.md` | **The current build plan (ADR-0052–0064).** Seven tasks, TDD, no model call introduced. Persists the session declaration (0 of 3,668 rows today), removes the drift signal, adds the one-tap label, stores paths on-device, reports unrecorded time, and builds the finished-vs-unfinished arithmetic. **The batched judge is deliberately out of scope** — it has no data yet |

**Product name is now MEANT.** The `docs/*-intent.md` filenames are still stale; the "Project:" fields were corrected at 0.2. Renaming files is deferred so cross-links and git history stay intact.

**The seven paste-in metaprompts (`docs/metaprompt-*.md`) were removed 2026-09-11.** They were one-shot session-bootstrap prompts for builds that already happened (the 0.1 design/build session, the 0.2 UI build); nothing reads them now that those sessions are over, and the newest one (`metaprompt-ui.md`) was already just a pointer to facts that live in `docs/design.md`/`docs/design-toolkit.md` today. Not folded anywhere — their content was either historical (what to paste into a session that no longer needs bootstrapping) or fully superseded by the design docs above.

---

## 4. Staleness watch

| Doc | Reconciled with reality | Risk |
|---|---|---|
| idea-intent.md | 2026-09-11 | 0.2c voided A7/its kill criterion (plan cut) and answered Q5 (companion placement). C7 and C17's ARR figure remain unverified. C5 is retained but explicitly no longer load-bearing |
| prd-intent.md | **2026-09-15** | **Amendment 0.3 absorbed ADR-0052–0064.** Q4, Q7 and Q9 are now **void** (not answered — the companion no longer signals and the judge reads no page text), and **Q12 is resolved**. **Q5** (evidence threshold before a pattern may be stated) is the one that still blocks a shipping decision, and it now gates the dashboard contrast line |
| sdd-intent.md | 2026-09-11 | 0.2c corrected V4, §8.2's abuse case, answered Q3, fixed SDD-C7/C8. **§3.1's schema is a known, flagged FAIL — it describes the judge's target shape, not the richer mechanical schema that actually shipped (D26-D41).** Needs its own pass against `lib/migrations/*.sql` |
| sitemap-intent.md / flow-intent.md | 2026-09-11 | 0.2c corrected S9 (companion) and struck the cut plan's events (EV8-EV10, EV14, E12) |
| **Code** | **not reconciled** | **The 2026-09-11 audit found the reverse problem too: real shipped code (D26-D42's mechanical judgment/memory system) that the docs didn't know about at all. The gap runs both ways now — docs describing unbuilt things, and code the docs never mentioned. Whatever governance let a whole plan's Task 20 (write the decisions down) go unexecuted for a week is the actual root cause and hasn't been fixed, only this one instance of its damage** |
| build-intent.md / build.md | 2026-08-18 | Intentionally frozen as history (§1.1) |

---

## 5. Foundation Gate

**PROCEED WITH FIXES** — re-run 2026-08-28, cycle 1 (original 2026-08-18). All six §1 fields remain concrete under the new persona. Fixes carried: companion placement, the judge's precision floor, the coach's evidence threshold, and the free/paid boundary. Canonical record: [idea-intent.md §8](idea-intent.md).

**Why FIXES rather than PROCEED:** A8 (the judge is accurate enough to be allowed to signal) and A9 (a calm presence does not inhibit complex work) are both Low confidence and both sit under features that are now central. A9 is the one to watch — if it is false, every metric in the product improves while the user's work gets worse, and nothing in our own data would catch it.

---

## 6. Decisions taken outside a document

**Superseded as the point of entry, 2026-09-10.** New decisions are appended as `docs/adr/ADR-NNNN-slug.md` files (one per decision, append-only, never edited after acceptance) — see `docs/adr/README.md`. Every `D#` below now also exists as `ADR-####` (same number, zero-padded) in that format; this table stays as a historical, at-a-glance index, but `docs/adr/` is where a future reader should look first, and where every future decision gets recorded.

| # | Decision | Date | Where it belongs |
|---|---|---|---|
| D1 | User defined by behavior (browser-native worker), not job title | 2026-08-18 | IDEA §1 |
| D2 | Browser extension + web app; no desktop app in v1 | 2026-08-18 | SDD §2 |
| D3 | Real sign-in and a database, not local-only storage | 2026-08-18 | SDD §2 |
| D4 | Whole loop shipped thin, rather than one link deeply | 2026-08-18 | PRD |
| D5 | Calibration and rewards cut from v1 | 2026-08-18 | IDEA §4 — **superseded at 0.2.** Calibration returns as memory (PRD-F11); reward returns only within I2 |
| D6 | Extension authenticates by one-time pairing code, not OAuth | 2026-08-18 | SDD §4.2 |
| D7 | Stack: Vercel + Neon Postgres + Clerk | 2026-08-18 | SDD §4.3 — **amended by D21** |
| D8 | Hostname only — never full URLs or page titles | 2026-08-18 | SDD V5 — **partially superseded by D17.** Hostname-only still governs *storage*; titles and text may now be read in flight and stored nowhere |
| D9 | Block page is a redirect rule, so host permissions are declared per blocklist domain | 2026-08-18 | SDD V4 (amended), build.md §7.4 |
| **D10** | **Primary user moves from employed corporate administrator to self-employed non-technical browser worker.** The old persona had no purchasing authority, and the only party with budget was the employer — whom IDEA §9 forbids serving, permanently. The product had designed itself into having no legal buyer | 2026-08-28 | IDEA §1, PRD §2 |
| **D11** | **The session gains a generated plan of 1–5 steps,** produced after the session starts so nothing waits on it. Gives the judge something concrete to judge against, and sub-goals help most at initiation (C13, C14) | 2026-08-28 | PRD-F8 |
| **D12** | **Attention is judged semantically against the current task.** The 0.1 product could not answer its own defining example — the same hostname being work at 4pm and drift at 11am | 2026-08-28 | PRD-F9, PRD §6 |
| **D13** | **One creature, two registers: witness during the session, coach in the review.** Splitting them would cost the continuity that makes memory feel like a relationship and the authority that makes advice land. I3 resolves the contradiction — the coach answers to the evidence, never to the answer | 2026-08-28 | PRD-F10, F12 |
| **D14** | **Inference runs in the cloud via Vercel AI Gateway; on-device Gemini Nano is deferred as a v2 upgrade.** Two code paths is the thing that stops a build shipping, judgment quality matters more than judgment location, and the hardware floor (22GB disk, 16GB RAM) excludes a real share of this persona's laptops | 2026-08-28 | SDD §4.3, §6; C8 |
| **D15** | **Direct consumer subscription. Free is mechanical (block, review, ledger); paid is the half that knows you.** The paywall sits exactly where the inference cost sits, which is the only pricing model that survives M9 | 2026-08-28 | PRD §7, PRD Q6 |
| **D16** | **The judge reads in two tiers.** `activeTab` cannot read page content on a tab change (C19), so T-A judges on hostname plus title with today's manifest, and T-B adds a text extract behind `optional_host_permissions` requested at runtime. `<all_urls>` never appears at install | 2026-08-28 | SDD §5.2, V4 |
| **D17** | **V5 is amended from "never send" to "never store."** The old rule cannot survive cloud judging; deleting it would have removed the product's only structural defence against becoming surveillance. The replacement is narrower in what it permits and stronger in what it guarantees | 2026-08-28 | SDD §5.1 |
| **D19** | **The teaching tiers are an architectural rule, not a lesson plan (I9).** A beginner rebuilds a subset and pastes the rest, so judge, companion, memory and coach must each detach without taking the product down. If the pieces do not come apart, the manual cannot exist | 2026-08-28 | PRD I9, PRD §9 |
| **D20** | **Two gaps stop being excusable now the clock is gone:** the judge's eval set (PRD-F14, without which M7 and K4 are unmeasurable) and data deletion (PRD-F15, an obligation memory created for itself) | 2026-08-28 | PRD §3, `../apexhuman.md` §8 |
| **D18** | **Numbered migrations replace hand-applied `schema.sql`.** Defensible for four hours with no data; not defensible now that memory outlives the sessions that produced it | 2026-08-28 | SDD §3.2 |
| **D21** | **Clerk replaced by Neon Auth (managed Better Auth), amending D7.** Auth now lives on the same account and branch as the database instead of a fourth separate vendor — one fewer signup on a student's provisioning list (`../apexhuman.md` §5). Package is beta (`@neondatabase/auth@0.5.x-beta`); no middleware/`proxy.ts` is used because its route-gating `auth.middleware()` would redirect `/` (the public sign-in page) to itself — every protected surface guards with `auth.getSession()` directly instead, matching the pattern already in place | 2026-09-01 | PRODUCT.md, SDD §4.3, §5, §9.3, sitemap §5, PRD §7, IDEA Q2 |

---

| **D22** | **Foundation styling shipped (Phases 1–2 of the UI build).** `app/globals.css` and `extension/meant.css` now implement the class contract against `design/tokens.css`; the mark is CSS states of `.m-mark`, not six SVG files — every artboard draws it with divs, and the header logo is the only real SVG in the canvas. `.m-mark:empty` renders the small decorative glyph every real call site already used (dashboard row, review header, popup, block page); `.m-mark:not(:empty)` becomes the real proportional band (`lib/band.ts`), reusing `.m-row-bar[data-kind]` for both the row swatch and the band segment. Full reasoning and the artboard-vs-doc departures (block page and popup no longer tick, per toolkit §9 and §6 respectively; the ledger drops the duration/domain columns for one band, per its own artboard) live in the build plan and `docs/dead-ends.md` | 2026-09-01 | `docs/design-toolkit.md` §2, §6, §8, §9; plan file `you-are-building-the-elegant-deer.md` |
| **D23** | **Landing's CTA is "Sign in," not "Add to Chrome."** No Chrome Web Store listing exists and `apexhuman.md` §7 rule 8 forbids the build path needing one. Hero and footer become the real Neon Auth sign-in/sign-up form; the header keeps a quiet link out to the extension's own README section | 2026-09-01 | `PRODUCT.md`, sitemap S1 |
| **D24** | **A stale or revoked Neon Auth session cookie must not crash a page.** `auth.getSession()` can try to refresh or clear the cookie as a side effect, which Next.js only permits from a Server Action or Route Handler — called from a plain Server Component (every page in this app) it throws instead of reporting no session. `lib/auth/session.ts#currentUserId()` catches this and treats it as signed-out, the same principle E8 already applies to a revoked device token | 2026-09-01 | `lib/auth/session.ts`, SDD flow E8 |

| **D25** | **The companion ships (Phase 3), with a mechanical drift signal instead of the judge.** No `task`/`judgment`/`memory` tables and no model this pass, so `.m-mark[data-state="drifting"]` — declared since 0.1, set nowhere until now — is driven by `sw.js#updateCompanion`: a domain from any known distraction category (`blocklists.js`) that isn't the one the session actually chose to block. Exercises the judge seam (I9) by construction, not assertion. `chrome.sidePanel` answers sitemap Q2/Q3 without running the PiP spike; the return-turn-is-free choice provisionally answers flow Q2, pending the 25-minute recording gate | 2026-09-01 | sitemap S9, Q2, Q3; flow Q2; PRD I9; plan file — **superseded 3 days later by D26-D42 below, and again by D26/D27's real dwell/idle logic and the D32/D41-shaped `judgment`/`memory` tables** |

**D26-D42 below were made 2026-09-04 in `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` and shipped in code (`lib/thresholds.ts`, `lib/migrations/002-drift.sql`, `event.label`) — but that plan's own Task 20, which was supposed to write them here, was never executed (its checkboxes are unchecked). Found and reconciled in a 2026-09-11 doc audit; see `docs/prd-intent.md` amendment 0.2c.**

| D26 | The judge runs after dwell (20s foreground), not on tab change. Answers flow Q3: no | 2026-09-04 | `lib/thresholds.ts` (`DWELL_MS`) |
| D27 | Away is detected by `chrome.idle`, not window focus. `idle` while the tab is `audible` still counts as attention | 2026-09-04 | `extension/sw.js` |
| D28 | Three chip-driven questions per session (intention, work sites, distraction sites), pre-selected from the previous session | 2026-09-04 | `extension/popup.js` |
| D29 | "What pulls you away" is asked at setup, not seeded from `chrome.topSites`; the first review additionally offers it with evidence | 2026-09-04 | `extension/popup.js` |
| D30 | Ambiguity stays silent; an explicit tap resolves at n=1. The 3-observation/80%-agreement rule governs conflict only | 2026-09-04 | `lib/thresholds.ts` (`MEMORY_MIN_EVIDENCE`, `MEMORY_MIN_AGREEMENT`) |
| D31 | Blocked domains never trigger the companion — the block page already spoke | 2026-09-04 | `extension/sw.js` |
| D32 | Only user taps write memory; judge verdicts are session-scoped, not memorized on their own | 2026-09-04 | `memory` table |
| D33 | The judge's session cache is keyed per visit, not per domain — a domain cleared earlier in a session can re-trigger later | 2026-09-04 | `extension/sw.js` |
| D34 | The intention sentence locks after 60 seconds (draft window = grace window); a mid-session change starts a new, `superseded` session | 2026-09-04 | `extension/popup.js` |
| D35 | No "again" button on the review; the popup pre-fills the last sentence instead (the review is a web page, can't start a session without a new trust boundary) | 2026-09-04 | — |
| D36 | **Not built** — standing-list management was planned as a full extension page (`lists.html`); `permissions.request({origins})` from a popup was reported to hang. Confirmed not built: no `lists.html` exists | 2026-09-04 | — |
| D37 | `event` gains a `label` column (work/distract/neutral/unknown) so the live band can render `youtube.com — 2 min work, 15 min drift` | 2026-09-04 | `lib/migrations/002-drift.sql` |
| **D38** | **PRD-F8 (the AI-generated task plan) is cut, not deferred.** The live band and cycle read serve its stated purpose with no model call; `I8` already distrusts step-completion as a progress signal; the judge judges the sentence, not a step. Takes `US-07`, `PRD-F10`'s task-marking, `EV8`-`EV10`, `M6`, and the `task` table with it (confirmed: no `task` table exists) | 2026-09-04 | `docs/prd-intent.md` §3 (0.2c) |
| D39 | Cycles ship; a dial and a ticking countdown do not — static reads and a toolbar badge only, per `docs/design-toolkit.md` §9's refusal | 2026-09-04 | `lib/thresholds.ts` (`CYCLE_PRESETS`) |
| D40 | **Not built** — an AI "carve to unblock" feature was designed (model may only narrow the block list, never widen it) but `app/api/carve/route.ts` does not exist | 2026-09-04 | — |
| D41 | `neutral` is a first-class label, distinct from `unknown` — forcing ambiguous domains into work-or-drift poisons the memory that gates the judge | 2026-09-04 | `event.label`, `judgment.label` |
| D42 | The running popup's live band shows time-by-site from local tally data, and never marks drift (drift stays review-only, per I2) | 2026-09-04 | `extension/popup.js` (round 6, ADR-0028) |
| D50 | **The evidence threshold gates *inference*, never *description*.** Showing a user their own rows has no floor; asserting a regularity about them keeps one | 2026-09-11 | PRD §3.1 I6, ADR-0050 |
| D51 | **The coach attaches no *valence* to the outcome answer but may freely *reason from* it.** The 0.2 wording forbade using the most informative column in the schema | 2026-09-11 | PRD §3.1 I3, ADR-0051 |
| **D52** | **Awareness is the goal; information is the mechanism.** *Information → pattern → noticing*, with a lag. The review is a training loop, not a ledger. Self-control and accountability are secondary | 2026-09-15 | ADR-0052 |
| **D53** | **The evidence bar scales with the cost of being wrong.** n=2 is enough to change a habit and not enough to build a feature | 2026-09-15 | ADR-0053 |
| **D54** | **User defined by behavior; buyer is a separate axis; segments left unranked.** Boundary = browser share reported at runtime, not job title | 2026-09-15 | ADR-0054 |
| **D55** | **Canonical problem statement, with three falsifiers.** "They don't know the problem exists" is a distribution fact, not a wedge | 2026-09-15 | ADR-0055 |
| **D56** | **Why-now is two changed conditions** (AI collapsed the surfaces; sub-cent inference). MV3 → why-possible; abundance → why-ever | 2026-09-15 | ADR-0056 |
| **D57** | **The companion's live drift signal is removed.** No way to report a false positive; 14-domain universe; precision unknown and unmeasurable | 2026-09-15 | ADR-0057 |
| **D58** | **The companion becomes an input device** — one tap, *"this isn't the work."* A self-report cannot be a false positive | 2026-09-15 | ADR-0058 |
| **D59** | **Full paths stored in extension local storage only, never server-side.** I7 amended; transit is transient | 2026-09-15 | ADR-0059 |
| **D60** | **The judge runs after the session, batched, on demand.** ~20× cheaper; buys model quality, not margin | 2026-09-15 | ADR-0060 |
| **D61** | **The two-tier judge is collapsed. No page text or title is ever read.** Q4/Q7/Q9, SDD Q8, T16/T17 void | 2026-09-15 | ADR-0061 |
| **D62** | **Labels written per visit (`event.label`); memory accumulates by threshold, not at n=1.** Defers the undefined "intention class" | 2026-09-15 | ADR-0062 |
| **D63** | **`docs/adr/` is the most up-to-date record in the repo.** Where an ADR and any document disagree, the ADR is right | 2026-09-15 | ADR-0063, AGENTS.md |
| **D64** | **The coach's preset corpus: relevance over recency, a source-tier gate, and a review date.** SEO "statistics 2026" pages are inadmissible | 2026-09-15 | ADR-0064 |

## 7. Pending spawn proposals

**A new Build Run-of-Show for 0.2 is needed and has not been written.** `build-intent.md` is frozen as the record of the four-hour sitting. The 0.2 scope — plan, judge, companion, memory, coach, personal blocklist, plus two migrations and a permission flow — is not a four-hour job and should not pretend to be one. Order of build is stated in PRD §9: the review first, because everything else is evidence for it.

**Two spikes should precede it, and both are timeboxed:**

| Spike | Question | Box | Why it comes first |
|---|---|---|---|
| ~~S-1~~ | ~~Does tier T-A clear the precision floor on its own?~~ **Restated 2026-09-15 (ADR-0061):** the tiers are gone and the permission prompt already disappeared, so the original framing has no referent. **The live version: is hostname + on-device path accurate enough to be worth showing?** | Half a day of labelling stored sessions | Now measurable **offline, against sessions already recorded** — no permission, no funnel risk, no live judging. Still the cheapest high-leverage question in the project |
| S-2 | Does the companion render in `chrome.sidePanel` or Document Picture-in-Picture? | 30 minutes | PiP floats and needs no host permission but requires a gesture, dies with its opener, and its extension support is undocumented. Side panel is the fallback and is certain (SDD Q3, SITEMAP Q2) |

Rejected by the absorption test (AGENTS §11.1) — content lives where noted: data model → SDD §3 (4 tables, threshold ~12) · QA plan → SDD §8 (8 cases, threshold ~20) · privacy/compliance → SDD §9 · classification taxonomy → PRD §6 (there is no taxonomy in v1).
