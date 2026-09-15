# ADR-0043 — Standing-list management as a full extension page — designed, not built

- **Date:** 2026-09-04
- **Status:** Proposed, never implemented (confirmed 2026-09-11: no `lists.html` exists in `extension/`)
- **Context:** `docs/sitemap-intent.md` §8 says standing-list management "lives in the popup." A forced departure was identified: `chrome.permissions.request({origins})` called from a popup was reported to hang, which would block granting a user-added domain the host permission it needs to actually block.
- **Decision (as designed, not shipped):** Free list *editing* (add/remove domains from the standing list) stays in the popup; only the one-time *permission grant* that lets a newly user-added domain actually block would redirect to a dedicated extension page (`lists.html`).
- **Consequences:** This gap is real and open — standing-list permission granting for user-added domains may not work as originally designed. Recorded here so it isn't mistaken for shipped; needs verification against current `extension/popup.js` behavior before relying on it.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D36")
