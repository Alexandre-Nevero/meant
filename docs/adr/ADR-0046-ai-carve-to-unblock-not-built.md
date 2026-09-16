# ADR-0046 — AI may only *unblock*, never block — designed, not built

- **Date:** 2026-09-04
- **Status:** Proposed, never implemented (confirmed 2026-09-11: no `app/api/carve/route.ts` exists, no AI Gateway/model integration exists anywhere in `app/`)
- **Context:** The starting block set is everything the user has ever called a distraction. A model narrowing that set to what's actually relevant to today's sentence was proposed as a differentiator — but a model that could *add* a block is dangerous: a wrong label costs a wrong review line (fixable in one tap), while a wrong block stops a needed page loading mid-session with no take-back — the failure mode that gets an extension uninstalled.
- **Decision (as designed, not shipped):** The model's only power would be to *carve out* (unblock) domains relevant to today's sentence from both the built-in and the user's own lists — always subtractive, never additive.
- **Consequences:** As designed, this is the one point where the cut AI stack (see ADR-0033, PRD amendment 0.2c) would touch blocking directly — worth keeping subtractive-only if it's ever built, given the asymmetric cost of a wrong block vs. a wrong label.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D40")
