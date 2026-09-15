# ADR-0044 — event gains a label column

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** Rendering `youtube.com — 2 min work, 15 min drift` in the live band (ADR-0049) needs to know which classification was in force when each attention slice closed — seconds alone don't carry that.
- **Decision:** Add `event.label` (`work` | `distract` | `neutral` | `unknown`). A label is one word from the product's own classifier, not page content — hostname-only storage (ADR-0008) still holds.
- **Consequences:** Enables the live per-domain band (ADR-0049) and per-domain breakdown UI without adding any new sensitive data to storage.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D37"), `lib/migrations/002-drift.sql`
