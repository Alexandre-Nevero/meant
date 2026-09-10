# Round 6 — design notes

**Date:** 2026-09-10 · **Surface:** extension popup (`idle`, `running`) + companion + manifest · **Mode:** Operate

Refinement of the shipped round-5 surfaces. No new visual world, no new tokens, no new icon system.

---

## A. Custom-picker alignment fix

**Root cause, confirmed by reading the shipped code**: `.m-chip[data-chip-role="number"]` (the work/break inputs) sets `text-align: center` and `font-size`, but neither it nor the base `.m-chip` rule sets `line-height` — a `<input type="number">`'s default line-height doesn't vertically center against the chip's `padding: 8px 14px` the way a `<button>`'s text content does, so the digit sits visually high inside the pill. The two number-input chips also don't share an explicit `height` with the `until I stop`/`no cycles` button-chips beside them, so the row reads as slightly uneven.

**Fix** (`extension/meant.css`):
```css
.m-chip[data-chip-role="number"] {
  width: 56px;
  height: 34px;
  cursor: text;
  font-family: var(--m-figure);
  font-size: 12px;
  line-height: 1;
  text-align: center;
  color: var(--m-ink);
}
```
Add `height: 34px` to the base `.m-chip` rule too (currently unset, sized only by padding+content) so every chip in the popup — text or number — shares one explicit height and the row's outlines align on one baseline.

---

## B. Hover pill — closer to the reference, still on-brand

Current: `extension/companion-overlay.js`'s `[data-companion-hover-pill]` is a plain single-line text pill (`padding: 8px 14px`, `border-radius: 999px`, `border: 1px solid #C7C2BB`).

The reference image is a dark rounded card with bold title + muted subtitle + a status icon on the right. We have one line of real content (the intention), not two, and this product's explicit rule is no new icon system — so this is a **structural adaptation**, not a copy:

- Keep single-line text (no invented subtitle).
- Add a small leading dot using the existing `--m-clay` color — the same dot already drawn on the companion itself — as the pill's own "icon," reusing an existing visual element instead of inventing a new glyph.
- Increase padding slightly (`10px 16px`) and bump `font-size` to `14px` so it reads with more presence, closer to the reference's weight.
- Keep the fixed, non-theme-toggled colors exactly as already justified (contrast-critical over an arbitrary page background).

```css
[data-companion-hover-pill] {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms var(--m-ease);
  margin: 0;
  padding: 10px 16px 10px 14px;
  max-width: 240px;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid #C7C2BB;
  background: #F3F1EE;
  color: #14120F;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(20, 18, 15, 0.15);
}
[data-companion-hover-pill]::before {
  content: '';
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #C75B39; /* --m-clay, fixed for the same reason as the pill's other colors */
}
[data-companion-hover-pill] span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

`showHoverPill()` changes from `hoverPill.textContent = ...` to wrapping the text in a child `<span>` (so the `::before` dot and the truncating text span sit side by side in the flex row):
```js
hoverPill.replaceChildren(document.createElement('span'))
hoverPill.firstChild.textContent = currentSession.intention
```
(`hoverPill` itself is still the `<p data-companion-hover-pill>` — only its content construction changes from a plain text node to one child `<span>`.)

---

## C. Suppress native input decorations on the intention field

Current: `sentenceNode = el('input', 'm-field')` (in both `idle()`'s field and `running()`'s editable sentence) has no `spellcheck` attribute — Chrome defaults this to `true`, drawing a red squiggly under anything it doesn't recognize, and native double-click-to-select-word behavior applies like any plain text box.

Fix: add `sentenceNode.spellcheck = false` right after each `el('input', 'm-field')` construction (both `idle()`'s `field` and `running()`'s `sentenceNode` editable branch). This removes the red squiggly. Double-click-to-select-word is native browser text-selection behavior tied to being a real, editable `<input>` — it cannot be disabled without also breaking normal text editing (arrow keys, click-to-position-cursor, etc. all rely on the same underlying selection model), so the concrete, safe fix is exactly the `spellcheck` removal above, which is what was visually reading as "double-click artifacts" in the reference screenshot (the red dotted underline is Chrome's spellcheck marking, not a selection artifact).

---

## D. Live per-domain breakdown list during a running session

Current: `running()` already computes `segments` (via `withOpenSlice`/`toSegments`) purely to draw the SVG loop — the per-domain breakdown (`{domain, flex}` in seconds) is already known, just never rendered as text.

Add a row list, same visual vocabulary as the outcome screen's rows (`.m-row`/`.m-row-bar`/`.m-row-domain`/`.m-row-figure` — all already exist in `extension/meant.css`), placed after the phase line and before the blocked-domains section:

```js
const attentionRows = segments
  .filter((s) => s.kind.startsWith('attention'))
  .map((s) => {
    const row = el('div', 'm-row')
    const bar = el('span', 'm-row-bar')
    bar.dataset.kind = s.kind
    const domain = el('p', 'm-row-domain', s.domain)
    const figure = el('p', 'm-row-figure', `${Math.round(s.flex / 60)} min`)
    row.append(bar, domain, figure)
    return row
  })
