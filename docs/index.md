# Document Index — MEANT

**Project:** MEANT (`meant`)
**Owner:** Alexandre Andrei Nevero
**Last updated:** 2026-08-28
**Suite:** FMD Lite 1.1.0

---

## 1. Core suite

| Doc | File | Version | Status | Cycle | Updated |
|---|---|---|---|---|---|
| Idea Brief | [idea-intent.md](idea-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| PRD | [prd-intent.md](prd-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| Sitemap | [sitemap-intent.md](sitemap-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| User Flow | [flow-intent.md](flow-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |
| SDD | [sdd-intent.md](sdd-intent.md) | 0.2 | Draft | 1 | 2026-08-28 |

### 1.1 Spawned documents

| Doc | File | ID prefix | Parent | Version | Status | Created |
|---|---|---|---|---|---|---|
| Build Run-of-Show | [build-intent.md](build-intent.md) | `T#` | sdd-intent.md | 0.1 | **Historical** | 2026-08-18 |
| Build Guide | [build.md](build.md) | `TASK-###`, `INV-#` | sdd-intent.md | 0.1 | **Historical** | 2026-08-18 |
| Design Toolkit | [design-toolkit.md](design-toolkit.md) | — | ../PRODUCT.md | 0.1 | **Deleted in working tree** | 2026-08-18 |

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
| Time budget | **No limit on our build.** The binding constraint is reproduction: a non-technical student, alone and online, must rebuild a defined subset in 4–8 hours. See `../context.md` §5 and §6 |
| Purpose | **A reference product for apexhuman.ai** — the worked example that students, entrepreneurs, solopreneurs and SMEs learn from. Ships as three artifacts: the product, a rebuild manual, and a build video |
| External services | Five maximum; **four allocated**: Vercel (hosting), Neon Postgres (database), Clerk (auth), Vercel AI Gateway (inference). One unallocated |
| Platforms | Wherever Chrome/Edge runs — macOS and Windows identically |
| Business model | Direct consumer subscription. Free is mechanical; paid is the half that knows you (D15) |
| Cut from v1, still cut | Voice, in-session conversation, on-device inference, desktop/OS tracking, app blocking, scheduling, Locked Mode, sync, teams, any score |
| **Un-cut at 0.2** | **Calibration, returning as memory (PRD-F11). Positive reinforcement, returning in the strictly bounded form permitted by I2 — review only, never during a session** |

---

## 3.1 Design and execution artifacts

| File | What it is |
|---|---|
| `../context.md` | **Course and delivery context (new 2026-08-28).** Who the reference product is for, the two Apex Human delivery shapes, the honest 4–8 hour student budget, and the three-tier rule that assigns every part of the build. **It replaces the "four hours, one builder" constraint that `build-intent.md` has been silently exporting to every other document** |
| `PRODUCT.md` | Product context for design tooling, derived from these docs |
| `docs/design-toolkit.md` | The committed visual world as a specification. **Currently deleted in the working tree, and `design/` was never produced — so the mark, its five states, and the token set do not exist yet.** The companion (S9) is a design decision waiting on this, not on code |
| `docs/metaprompt-design.md` | Paste-in prompt for the design session |
| `docs/metaprompt-build.md` | Shared build contract: skills, invariants, parallelism, and the Coordination section that the design metaprompt points at |
| `docs/metaprompt-build-1.md` | Hour 1: provision, schema, shell, and the extension-auth decision |
| `docs/metaprompt-build-2.md` | Hour 2: the auth bridge and the extension skeleton |
| `docs/metaprompt-build-3.md` | Hour 3: sessions, attention recording, blocking |
| `docs/metaprompt-build-4.md` | Hour 4: the review, the ledger, verification, and closing the build |

**Product name is now MEANT.** The `docs/*-intent.md` filenames are still stale; the "Project:" fields were corrected at 0.2. Renaming files is deferred so cross-links and git history stay intact.

**The metaprompts describe the 0.1 build and are stale at 0.2.** They still instruct a session to ship a product with no AI. Rewrite them alongside the new run-of-show (§7), or delete them — do not run them as they stand.

---

## 4. Staleness watch

| Doc | Reconciled with reality | Risk |
|---|---|---|
| idea-intent.md | 2026-08-28 | C7 and C17's ARR figure remain unverified. C5 is retained but explicitly no longer load-bearing |
| prd-intent.md | 2026-08-28 | §6 reversed the 0.1 "no AI" position. Q4 (precision floor), Q5 (evidence threshold) and Q9 (is tier T-A enough?) are unanswered and each blocks a shipping decision |
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

| # | Decision | Date | Where it belongs |
|---|---|---|---|
| D1 | User defined by behavior (browser-native worker), not job title | 2026-08-18 | IDEA §1 |
| D2 | Browser extension + web app; no desktop app in v1 | 2026-08-18 | SDD §2 |
| D3 | Real sign-in and a database, not local-only storage | 2026-08-18 | SDD §2 |
| D4 | Whole loop shipped thin, rather than one link deeply | 2026-08-18 | PRD |
| D5 | Calibration and rewards cut from v1 | 2026-08-18 | IDEA §4 — **superseded at 0.2.** Calibration returns as memory (PRD-F11); reward returns only within I2 |
| D6 | Extension authenticates by one-time pairing code, not OAuth | 2026-08-18 | SDD §4.2 |
| D7 | Stack: Vercel + Neon Postgres + Clerk | 2026-08-18 | SDD §4.3 |
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
| **D20** | **Two gaps stop being excusable now the clock is gone:** the judge's eval set (PRD-F14, without which M7 and K4 are unmeasurable) and data deletion (PRD-F15, an obligation memory created for itself) | 2026-08-28 | PRD §3, `../context.md` §8 |
| **D18** | **Numbered migrations replace hand-applied `schema.sql`.** Defensible for four hours with no data; not defensible now that memory outlives the sessions that produced it | 2026-08-28 | SDD §3.2 |

---

## 7. Pending spawn proposals

**A new Build Run-of-Show for 0.2 is needed and has not been written.** `build-intent.md` is frozen as the record of the four-hour sitting. The 0.2 scope — plan, judge, companion, memory, coach, personal blocklist, plus two migrations and a permission flow — is not a four-hour job and should not pretend to be one. Order of build is stated in PRD §9: the review first, because everything else is evidence for it.

**Two spikes should precede it, and both are timeboxed:**

| Spike | Question | Box | Why it comes first |
|---|---|---|---|
| S-1 | Does tier T-A (hostname + title) clear the precision floor on its own? | Half a day of manual labelling | If yes, tier T-B never ships, the broad-permission prompt disappears from the product entirely, and the install funnel gets dramatically simpler. Cheapest, highest-leverage question in the project (IDEA Q10, PRD Q9) |
| S-2 | Does the companion render in `chrome.sidePanel` or Document Picture-in-Picture? | 30 minutes | PiP floats and needs no host permission but requires a gesture, dies with its opener, and its extension support is undocumented. Side panel is the fallback and is certain (SDD Q3, SITEMAP Q2) |

Rejected by the absorption test (AGENTS §11.1) — content lives where noted: data model → SDD §3 (4 tables, threshold ~12) · QA plan → SDD §8 (8 cases, threshold ~20) · privacy/compliance → SDD §9 · classification taxonomy → PRD §6 (there is no taxonomy in v1).
