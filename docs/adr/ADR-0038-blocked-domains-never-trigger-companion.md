# ADR-0038 — Blocked domains never trigger the companion

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** A blocked domain already gets its own response (the block page). Having the companion *also* signal drift for a domain that's already blocked is redundant and was an inverted-logic bug in an earlier version (FP4).
- **Decision:** The companion's drift signal explicitly excludes any domain already on the session's blocklist.
- **Consequences:** Repairs the FP4 inverted-logic bug; the block page and the companion never double-speak about the same domain.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D31"), `extension/sw.js`
