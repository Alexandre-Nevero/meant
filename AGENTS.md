# MEANT — Agent Guide

## Project overview

MEANT is a browser extension plus web app that makes you say what you intend to finish,
blocks what you chose to avoid, sits with you while you work, and ends by asking whether you
finished it. **Corrected 2026-09-16 (ADR-0054): the user and the buyer are separate axes.** It
*serves* anyone whose work surface and distraction surface are the same browser — no job-title
filter — and it is *bought* by the self-employed browser-native worker (freelancers, consultants,
coaches, VAs), who owns the laptop and the card. Segments are deliberately unranked. Second audience: this is also the reference build for apexhuman.ai and will be filmed —
see [apexhuman.md](apexhuman.md), which is course context, never product truth.

## For teammates (30-second orientation)

You need `/docs` (including `docs/design.md`), `PRODUCT.md`, `CLAUDE.md`, and this file —
**not** `fmd/` (owner-local factory kit; do not commit or read it).

- **`PRD-F#`** = a feature label linking code ↔ `docs/prd-intent.md` ↔ tests (soft, not an
  orphan gate). `I#` = a product invariant (`docs/prd-intent.md` §3.1) — breaking one is a bug,
  not a style choice.
- **`docs/adr/`** is the decision changelog — read newest first; an ADR wins over stale
  narrative elsewhere until that narrative is reconciled. On a real product, architecture, or
  plan decision, **append an ADR** (every agent). `docs/index.md` §6 is the same log's
  historical predecessor (D1-D25, ported 1:1 as ADR-0001–0025) — kept for continuity, not the
  place to add new entries.
- Read `docs/index.md` §1 for what exists and its status before touching a doc; do not
  duplicate facts across `PRODUCT.md`, `docs/prd-intent.md`, and `docs/design.md` — see "Do not
  touch" below for which one is canonical for what.

## Architecture

Chrome/Edge MV3 extension (`extension/`, plain ES modules — no bundler, no TypeScript, no
React) plus a Next.js 16 web app (`app/`) on Vercel, with Neon Postgres + Neon Auth and
inference via Vercel AI Gateway (not yet wired to any product code — see Stack currency).
**Status as of 2026-09-16: the entire AI stack (plan, judge, memory, coach — PRD §6) is
unbuilt.** ~~The companion's drift signal is a mechanical hostname-category check standing in
for the judge (ADR-0025).~~ **Corrected 2026-09-16: that signal was deleted (ADR-0057).** The
companion signals nothing; it **takes one tap** meaning *"this isn't the work"* (ADR-0058).
Attention is still recorded live and silently; the judge, when it exists, will run **after** the
session in batches (ADR-0060) and will **never read page text or titles** (ADR-0061). Full visit
paths are kept **on the device only** (ADR-0059).

See [System Design](docs/sdd-intent.md), [PRD](docs/prd-intent.md), [Sitemap](docs/sitemap-intent.md), [User Flow](docs/flow-intent.md).

## Build & run

```
npm run dev     # next dev — also regenerates extension/tokens.css from design/tokens.css
npm run build   # next build
```
Load `extension/` unpacked in Chrome/Edge (`chrome://extensions` → Developer mode → Load
unpacked). No Chrome Web Store review is on the build path — unpacked must stay fully usable.

## Test

```
npm test           # node --test — pure-function unit tests
npm run test:e2e   # npx playwright test --workers=1 — no --reporter flag
npx tsc --noEmit    # web app only; extension/ has no TypeScript
```
All three clean before any change is considered done. **`test:e2e` requires `.env.test` and
refuses to start without it** (added 2026-09-15): that refusal is correct behaviour, not a
failure — without it the suite writes to **production**. See `.env.test.example`; the database
*name* must end `_test`, because a Neon branch inherits its parent's database name and would
otherwise pass the check while pointing at real data. `e2e/*.spec.ts` is the source of truth
for what's covered — read a spec file's own comments for why a case exists, not a separate
prose recipe (the one that used to track this, `docs/qa-recipe-playwright-e2e.md`, was
removed 2026-09-11: 74+ cases of narrative duplicating what the real specs already assert).

## Code style & conventions

- Web app: Next.js App Router, Server Components by default, `lib/auth/session.ts` for auth
  state (never `auth.middleware()` — see Stack currency).
- Extension: no build step. `extension/lib/*.js` holds pure functions (attribution, tally,
  normalize-domain) — keep them pure and unit-tested; `sw.js` is the only place that touches
  `chrome.*` APIs for background state.
- Design: `design/tokens.css` only — never a hex value in a component. `docs/design.md` is the
  read-first index over tokens/canvas/toolkit; read it before touching any UI. **The app shell is
  the one surface with no artboard** — `design/canvas/` holds seven and none shows navigation, so
  on that surface the usual "the canvas outranks the docs" rule has nothing to point at.
- Tests are TDD-first: a failing test before the fix, for every behavior change.

## Stack currency (verify before coding — overrides training memory)

