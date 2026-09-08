# Design — Companion size/hover pill, popup timer loop, nav icons, chip density, tracking bug

**Date:** 2026-09-08 · **Traces to:** direct real-browser feedback, round 4.

Six items bundled into one design/plan, following the same batching pattern as the three
prior rounds. One is a concrete bug fix (no design decision needed); five are visual/UX
refinements of already-shipped surfaces. Everything below is grounded in code read this
session, not assumed.

## 0. The tracking bug — root cause found, ready to fix, no design ambiguity

**Problem.** Two real-browser complaints — a known-junk domain (`emnalgngpciahekjdcgpbgnhmkpjhlhi`,
a Chrome extension ID) still showing on a review page, and other real tabs the user visited
not appearing — trace to the same root cause, confirmed by reading both files directly:

- `lib/band.ts`'s `toBand()` got an extension-ID-shape exclusion filter in the prior round
  (round 3). It feeds the colored **band** only.
- `lib/review-data.ts`'s `getReviewData()` computes `topAttention` — the actual per-domain
  **rows** rendered with names and minutes — via a completely separate query, with zero
  filtering: `rows.filter((r) => r.kind === 'attention' && r.domain).slice(0, 3)`. This is
  what `app/review/[sessionId]/page.tsx` maps over to render the visible domain list.

The junk row was never excluded from the list a user actually reads — only from the
aggregate bar above it. Because `topAttention` caps at the top 3 domains by time (the SQL
query already sorts by `seconds desc`), and the junk row was competing for one of those 3
slots, fixing this should surface a real domain that's currently being crowded out —
explaining both complaints with one fix.

**Fix.** Add the same extension-ID-shape guard (`/^[a-p]{32}$/`, anchored both ends —
already proven correct and tested in `lib/band.ts`) to `getReviewData()`'s `topAttention`
filter. No new validation concept; reuse the exact regex already shipped, imported from
`lib/band.ts` rather than redeclared, so the two call sites can never drift out of sync
again. `lib/band.ts`'s `const EXTENSION_ID_SHAPE = /^[a-p]{32}$/` is currently module-
private — add `export` to its declaration (a one-word change, no behavior difference for
`toBand()` itself) so `lib/review-data.ts` can `import { EXTENSION_ID_SHAPE } from
'./band'` rather than copy-pasting the pattern a second time.

## 1. Companion size

**Resolved directly with the user**, after flagging a real conflict: `PRODUCT.md` itself
(canonical, higher authority than any prior code change) states the companion should read
"at 28px, not 80–120px... a small, ambient presence, not a focal element competing with
the page underneath it." The reference image implied a much larger scale. Resolution: stay
well under the 80px ceiling PRODUCT.md protects, while still delivering a real, felt
increase from the 36px shipped last round.

**Fix.** `SIZE` in `extension/companion-overlay.js` goes from `36` to `52` — a genuine
jump (+44% from last round, +86% from the original 28px), but nowhere near the
80–120px range PRODUCT.md explicitly rules out. All positioning math (`positionHost`,
`onDrag`, `endDrag`) already derives from the `SIZE` constant — no other change needed for
the size itself.

## 2. Companion hover-reveal intention pill

**Problem.** The only way to see the companion's current intention today is a plain HTML
`title` attribute — the native browser tooltip, slow to appear (~1s OS-level delay),
completely unstyled, and inconsistent across Chrome/Edge. The reference image shows a real,
styled pill appearing on hover.

