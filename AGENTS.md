# MEANT — Agent Guide

## Project overview

MEANT is a browser extension plus web app that makes you say what you intend to finish,
blocks what you chose to avoid, sits with you while you work, and ends by asking whether you
finished it. It serves self-employed, non-technical, browser-native workers (freelancers,
consultants, coaches, VAs) who need to know whether a work block produced the thing it was
for. Second audience: this is also the reference build for apexhuman.ai and will be filmed —
see [apexhuman.md](apexhuman.md), which is course context, never product truth.

## For teammates (30-second orientation)

You need `/docs`, `PRODUCT.md`, `CLAUDE.md`, `design.md`, and this file — **not** `fmd/`
(owner-local factory kit; do not commit or read it).

- **`PRD-F#`** = a feature label linking code ↔ `docs/prd-intent.md` ↔ tests (soft, not an
  orphan gate). `I#` = a product invariant (`docs/prd-intent.md` §3.1) — breaking one is a bug,
  not a style choice.
- **`docs/adr/`** is the decision changelog — read newest first; an ADR wins over stale
  narrative elsewhere until that narrative is reconciled. On a real product, architecture, or
  plan decision, **append an ADR** (every agent). `docs/index.md` §6 is the same log's
  historical predecessor (D1-D25, ported 1:1 as ADR-0001–0025) — kept for continuity, not the
  place to add new entries.
- Read `docs/index.md` §1 for what exists and its status before touching a doc; do not
  duplicate facts across `PRODUCT.md`, `docs/prd-intent.md`, and `design.md` — see "Do not
  touch" below for which one is canonical for what.

## Architecture

Chrome/Edge MV3 extension (`extension/`, plain ES modules — no bundler, no TypeScript, no
React) plus a Next.js 16 web app (`app/`) on Vercel, with Neon Postgres + Neon Auth and
inference via Vercel AI Gateway (not yet wired to any product code — see Stack currency).
**Status as of 2026-09-10: the entire AI stack (plan, judge, memory, coach — PRD §6) is
unbuilt.** The companion's drift signal is a mechanical hostname-category check standing in
for the judge (ADR-0025) — do not read its presence as evidence the judge exists.

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
All three clean before any change is considered done. See `docs/qa-recipe-playwright-e2e.md`
for the running case log — read its header/format and the last 2-3 cases, not the whole file;
it is an append-only record, not a document meant to load in full.

## Code style & conventions

- Web app: Next.js App Router, Server Components by default, `lib/auth/session.ts` for auth
  state (never `auth.middleware()` — see Stack currency).
- Extension: no build step. `extension/lib/*.js` holds pure functions (attribution, tally,
  normalize-domain) — keep them pure and unit-tested; `sw.js` is the only place that touches
  `chrome.*` APIs for background state.
- Design: `design/tokens.css` only — never a hex value in a component. `design.md` is the
  read-first index over tokens/canvas/toolkit; read it before touching any UI.
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
  byte-identical in every property. No total-hours figure, no percentage, no score, anywhere.
  The popup animates nothing. Nothing good happens on screen during a session — positive
  feedback lives only in the review. The companion never varies with the outcome answer.
- **The frozen 13-class contract** (`design.md` §5): don't add a 14th class; `data-*`
  attribute extensibility is fine.
- **Canonical-truth ownership**: `docs/prd-intent.md` is canonical for product requirements.
  `PRODUCT.md` is a regenerated derived summary (kept only because design tooling reads a root
  `PRODUCT.md` by convention) — edit the PRD, then regenerate `PRODUCT.md`, never the reverse.
  `design.md` is canonical for cross-checked, verified accessibility/contrast facts; the design
  canvas (`design/canvas/*.dc.html`) outranks every written doc on visual truth.

## Decisions (soft discipline)

- Read [`docs/adr/`](docs/adr/) and `docs/index.md` §6 before changing a recorded choice.
- Never rename an immutable ID (`PRD-F#`, `I#`, `ADR-####`) once assigned.
- On a real decision or pivot: append `docs/adr/ADR-NNNN-slug.md` in the same session.

## Definition of done

- `npm test`, `npm run test:e2e`, and `npx tsc --noEmit` all pass.
- A UI-affecting change is verified by rendering it (`node ~/.agents/skills/impeccable/scripts/detect.mjs <files|url>`), not just a clean build — see `CLAUDE.md`.
- Code change ties to a `PRD-F#` where applicable; `docs/qa-recipe-playwright-e2e.md` gets a
  new lettered case for anything newly verifiable.
- A real product/architecture/plan decision is logged as an ADR before the task is called done.
- Framework APIs verified against pinned docs — see Stack currency above.
- No secrets committed.

## References

- [Docs index](docs/index.md) — what exists, owners, staleness watch
- [ADRs](docs/adr/) — decision changelog, read first
- [PRD](docs/prd-intent.md) · [SDD](docs/sdd-intent.md) · [Sitemap](docs/sitemap-intent.md) · [User Flow](docs/flow-intent.md) · [Idea Brief](docs/idea-intent.md)
- [PRODUCT.md](PRODUCT.md) · [design.md](design.md) · [apexhuman.md](apexhuman.md) (course context, not product truth)
- [CLAUDE.md](CLAUDE.md) — design invariants and verification commands
