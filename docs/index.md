# Document Index — MEANT

**Project:** MEANT (`meant`)
**Owner:** Alexandre Andrei Nevero
**Last updated:** 2026-09-10
**Suite:** FMD Lite 1.1.0 (doc suite shape) — decision log and `AGENTS.md` adopted the newer
private FMD factory's conventions (`docs/adr/`, ADR format) on 2026-09-10; the `*-intent.md`
doc set itself was not migrated to that factory's template names, to avoid breaking the ~30
files that link them by current filename

---

## 1. Core suite

| Doc | File | Version | Status | Cycle | Updated |
|---|---|---|---|---|---|
| Idea Brief | [idea-intent.md](idea-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| PRD | [prd-intent.md](prd-intent.md) | 0.2b | Draft | 1 | 2026-09-10 |
| Sitemap | [sitemap-intent.md](sitemap-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| User Flow | [flow-intent.md](flow-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| SDD | [sdd-intent.md](sdd-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |

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
| `docs/design-toolkit.md` | The committed visual world as a specification. **Restored 2026-09-01 (D22)** — `design/tokens.css` and `design/canvas/` exist, the class contract is implemented. Superseded by `design.md` as the read-first index over this file, `tokens.css`, and the canvas |
| `design.md` | **Read-first index (2026-09-01+) over `design/canvas/`, `design/tokens.css`, and `docs/design-toolkit.md`** — the accessibility contrast checks and the class-contract quick reference live only here |
| `docs/adr/` | **Decision changelog (2026-09-10).** Append-only, one file per decision; supersedes §6 below as the point of entry for new decisions — see `docs/adr/README.md` |
| `docs/metaprompt-ui.md` | **Paste-in prompt for the UI/UX build (2026-09-01).** Supersedes the design and build metaprompts below, which describe the 0.1 product and will mislead a session that runs them |
| `design/canvas/` | **The seven artboards, and visual truth.** They outrank `design-toolkit.md` and `tokens.css` when they disagree |
| `docs/metaprompt-design.md` | **Stale.** Paste-in prompt for the 0.1 design session |
| `docs/metaprompt-build.md` | Shared build contract: skills, invariants, parallelism, and the Coordination section that the design metaprompt points at |
| `docs/metaprompt-build-1.md` | Hour 1: provision, schema, shell, and the extension-auth decision |
| `docs/metaprompt-build-2.md` | Hour 2: the auth bridge and the extension skeleton |
| `docs/metaprompt-build-3.md` | Hour 3: sessions, attention recording, blocking |
| `docs/metaprompt-build-4.md` | Hour 4: the review, the ledger, verification, and closing the build |

**Product name is now MEANT.** The `docs/*-intent.md` filenames are still stale; the "Project:" fields were corrected at 0.2. Renaming files is deferred so cross-links and git history stay intact.

**The 0.1 metaprompts are stale and still instruct a session to ship a product with no AI.** `docs/metaprompt-ui.md` replaces them for interface work. The build metaprompts still need replacing or deleting; do not run them as they stand.

---

## 4. Staleness watch

| Doc | Reconciled with reality | Risk |
|---|---|---|
| idea-intent.md | 2026-08-28 | C7 and C17's ARR figure remain unverified. C5 is retained but explicitly no longer load-bearing |
| prd-intent.md | 2026-09-10 | Amendment 0.2b folded in `PRODUCT.md`'s current facts (companion Orbit spec, corrected host-permission constraint, explicit "AI stack unbuilt" status). Q4 (precision floor), Q5 (evidence threshold) and Q9 (is tier T-A enough?) remain unanswered and each still blocks a shipping decision |
| sdd-intent.md | 2026-08-28 | V4 and V5 both amended. **Q3 (companion placement) is unspiked and the Document PiP row in §11 contains a documented unknown.** Re-check MV3 details before building |
| sitemap / flow | 2026-08-28 | S9's rendering surface depends on SDD Q3 and is therefore provisional |
| **Code** | **not reconciled** | **`extension/` and `app/` implement 0.1. Nothing at 0.2 is built. The gap between these documents and the 977 lines on disk is now the largest it has ever been, and that is the main staleness risk in this project** |
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

| **D25** | **The companion ships (Phase 3), with a mechanical drift signal instead of the judge.** No `task`/`judgment`/`memory` tables and no model this pass, so `.m-mark[data-state="drifting"]` — declared since 0.1, set nowhere until now — is driven by `sw.js#updateCompanion`: a domain from any known distraction category (`blocklists.js`) that isn't the one the session actually chose to block. Exercises the judge seam (I9) by construction, not assertion. `chrome.sidePanel` answers sitemap Q2/Q3 without running the PiP spike; the return-turn-is-free choice provisionally answers flow Q2, pending the 25-minute recording gate | 2026-09-01 | sitemap S9, Q2, Q3; flow Q2; PRD I9; plan file |

## 7. Pending spawn proposals

**A new Build Run-of-Show for 0.2 is needed and has not been written.** `build-intent.md` is frozen as the record of the four-hour sitting. The 0.2 scope — plan, judge, companion, memory, coach, personal blocklist, plus two migrations and a permission flow — is not a four-hour job and should not pretend to be one. Order of build is stated in PRD §9: the review first, because everything else is evidence for it.

**Two spikes should precede it, and both are timeboxed:**

| Spike | Question | Box | Why it comes first |
|---|---|---|---|
| S-1 | Does tier T-A (hostname + title) clear the precision floor on its own? | Half a day of manual labelling | If yes, tier T-B never ships, the broad-permission prompt disappears from the product entirely, and the install funnel gets dramatically simpler. Cheapest, highest-leverage question in the project (IDEA Q10, PRD Q9) |
| S-2 | Does the companion render in `chrome.sidePanel` or Document Picture-in-Picture? | 30 minutes | PiP floats and needs no host permission but requires a gesture, dies with its opener, and its extension support is undocumented. Side panel is the fallback and is certain (SDD Q3, SITEMAP Q2) |

Rejected by the absorption test (AGENTS §11.1) — content lives where noted: data model → SDD §3 (4 tables, threshold ~12) · QA plan → SDD §8 (8 cases, threshold ~20) · privacy/compliance → SDD §9 · classification taxonomy → PRD §6 (there is no taxonomy in v1).
