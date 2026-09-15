# ADR-0040 — The judge's session cache is keyed per visit, not per domain

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** An earlier version cached a verdict per domain for the whole session — meaning a domain cleared as "work" early on would stay cleared even if the user returned to it for a completely different reason later.
- **Decision:** Cache per *visit* instead. Concretely: 15 minutes of anime clips on YouTube late in a session is judged fresh, not silently waved through because YouTube was cleared as work 25 minutes earlier.
- **Consequences:** Slightly more re-evaluation than a per-domain cache, in exchange for not letting an early clearance become a blanket pass for the rest of the session.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D33"), `extension/sw.js`
