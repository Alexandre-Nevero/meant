# ADR-0049 — The running popup's live band shows time-by-site, never marks drift

- **Date:** 2026-09-04 (shipped as part of round 6, ADR-0028)
- **Status:** Accepted
- **Context:** `docs/design-toolkit.md` §2 and `PopupRunning.dc.html` had already specified a growing band in the running popup ("a thin band grows beneath it; the remainder is a dashed edge") — it was never built because `popup.js` had no per-domain data to draw it from. `event.label` (ADR-0044) supplied that data.
- **Decision:** Wire the band from a local tally in `chrome.storage.local` — no network call. It shows attention time by site; it does not mark or highlight drift. Drift marking stays review-only, per I2 and `docs/design.md` §7 ("nothing good happens on screen during a session" cuts both ways — nothing alarming does either, mid-session).
- **Consequences:** Closes a gap between the approved design canvas and shipped code that had existed since the canvas was drawn. Implemented concretely in round 6 — see ADR-0028's "live per-domain attention breakdown."
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D42"), `extension/popup.js`
