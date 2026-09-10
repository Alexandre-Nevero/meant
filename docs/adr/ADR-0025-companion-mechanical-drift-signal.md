# ADR-0025 — Companion ships with a mechanical drift signal instead of the judge

- **Date:** 2026-09-01
- **Status:** Accepted — explicitly a placeholder, not a step toward PRD-F9 (see `docs/prd-intent.md` §6 status note added 2026-09-10)
- **Context:** No `task`/`judgment`/`memory` tables and no model exist yet in this pass. Shipping the companion (I9's seam) required something to drive its drift state without the judge.
- **Decision:** `extension/sw.js#updateCompanion` flags drift when the active tab's domain is a member of any known distraction category (`blocklists.js`) that the session didn't itself choose to block — a hostname-category check, no model in the path.
- **Consequences:** Exercises the judge's seam by construction, not assertion (I9) — proves the companion can run judge-off. Must be removed, not extended, once the real judge (ADR-0012) ships; conflating the two would quietly misrepresent what the product can currently tell.
- **Source:** `docs/sitemap-intent.md` S9, Q2, Q3; `docs/flow-intent.md` Q2; `docs/prd-intent.md` I9
