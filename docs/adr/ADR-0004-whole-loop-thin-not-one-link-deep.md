# ADR-0004 — Ship the whole loop thin, rather than one link deeply

- **Date:** 2026-08-18
- **Status:** Accepted
- **Context:** The product's value claim is the *loop* (declare → protect → observe → review), not any single link in it. Building one link to a polished depth first would ship something that can't demonstrate the actual value proposition.
- **Decision:** Every phase of the loop (start, during, review) ships a thin, working version together, rather than building block-and-protect deeply before touching review.
- **Consequences:** Nothing in v1 is deep, but the whole thesis is testable from the first build. Later rounds (companion, timer, blocking UI — ADR-0026 onward) deepen individual links without changing this shape.
- **Source:** `docs/prd-intent.md`
