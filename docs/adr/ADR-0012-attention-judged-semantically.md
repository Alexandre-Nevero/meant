# ADR-0012 — Attention is judged semantically against the current task

- **Date:** 2026-08-28
- **Status:** Accepted (requirement) — **not yet built as of 2026-09-10**; see `docs/index.md` D25 for the mechanical stand-in currently shipped instead
- **Context:** The 0.1 product could not answer its own defining example: the same hostname is work at 4pm and drift at 11am. A hostname-only blocklist can't resolve that; reading the tab against the stated intention can.
- **Decision:** Attention is judged against the current task/intention, not a static blocklist. This is what "the judge" (PRD-F9) is.
- **Consequences:** Forced the 0.1 "no AI" position (`docs/prd-intent.md` §6.1) to reverse. Real, still-open cost: this is the single largest unbuilt piece of the product as of this date.
- **Source:** `docs/prd-intent.md` PRD-F9, §6
