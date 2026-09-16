# ADR-0034 — Away is detected by chrome.idle, not window focus

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** Window-focus-based away detection misfires: a user watching a long video in a background-but-audible tab isn't "away," but naive focus tracking would file it that way.
- **Decision:** Use `chrome.idle` for away detection (adds no install warning — it's a standard permission). Refinement: idle while the foreground tab is `audible` still counts as attention on that domain, not away.
- **Consequences:** Filing a 40-minute video as "away" would have been a visible, credibility-destroying lie the first time a user noticed it.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D27"), `extension/sw.js`
