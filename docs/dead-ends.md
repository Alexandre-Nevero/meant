# Dead ends — running log

Kept from the first commit of the UI build (`context.md` §7 rule 10: "our debugging is
the manual's troubleshooting chapter, and it is worth more than the happy path").
Append here as they happen; do not reconstruct after the fact.

---

### `design/canvas/support.js` was never committed

Every artboard (`design/canvas/*.dc.html`) loads `./support.js` and depends on it for
`<x-dc>`, `<helmet>`, `<sc-for list="{{...}}" as="...">`, and `class Component extends
DCLogic { renderVals() {...} }`. The file doesn't exist anywhere on disk or in git
history (`git log --all --diff-filter=A -- '*support.js'` is empty) — commit f257df1
("rescue the artboards from /tmp") left it behind. The artboards did not render at all
before this fix.

**Fix:** wrote a ~90-line reimplementation (`design/canvas/support.js`) covering just
the contract the seven files actually use: hoist `<helmet>` into `<head>`, make
`<x-dc>` layout-transparent via `display: contents`, eval the trailing script with
`return Component` appended (class declarations aren't `window` properties, so the
browser's own execution of that script tag never exposes `Component` — has to be
re-evaluated inside a function that returns it), then walk the tree substituting
`{{path}}` and expanding `<sc-for>` against `new Component().renderVals()`.

### CSS custom-property fallback syntax: comma outside `var()` breaks everything, not just that item

Wrote `--m-display: var(--font-fraunces), Georgia, serif;` intending "use the
next/font variable if set, else Georgia, serif." That's not what this does — the
comma is a top-level list separator, not part of the `var()` call, so if
`--font-fraunces` is undefined the *entire* custom property becomes invalid at
computed-value time (not just that one alternative). Every static context that loads
`app/globals.css` without Next.js's font injection (all seven design fixtures) would
have rendered in the browser default font with no visible error.

**Fix:** `var(--font-fraunces, Georgia, serif)` — the fallback has to live *inside*
the `var()` call; everything after the first comma there is the fallback list.

### The design canvas draws two visuals that look like one class: the mark-icon and the real band

`.m-mark[data-state]` is used exactly five times in the shipped code
(dashboard row status, dashboard empty state, review page header, popup idle/running,
block page) and every single call site passes it with **no children** — a bare
self-closing element. But the toolkit and Main.dc.html/Ledger.dc.html also draw a
real, data-proportional attention band using the same outline-plus-segments visual
language. These are not the same thing at the same size: the childless usages are a
small ~34×16px brand glyph; the band is a full-width, height-varies-by-surface data
visualization.

**Resolved with `:empty`.** `.m-mark:empty` renders the small decorative glyph purely
from CSS (a `::after` fill bar); `.m-mark:not(:empty)` becomes a real flex container
and its children — reused `.m-row-bar[data-kind]` elements sized via inline
`style={{ flex }}` — draw the actual band. One class, two states, chosen by whether
real data was passed as children, not by a state flag. Kept the class count at
exactly 13, per `docs/design-toolkit.md` §8's "never rename unilaterally, fixed
contract" — this reads that as "don't proliferate," not just "don't rename."

### `<Answer>`'s wrapper reused `.m-row`, which is a 3-column grid

`app/review/[sessionId]/answer.tsx` wrapped the Yes/Not-yet buttons in
`<div className="m-row">`. `.m-row` is `grid-template-columns: 14px minmax(0,1fr)
88px` everywhere it's used for domain/step listings — applied to two buttons, the
first would have been squeezed into a 14px column. Pre-existing bug, caught while
building the CSS that would have made it visible for the first time. Fixed to a bare
flex wrapper.

### Outcome text (`Yes` / `Not yet` / `Unanswered`) isn't a figure

First pass gave the ledger-preview and review-page outcome column `.m-row-figure`
(Sometype Mono, tabular-nums) — reasonable-looking, but the artboards draw this column
in plain body type, never mono. `.m-row-figure` is for actual numeric figures ("41
min"); reusing it for a word was a category error. Fixed in both
`app/dashboard/page.tsx` (already correct) and `app/page.tsx`'s ledger preview (was
wrong, now matches).

### Popup's live "running" state is thinner than the artboard, deliberately

`PopupRunning.dc.html` draws a band, a 3-step plan list, and a live "claude.ai now.
social blocked." status line. The shipped `popup.js` has none of that data available —
no per-domain aggregate query from the side panel context, no task table this pass
(decision 9) — so the live popup stays at mark + sentence + elapsed + Stop. The fixture
(`design/fixtures/popup-running.html`) proves the fuller artboard treatment renders
correctly in CSS; the gap is a data source, not a styling gap, and is exactly what
decision 9 already named for the review page's plan list.

### The companion's own storage listener would have destroyed the transition it exists for

First draft of `sidepanel.js` re-rendered the whole gaze DOM tree on every
`chrome.storage.onChanged` event, including a `companionState`-only change. That
replaces the `.m-companion-capsule` element with a brand-new one carrying the new
`data-state` from the start — there is no "previous" element left in the DOM for the
CSS transition to animate *from*, so the one authored move (translateY+scaleY, 280ms)
would have snapped instantly instead of playing. Fixed by keeping a reference to the
capsule and only mutating its `data-state` attribute in place for state-only changes;
a full rebuild happens exclusively when the session itself changes.

### `gstack browse` / Playwright: browser binary version mismatch

`~/.claude/skills/gstack/browse` needed a Chromium version the global Playwright cache
didn't have (`chromium_headless_shell-1208`). Installing chromium generically (from
the project root) fetched newer cached versions (1232/1234) that didn't satisfy the
pinned dependency. Had to install from inside `~/gstack` itself, where the pinned
`playwright-core` version lives, so the install resolves the exact revision the tool
was built against.