**Fix.** A new Shadow DOM element, `hoverPill` — a sibling of `dot-wrap` inside the same
shadow root, hidden by default (`opacity: 0; pointer-events: none`), shown on
`pointerenter`/hidden on `pointerleave` of `dot-wrap` (not the whole host, so dragging
doesn't fight with the hover state).

**Trigger:** hover only, no click. A 150ms show-delay (`setTimeout`, cleared on
`pointerleave` before it fires) prevents flicker from a fast mouse pass-over — this
matches how a native tooltip already feels, just faster and styled. Hide is instant (no
delay) so it never lingers after the user has moved on.

**Position:** absolutely positioned relative to `:host`, `bottom: calc(100% + 8px)` by
default (pill above the dot, an 8px gap), horizontally centered
(`left: 50%; transform: translateX(-50%)`). On show, measure
`hoverPill.getBoundingClientRect()` against `window.innerWidth`/`window.innerHeight`: if it
would clip past the left or right edge, shift it just enough to stay on-screen (adjust
`transform: translateX(...)` by the clipped amount, don't re-anchor to a different side);
if it would clip past the TOP of the viewport (the companion is near the top of the page),
flip to `top: calc(100% + 8px)` (pill below the dot) instead. This mirrors the existing
`positionHost()` function's own style — measure real geometry, don't guess.

**Panel styling — fixed colors, not theme-dependent.** This is the single most important
constraint, learned the hard way in this exact file last round: `prefers-color-scheme`
reflects the user's OS setting, not the actual background of whatever page the companion
floats over. The dot's own fix removed all `prefers-color-scheme` dependency from anything
contrast-critical. The hover pill must not reintroduce that mistake — unlike a dot that can
get away with one accent color, a text pill needs real contrast against arbitrary,
unpredictable page content behind it, so:
- Background: a fixed, opaque `#F3F1EE` (the *light* value of `--m-ground`, hardcoded, not
  toggled by `@media (prefers-color-scheme: dark)`) — always the same warm cream card,
  regardless of system theme or page background. An opaque fill is required here (unlike
  the dot, which is a single small shape); a page-colored or semi-transparent pill would be
  illegible against arbitrary busy content.
- Text: fixed `#14120F` (light `--m-ink`) on that fixed background — always this exact
  pair, never swapped.
- A shadow for contrast insurance against a light-colored page directly behind it:
  `box-shadow: 0 2px 8px rgba(20, 18, 15, 0.15)` (a fixed rgba built from the same fixed
  ink value, not a theme-toggled token).
- Border: `1px solid` a fixed light `--m-edge` (`#C7C2BB`), matching this pill's role as a
  small card, not a stroked outline like `.m-sentence`.

**Shape and type**, matching this product's existing sentence-pill *idea*, scaled down for
a small hover element rather than reusing `.m-r-field`'s 26px (proportioned for the popup's
76px-tall field, wrong scale here): `border-radius: 999px` (this file's Shadow DOM already
redeclares `--m-clay`/`--m-ground` as custom properties rather than importing
`design/tokens.css`'s class-based radii, so add a fixed `999px` literal here, matching
`--m-r-chip`'s value without needing the token itself), `padding: 8px 14px` (matching
`.m-chip`'s own padding scale), `font-family: 'Fraunces', Georgia, serif` (matching
`.m-sentence`'s display face — this file already loads no web fonts of its own since it's a
content-script Shadow DOM with `all: initial`, so fall back through the same generic stack
the rest of this file's CSS already assumes), `font-size: 13px`, `white-space: nowrap`,
`max-width: 240px` with `overflow: hidden; text-overflow: ellipsis` for a very long
intention sentence (never let the pill grow wider than a small fraction of a typical
viewport).

**Content and edge cases:** if `session.intention` is empty or falsy, never show the pill
at all on hover (skip the whole show/measure/position sequence) — nothing meaningful to
display. The `title` attribute currently set on `dot` (`dot.title = session.intention || ''`)
stays as a native fallback (costs nothing, helps a keyboard/assistive-tech user who can't
hover), it is not replaced, only supplemented.

**Motion:** a plain opacity fade only (no scale, no slide) — `transition: opacity 150ms
var(--m-ease)` — and the existing blanket `@media (prefers-reduced-motion: reduce) { * {
animation: none !important; transition: none !important } }` rule already in this file
covers it with zero additional code (it's a `transition`, and that rule already zeroes
every transition in this file).

**Exact construction, mirroring this file's own `ensureMounted()`/`positionHost()` style**:

```javascript
let hoverPill = null
let hoverTimer = null

// Called once from ensureMounted(), alongside dot/ring/core construction.
function buildHoverPill(shadow) {
  hoverPill = document.createElement('p')
  hoverPill.className = '' // no class — Shadow DOM styling is all attribute/tag-scoped here
  hoverPill.dataset.companionHoverPill = 'true'
  shadow.append(hoverPill)
}

function showHoverPill(session) {
  if (!session?.intention) return
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    hoverPill.textContent = session.intention
    hoverPill.style.opacity = '1'
    hoverPill.style.bottom = 'calc(100% + 8px)'
    hoverPill.style.top = ''
    hoverPill.style.left = '50%'
    hoverPill.style.transform = 'translateX(-50%)'
    // Measure after it's laid out, then correct for viewport clipping.
    requestAnimationFrame(() => {
      const rect = hoverPill.getBoundingClientRect()
      if (rect.top < 0) {
        hoverPill.style.top = 'calc(100% + 8px)'
        hoverPill.style.bottom = ''
      }
      const overflowRight = rect.right - window.innerWidth
      const overflowLeft = -rect.left
      if (overflowRight > 0) hoverPill.style.transform = `translateX(calc(-50% - ${overflowRight}px))`
      else if (overflowLeft > 0) hoverPill.style.transform = `translateX(calc(-50% + ${overflowLeft}px))`
    })
  }, 150)
}

function hideHoverPill() {
  clearTimeout(hoverTimer)
  hoverPill.style.opacity = '0'
}

// Registered alongside the existing pointerdown/pointermove/pointerup listeners on
// `dot` (dot-wrap), in ensureMounted():
dot.addEventListener('pointerenter', () => showHoverPill(currentSession))
dot.addEventListener('pointerleave', hideHoverPill)
```

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
  padding: 8px 14px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid #C7C2BB;
  background: #F3F1EE;
  color: #14120F;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(20, 18, 15, 0.15);
}
```

`currentSession` above stands in for whatever this file's existing `render()`/`applyState()`
flow already threads through as the current session object — wire this to the same source
`dot.title = session.intention || ''` already reads from today, not a new storage read.

## 3. Running popup's intention pill — the outline as a static segmented loop

**Problem (refining what round 3 shipped).** The pill currently has a single 3px strip
along its BOTTOM edge only, showing elapsed/remaining as a two-segment fill. Feedback wants
the FULL outline (the pill's actual perimeter) to carry this signal, not just one edge —
using this product's own already-established segment vocabulary (`--m-clay` solid =
elapsed, dashed = remaining), traced around the pill's real shape rather than a separate
flat strip.

**Already resolved, do not re-litigate:**
- Stays fully static — recomputed only on the popup's own natural re-render, never a live
  tick. `docs/design-toolkit.md`'s explicit refusals ("a Pomodoro dial," "a progress ring,"
  "a countdown that ticks") are why this was a real, deliberate tension the first time this
  surface was built, and remain the reason it's static now — this loop uses the exact same
  already-approved segmented-bar convention this product uses everywhere else (the review
  page's band, the dashboard's ledger rows), just traced around a full perimeter instead of
  one flat strip. It is not a new circular dial; it's the same static, data-driven segment
  language this product has used since round 2, in a new shape.
- When a work/break cycle is configured, the loop's position is `elapsedMs % cycleMs` —
  the exact modulo arithmetic `cyclePhase()` already computes for the phase text today.
  This is *why* an "indefinite" (no fixed session end) timer already "just starts over" for
  free: the modulo naturally wraps every cycle length regardless of whether the overall
  session has a planned end at all. No new logic needed for this — only the rendering
  technique changes, not `cyclePhase()` itself.
- When no cycle is configured at all, there's no natural period to loop against, so the
  pill shows a plain, unsegmented, static outline — exactly today's non-progress
  `[data-timer-pill]` appearance. Nothing new invented here either.

**Why a CSS border can't do this** (confirmed against this exact file already): the pill
wraps either a real `<input>` (which cannot contain child DOM nodes — rules out the
existing `.m-mark:not(:empty)` child-span technique living *inside* the field) or a `<p>`;
and CSS `border-image` does not combine reliably with `border-radius` across browsers —
already a confirmed blocker when the bottom-edge-strip version was built.

**Fix — an SVG stroke around the wrapper, not a CSS border.** Move the pill's visible
outline off `[data-timer-pill]`'s CSS `border` property entirely and onto an absolutely
positioned `<svg>` sibling of the intention field, inside the same wrapper:

```javascript
// Inside running(), where pillWrap and the phase-fill construction already live:
const pillWrap = el('div')
pillWrap.dataset.timerPill = 'true'
pillWrap.append(sentenceNode)

if (phase) {
  // Measure the real rendered box — the pill's height varies with intention text length
  // (it can wrap to two lines), so this can't be a fixed viewBox computed ahead of time.
  // Deferred to a microtask so layout has actually happened before we measure it.
  requestAnimationFrame(() => {
    const { width, height } = pillWrap.getBoundingClientRect()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;'

    const r = 26 // matches --m-r-field's existing 26px corner radius — the pill's shape
                 // doesn't change, only how its outline is drawn
    function track(strokeColor) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', '0.75'); rect.setAttribute('y', '0.75')
      rect.setAttribute('width', String(width - 1.5))
      rect.setAttribute('height', String(height - 1.5))
      rect.setAttribute('rx', String(r)); rect.setAttribute('ry', String(r))
      rect.setAttribute('fill', 'none')
      rect.setAttribute('stroke', strokeColor)
      rect.setAttribute('stroke-width', '1.5')
      return rect
    }

    const remainder = track('var(--m-edge)')
    remainder.setAttribute('stroke-dasharray', '3 3') // the existing dashed "remainder" look
    const elapsed = track('var(--m-clay)')
    svg.append(remainder, elapsed)
    pillWrap.append(svg) // after the field, so it draws on top of the (now-borderless) box

    // getTotalLength() gives the SVGGeometryElement's real, exact rendered perimeter for
    // THIS specific rounded-rect — no manual perimeter formula to get subtly wrong.
    const perimeter = elapsed.getTotalLength()
    const elapsedFraction = phase.elapsedInPhaseMs / phase.phaseMs
    elapsed.setAttribute('stroke-dasharray', `${perimeter * elapsedFraction} ${perimeter}`)
  })
}
```

`[data-timer-pill]` keeps its plain CSS `border: var(--m-stroke) solid var(--m-ink);
border-radius: var(--m-r-field);` as the DEFAULT appearance (matching today's no-cycle
case exactly) — the SVG overlay only gets added when `phase` exists, and when it's present,
`[data-timer-pill]`'s own CSS border is suppressed (`border: none` added to the same
`[data-timer-pill]` rule, conditioned on a `[data-timer-pill]:has(svg)` selector, or
simpler: add the `border: none` directly via a `pillWrap.style.border = 'none'` at the same
point the SVG gets appended — either works, pick whichever reads more naturally against the
existing code once actually writing it).

`sentenceNode`'s own CSS border stays suppressed exactly as round 3 already shipped
(`[data-timer-pill] > .m-field, [data-timer-pill] > .m-sentence { border: none; }`) — this
part is unchanged.

The `remainder` track's `stroke-dasharray: 3 3` is a small, fixed dash pattern reused as-is
from what a dashed SVG stroke naturally renders — this is a deliberate, minor deviation
from `.m-row-bar[data-kind="remainder"]`'s own CSS dashed-border rendering (browsers dash
borders and SVG strokes with different underlying mechanisms; matching the *look* is what
matters, not the literal CSS property), and should be visually confirmed to read as the
same "remainder" language during implementation's required screenshot check.

**Focus-outline check carries over unchanged**: round 3 already verified `:focus-visible`
isn't clipped by the wrapper — confirm this is still true with the SVG in place (it uses
`pointer-events: none` specifically so it never intercepts clicks/focus, and sits at
`position: absolute; inset: 0` without `overflow: hidden` on the wrapper this time, since
the border-suppression approach no longer needs to clip anything).

## 4. Popup top-right nav icons

**Problem.** `navRow()` currently renders "History" and "meant.app" as two full-width
`.m-btn[data-variant="quiet"]` text buttons, appended last in every state's `show(...)`
call — so they render at the very bottom of the popup, after everything else. Feedback
wants them relocated to the top-right, as icons rather than full-width text buttons.

**Icon choice — reuse the mark, not a new icon system.** `PRODUCT.md`'s own accessibility
section is explicit: *"MEANT has exactly one icon system: the mark... There is no icon
library in this project and none should be added for the product's own chrome."* Importing
Phosphor/Heroicons-style icons for these two buttons would be exactly the mismatch that
rule refuses. Two different, deliberate choices instead:

- **History** → the *existing* `.m-mark[data-state="ended"]` glyph itself (the same small
  decorative capsule-gradient mark already used everywhere a completed/past session is
  represented) as the button's icon. This is not a new visual language — it's the one
  icon this product already has, reused for exactly the concept ("past sessions") it
  already represents everywhere else.
- **meant.app** → a single, hand-drawn external-link glyph (arrow exiting a box),
  matching the ONE other place this codebase draws a custom SVG glyph
  (`app/page.tsx`'s beat-arrow: `stroke="currentColor" stroke-width="1.5"
  stroke-linecap="round" stroke-linejoin="round" fill="none"`), so the stroke style is
  consistent with existing precedent rather than inventing a new one:

  ```html
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M6 2H2v10h10V8M8 2h4v4M12 2 6 8" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  ```

