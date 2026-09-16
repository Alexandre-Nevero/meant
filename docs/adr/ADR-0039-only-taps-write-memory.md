# ADR-0039 — Only user taps write memory; judge verdicts are session-scoped

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** If every verdict (mechanical or, later, model-produced) wrote to long-lived memory, a single noisy session could permanently mislabel a domain.
- **Decision:** A verdict only affects the current session. Only an explicit user tap (a correction) writes to the `memory` table.
- **Consequences:** Memory accumulates only from real, human-confirmed signal — never from a single unreviewed automated guess, mechanical or model-based.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D32"), `memory` table (`lib/migrations/002-drift.sql`)
