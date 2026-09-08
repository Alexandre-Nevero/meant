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

### The companion's design reversed from "coach, not a pet" to Orbit (2026-09-05)

PRODUCT.md's original companion spec (0.2 amendment) was explicit and reasoned:
"It is a coach, not a pet. This audience screen-shares with clients." State was gaze/
posture only, never color; 80-120px; no visible acknowledgment of a return from drift
("nothing good happens on screen during a session... shown only in the review").

An external reference sheet ("MEANT Companion -- Orbit") was supplied mid-build showing
a 28px orbital dot, color-coded ring states, and a visible "Return: ring collapses,
acknowledges your refocus" animation -- conflicting with all three specifics above.
Surfaced the conflict directly, quoting PRODUCT.md, before writing any code. Owner
chose full Orbit adoption over the documented spec, explicitly asking for PRODUCT.md
to be updated rather than left to silently drift out of sync with the shipped code.

Implemented: extension/companion-overlay.js rebuilt at 28px, ring presence/style (not
hue) tells state, one 0.6s return-pulse plays on drift-to-focus transition. PRODUCT.md's
"The companion, specifically" section rewritten to match, with this entry as the record
of why. The prior gaze/capsule design is recoverable from git history before this date.

### `chrome.runtime.onStartup` never fires for an unpacked extension loaded via `--load-extension` (2026-09-07)

Wrote an E2E test for the browser-restart recovery path (`extension/sw.js`'s
`onStartup` listener, which was supposed to end any session still running when the
browser reopens). Instrumented both `onInstalled` and `onStartup` with a storage
counter across a real close-and-relaunch of a persistent Chromium context (same
profile dir, not a fresh one) — confirmed `onInstalled` fires on *every* relaunch and
`onStartup` never fires at all, at least under Playwright's `--load-extension` CLI
loading. Chrome's own docs don't state whether this generalizes to a real user's
manual "Load unpacked" install across ordinary restarts (only that
`chrome.runtime.reload()` counts as an update) — checked developer.chrome.com
directly rather than assume, and it's silent on the browser-restart case.

Given the uncertainty, didn't bet on either event: `recoverStaleSession()` is now
registered on both `onInstalled` and `onStartup`, so a live session can't leak
regardless of which one Chromium actually fires for a given user. Whether `onStartup`
ever fires for a real, UI-loaded unpacked extension remains unverified — Playwright
can't simulate that specific load path, so it joins `docs/qa-recipe-browser-verification.md`
Part C as human-only, not because it's hard to script but because the test harness's
own loading mechanism is a different code path than a real user's install.

### Declarative Net Request redirect rule required host permission for target domain (2026-09-07, Task 1 fix)

`extension/manifest.json`'s `host_permissions` only listed a hardcoded set of distraction
domains. Chrome's declarativeNetRequest `redirect` action requires host permission for
the target domain it redirects to — in this case, the domain being blocked must have a
matching host permission, or the redirect silently fails. A user-typed blocked domain
outside the hardcoded list would have an installed redirect rule that fires but does
not execute; the rule would check the request domain and match, but Chrome would refuse
to execute the redirect to `blocked.html` because the extension lacked host permission
for that origin. (Per Chrome's docs on `chrome.tabs.query()`, the `tabs` permission
alone is sufficient for unredacted `tab.url` — host_permissions are OR'd with this, not
required, so tracking via `activeDomain()` in sw.js:52–60 was never broken by this gap.)

**Update (2026-09-08):** confirmed the real cause. `startSession` (`extension/sw.js`)
never called `transition()` — it seeded `slice: emptySlice(now)` with `domain: null`
regardless of whatever tab was actually focused when Start was clicked. An already-active
tab got zero attention time until some *other* event fired (tab switch, URL update, window
focus change, or a 30s alarm tick while idle) — which never happens if the user simply
stays on the same tab. Fixed by seeding the slice with the real active tab's domain
immediately in `startSession`, right after the session is written to storage.

**Fix:** Broadened `host_permissions` from the hardcoded list to `["<all_urls>"]` and
`web_accessible_resources[0].matches` to `["<all_urls>"]` — the necessary change for
`redirect` actions to work on non-hardcoded domains. This is no new category of trust
(the content script was already injected at `<all_urls>`); it only enables redirect
targeting for additional origins. Task 1 adds a regression test (`e2e/session-lifecycle.spec.ts`,
"a blocked domain not in the old hardcoded list is still redirected to blocked.html")
that verifies blocking works for non-hardcoded domains and fails against the old manifest.

### The floating companion never appears in the user's real Brave — root cause unconfirmed (2026-09-07)

Confirmed directly by the user (not a stale-tab timing coincidence — "never," across
many sessions): the companion (`extension/companion-overlay.js`) does not appear on any
page in their real Brave install, despite three attempts at live computer-use diagnosis
producing evidence that this project's own Playwright E2E suite directly contradicts —
the suite has run `e2e/companion.spec.ts` dozens of times today, against this exact
`extension/` folder, in a real (non-mocked) unpacked Chromium load, and it reliably
passes.

All three computer-use diagnostic rounds turned out to be unreliable on inspection, not
just inconclusive: round 1 read DevTools' Application → Local Storage panel (which shows
`window.localStorage`, unrelated to `chrome.storage.local`) and reported it as if it were
extension storage; round 2 reported "no network requests fired" from what was likely a
regular page's Network tab rather than the service worker's own, and treated the popup
closing on blur — normal Chrome behavior any time an extension popup loses focus, e.g.
from opening DevTools right after a click — as evidence of failure; round 3 read the raw
LevelDB storage files directly (a legitimate method) and found a real, active session,
directly disproving round 1's own conclusion.

Researched whether Brave Shields' script-blocking could affect an extension's own
`content_scripts` (as opposed to a page's own scripts) — checked Brave's GitHub issue
tracker directly (brave/brave-browser#45019, #46155, #8307) rather than assume either
way. No definitive public documentation exists on this specific question.

**No code fix made** — there is no confirmed root cause to fix, and guessing one (as
round 1 did) produces a wrong "fix" that doesn't address the real problem while looking
resolved. Given three rounds of unreliable live diagnosis already, a fourth wasn't
pursued. Instead, one simple, concrete, human-only check was added to the manual testing
walkthrough: toggle Brave Shields off for a test site (one click, no DevTools) and see if
the companion appears with Shields off — if it does, Shields is the cause and the fix is
either a documented user-facing workaround or (if Brave's extension API allows detecting
Shields state) a code change; if it still doesn't appear, Shields is ruled out and this
needs fresh investigation with different tooling than computer-use has provided so far.

### The companion's drift signal was dead code — `updateCompanion` was never called (2026-09-08)

Confirmed by grep: `updateCompanion` (`extension/sw.js`) was fully defined but had zero
call sites anywhere in the file. It also had a field-name bug that made it moot either
way — `isCurrentlyBlocked(nextDomain, session.blocklist)` read `session.blocklist`
(singular), a field that is never set (sessions store `blockedDomains`/`blocklists`,
plural); `isCurrentlyBlocked` resolves BLOCKLISTS *category names*, but `blockedDomains`
is already a flat array of resolved domain strings, so even passing the right field in
wouldn't have worked without also changing the check's shape. In practice, the companion
could only ever render its default 'focus' ring — the 'drift' state was unreachable,
which independently explains reports that focus vs. drift were "too vague to tell apart."

Fixed both: the check now compares `nextDomain` directly against `session.blockedDomains`,
and `updateCompanion(next, state.domain)` is called from inside `transition()`, so every
real tab/domain-change event now actually drives the signal.