Both buttons become icon-only, so each needs a real accessible name (`aria-label`) since
the visible text is gone — `aria-label="View session history"` /
`aria-label="Open meant.app"` — matching the exact rule `PRODUCT.md`'s own accessibility
section already states for this precise situation (decorative icon + no visible text
label → a real text alternative, not just `aria-hidden`).

**Layout — a new header row, no new class.** The popup has no existing header structure
today; every state's first element is the plain `mark` glyph with nothing wrapping it. Add
a plain wrapper `<div>` (no class — attribute-based only, per the frozen contract) around
`mark` and the two icon buttons:

```javascript
const header = el('div')
header.dataset.popupHeader = 'true'
header.append(mark, navRow())
```

Both `idle()` and `running()` build this same `header` in place of the bare `mark` they
build today, and both drop `navRow()` from the end of their own `show(...)` call (it now
lives inside `header` instead). Every other argument in each function's existing
`show(...)` call is unchanged and keeps its existing order — only the first argument
changes, from `mark` to `header`, and the trailing `navRow()` argument is deleted:
- `idle()`: `show(mark, label, field, duration.row, cycle.row, cycle.customRow,
  siteCluster, start, disconnect, navRow())` becomes
  `show(header, label, field, duration.row, cycle.row, cycle.customRow, siteCluster,
  start, disconnect)`.
