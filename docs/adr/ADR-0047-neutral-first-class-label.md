# ADR-0047 — neutral is a first-class label, distinct from unknown

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** Forcing every domain into a binary work-or-drift classification produces bad data for domains that are genuinely neither (a bank site, a two-minute personal email) — and bad data poisons the memory that gates the judge (I4).
- **Decision:** `neutral` means "genuinely neither"; `unknown` means "could not tell" — two distinct states, not one fallback. A declared `neutral` domain never signals and is never judged again.
- **Consequences:** In-session correction for a wrongly-flagged domain stays two taps (only ever correcting a flag that fired); the review offers a third option (neutral) since it has more room and less urgency.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D41"), `event.label`/`judgment.label`