```
Only rendered `if (attentionRows.length > 0)` — a session with zero real attention yet (fresh start) shows nothing here, same "don't invent data" discipline as the outcome band.

---

## E. "Blocking" list gets the same row treatment

Current: `blockedList = session.blockedDomains?.length ? el('p', 'm-meta', \`blocking: ${session.blockedDomains.join(', ')}\`) : null` — one plain sentence.

Blocked domains aren't attention-tracked data (they're static config, not measured time), so they get a plain neutral row, not a colored attention tint — reusing the row *shape* for visual consistency, not the attention *palette*:

```js
const blockedRows = (session.blockedDomains ?? []).map((domain) => {
  const row = el('div', 'm-row')
  const bar = el('span', 'm-row-bar')
  bar.dataset.kind = 'step-open' // neutral outline swatch, already exists, not an attention tint
  const label = el('p', 'm-row-domain', domain)
  row.append(bar, label)
  return row
})
const blockingLabel = session.blockedDomains?.length ? el('p', 'm-meta', 'blocking') : null
```
Rendered as `blockingLabel` followed by each row in `blockedRows`, replacing the single old `blockedList` paragraph. `.m-row-figure` is simply omitted for these rows (no time figure to show).

---

## F. Cold-start floor: 5% → 2%

One constant, `extension/popup.js`: `const MIN_ARC = 0.02 * L` (was `0.05 * L`). No other change — the same clamp-only-`shares[0]`, same cold-start-synthesize-one-arc behavior from round 5, just a smaller floor.

---

## G. Companion re-injects into already-open tabs without a manual refresh

**Root cause**: `content_scripts` in `manifest.json` only injects `companion-overlay.js` into a tab at that tab's own load time. Reloading the extension (dev iteration) or the extension auto-updating (in the wild) leaves already-open tabs running an orphaned, invalidated instance of the old script — Chrome will not re-run declarative `content_scripts` into a tab that's already loaded, by design.

**Real fix, not a workaround**: Chrome's `scripting` API lets a background script explicitly (re-)inject a content script into already-open tabs on demand. Add `chrome.runtime.onInstalled` (fires on both fresh install and every extension update/reload) and `chrome.runtime.onStartup` handling in `extension/sw.js` that iterates all open tabs and re-injects `companion-overlay.js` into each one eligible.

```json
// manifest.json — add "scripting" to the existing permissions array
"permissions": ["declarativeNetRequest", "tabs", "storage", "alarms", "idle", "scripting"],
```

```js
// extension/sw.js — new function + listener registration
async function reinjectCompanion() {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue
    // Only http(s) — chrome://, the Chrome Web Store, and other extensions' pages
    // reject scripting injection outright; skip them rather than let each one throw.
    if (!/^https?:\/\//.test(tab.url)) continue
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['companion-overlay.js'] })
    } catch {
      // A tab can still reject injection for reasons outside our control (a page that
      // navigated away between the query and the injection attempt, a permission the
      // user revoked for one origin) — skip it, don't let one tab's failure stop the rest.
    }
  }
}
chrome.runtime.onInstalled.addListener(reinjectCompanion)
chrome.runtime.onStartup.addListener(reinjectCompanion)
```

**A real duplicate-mount risk this must guard against**: a tab that was opened AFTER the extension's current version was already running (i.e., the declarative `content_scripts` entry already injected it normally) must not get a SECOND copy injected on top when `reinjectCompanion` also runs (e.g. `onStartup` firing because the browser itself restarted, not because the extension changed) — two copies of `companion-overlay.js` in the same tab would create two competing `hostEl`s. `companion-overlay.js` already has a natural guard for this: `ensureMounted()` no-ops if `hostEl` is already set — but that guard lives in *module-scope state*, which a **second, independent execution** of the whole script does not share (each `executeScript` call gets its own fresh module scope). The real guard must be in the page's own DOM: check for the host element's own marker attribute before mounting a second one.

Add, as the very first lines of `companion-overlay.js` (before any of its existing module-scope `let` declarations):
```js
// A second injection of this same script (from reinjectCompanion(), e.g. after a
// browser restart re-runs onStartup on a tab this exact version already mounted into
// normally) must not create a second host element. This check has to live in the DOM,
// not in this module's own scope — a fresh chrome.scripting.executeScript() call gets
// a fresh module scope every time, so a module-level guard would never see the first
// injection's state.
if (document.documentElement.querySelector('[data-meant-companion]')) {
  // Already mounted by an earlier injection of this exact script — stop here.
  throw new Error('meant-companion-already-mounted')
}
```
(A thrown error at the top level of a content script simply stops that script's execution; it doesn't propagate anywhere harmful, and `chrome.scripting.executeScript`'s own promise still resolves normally — this is the standard, documented pattern for an idempotent injectable script.)

---

## Scope boundaries

Not touched: the outcome screen (already correct from round 5), the timer loop's geometry/segment algorithm itself (only the floor constant changes), the web app.