### GSAP `pinSpacing` silently disables itself when the pinned element's parent is `display:flex`

Built the landing scroll-jack (`app/scroll-story.tsx`) with `ScrollTrigger.create({
pin: true, scrub: 1, end: () => '+='+distance(), animation: gsap.to(track, {x: () =>
-distance(), ease: 'none'}) })`. Distance computed correctly (confirmed 744px via a
temporary `console.log`), `ScrollTrigger.getAll()[0]` showed the right `start`/`end`
pixel range — but `document.querySelector('.pin-spacer').style.height` never grew past
the section's own natural height. Scrolling to the reported `end` position was
impossible: the document simply didn't have that much extra height, because the page's
own root (`[data-surface="landing"] { display:flex; flex-direction:column }`) is the
pinned section's parent.

Read `node_modules/gsap/dist/ScrollTrigger.js` directly (~line 1825):
```js
pinSpacing === false || pinSpacing === _margin || (pinSpacing = !pinSpacing && pin.parentNode && pin.parentNode.style && _getComputedStyle(pin.parentNode).display === "flex" ? false : _padding);
```
When `pinSpacing` isn't explicitly set and the pinned element's parent computes to
`display:flex`, GSAP defaults it to `false` — no spacer growth, pin has nothing to
scroll through, and nothing in the console or the ScrollTrigger instance itself says so
(`start`/`end` still report the correct intended range; only the spacer disagrees).

**Fix:** pass `pinSpacing: true` explicitly whenever the pinned element's parent is a
flex (or likely grid) container. Cheap, and there's no warning to catch it — the only
signal is scrolling to the reported `end` and finding you can't reach it.

Also worth keeping from the same build: `end` (a function) re-evaluates on
`ScrollTrigger.refresh()` by default, but a tween's own dynamic property functions
(`x: () => ...`) do not, unless `invalidateOnRefresh: true` is set on the trigger — a
plain captured `const distance = …` computed once at mount will silently go stale the
moment a web font swap reflows the track after first paint.
