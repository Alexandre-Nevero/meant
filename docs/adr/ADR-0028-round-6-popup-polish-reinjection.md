# ADR-0028 — Round 6: popup refinement and companion re-injection

- **Date:** 2026-09-10
- **Status:** Accepted (shipped)
- **Context:** A refinement pass over round-5 surfaces — no new visual world, no new tokens, no new icon system. Several small shipped bugs and one real architectural gap (companion orphaned in already-open tabs after an extension reload/update) needed fixing.
- **Decision:**
  - Number-input chips (work/break duration) get explicit `height`/`line-height` so digits center against the pill the same way button-chips do.
  - The companion's hover-reveal pill gains a small leading dot (reusing the existing `--m-clay` dot already drawn on the companion itself, not a new icon) and slightly heavier padding/font-size, closer to a supplied reference without inventing new iconography.
  - The intention `<input>` gets `spellcheck = false` to kill Chrome's red squiggly, which was misread as a selection artifact; double-click-to-select-word is native `<input>` behavior and is not disabled (would break normal text editing).
  - The running popup gains a live per-domain attention breakdown and a "blocking" row list, reusing the existing `.m-row`/`.m-row-bar` vocabulary already used elsewhere — no new visual language.
  - Cold-start arc floor drops from 5% to 2% (`MIN_ARC` in `extension/popup.js`).
  - `chrome.scripting.executeScript` re-injects `companion-overlay.js` into already-open tabs on `onInstalled`/`onStartup` (Chrome does not re-run declarative `content_scripts` into a tab that's already loaded). A DOM-level marker guard (`[data-meant-companion]`) prevents a double-mount when a tab already carries a normally-injected instance — this guard has to live in the DOM, not module scope, since a fresh `executeScript` call gets a fresh module scope every time.
- **Consequences:** No behavior change to the AI stack (still entirely unbuilt, see `docs/prd-intent.md` §6). The `scripting` permission was added to `manifest.json` to support re-injection.
- **Source:** `docs/superpowers/specs/2026-09-10-round-6-design-notes.md`, `docs/superpowers/plans/2026-09-10-popup-round-6.md`
