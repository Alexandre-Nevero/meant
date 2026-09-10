# ADR-0019 — Teaching tiers are an architectural rule, not a lesson plan

- **Date:** 2026-08-28
- **Status:** Accepted
- **Context:** A beginner rebuilds a T1 subset of the product and pastes the rest (T2/T3, `apexhuman.md` §6). If judge/companion/memory/coach don't come apart cleanly from the mechanical core, the manual literally cannot exist.
- **Decision:** I9 — every feature above the mechanical loop (judge, companion, memory, coach) must be independently removable, in any combination, without the product breaking or becoming not-worth-using.
- **Consequences:** This is why `docs/index.md` D25's mechanical drift stand-in was possible at all — the judge's seam had to exist before the judge did, by construction, for the companion to ship without it. Every seam must be exercised, not merely asserted.
- **Source:** `docs/prd-intent.md` I9, §9