| ❌ Stale / from memory | ✅ Current (this project) | Why |
|---|---|---|
| Clerk for auth | `@neondatabase/auth` (`^0.5.0-beta`) | ADR-0021 — one vendor instead of two, auth lives on the same Neon branch as the data |
| `auth.middleware()` for route gating | `auth.getSession()` called directly on every protected Server Component | Middleware's redirect would loop the public sign-in page (`/`) to itself — ADR-0024 |
| `<all_urls>` only via `optional_host_permissions` | `<all_urls>` in `host_permissions`, unconditional, since 2026-09-07 | ADR-0027 — the content script already needed it; a per-domain prompt was worse UX for no added trust boundary |
| Hand-applied `schema.sql` | Numbered migrations (`lib/migrate.mjs`) | ADR-0018 |

Pinned versions: Next.js 16.3.1, React 19.2.8, `@neondatabase/serverless` ^1.1.0,
`@neondatabase/auth` ^0.5.0-beta (beta — re-verify before relying on new behavior),
`@playwright/test` ^1.63.0, TypeScript ^5.

## Do not touch

- **Invariants** (`docs/prd-intent.md` §3.1, restated `PRODUCT.md`): `Yes`/`Not yet` stay
  byte-identical in every property. Quantities render on the dashboard: attended time, counts, shares, and change against the previous period (ADR-0068). Nothing renders a composite productivity score, and no figure carries a colour that grades it.
  The popup animates nothing. Nothing good happens on screen during a session — positive
  feedback lives only in the review. The companion never varies with the outcome answer.
