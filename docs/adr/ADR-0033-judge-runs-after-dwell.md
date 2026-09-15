# ADR-0033 — The judge runs after dwell, not on tab change

- **Date:** 2026-09-04
- **Status:** Accepted — shipped, but see ADR-0038's note: no real model call exists yet, this governs the mechanical stand-in's timing
- **Context:** SDD §4.2 originally specified tab-change → memory → judge, immediately. Judging or signalling on every tab flicker is noisy and expensive.
- **Decision:** Requires 20 seconds of foreground time before a domain is judged or signalled (`DWELL_MS` in `lib/thresholds.ts`). Provisionally answers `flow` Q3 with "no."
- **Consequences:** A domain visited for under 20s never gets judged or flagged — deliberate, not a bug. This ADR and D26-D42 sat only in a 153KB plan file for a week before being recorded here (2026-09-11 doc audit) — see `docs/prd-intent.md` amendment 0.2c.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D26"), `lib/thresholds.ts`
