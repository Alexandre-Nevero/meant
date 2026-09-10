# ADR-0018 — Numbered migrations replace hand-applied schema.sql

- **Date:** 2026-08-28
- **Status:** Accepted
- **Context:** Hand-applying `schema.sql` was defensible for a four-hour build with no persistent data. Once memory (PRD-F11) outlives the sessions that produced it, an unversioned schema becomes a real data-safety risk.
- **Decision:** Schema changes go through numbered, ordered migrations from this point on.
- **Consequences:** Slightly more ceremony per schema change; in exchange, the schema's history is reconstructable and a bad migration is revertible.
- **Source:** `docs/sdd-intent.md` §3.2
