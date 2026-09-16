# ADR-0036 — "What pulls you away" is asked at setup, not seeded from browsing history

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** `chrome.topSites` could pre-seed a distraction list automatically, but that reads browsing history the user hasn't explicitly volunteered.
- **Decision:** Ask directly at setup instead. The first review additionally offers to add a site to the distraction list, with evidence attached — the one surface the product is allowed to speak on (I2).
- **Consequences:** Slightly more setup friction, in exchange for never silently reading history the user didn't hand over.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D29"), `extension/popup.js`