- `running()`: `show(mark, pillWrap, ...(phaseLine ? [phaseLine] : []), elapsed,
  ...(blockedList ? [blockedList] : []), stop, navRow())` becomes `show(header, pillWrap,
  ...(phaseLine ? [phaseLine] : []), elapsed, ...(blockedList ? [blockedList] : []),
  stop)` — `pillWrap` (item 3's wrapper, already holding `sentenceNode`) is unaffected by
  this change, since it was already the second `show(...)` argument, not `mark` itself.

```css
[data-popup-header] {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
[data-popup-header] .m-chip-row { gap: 8px; } /* navRow()'s own row, tightened for two
                                                  small icon buttons instead of two
                                                  full-width ones */
[data-popup-header] .m-btn {
  width: auto;
  padding: 8px;
}
```

`navRow()` itself needs no internal change — its two buttons already exist, this only
changes where the row is mounted and how it's styled via the new ancestor attribute
selector (matching the exact pattern `[data-surface="popup"] .m-field` already uses
elsewhere in this file to override a base rule for one context).

## 5. Chip density in the idle popup

**Problem.** Direct feedback that the idle popup has "too many pills, unintuitive,"
specifically calling out the cycle-preset row (25/5, 50/10, custom, no cycles — four
chips in one row).

**Fix — grouping and spacing, not a new interaction pattern.** Two changes, both reusing
patterns already established in this exact file, no new CSS concepts:
- Moving `navRow()` to the header (item 4) already removes two full-width buttons from the
  bottom of the idle view — a real, if incidental, density reduction, worth noting rather
  than double-counting as a separate fix.
- Apply the *existing* `data-chip-layout="cluster"` treatment (already used elsewhere in
  this file to group the work-sites and blocklist chip rows as one related pair) to the
  cycle-preset row too, visually separating the two numeric presets (`25/5`, `50/10`) from
  the two word options (`custom`, `no cycles`) with a slightly larger internal gap between
  the two pairs than within each pair — the perceived clutter is partly the four chips
  reading as one undifferentiated row rather than two clearly related pairs.

**Explicitly out of scope for this pass**: collapsing the cycle picker behind a disclosure/
accordion, or any other new interaction pattern. That would be a real information-
architecture change, not a refinement — if the grouping/spacing fix above doesn't feel
like enough once it's actually built and screenshotted, that's a separate, bigger decision
to make deliberately, not a default to reach for now.

## Global constraints (all six items)

- Tokens-first CSS throughout (`design/tokens.css` values only) — the two fixed, non-
  theme-toggled hex values in item 2 (`#F3F1EE`, `#14120F`) are a deliberate exception,
  matching the exact reasoning that already justified `--m-clay`'s fixed fill on the dot
  itself: a contrast-critical color floating over arbitrary, unknown page backgrounds must
  not depend on `prefers-color-scheme`, which reflects the OS, not the page.
- No new class name beyond the frozen 13-class + `.m-chip`/`.m-chip-row`/`.m-companion-*`
  contract for the extension — `data-timer-pill`, `data-popup-header` are attribute-only
  additions, matching the established pattern.
- No animation added to any popup-scoped element beyond what's explicitly specified — the
  companion's own hover-pill fade is a content-script overlay, not the popup, so it's
  already in the same established exception category as the dot's own breathe/wake
  animations.
- No ticking countdown, no dial, no progress ring anywhere in item 3 — reconfirmed against
  `docs/design-toolkit.md`'s refusals; the segmented-loop interpretation is a deliberate,
  reasoned reading of an already-approved static convention in a new shape, not a new
  exception being carved out.
- `DESIGN.md`'s own §4/§6 sections describing the companion (three-node capsule/gaze/
  aperture system, `.m-companion-*` classes, a side panel) are stale — they describe the
  PRE-Orbit-reversal design and don't match the actual shipped `companion-overlay.js`
  (confirmed by reading the real file directly this session: `.dot-wrap`/`.ring`/`.dot`,
  no `.m-companion-*` classes, a floating overlay not a side panel). This spec follows the
  real, current code and `PRODUCT.md`'s own more recent Orbit section, not `DESIGN.md`'s
  stale companion description — flagged here per this project's own hierarchy-of-truth
  rule (say which source you followed and why), not silently resolved either way. Not
  fixed as part of this batch (repairing doc drift is a separate, explicit ask, not a side
  effect of a design task).
