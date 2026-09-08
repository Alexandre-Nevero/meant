# Design — Companion redesign, review page width, tracking hygiene, block reversion, running-popup timer

**Date:** 2026-09-08 · **Traces to:** direct real-browser feedback, round 3.

Five independent fixes bundled into one design/plan, following the same batching pattern
as the two prior QA rounds. Each is scoped narrowly; none touches the others' files except
where noted.

## 1. Companion redesign — size, actions, animations (not visual design)

**Problem.** The companion (`extension/companion-overlay.js`) is invisible on light pages
under a real, specific condition: its inner `.dot` core reads `background: var(--m-ink)`,
and `--m-ink` flips between `#14120F` (light) and `#F3F1EE` (near-white) under `@media
(prefers-color-scheme: dark)` — the **browser/OS** dark-mode preference, which has nothing
to do with the actual background color of whatever page the user is looking at. A user
with system dark mode on, browsing an ordinary white-background site, gets a near-white
10px dot on a white page — invisible. The `.ring` element already uses `var(--m-clay)`
(orange in both light and dark variants), so it stays visible regardless of the same
media query; only `.dot` has this bug.

Separately, the reference (Codex's "wake your pet" mascot) is explicitly *not* a visual
design instruction — the user was clear not to copy its look. What it does establish: a
noticeably-more-substantial size than today's 28px footprint, an implied idle/awake
behavioral distinction, and a literal "waking" moment when the companion appears — not a
static pop-in.

**Fix.**
- `.dot`'s fill switches from `var(--m-ink)` to `var(--m-clay)` — matching the ring,
  removing all dependence on `prefers-color-scheme` for visibility. Orange has working
  contrast against both a white and a black background; near-black-vs-near-white does not.
  `--m-ink` becomes unused in this file once this lands — remove it and its dark-mode
  override rather than leave dead tokens.
- `SIZE` grows from `28` to `36` (a deliberate, visible bump — not a copy of Codex's own
  pixel size, just a size decision made in that spirit). All positioning math
  (`positionHost`, `onDrag`, `endDrag`) already derives from the `SIZE` constant, so this
  is a one-line change with no follow-on math to redo.
- A one-shot "wake" animation on mount (`ensureMounted`): the host element starts at
  `transform: scale(0.5); opacity: 0` and animates to `scale(1); opacity: 1` over ~360ms
  with the existing `--m-ease` curve, once per page load (not on every
  `chrome.storage.onChanged` re-render — only `ensureMounted`'s first-ever call for this
  page). This is the "actions" ask: the companion visibly *arrives*, rather than silently
  existing. Respects `prefers-reduced-motion` like every other animation in this file
  already does (the existing blanket `@media (prefers-reduced-motion: reduce) { * {
  animation: none !important } }` rule already covers this without extra code).
- The existing focus/drift/return-pulse state system, and the "never a color, only
  presence/style" invariant, are unchanged — this redesign is size + one new mount
  animation + a color-source fix, not a new state machine.

**Out of scope:** no face, no character, no illustration — `docs/design-toolkit.md`'s
established Orbit visual language (an abstract dot/ring, no personality glyph) stays
exactly as it is. "Feel like a pet" is delivered through size and the wake animation, not
through mimicking the reference's actual artwork.

## 2. Review page width parity with the dashboard

**Problem.** `[data-surface="ledger"]` (the dashboard) already has `max-width: 1000px;
margin: 0 auto; padding: 72px 80px` (added for the earlier "dashboard too wide"
complaint). `[data-surface="review"]` (the per-session review/"history" page) never got
the equivalent rule — confirmed by grep, zero width-cap rules exist for it in
`app/globals.css`. On a wide viewport it stretches edge to edge exactly like the dashboard
used to.

**Fix.** Add the identical container rule to `[data-surface="review"]` in
`app/globals.css` — same values as `[data-surface="ledger"]`, for literal visual parity
between the two "history" surfaces, matching the user's own framing ("make sure it
matches the dashboard's design").

## 3. Domain-tracking hygiene — defense in depth against stale/invalid rows

**Problem.** Traced every domain-resolution path in `extension/sw.js`
(`activeDomain`, `sweepOpenTabs`, and all four tab/window/idle event listeners) — every one
routes through `safeHostname()`, which already rejects any non-`http(s)` URL, including
`chrome-extension://<any-id>/...` regardless of whose extension it is. There is no live
code path left that can record an extension ID as a tracked domain. The most likely
explanations for continuing to see one: (a) an old review page for a session recorded
before this filter existed — historical bad rows are not retroactively cleaned by a
code fix — or (b) the browser is running an extension build older than the fix.

**Fix (defense in depth, not a live-tracking change).** Add a real-domain-shape guard
where review data is rendered, so historical junk rows stop *displaying* even though they
remain in the database: `lib/band.ts`'s `toBand()` already filters `r.kind === 'attention'
&& r.domain` before building segments — extend that filter to also require the domain
string look like a real hostname (contains a `.`, matching the same "must have a dot" rule
`extension/lib/normalize-domain.js` and `lib/domains.ts` already enforce elsewhere in this
codebase — no new validation concept, reusing the existing one). A 32-character
lowercase-`a`–`p` string (the Chrome extension ID charset) has no dot and gets excluded by
this same rule; no special-cased pattern-matching against "looks like an extension ID"
needed.

## 4. Blocked sites don't revert when a session ends

**Problem.** `endSession()` already unconditionally removes all `declarativeNetRequest`
rules in a `finally` block (already covered by a passing test) — so a *fresh* navigation
attempt to a previously-blocked domain after the session ends correctly succeeds. What
never happens: a tab that's *already sitting on* `blocked.html?d=<domain>` (redirected
there mid-session) has nothing that navigates it back once the session ends. `declarativeNetRequest`
only intercepts new navigation attempts — removing the rule doesn't un-redirect a tab
that's already redirected. The user has to manually revisit the site. This is the literal
"blocked sites do not revert... even if it's done" complaint.

**Fix.** Mirror the existing `sweepOpenTabs()` (which sweeps tabs *forward* to
`blocked.html` at session start) with a new `sweepBlockedTabsBack(domains)` called from
`endSession()`'s `finally` block, before `removeAllRules()`: query all tabs, find any
whose current URL is this extension's own `blocked.html` with a `?d=` parameter matching
one of `session.blockedDomains`, and navigate that tab to `https://<domain>` (the bare
domain's root — the original deep link isn't recoverable from what's stored, same
resolution granularity the block itself already operates at). Scoped to *this session's*
blocked domains only, not blindly to every open `blocked.html` tab (a stale tab blocked by
an earlier, already-ended session must not get swept by an unrelated session's end).

## 5. Running popup: the pill's outline carries phase progress, timer text below

**Problem (already partly addressed, being corrected here).** An earlier pass added phase
display via a separate, tiny `.m-mark` glyph above the intention box, with "work — N min
left" as a further separate line below. The user's ask is structurally different: the
outline that already holds the intention sentence (`.m-field`/`.m-sentence`) should itself
carry the progress indicator — solid outline for elapsed, dashed for remaining — with the
intention text staying inside that same box, and the phase/remaining-time text directly
underneath it. This was clarified and confirmed against this project's own explicit
refusals (`docs/design-toolkit.md`: no Pomodoro dial, no progress ring, no ticking
countdown) — resolved as a **static** progress indicator, recomputed only on the popup's
own natural re-render, never a live per-second tick.

**Why not a literal two-tone CSS border:** `sentenceNode` is sometimes a real `<input>`
(inside the sentence-edit grace window) and inputs cannot contain child DOM nodes, so the
existing `.m-mark:not(:empty)` technique (child `<span>` elements with `flex` values) can't
live *inside* the input itself. Also, CSS `border-image` (the native way to split a
border's color in two zones) does not combine reliably with `border-radius` across
browsers — not viable for a rounded pill.

**Fix.** Wrap `sentenceNode` in a new container element (`.m-timer-pill`, an attribute-only
addition — no new class beyond what's already used: reuses `.m-row-bar[data-kind]`
verbatim) that:
- Renders the pill's own border as normal (same token, same radius) on the wrapper, not
  on the input/paragraph itself (the input's own border is suppressed via
  `border: none` when wrapped this way).
- Adds a thin two-segment strip along the pill's bottom inside edge — the same
  `.m-row-bar[data-kind="attention-1"]` (solid) / `[data-kind="remainder"]` (dashed)
  pair the review page and the earlier phase-display attempt already use, 3px tall,
  positioned absolutely flush with the pill's own bottom border, so it reads as "the
  outline is showing progress" without requiring an actual CSS border split.
- Only renders when `session.cycle` is configured — with no cycle, the wrapper still
  exists (for structural consistency) but the progress strip is empty/absent, matching
  today's "no cycle configured shows no phase" behavior.
- The `phaseLine` text ("work — 15 min left") moves to sit immediately after the pill
  wrapper, replacing its current position after the separate elapsed-time line — directly
  under the pill, as asked.
- The plain `.m-mark[data-state="running"]` glyph at the top of this view is unchanged
  and stays — it matches the idle/ended states, which each render their own decorative
  mark, and removing it would break that parity. It simply stops also carrying the
  cycle-phase fill (that job moves entirely to the sentence pill); with a cycle
  configured, `.m-mark` now always renders empty (decorative only), never
  `:not(:empty)`. The plain "N min elapsed" line is unaffected and stays.

## Global constraints (all five items)

- Tokens-first CSS throughout (`design/tokens.css` values only).
- No new class name beyond the frozen 13-class + `.m-chip`/`.m-chip-row`/
  `.m-companion-*` contract for the extension; attribute values (`data-*`) are the
  extensibility mechanism, exactly as every prior task in this project has used.
- No animation added to any popup-scoped element beyond what's explicitly specified above
  (the popup animates nothing, per PRODUCT.md) — the companion is a content-script overlay
  on arbitrary pages, not the popup, so its own animations are already an established,
  separate exception (it already had breathing/pulse animations before this change).
- No ticking countdown, no dial, no progress ring — reconfirmed against
  `docs/design-toolkit.md`'s refusals for item 5, resolved with the user directly.
