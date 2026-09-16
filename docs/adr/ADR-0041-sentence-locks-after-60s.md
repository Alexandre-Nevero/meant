# ADR-0041 — The intention sentence locks after 60 seconds

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** An editable-forever intention sentence makes "what was I judged against" ambiguous after the fact, and could be gamed retroactively.
- **Decision:** The draft window equals the grace window (60s, N8). After that, the sentence locks; changing intention mid-session starts a new session, marked `superseded` rather than silently mutating the old one.
- **Consequences:** A `superseded` session becomes answerable from the dashboard rather than silently landing as `unanswered` — the outcome ledger stays honest about what happened to it.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D34"), `extension/popup.js`
