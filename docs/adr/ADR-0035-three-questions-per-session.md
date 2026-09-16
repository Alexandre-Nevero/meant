# ADR-0035 — Three chip-driven questions per session

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** A single free-text intention field can't resolve the product's own defining case (same hostname, work at 4pm, drift at 11am) without knowing what "work" and "distraction" mean *for this session*.
- **Decision:** Ask three questions every session — intention, "where it happens" (work sites), "what pulls you away" (distraction sites) — each pre-selected from chips based on the previous session's picks. Reverses an earlier single-field design: asking "where it happens" up front resolves ambiguity before the first wrong flag, where a mid-session correction only recovers from one.
- **Consequences:** More popup friction than a single field, traded for resolving the Instagram-at-11am-vs-4pm case without waiting for a correction.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D28"), `extension/popup.js`
