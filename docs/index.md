# Document Index — Intent

**Project:** Intent (`intent`)
**Owner:** Alexandre Andrei Nevero
**Last updated:** 2026-08-18
**Suite:** FMD Lite 1.1.0

---

## 1. Core suite

| Doc | File | Version | Status | Cycle | Updated |
|---|---|---|---|---|---|
| Idea Brief | [idea-intent.md](idea-intent.md) | 0.1 | Draft | 1 | 2026-08-18 |
| PRD | [prd-intent.md](prd-intent.md) | 0.1 | Draft | 1 | 2026-08-18 |
| Sitemap | [sitemap-intent.md](sitemap-intent.md) | 0.1 | Draft | 1 | 2026-08-18 |
| User Flow | [flow-intent.md](flow-intent.md) | 0.1 | Draft | 1 | 2026-08-18 |
| SDD | [sdd-intent.md](sdd-intent.md) | 0.1 | Draft | 1 | 2026-08-18 |

### 1.1 Spawned documents

| Doc | File | ID prefix | Parent | Version | Status | Created |
|---|---|---|---|---|---|---|
| Build Run-of-Show | [build-intent.md](build-intent.md) | `T#` | sdd-intent.md | 0.1 | Draft | 2026-08-18 |
| Build Guide | [build.md](build.md) | `TASK-###`, `INV-#` | sdd-intent.md | 0.1 | Draft | 2026-08-18 |
| Design Toolkit | [design-toolkit.md](design-toolkit.md) | — | ../PRODUCT.md | 0.1 | Draft | 2026-08-18 |

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
| `SDD-C#`, `V#`, `D#` | SDD | Components, verifications, decisions |
| `T#` | build-intent.md | Time slots in the four-hour sitting |
| `TASK-###` | build.md | Build tasks (stable) |
| `INV-#` | build.md | Build invariants |

---

## 3. Build context

| | |
|---|---|
| Form factor | Chrome/Edge extension (MV3) + web app with sign-in and a database |
| Time budget | Four hours, one strong student |
| External services | Five maximum; three allocated: Vercel (hosting), Neon Postgres (database), Clerk (auth). Two unallocated |
| Platforms | Wherever Chrome/Edge runs — macOS and Windows identically |
| Cut from v1 | Calibration, rewards, desktop/OS tracking, app blocking, scheduling, Locked Mode, sync, teams |

---

## 3.1 Design and execution artifacts

| File | What it is |
|---|---|
| `PRODUCT.md` | Product context for design tooling, derived from these docs |
| `docs/design-toolkit.md` | The committed visual world as a specification. No assets by design; §10 lists what a generator must produce, §11 is how it is judged |
| `docs/metaprompt-design.md` | Paste-in prompt for the design session |
| `docs/metaprompt-build.md` | Shared build contract: skills, invariants, parallelism, and the Coordination section that the design metaprompt points at |
| `docs/metaprompt-build-1.md` | Hour 1: provision, schema, shell, and the extension-auth decision |
| `docs/metaprompt-build-2.md` | Hour 2: the auth bridge and the extension skeleton |
| `docs/metaprompt-build-3.md` | Hour 3: sessions, attention recording, blocking |
| `docs/metaprompt-build-4.md` | Hour 4: the review, the ledger, verification, and closing the build |

**Product name is now MEANT.** The `docs/*-intent.md` filenames and the "Intent" project field are stale and need a rename pass.

---

## 4. Staleness watch

| Doc | Reconciled with reality | Risk |
|---|---|---|
| idea-intent.md | 2026-08-18 | C6 now verified (Session ships the loop on Apple platforms). Project name "Intent" collides with a shipping App Store product — rename pending |
| sdd-intent.md | 2026-08-18 | V4 amended during build-guide authoring; re-check MV3 details before the build |

---

## 5. Foundation Gate

**PROCEED WITH FIXES** — run 2026-08-18, cycle 1. All six §1 fields concrete; no contradicted claims. Fixes carried: provider selection, blocklist source, away-time definition. Canonical record: [idea-intent.md §8](idea-intent.md).

---

## 6. Decisions taken outside a document

| # | Decision | Date | Where it belongs |
|---|---|---|---|
| D1 | User defined by behavior (browser-native worker), not job title | 2026-08-18 | IDEA §1 |
| D2 | Browser extension + web app; no desktop app in v1 | 2026-08-18 | SDD §2 |
| D3 | Real sign-in and a database, not local-only storage | 2026-08-18 | SDD §2 |
| D4 | Whole loop shipped thin, rather than one link deeply | 2026-08-18 | PRD |
| D5 | Calibration and rewards cut from v1 | 2026-08-18 | IDEA §4 |
| D6 | Extension authenticates by one-time pairing code, not OAuth | 2026-08-18 | SDD §4.2 |
| D7 | Stack: Vercel + Neon Postgres + Clerk | 2026-08-18 | SDD §4.3 |
| D8 | Hostname only — never full URLs or page titles | 2026-08-18 | SDD V5 |
| D9 | Block page is a redirect rule, so host permissions are declared per blocklist domain | 2026-08-18 | SDD V4 (amended), build.md §7.4 |

---

## 7. Pending spawn proposals

None. `build-intent.md` was proposed and approved 2026-08-18; it is registered in §1.1.

Rejected by the absorption test (AGENTS §11.1) — content lives where noted: data model → SDD §3 (4 tables, threshold ~12) · QA plan → SDD §8 (8 cases, threshold ~20) · privacy/compliance → SDD §9 · classification taxonomy → PRD §6 (there is no taxonomy in v1).