- **The frozen 13-class contract** (`docs/design.md` §5): don't add a 14th class; `data-*`
  attribute extensibility is fine. **Counted 2026-09-16, the code defines 15** — `.m-chip` and
  `.m-chip-row` ship in the popup — plus three structural families (`.m-landing-*`, `.m-rise`,
  `.m-shell-*`). **Whether the contract is 13 or "13 plus named structural families" is an open
  owner decision (#51). Until it is decided, treat the rule as binding and argue any new class in
  writing before using it** — do not settle it by editing a number in a doc.
- **Canonical-truth ownership**: **`docs/adr/` outranks everything below on anything it has
  ruled on (ADR-0063).** Beneath that, `docs/prd-intent.md` is canonical for product requirements.
  `PRODUCT.md` is a regenerated derived summary (kept only because design tooling reads a root
  `PRODUCT.md` by convention) — edit the PRD, then regenerate `PRODUCT.md`, never the reverse.
  `docs/design.md` is canonical for cross-checked, verified accessibility/contrast facts; the
  design canvas (`design/canvas/*.dc.html`) outranks every written doc on visual truth.

## Decisions — `docs/adr/` is the most up-to-date information in this repository

**This is a hard rule, not soft discipline (ADR-0063).**

1. **`docs/adr/` is the current record.** Where an ADR and any other document disagree —
   the PRD, the SDD, IDEA, `PRODUCT.md`, `apexhuman.md`, this file — **the ADR is right and
   the other document is stale.** Say so, then reconcile. Never silently pick one.
   The long documents are *periodic reconciliations of the ADR log*, so between reconciliations
   they are stale by construction.
2. **Every change of decision is written as an ADR**, one file per decision, append-only,
   never edited after acceptance. **A decision that is not in `docs/adr/` has not been made.**
3. **An ADR records a decision already taken — never one that is proposed.** If the evidence
   is not in yet, it belongs in the owning document's open-questions table. A decision taken
   against unknown evidence must say so in its own Consequences.

Also:

- Read the ADR log before changing a recorded choice. Newest numbers first — they supersede.
- Never rename an immutable ID (`PRD-F#`, `I#`, `ADR-####`) once assigned.
- Append `docs/adr/ADR-NNNN-slug.md` in the same session as the decision, not afterwards.

**Why this rule exists.** Twice this project lost the thread. Amendment 0.2c records 17 real
decisions (D26–D42) that shipped code but sat undiscoverable inside a 153KB plan file for a week
because the task that was meant to record them was never run. Then on 2026-09-14 six ADRs were
written *before* their decisions had evidence and had to be reverted. Rules 2 and 3 are the two
halves of that.

## Testable modules — where pure logic goes

`node --test` cannot resolve the `@/` tsconfig alias, so **any module that imports `@/…` is
unreachable from a unit test.** That is why `test/review-data.test.js` mirrors a filter shape
instead of importing `getReviewData`.

So: **pure logic lives in its own module with no `@/` imports**, and the surface that needs the
database imports *it*. `lib/session-payload.ts`, `lib/session-time.ts`, `lib/attention-contrast.ts`,
`extension/lib/*.js` all follow this. `import type` is fine anywhere — it is erased at runtime.

For a `lib/` → `lib/` value import, use a **relative path with the `.ts` extension**
(`from './band.ts'`). `allowImportingTsExtensions` is enabled in `tsconfig.json` for exactly
this; it is safe because `noEmit` is already true, and it is the only form both `tsc` and
`node --test` accept.

## Work tracking — GitHub Project 16 "Meant"

`https://github.com/orgs/ED3N-Ventures-Interns/projects/16` · repo `ED3N-Ventures-Interns/meant`.
The project is the schedule; **`docs/adr/` is still the truth** (ADR-0063). An issue implements an
ADR; it never replaces one.

**Always real issues, never draft items.** A draft cannot be closed by a commit, cannot link a PR,
and vanishes from the repo's history. Create the issue, then add it to the project.

```bash
gh issue create --repo ED3N-Ventures-Interns/meant --title "..." --body-file <file> --label "adr,extension"
gh project item-add 16 --owner ED3N-Ventures-Interns --url <issue-url> --format json   # returns the item id
gh project item-edit --id <item> --project-id PVT_kwDOEecM1s4BjXGX --field-id <field> --single-select-option-id <opt>
```

**Every issue body carries four things, or it is not ready to pick up:**
1. **The ADR it implements.** Work with no recorded decision behind it is work nobody agreed to.
2. **Exact files** — create / modify with line numbers / test.
3. **The acceptance test** — the observation that proves it, not a description of the change.
4. **What it blocks or depends on.**

**Fields — fill every one. A blank field is a decision nobody made.**

| Field | Id | Values |
|---|---|---|
| Status | `PVTSSF_lADOEecM1s4BjXGXzhiLrYc` | Backlog `f75ad846` · In progress `47fc9ee4` · For review `aba860b9` · In Testing `34f04ae0` · For Release `fc85ffd7` · Done `98236657` · Blocked `44299ca7` · On Hold `1e5451a7` · Failed Testing `5bca9a28` · Won't Do `849498f5` |
| Week *(iteration)* | `PVTIF_lADOEecM1s4BjXGXzhiLrZM` | Week 2 = `a5098313` (2026-09-14) · Week 3 = `3ce4a38c` (2026-09-21) |
| Priority | `PVTSSF_lADOEecM1s4BjXGXzhiLrZQ` | P0 `46c35852` · P1 `e3d3a432` · P2 `7df46d17` · P3 `ec553a46` · P4 `53e9a484` |
| Estimate Effort (hours) | `PVTF_lADOEecM1s4BjXGXzhiLrZU` | number, `--number` |

Labels: `extension` · `api` · `web` · `data` · `adr` · `blocked` · `documentation` · `bug`.

### Three rules that exist because they were broken

1. **Never mark Done from a plan. Mark Done from a verification.** On 2026-09-15 the EDEN sheet
   carried five DONE rows; three were false against the code. *"Task 10: The signalling gate"* was
   marked done and described as deleting `updateCompanion`/`DRIFT_*` — every one of those symbols
   was live at `sw.js:202-270`, and `extension/lib/gate.js` never existed. `lists.html` (marked
   done) is recorded as **not built** in ADR-0043. `app/api/memory/route.ts` (marked done) does not
   exist. **Run the check before you move the card.**
2. **Blocked means blocked on evidence or data, never on scheduling**, and the body must name what
   unblocks it. Issue #16 is blocked because `judgment` has 0 rows and `work_sites` is empty in
   3,668 of 3,668 — not because nobody got to it.
3. **Close issues from commits**, so history and tracker cannot drift: `Closes #12` in the commit
   body. Never close by hand what a commit could close.

**Estimates are hours and they are a budget, not a wish.** Sum the open Week items before adding
another: if the week is already at ~35h, the next card is next week's.

## Definition of done

- `npm test`, `npm run test:e2e`, and `npx tsc --noEmit` all pass.
- A UI-affecting change is verified by **rendering it and looking** — a screenshot at 1440px and
  390px — not by a clean build. **The detector is a floor, not evidence** (recorded 2026-09-15):
  `node ~/.agents/skills/impeccable/scripts/detect.mjs <files|url>` returned `[]` for a `.tsx` file
  containing `#ff0000`, 10px type and `transition: all 0.3s`, because most of its rules only run
  for full-page documents. **An empty result proves nothing about a component file.**
- Code change ties to a `PRD-F#` where applicable; anything newly verifiable gets a real
  `e2e/*.spec.ts` case, not a prose recipe entry.
- A real product/architecture/plan decision is logged as an ADR before the task is called done.
- The GitHub Project card is moved **after** the verification runs, never after the code is written.
- Framework APIs verified against pinned docs — see Stack currency above.
- No secrets committed.

## References

- [Docs index](docs/index.md) — what exists, owners, staleness watch
- **[ADRs](docs/adr/) — the most up-to-date record in the repo. Read first; it outranks every doc below (ADR-0063)**
- [PRD](docs/prd-intent.md) · [SDD](docs/sdd-intent.md) · [Sitemap](docs/sitemap-intent.md) · [User Flow](docs/flow-intent.md) · [Idea Brief](docs/idea-intent.md)
- [PRODUCT.md](PRODUCT.md) · [design.md](docs/design.md) · [apexhuman.md](apexhuman.md) (course context, not product truth)
- [CLAUDE.md](CLAUDE.md) — design invariants and verification commands

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
