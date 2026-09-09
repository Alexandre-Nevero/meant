# Popup Round 5 — Live Attention Loop, Progressive Disclosure, Outcome Band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the running popup's timer pill a live, per-site segmented progress loop (built from an entirely local, offline-safe tally — no network), redesign the idle popup's duration/cycle picker as two-level progressive disclosure, add a visual attention band to the post-session outcome screen, and consolidate the running screen's copy.

**Architecture:** A new pure module (`extension/lib/tally.js`) converts an accumulating `session.tally` object into the same `Segment[]` shape the web app's review page already uses. `extension/sw.js` gains ~15 lines to maintain that tally as events close. `extension/popup.js` gets three independent rewrites (the loop, the picker, the outcome band) plus one copy consolidation — all four touch the same file but different, non-overlapping functions. Two stale design-canvas files get redrawn last, once real behavior exists to draw.

**Tech Stack:** Plain ES modules (no bundler, no TypeScript) for the extension; Playwright E2E; Node's built-in test runner for unit tests.

## Global Constraints

- This is a git worktree (`worktree-drift-and-cycles`, branch `popup-round-5`, forked from `main` at `934d7ab`) — no `-C`/`cd` into another worktree, no git operations targeting another worktree.
- Never add AI/assistant attribution to any commit message.
- No live tick anywhere: `grep -rn "setInterval" extension/` must return nothing before and after every task. `requestAnimationFrame` in `running()` stays a single one-shot measurement frame, never a repeating loop.
- No hex values in `extension/popup.js` or `extension/meant.css` changes — `grep -rn "#[0-9A-Fa-f]\{6\}" extension/popup.js` must return nothing after every task touching that file. Every color is an existing `var(--m-*)` token (`--m-clay`, `--m-clay-2`, `--m-clay-3`, `--m-edge`, `--m-away`, `--m-stroke-loud` all already exist in `extension/tokens.css` — confirmed this session, do not add new ones).
- No new class name beyond the frozen 13-class contract + `.m-chip`/`.m-chip-row`/`.m-companion-*`. This plan's new attribute values (`data-loop`, `data-chip-role="number"`, `data-chip-layout="custom"`, `data-band="session"`) are `data-*` extensibility, not new classes.
- After every task: `npx playwright test --workers=1` (no `--reporter` flag), `npx tsc --noEmit`, `npm test`, and (once Task 1 lands) `node --test test/tally.test.js` must all be clean.
- Confirm the dev server (`npm run dev`) is live via `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000` before any Playwright run; start it with `nohup npm run dev > /tmp/dev-server.log 2>&1 & disown` if not.
- Every behavior-changing task gets a new/extended Playwright case and a `docs/qa-recipe-playwright-e2e.md` lettered-case update. Confirmed current end-state at plan-writing time: last case is **AH**, last item is **74** — the next new case is **AI**, item **75** — but re-check the file's actual tail before assuming this hasn't shifted.
- Every UI-affecting task requires a real screenshot visual check (temp spec, screenshot, Read tool, actual look, delete both afterward) before being considered done — per this repo's CLAUDE.md: "Static code and a clean build are not evidence. Render it and look."
- This machine has intermittently hit real memory pressure during heavy Playwright runs. If a full-suite run dies from process/system death (not real assertion failures), that's environmental — restart the dev server if needed and retry once; if it recurs, fall back to the specific spec file(s) the task touched plus `tsc`/unit tests as evidence, noting it in the report.
- Do not re-litigate any already-resolved design decision from `docs/superpowers/specs/2026-09-09-round-5-design-notes.md` (the local-tally-not-polling decision, the away-folds-into-remainder-on-the-loop decision, the 2px stroke weight, the solid non-dashed remainder, the `25/5` default, the retired bounded-multi-cycle combination) — implement exactly what that spec already resolved.
- **Item A (the companion) has no task in this plan.** Confirmed not broken this session; any real fix is a separate, future task if the user's own clean retest still shows a problem.
- **The web app's navigation/pages are explicitly out of scope for this plan** — a separate, later brainstorming pass.

---

## Task 1: `extension/lib/tally.js` — pure tally-to-segments conversion

**Files:**
- Create: `extension/lib/tally.js`
- Test: `test/tally.test.js`

**Interfaces:**
- Consumes: nothing (pure, no `chrome.*`, no `Date.now()` — every caller passes `at`, matching `extension/lib/attribution.js`'s own discipline).
- Produces:
  - `withOpenSlice(tally, slice, at)` → `{ attention: {[domain]: seconds}, away: number, break: number }` — the closed-tally plus whatever the still-open slice contributes, as one merged object. `tally`/`slice` may be `null`/`undefined`.
  - `toSegments(merged)` → `Array<{ kind: 'attention-1'|'attention-2'|'attention-3'|'away'|'break', domain: string|null, flex: number }>` — top 3 attention domains by seconds (ties keep first-seen order), zero-second and extension-ID-shaped domains dropped, `away`/`break` as their own segments when present. Never emits `remainder` — the caller computes that from the denominator.

- [ ] **Step 1: Write the failing tests**

Create `test/tally.test.js`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { withOpenSlice, toSegments } from '../extension/lib/tally.js'

test('toSegments: top three attention domains by seconds, 4th+ dropped', () => {
  const merged = { attention: { a: 100, b: 90, c: 80, d: 70 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  const attentionSegments = segments.filter((s) => s.kind.startsWith('attention'))
  assert.equal(attentionSegments.length, 3)
  assert.deepEqual(attentionSegments.map((s) => s.domain), ['a', 'b', 'c'])
})

test('toSegments: an exact tie keeps first-seen (insertion) order', () => {
  const merged = { attention: { later: 50, earlier: 50 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  assert.deepEqual(segments.map((s) => s.domain), ['later', 'earlier'])
})

test('toSegments: a zero-second domain is dropped', () => {
  const merged = { attention: { real: 30, zeroed: 0 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  assert.equal(segments.filter((s) => s.kind.startsWith('attention')).length, 1)
  assert.equal(segments[0].domain, 'real')
})

test('toSegments: a 32-char [a-p] domain is dropped; localhost is kept', () => {
  const merged = {
    attention: { 'emnalgngpciahekjdcgpbgnhmkpjhlhi': 60, localhost: 40 },
    away: 0,
    break: 0,
  }
  const segments = toSegments(merged)
  const attentionSegments = segments.filter((s) => s.kind.startsWith('attention'))
  assert.equal(attentionSegments.length, 1)
  assert.equal(attentionSegments[0].domain, 'localhost')
})

test('toSegments: away and break become their own segments when present', () => {
  const merged = { attention: { a: 10 }, away: 20, break: 30 }
  const segments = toSegments(merged)
  assert.deepEqual(segments.map((s) => s.kind), ['attention-1', 'away', 'break'])
})

test('toSegments: away/break omitted entirely when zero', () => {
  const merged = { attention: { a: 10 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  assert.deepEqual(segments.map((s) => s.kind), ['attention-1'])
})

test('withOpenSlice: adds an open attention slice to an existing domain total', () => {
  const tally = { attention: { 'a.com': 100 }, away: 0, break: 0 }
  const slice = { domain: 'a.com', since: 1000, mode: 'attention' }
  const merged = withOpenSlice(tally, slice, 1000 + 30_000)
  assert.equal(merged.attention['a.com'], 130)
})

test('withOpenSlice: a null-domain attention slice adds nothing', () => {
  const tally = { attention: {}, away: 0, break: 0 }
  const slice = { domain: null, since: 1000, mode: 'attention' }
  const merged = withOpenSlice(tally, slice, 1000 + 30_000)
  assert.deepEqual(merged.attention, {})
})

test('withOpenSlice: at before slice.since adds nothing (no negative)', () => {
  const tally = { attention: { 'a.com': 50 }, away: 0, break: 0 }
  const slice = { domain: 'a.com', since: 5000, mode: 'attention' }
  const merged = withOpenSlice(tally, slice, 1000)
  assert.equal(merged.attention['a.com'], 50)
})

test('withOpenSlice: away/break slices land in their own buckets, no floor', () => {
  const tally = { attention: {}, away: 5, break: 0 }
  const awaySlice = { domain: null, since: 0, mode: 'away' }
  const merged = withOpenSlice(tally, awaySlice, 3_000) // 3 real seconds, below AWAY_MIN_MS's 15s floor
  assert.equal(merged.away, 8) // 5 + 3, no floor applied on a display read
})

test('withOpenSlice: no tally and no slice returns an empty merged object', () => {
  const merged = withOpenSlice(undefined, null, 1000)
  assert.deepEqual(merged, { attention: {}, away: 0, break: 0 })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/tally.test.js`
Expected: FAIL — `extension/lib/tally.js` does not exist (import error).

- [ ] **Step 3: Write the implementation**

Create `extension/lib/tally.js`:

```javascript
// Duplicated from lib/band.ts#EXTENSION_ID_SHAPE — the plain-JS extension can't import that
// TS module (same limitation as GRACE_MS / CYCLE_PRESETS in popup.js). Keep them identical.
const EXTENSION_ID_SHAPE = /^[a-p]{32}$/

/** tally + the still-open slice's elapsed time, as one merged tally. Read-only view: no
 *  AWAY_MIN_MS floor is applied here (that floor exists to keep junk out of the event log,
 *  not out of a display), and nothing is written back. */
export function withOpenSlice(tally, slice, at) {
  const merged = {
    attention: { ...(tally?.attention ?? {}) },
    away: tally?.away ?? 0,
    break: tally?.break ?? 0,
  }
  if (!slice) return merged
  const seconds = Math.floor(Math.max(0, at - slice.since) / 1000)
  if (seconds === 0) return merged
  if (slice.mode === 'attention' && slice.domain) {
    merged.attention[slice.domain] = (merged.attention[slice.domain] ?? 0) + seconds
  } else if (slice.mode === 'away') merged.away += seconds
  else if (slice.mode === 'break') merged.break += seconds
  return merged
}

/** Merged tally → the same `{ kind, flex }` Segment shape lib/band.ts#toBand produces, so the
 *  popup and the review draw from one vocabulary. Top three domains by seconds, ties broken by
 *  first-seen, zero-second and extension-ID-shaped domains dropped, away/break as their own
 *  segments. Never emits `remainder` — the caller owns the denominator, exactly as toBand() does. */
export function toSegments(merged) {
  const attention = Object.entries(merged.attention)
    .filter(([domain, seconds]) => seconds > 0 && !EXTENSION_ID_SHAPE.test(domain))
    // Object.entries preserves insertion order, and Array#sort is stable in every engine
    // this ships to — so an exact tie keeps first-seen order with no explicit tie-breaker.
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const segments = attention.map(([domain, seconds], i) => ({
    kind: ['attention-1', 'attention-2', 'attention-3'][i],
    domain,
    flex: seconds,
  }))
  if (merged.away > 0) segments.push({ kind: 'away', domain: null, flex: merged.away })
  if (merged.break > 0) segments.push({ kind: 'break', domain: null, flex: merged.break })
  return segments
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/tally.test.js`
Expected: PASS, all 10 tests.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean (this task adds no new files any other test touches yet).

- [ ] **Step 6: Commit**

```bash
git add extension/lib/tally.js test/tally.test.js
git commit -m "feat(extension): a pure tally-to-segments module for live per-site attention data"
```

---

## Task 2: `extension/sw.js` — accumulate `session.tally` as events close

**Files:**
- Modify: `extension/sw.js`
- Test: `e2e/session-lifecycle.spec.ts`

**Interfaces:**
- Consumes: nothing new (this task doesn't import `tally.js` — it just accumulates the raw shape `withOpenSlice`/`toSegments` expect).
- Produces: `session.tally` now genuinely accumulates as `{ attention: {[domain]: seconds}, away: number, break: number }`, written into `chrome.storage.local`'s `session` object every time `transition()` runs and closes a slice with real elapsed time.

**A real bug found and fixed by this task, not in the design spec**: `startSession()` (`extension/sw.js:127`) currently seeds `tally: {}` — a bare empty object. `transition()`'s own fallback is `session.tally ?? { attention: {}, away: 0, break: 0 }`, but `??` only falls back on `null`/`undefined` — `{}` is neither, so the fallback never fires and `tally.attention[event.domain] = ...` would throw (`Cannot set properties of undefined`) the very first time an attention event closes. Fix both: seed the correct shape at session start, and keep `transition()`'s own defensive fallback for the small amount of already-shipped session data that might still have the bare `{}` shape.

- [ ] **Step 1: Write the failing test**

Add to `e2e/session-lifecycle.spec.ts` (reuse the existing `pairAndOpenPopup` helper already defined at the top of that file):

```typescript
test('session.tally accumulates real attention seconds as tabs are switched', async ({ context, extensionId, freshAccount }) => {
  const firstTab = await context.newPage()
  await firstTab.goto('https://example.com')
  await firstTab.bringToFront()

  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await firstTab.bringToFront()
  await page.locator('input.m-field').first().fill('tally test')
  await page.getByRole('button', { name: 'Start' }).click()

  // Stay on example.com long enough to cross attribution.js's 1-second emission floor.
  await firstTab.waitForTimeout(2_000)

  // Switch to a second real domain — this closes the example.com slice, which is what
  // actually writes its seconds into session.tally (tally only grows on slice close).
  const secondTab = await context.newPage()
  await secondTab.goto('https://example.org')
  await secondTab.bringToFront()
  await secondTab.waitForTimeout(500)

  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.tally?.attention?.['example.com'])))))
    .toBeGreaterThan(0)

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "session.tally accumulates" --workers=1`
Expected: FAIL — `session.tally.attention` stays `undefined`/`{}` (or the whole flow throws, since `transition()` currently never writes to `tally` at all).

- [ ] **Step 3: Implement the fix**

In `extension/sw.js`, change `startSession()`'s session-seed object:

```javascript
// was:
      ruleIds: [], signals: [], corrected: [], judged: {}, tally: {},
// now:
      ruleIds: [], signals: [], corrected: [], judged: {},
      tally: { attention: {}, away: 0, break: 0 },
```

Change `transition()`:

```javascript
async function transition({ mode, domain, at = Date.now() }) {
  const session = await getSession()
  if (!session) return
  const prior = session.slice ?? emptySlice(new Date(session.startedAt).getTime())
  const { events, state } = advance(prior, { at, mode, domain })
  const tally = session.tally?.attention ? session.tally : { attention: {}, away: 0, break: 0 }
  for (const event of events) {
    await enqueue(session, event)
    if (event.kind === 'attention' && event.domain) {
      tally.attention[event.domain] = (tally.attention[event.domain] ?? 0) + event.seconds
    } else if (event.kind === 'away') tally.away += event.seconds
    else if (event.kind === 'break') tally.break += event.seconds
  }
  // dwellSince survives service-worker death because it lives in storage.
  const dwellSince = state.domain && state.domain === prior.domain ? (session.dwellSince ?? at) : at
  const next = { ...session, slice: state, dwellSince, tally }
  await chrome.storage.local.set({ session: next })
  await updateCompanion(next, state.domain)
  return next
}
```

(Only the `tally` line and the loop body inside the `for` change; everything else in `transition()` is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "session.tally accumulates" --workers=1`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test (check the file's actual current last case/item before assuming Case AI / item 75).

- [ ] **Step 7: Commit**

```bash
git add extension/sw.js e2e/session-lifecycle.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(extension): accumulate session.tally as attention/away/break events close"
```

---

## Task 3: The timer loop — live segmented progress, true 12 o'clock start, solid remainder, 5% floor

**Files:**
- Modify: `extension/popup.js` (`running`)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `withOpenSlice`, `toSegments` from `./lib/tally.js` (Task 1); `session.tally`/`session.slice` (Task 2, already present on every session object).
- Produces: nothing new exported — this only changes how `running()` renders.

**Resolved ambiguity, not explicit in the design spec — read before starting**: the design spec's §3.1 denominator formula explicitly handles `session.plannedMinutes == null` (the "until I stop" case, `denom = max(measured, 1)`), and §4's cold-start floor applies unconditionally. Nothing in the spec gates the loop's construction on `phase` (i.e. on a cycle being configured) the way the OLD shipped code did (`if (phase) { requestAnimationFrame(...) }`). Given the loop's new purpose — visualizing live per-site attention, not phase progress — **this task removes that gate: the loop now draws unconditionally, every time `running()` renders**, independent of whether a cycle is configured. `phase` (from `cyclePhase(session)`) is untouched and still independently gates the separate phase-remaining text line (that's Task 5's concern, not this one).

- [ ] **Step 1: Write the failing tests**

Add to `e2e/popup.spec.ts` (replace the OLD Case AF test and the two related pill tests entirely — see Step 3 below for exactly what to delete):

```typescript
test('the intention pill\'s loop starts at true top-center and traces clockwise', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('loop start test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap).toBeVisible()
  const svg = pillWrap.locator('svg')
  await expect(svg).toBeVisible()
  const paths = svg.locator('path')
  await expect(paths.first()).toBeVisible()

  // Every segment shares the identical `d` (the authored top-center-start path) —
  // confirms this is the new path-based construction, not the old two-<rect> one.
  const dValues = await paths.evaluateAll((els) => els.map((e) => e.getAttribute('d')))
  expect(new Set(dValues).size).toBe(1)
  expect(dValues[0]).toMatch(/^M [\d.]+ [\d.]+ H/) // starts with a horizontal move from top-center

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the pill shows a visible arc immediately at session start, before any real attention time', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('cold start test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  const svg = pillWrap.locator('svg')
  await expect(svg).toBeVisible()
  const firstPath = svg.locator('path').first()
  const dasharray = await firstPath.evaluate((e) => getComputedStyle(e).strokeDasharray)
  const [drawn] = dasharray.split(',').map((n) => parseFloat(n))
  expect(drawn).toBeGreaterThan(0) // a visible arc exists even with ~0 real elapsed time

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the loop is a solid line throughout, no dashed segments anywhere', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('solid line test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  const svg = pillWrap.locator('svg')
  await expect(svg).toBeVisible()
  const strokeWidths = await svg.locator('path').evaluateAll((els) => els.map((e) => getComputedStyle(e).strokeWidth))
  for (const w of strokeWidths) expect(w).toBe('2px') // --m-stroke-loud, uniform across every segment

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the pill\'s border is visually suppressed without changing its measured size', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('measurement test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap).toHaveAttribute('data-loop', 'on')
  await expect(pillWrap).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)') // transparent, not border-style:none

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the loop still draws when no cycle is configured, filling from live attention data alone', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: 'custom', exact: true }).click()
  await page.getByRole('button', { name: 'no cycles', exact: true }).click()
  await page.locator('input.m-field').first().fill('no cycle loop test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap.locator('svg')).toBeVisible() // the loop is NOT gated on a cycle existing

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

Note: the last test above (`custom` then `no cycles`) depends on Task 4's picker landing first for that exact click sequence to work — since Task 4 comes AFTER this task in the plan, **this specific test cannot pass until Task 4 also lands**. Write it now as specified (it documents Task 3's own behavior — the loop is unconditional), but mark it `test.fixme(...)` instead of `test(...)` for this task only, with a comment `// un-skip once Task 4's picker lands 'custom' → 'no cycles'`, and convert `test.fixme` back to `test` as part of Task 4's own test updates (Task 4's step list below includes this exact conversion).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/popup.spec.ts -g "true top-center|visible arc immediately|solid line throughout|visually suppressed" --workers=1`
Expected: FAIL — the current code still builds two `<rect>` elements with `stroke-dasharray` two-tone fill, not authored `<path>` segments; `data-loop` doesn't exist yet; `border-color` isn't set (the old code sets `style.border = 'none'`, which sets `border-style`, not `border-color`).

- [ ] **Step 3: Delete the three now-superseded old tests**

In `e2e/popup.spec.ts`, delete these three tests entirely (they assert on the old two-`<rect>` two-tone construction this task replaces):
- `'a running session with a cycle configured shows progress on the intention pill\'s own outline, not a separate mark'`
- `'the intention pill\'s progress is drawn as an SVG loop around its full perimeter, not a bottom-only strip'`
- `'the pill keeps its plain CSS border, no SVG, when no cycle is configured'`

(Re-read the file to confirm exact current line ranges before deleting — Tasks 1 and 2 don't touch this file, so line numbers should match what's shown above under "Interfaces", but confirm directly rather than trusting stale line numbers.)

Keep these two, unmodified — they test the phase-line/no-phase-line behavior, which is independent of the loop and untouched by this task:
- `'a running session with a cycle configured shows which phase it is in, without a ticking countdown'`
- `'a running session with no cycle configured shows no phase line'`

- [ ] **Step 4: Implement the fix**

In `extension/popup.js`, add the import at the top of the file:

```javascript
import { post, get, apiBase } from './api.js'
import { isEditable } from './lib/sentence-lock.js'
import { normalizeDomain } from './lib/normalize-domain.js'
import { resolveSitePhrase } from './lib/resolve-sites.js'
import { withOpenSlice, toSegments } from './lib/tally.js'
```

Replace the entire block from the `pillWrap` comment through the `if (phase) { ... }` block inside `running()` (currently the block starting `// The intention's own box doubles as the cycle's static progress indicator...` through the closing `}` of the `if (phase)`):

```javascript
  // The intention's own box doubles as the session's live attention loop: an authored SVG
  // path traced around the pill's existing rounded-rect shape (same 26px corner radius as
  // --m-r-field — this doesn't change the pill's shape, only how its outline is drawn),
  // segmented by which sites the time actually went to. Unconditional — this draws every
  // time, independent of whether a cycle is configured, since it visualizes live attention
  // data, not phase progress. Static only: one requestAnimationFrame measurement frame,
  // gated on document.fonts.ready so a font-swap reflow can't leave the viewBox stale.
  const pillWrap = el('div')
  pillWrap.dataset.timerPill = 'true'
  pillWrap.append(sentenceNode)

  const merged = withOpenSlice(session.tally, session.slice, Date.now())
  const segments = toSegments(merged)

  document.fonts.ready.then(() => requestAnimationFrame(() => {
    pillWrap.dataset.loop = 'on' // CSS makes the border transparent without changing clientWidth/Height
    const width = pillWrap.clientWidth
    const height = pillWrap.clientHeight

    const SVG_NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('aria-hidden', 'true') // the figures beside it carry the same information
    svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;'

    // Clockwise from top-dead-centre. Same rounded-rect geometry as --m-r-field (26px), so
    // the pill's shape does not change — only where the outline's zero point is and how it
    // is painted. inset = 1 (half the 2px stroke), r = 26.
    const inset = 1
    const r = 26
    function loopPath() {
      const x = inset, y = inset
      const w = width - inset * 2, h = height - inset * 2
      const rr = Math.min(r, w / 2, h / 2) // matches the rx/ry clamp <rect> would apply
      return [
        `M ${x + w / 2} ${y}`,
        `H ${x + w - rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
        `V ${y + h - rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
        `H ${x + rr}`,
        `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
        `V ${y + rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
        `H ${x + w / 2}`,
      ].join(' ')
      // No `Z` — the path already returns to its start point, and a `Z` would add a
      // zero-length close that some engines count in getTotalLength().
    }
    const d = loopPath()

    // A throwaway path just to measure the real rendered perimeter — getTotalLength()
    // gives the exact number for THIS pill's real, measured size (it can wrap to two
    // lines), no manual perimeter formula needed.
    const measurer = document.createElementNS(SVG_NS, 'path')
    measurer.setAttribute('d', d)
    svg.append(measurer)
    const L = measurer.getTotalLength()
    measurer.remove()

    // §3.1 — the loop's full length means the session's planned duration. "until I stop"
    // (plannedMinutes == null) has no target, so the loop just fills with real proportions
    // (denom = measured). Math.max(..., measured) clamps a session that overruns its plan
    // instead of letting segments run past L.
    const measured = segments.reduce((sum, s) => sum + s.flex, 0)
    const denom = session.plannedMinutes == null
      ? Math.max(measured, 1)
      : Math.max(session.plannedMinutes * 60, measured)

    const PAINT = {
      'attention-1': 'var(--m-clay)',
      'attention-2': 'var(--m-clay-2)',
      'attention-3': 'var(--m-clay-3)',
      remainder: 'var(--m-edge)',
    }
    const GAP = 3 // px of path length — matches .m-mark:not(:empty) { gap: 3px }
    const MIN_ARC = 0.05 * L // item D — never render nothing at t≈0
    const MIN_DRAWN = 8 // below this a segment cannot read as a segment

    function arc(kind, start, len) {
      const p = document.createElementNS(SVG_NS, 'path')
      p.setAttribute('d', d) // the same authored d for every segment
      p.dataset.kind = kind // debuggable, and greppable against .m-row-bar
      p.style.fill = 'none'
      p.style.stroke = PAINT[kind]
      p.style.strokeWidth = '2' // --m-stroke-loud — the smallest weight that holds --m-clay-3
      p.style.strokeLinecap = 'butt' // round caps would eat into the 3px gaps
      p.style.strokeDasharray = `${len} ${L - len}` // sums to exactly L: a segment crossing
      p.style.strokeDashoffset = `${(L - start) % L}` // the seam wraps instead of clipping
      svg.append(p)
    }

    // 1. shares, in path-length units — away/break fold into the remainder (see PAINT: no
    //    away/break entry — a hatch can't survive a 2px stroke, and "away is a hatch, never
    //    solid grey" rules out painting it solid; the full away/break vocabulary lives on
    //    the outcome screen's 14px band instead, Task 6).
    const shares = segments
      .filter((s) => s.kind.startsWith('attention'))
      .map((s) => ({ kind: s.kind, len: (s.flex / denom) * L }))
      .filter((s) => s.len >= MIN_DRAWN) // a sub-8px sliver is noise; its time falls into
                                          // the remainder, unpainted

    // 2. the floor (item D) — first segment only, never a permanent offset once real
    //    progress exceeds it.
    if (shares.length === 0) shares.push({ kind: 'attention-1', len: MIN_ARC }) // cold start
    else shares[0].len = Math.max(shares[0].len, MIN_ARC)

    // 3. lay them out clockwise from 0 (= top-dead-centre), gaps carved out of each
    //    segment's tail.
    let cursor = 0
    for (const s of shares) {
      arc(s.kind, cursor, Math.max(s.len - GAP, 2))
      cursor += s.len
    }

    // 4. the remainder closes the loop, leaving one final gap before wrapping to top-centre.
    const remainder = L - cursor
    if (remainder > GAP + MIN_DRAWN) arc('remainder', cursor, remainder - GAP)

    pillWrap.append(svg)
  }))
```

In `extension/meant.css`, replace the measurement-bug-prone approach: find the existing `[data-timer-pill]` rule block and add, immediately after it:

```css
/* Fix (round 5): pillWrap.style.border = 'none' used to change clientWidth/Height right
 * before measuring it (a 1.5px border removal jumps the box 3px wider) — a transparent
 * border keeps the box size identical to the idle field it replaces, while still hiding
 * the visible line so the SVG loop is the only thing drawn. */
[data-timer-pill][data-loop="on"] { border-color: transparent; }
```

Also remove the now-fully-dead `[data-timer-pill] > .m-mark:not(:empty) { ... }` rule (the old bottom-strip construction from two rounds ago — it has had zero producers since the SVG-loop round before this one, and this task confirms no new producer is being added for it either). Leave `[data-timer-pill] > .m-field, [data-timer-pill] > .m-sentence { border: none; }` untouched.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx playwright test e2e/popup.spec.ts -g "true top-center|visible arc immediately|solid line throughout|visually suppressed" --workers=1`
Expected: PASS. (The 5th new test, the `no cycles` one, stays `test.fixme` until Task 4 — do not attempt to make it pass now.)

- [ ] **Step 6: Visual verification (required)**

Write a temporary spec that starts a `25/5` session, pushes `session.startedAt` back a few minutes (matching the existing pattern in `e2e/popup.spec.ts`'s phase test — `chrome.storage.local.get('session')`, mutate `startedAt`, `set` it back, `page.reload()`), navigates across 2-3 real domains first so real segments exist, reopens the popup, and screenshots the pill at native 360px width. Read the screenshot with the Read tool. Confirm: the colored arc(s) begin at the pill's true top-center (not near a corner), run clockwise, are solid (no dashes anywhere), and the remainder arc (if any) is a plain, slightly muted line, not a dashed one. Also screenshot a `custom` → `no cycles` session once it exists (skip this specific check until Task 4, note it as deferred in the report) — for THIS task, confirm the loop still shows something reasonable even with a cycle configured and near-zero real elapsed time (the 5% floor). Delete the temp spec and screenshot(s) afterward.

- [ ] **Step 7: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean except the one intentionally-`fixme`'d test (Playwright reports `fixme` tests as skipped, not failed — confirm the run shows 0 failed, not 0 run).

- [ ] **Step 8: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting the 4 passing tests (note the 5th is fixme'd pending Task 4).

- [ ] **Step 9: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): the timer pill's loop becomes a live per-site segmented outline, top-center start, solid line"
```

---

## Task 4: The progressive-disclosure duration + cycle picker

**Files:**
- Modify: `extension/popup.js` (`idle`, `cyclePicker` replaced, `cyclePresetKey` deleted)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-3 code-wise.
- Produces: the picker's public shape at the `Start` call site changes from two separate `duration.value`/`cycle.value` reads to one `picker.value` read returning `{ plannedMinutes, cycle }` directly — matching exactly what `chrome.runtime.sendMessage({ type: 'start', ... })` already expects, so `sw.js`/`startSession()` needs NO change.

**Before starting**: re-read the current `idle()` function directly (`extension/popup.js`) to confirm the exact current call site of `duration`/`cycle` construction and the `Start` click handler's `plannedMinutes`/`cycleValue` extraction — Tasks 1-3 don't touch `idle()`, so it should be unchanged from what's shown under this plan's own research, but confirm before writing the diff.

- [ ] **Step 1: Write the failing tests**

In `e2e/popup.spec.ts`, first **delete** these two now-superseded tests entirely:
- `'renders the approved layout: sentence, duration, cycle, site rows, Start'` (references the old 5-chip always-visible layout and the `50/10` default)
- `'single-select chips toggle exclusively: picking one flips the previous one off'` (tests the now-deleted standalone `duration` row)

Then **update** the existing `'the cycle-preset row visually separates the two duration presets from custom/no cycles'` test (Case AH) — the level-1 row now has 3 chips, not 4, and the gap is still before the 3rd (now `custom` is literally the 3rd of 3, previously it was the 3rd of 4):

```typescript
test('the cycle-preset row visually separates the two presets from custom', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const cycleRow = page.locator('[data-chip-layout="paired"]')
  await expect(cycleRow).toBeVisible()
  const chips = cycleRow.locator('.m-chip')
  await expect(chips).toHaveCount(3)

  const firstBox = (await chips.nth(0).boundingBox())!
  const secondBox = (await chips.nth(1).boundingBox())!
  const thirdBox = (await chips.nth(2).boundingBox())!
  const withinGroupGap = secondBox.x - (firstBox.x + firstBox.width)
  const beforeCustomGap = thirdBox.x - (secondBox.x + secondBox.width)
  expect(beforeCustomGap).toBeGreaterThan(withinGroupGap)

  // Exclusive selection spans all 3, including across the visual gap.
  await chips.first().click() // 25/5
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true')
  await chips.nth(2).click() // custom
  await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true')
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'false')
})
```

Add these new tests for the progressive-disclosure behavior:

```typescript
test('the idle popup shows only 25/5, 50/10, and custom at first — no duration row, no until-I-stop, no no-cycles', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await expect(page.getByRole('button', { name: '25/5', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '50/10', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'custom', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '25 min', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '50 min', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'until I stop', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'no cycles', exact: true })).toHaveCount(0)

  // 25/5 is the confirmed first-ever-session default.
  await expect(page.getByRole('button', { name: '25/5', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('clicking custom reveals labelled work/break inputs plus until-I-stop and no-cycles', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.getByRole('button', { name: 'custom', exact: true }).click()
  await expect(page.getByText('work', { exact: true })).toBeVisible()
  const workInput = page.locator('input[data-chip-role="number"]').first()
  const breakInput = page.locator('input[data-chip-role="number"]').nth(1)
  await expect(workInput).toBeVisible()
  await expect(breakInput).toBeVisible()
  await expect(workInput).toHaveCSS('cursor', 'text') // not "pointer" — a real defect fixed by this task
  await expect(page.getByRole('button', { name: 'until I stop', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'no cycles', exact: true })).toBeVisible()
})

test('no cycles disables the break input and relabels work to minutes, and stays reachable as a plain fixed-length session', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.getByRole('button', { name: 'custom', exact: true }).click()
  await page.getByRole('button', { name: 'no cycles', exact: true }).click()
  await expect(page.getByText('minutes', { exact: true })).toBeVisible()
  const breakInput = page.locator('input[data-chip-role="number"]').nth(1)
  await expect(breakInput).toBeDisabled()

  await page.locator('input[data-chip-role="number"]').first().fill('45')
  await page.locator('input.m-field').first().fill('no cycles test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
    .toBe(45)
  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.cycle)))))
    .toBe(null)

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('until I stop keeps the typed cycle but removes the planned-duration cap', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.getByRole('button', { name: 'custom', exact: true }).click()
  await page.getByRole('button', { name: 'until I stop', exact: true }).click()
  await page.locator('input.m-field').first().fill('until I stop test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
    .toBe(null)
  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.cycle)))))
    .toEqual({ work: 25, break: 5 }) // the default custom pair, since neither input was edited

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('picking 25/5 caps the session at exactly 30 planned minutes', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('preset cap test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
    .toBe(30)

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

Finally, update the two `'no cycles'` click sites left over from Task 3's own new tests, plus un-skip Task 3's `test.fixme`d test — search `e2e/popup.spec.ts` for every remaining `page.getByRole('button', { name: 'no cycles'` click (there should be exactly one inside a still-`fixme`'d test from Task 3, plus this task's own new tests above already use the correct new two-click path) and change each old, now-broken single click into the two-click reveal sequence:

```typescript
// was: await page.getByRole('button', { name: 'no cycles', exact: true }).click()
// now:
await page.getByRole('button', { name: 'custom', exact: true }).click()
await page.getByRole('button', { name: 'no cycles', exact: true }).click()
```

Convert Task 3's `test.fixme('the loop still draws when no cycle is configured...', ...)` back to a plain `test(...)` — its body already uses the correct two-click sequence (it was written that way in Task 3 specifically so no further edit is needed here beyond removing `.fixme`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/popup.spec.ts -g "only 25/5, 50/10, and custom|reveals labelled|disables the break input|keeps the typed cycle|caps the session at exactly" --workers=1`
Expected: FAIL — the old separate duration+cycle rows are still in place.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`, delete `cyclePresetKey()` and the entire `cyclePicker()` function (lines currently ~222-273 per this plan's own research — confirm directly), replacing both with:

```javascript
/** 25/5 · 50/10 · custom — one single-select, always visible. Custom reveals labelled
 *  work/break inputs plus two more chips (until I stop / no cycles), at-most-one-of-two.
 *  `.value` is `{ plannedMinutes, cycle }` directly — the exact shape the Start handler
 *  already sends to sw.js, so nothing downstream of this picker needs to change. */
function cycleDurationPicker(lastChoice) {
  const restored = restore(lastChoice)
  let mode = restored.mode
  let customMode = restored.customMode

  const workLabelText = el('span', null, customMode === 'none' ? 'minutes' : 'work')
  const workLabel = el('label', 'm-meta')
  const workInput = el('input', 'm-chip')
  workInput.type = 'number'
  workInput.min = '1'
  workInput.dataset.chipRole = 'number'
  workInput.value = String(restored.work)
  workLabel.append(workLabelText, workInput)

  const breakLabelText = el('span', null, 'break')
  const breakLabel = el('label', 'm-meta')
  const brkInput = el('input', 'm-chip')
  brkInput.type = 'number'
  brkInput.min = '1'
  brkInput.dataset.chipRole = 'number'
  brkInput.value = String(restored.brk)
  brkInput.disabled = customMode === 'none'
  breakLabel.append(breakLabelText, brkInput)

  const inputsRow = el('div')
  inputsRow.dataset.chipLayout = 'custom'
  inputsRow.append(workLabel, el('span', null, '/'), breakLabel)

  const openChip = el('button', 'm-chip', 'until I stop')
  openChip.type = 'button'
  openChip.setAttribute('aria-pressed', String(customMode === 'open'))
  const noneChip = el('button', 'm-chip', 'no cycles')
  noneChip.type = 'button'
  noneChip.setAttribute('aria-pressed', String(customMode === 'none'))
  const customChipsRow = el('div', 'm-chip-row')
  customChipsRow.append(openChip, noneChip)

  const customRow = el('div')
  customRow.append(inputsRow, customChipsRow)
  customRow.hidden = mode !== 'custom'

  function setCustomMode(next) {
    customMode = next
    openChip.setAttribute('aria-pressed', String(next === 'open'))
    noneChip.setAttribute('aria-pressed', String(next === 'none'))
    brkInput.disabled = next === 'none'
    workLabelText.textContent = next === 'none' ? 'minutes' : 'work'
  }
  openChip.addEventListener('click', () => setCustomMode(customMode === 'open' ? 'timed' : 'open'))
  noneChip.addEventListener('click', () => setCustomMode(customMode === 'none' ? 'timed' : 'none'))
  // Typing in either field is itself a choice of "timed" — editing numbers a pressed
  // chip is ignoring would be a trap. workInput's guard is asymmetric on purpose: under
  // "no cycles" the work field IS the session length, so editing it must not leave "none".
  workInput.addEventListener('input', () => { if (customMode === 'open') setCustomMode('timed') })
  brkInput.addEventListener('input', () => { if (customMode !== 'timed') setCustomMode('timed') })

  const level1 = chipGroup(
    [{ label: '25/5', value: '25/5' }, { label: '50/10', value: '50/10' }, { label: 'custom', value: 'custom' }],
    { mono: true, value: mode, onChange: (v) => { mode = v; customRow.hidden = v !== 'custom' } },
  )
  level1.row.dataset.chipLayout = 'paired'

  return {
    row: level1.row,
    customRow,
    get value() {
      const w = Number(workInput.value) || 25
      const b = Number(brkInput.value) || 5
      if (level1.value !== 'custom') {
        const [pw, pb] = level1.value.split('/').map(Number)
        return { plannedMinutes: pw + pb, cycle: { work: pw, break: pb } }
      }
      if (customMode === 'none') return { plannedMinutes: w, cycle: null }
      if (customMode === 'open') return { plannedMinutes: null, cycle: { work: w, break: b } }
      return { plannedMinutes: w + b, cycle: { work: w, break: b } }
    },
  }
}

/** Reconstructs the picker's {mode, customMode, work, brk} starting state from a saved
 *  { plannedMinutes, cycle } choice — or the default when there is none yet. */
function restore(lastChoice) {
  if (!lastChoice) return { mode: '25/5', customMode: 'timed', work: 25, brk: 5 }
  const { plannedMinutes: pm, cycle: c } = lastChoice
  if (!c) return { mode: 'custom', customMode: 'none', work: pm ?? 25, brk: 5 }
  const preset = CYCLE_PRESETS.find((p) => p.work === c.work && p.break === c.break)
  if (preset && pm === preset.work + preset.break) {
    return { mode: `${preset.work}/${preset.break}`, customMode: 'timed', work: c.work, brk: c.break }
  }
  // A preset pair with a mismatched duration is an old-model session (e.g. 50 min through
  // two 25/5 cycles) — lands in custom, exactly where the new model puts that shape.
  return { mode: 'custom', customMode: pm == null ? 'open' : 'timed', work: c.work, brk: c.break }
}
```

In `idle()`, replace:

```javascript
  const duration = chipGroup(
    [{ label: '25 min', value: '25' }, { label: '50 min', value: '50' }, { label: 'until I stop', value: '' }],
    { mono: true, value: lastChoice ? (lastChoice.plannedMinutes == null ? '' : String(lastChoice.plannedMinutes)) : '25' },
  )

  // First ever session: cycle defaults to 50/10 (Step 3). A returning session recalls last time's pick.
  const cycle = cyclePicker(lastChoice ? lastChoice.cycle : { work: 50, break: 10 })
  cycle.row.dataset.chipLayout = 'paired'
```

with:

```javascript
  // First ever session: 25/5 (30 min). A returning session recalls last time's pick.
  const picker = cycleDurationPicker(lastChoice)
```

Then, in the same function, every use of `duration.row`, `cycle.row`, `cycle.customRow` in the two `show(...)` calls becomes `picker.row`, `picker.customRow` (with no separate `duration.row`):

```javascript
// was:
      show(header(mark), label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start,
        el('p', 'm-meta', res?.offline ? 'No connection. A session needs one to start.' : 'Could not start.'))
// now:
      show(header(mark), label, field, picker.row, picker.customRow, siteCluster, start,
        el('p', 'm-meta', res?.offline ? 'No connection. A session needs one to start.' : 'Could not start.'))
```

```javascript
// was:
  show(header(mark), label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start, disconnect)
// now:
  show(header(mark), label, field, picker.row, picker.customRow, siteCluster, start, disconnect)
```

And the `Start` click handler:

```javascript
// was:
    const plannedMinutes = duration.value ? Number(duration.value) : null
    const cycleValue = cycle.value
// now:
    const { plannedMinutes, cycle: cycleValue } = picker.value
```

(Every later reference to `plannedMinutes`/`cycleValue` in that same handler — the `sendMessage` call and the `lastChoice` write — is unchanged, since the destructured names match exactly.)

In `extension/meant.css`, add the input-styling fix (after the existing `.m-chip[data-chip-role="delete"]` rules):

```css
/* Number inputs inside the cycle reveal: chip-shaped, but a text field, not a button. */
.m-chip[data-chip-role="number"] {
  width: 56px;
  cursor: text;
  font-family: var(--m-figure);
  font-size: 12px;
  text-align: center;
  color: var(--m-ink);
}
.m-chip[data-chip-role="number"]:disabled { color: var(--m-ink-3); border-color: var(--m-edge); cursor: default; }
[data-surface="popup"] [data-chip-layout="custom"] { display: flex; align-items: center; gap: 8px; }
[data-surface="popup"] [data-chip-layout="custom"] label { display: inline-flex; align-items: center; gap: 6px; }
```

Update the comment above the existing `[data-chip-layout="paired"] > .m-chip:nth-child(3)` rule (it currently claims the gap lands after the 2nd of 4 chips before `custom`/`no cycles` — that's now stale, since there are only 3 chips and `no cycles` no longer lives at this level):

```css
/* The cycle-preset row is ONE chipGroup (exclusive single-select must span all 3
 * options), so it can't be split into two separate groups the way "cluster" wraps two
 * independent label+chipGroup pairs elsewhere in this file — this adds a visual gap
 * before the 3rd chip ("custom"), separating the two numeric presets from it. */
[data-surface="popup"] [data-chip-layout="paired"] > .m-chip:nth-child(3) {
  margin-left: 12px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/popup.spec.ts --workers=1`
Expected: PASS, including the un-skipped Task 3 test and the updated Case AH test.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that opens the idle popup, screenshots the default (level-1 only) state, clicks `custom`, screenshots again, clicks `no cycles`, screenshots a third time. Read all three screenshots with the Read tool. Confirm: level 1 shows exactly 3 aligned chips with a clear gap before "custom"; the custom reveal shows clearly-labelled work/break inputs (a text cursor, not a pointer) plus the two chips, all reasonably aligned/spaced, nothing overlapping; the "no cycles" state visibly disables/greys the break input and relabels "work" to "minutes". Delete the temp spec and screenshots afterward.

- [ ] **Step 6: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean, 0 skipped.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting the new tests, and update (don't duplicate) the existing Case AH entry to reflect the 3-chip row.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): progressive-disclosure duration+cycle picker, merging the two old separate rows"
```

---

## Task 5: Running screen copy consolidation

**Files:**
- Modify: `extension/popup.js` (`running`)
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `cyclePhase(session)` (unchanged signature/return shape).
- Produces: nothing new — only changes what text renders.

**Resolved ambiguity, not fully covered by the spec's own table**: the design spec's §9 table only covers the 3 cases where `plannedMinutes` is meaningful (set + work phase, set + break phase, `until I stop`). It does not have a row for `cycle === null` (no phase concept at all — reachable via the new picker's `no cycles`). The OLD code already handled this case correctly by simply never building a `phaseLine` when `phase` is falsy, leaving only the plain `elapsed` line (`${elapsedMinutes} min elapsed`) — **this task does not change that branch at all**; the consolidation only applies to the two lines that existed SIMULTANEOUSLY (`elapsed` + `phaseLine`), which only ever happened when a cycle was configured.

- [ ] **Step 1: Write the failing test**

Update the existing `'a running session with a cycle configured shows which phase it is in, without a ticking countdown'` test in `e2e/popup.spec.ts` — the two separate lines (`X min elapsed` and `work — Y min left`) become one:

```typescript
test('a running session with a cycle configured shows one consolidated line, not two, and never ticks', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('consolidated copy test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText(/^\d+ min · \d+ min left$/)).toBeVisible()
  await expect(page.getByText(/min elapsed/)).toHaveCount(0) // the old separate line is gone

  // Push startedAt into the break phase without a real 26-minute wait.
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('session', ({ session }: any) => {
        session.startedAt = new Date(Date.now() - 26 * 60_000).toISOString()
        chrome.storage.local.set({ session }, () => resolve())
      })
    })
  })
  await page.reload()
  await expect(page.getByText(/^\d+ min · break, \d+ min left$/)).toBeVisible()

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

Do NOT modify the neighboring `'a running session with no cycle configured shows no phase line'` test — this task's own scope note above confirms that branch is unchanged; that test should keep passing unmodified throughout.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "one consolidated line" --workers=1`
Expected: FAIL — the current code still renders `elapsed` and `phaseLine` as two separate `.m-meta` elements.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`'s `running()`, replace:

```javascript
  const startedAt = new Date(session.startedAt).getTime()
  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60000)
  const elapsed = el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

  const phaseLine = phase ? el('p', 'm-meta', `${phase.phase} — ${phase.remainingMinutes} min left`) : null
```

with:

```javascript
  const startedAt = new Date(session.startedAt).getTime()
  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60000)

  // A single read, not a ticking clock — toolkit §9 refuses "a countdown that ticks".
  // With duration merged into the cycle (Task 4), "left in this cycle" and "left in this
  // session" are the same number for every mode except "until I stop" — two lines would
  // say one thing twice, so this collapses them into one.
  const phaseLine = phase
    ? el('p', 'm-meta', phase.phase === 'break'
        ? `${elapsedMinutes} min · break, ${phase.remainingMinutes} min left`
        : `${elapsedMinutes} min · ${phase.remainingMinutes} min left`)
    : el('p', 'm-meta', `${elapsedMinutes} min elapsed`)
```

Then find the `show(...)` call at the end of `running()` and remove the now-nonexistent `elapsed` variable, since `phaseLine` is unconditional now (it's never `null`, so the spread guard is no longer needed either):

```javascript
// was:
  show(header(mark), pillWrap, ...(phaseLine ? [phaseLine] : []), elapsed, ...(blockedList ? [blockedList] : []), stop)
// now:
  show(header(mark), pillWrap, phaseLine, ...(blockedList ? [blockedList] : []), stop)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "one consolidated line" --workers=1`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean — specifically confirm `'a running session with no cycle configured shows no phase line'` still passes unmodified.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case, and update (don't duplicate) the prior case documenting the two-line version.

- [ ] **Step 7: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(popup): consolidate the running screen's elapsed+phase lines into one, now that duration is the cycle"
```

---

## Task 6: The outcome-screen attention band

**Files:**
- Modify: `extension/popup.js` (`outcome`)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `data.topAttention`, `data.awaySeconds` (already fetched by `outcome()` from `/api/sessions/:id/review` — no new request, no server change).
- Produces: nothing new exported.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`:

```typescript
test('the outcome screen shows a colored attention band between the intention and the per-domain rows', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairPopup(setupPage, extensionId)
  await setupPage.locator('input.m-field').first().fill('outcome band test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )
  const { token } = await setupPage.evaluate(
    () => new Promise<{ token: string }>((r) => chrome.storage.local.get('token', (v: any) => r(v))),
  )
  await setupPage.request.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      sessionId,
      events: [
        { kind: 'attention', domain: 'chatgpt.com', seconds: 300, at: new Date().toISOString() },
        { kind: 'away', domain: null, seconds: 60, at: new Date().toISOString() },
      ],
    },
  })
  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  await setupPage.reload()

  const band = setupPage.locator('.m-mark[data-band="session"]')
  await expect(band).toBeVisible()
  const bars = band.locator('.m-row-bar')
  await expect(bars).toHaveCount(2) // one attention-1, one away
  await expect(bars.nth(0)).toHaveAttribute('data-kind', 'attention-1')
  await expect(bars.nth(1)).toHaveAttribute('data-kind', 'away')

  // Additive — the existing text rows are still there too.
  await expect(setupPage.getByText(/chatgpt\.com — \d+ min/)).toBeVisible()
})

test('the outcome screen shows no band when there is no attention data at all', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.locator('input.m-field').first().fill('empty outcome test')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  await page.reload()

  await expect(page.locator('.m-mark[data-band="session"]')).toHaveCount(0)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/popup.spec.ts -g "colored attention band|shows no band" --workers=1`
Expected: FAIL — `outcome()` doesn't render `.m-mark[data-band="session"]` yet.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`'s `outcome()`, insert immediately after the intention block and before the `data.topAttention` text-row loop:

```javascript
  const nodes = [header(mark)]
  if (data.intention) {
    nodes.push(el('p', 'm-meta', 'You meant to'), el('p', 'm-sentence', data.intention))
  } else {
    nodes.push(el('p', 'm-meta', "You didn't say what you meant to do."))
  }

  const TINTS = ['attention-1', 'attention-2', 'attention-3']
  const bandSegments = [
    ...data.topAttention.map((r, i) => ({ kind: TINTS[i], flex: r.seconds })),
    ...(data.awaySeconds > 0 ? [{ kind: 'away', flex: data.awaySeconds }] : []),
  ].filter((s) => s.flex > 0)
  if (bandSegments.length > 0) {
    const band = el('p', 'm-mark')
    band.dataset.state = 'ended'
    band.dataset.band = 'session'
    for (const s of bandSegments) {
      const bar = el('span', 'm-row-bar')
      bar.dataset.kind = s.kind
      bar.style.flex = String(s.flex) // the one legitimate inline style: it IS the data
      band.append(bar)
    }
    nodes.push(band)
  }

  for (const row of data.topAttention) {
    nodes.push(el('p', 'm-meta', `${row.domain} — ${Math.round(row.seconds / 60)} min`))
  }
```

(This replaces the current `const nodes = [header(mark)]` through the existing `for (const row of data.topAttention)` block — everything after that loop, in the same function, is unchanged.)

In `extension/meant.css`, add after the existing `.m-mark` rules:

```css
/* The session's attention as one full-width band, above the rows that label its swatches
 * (docs/design-toolkit.md §2, "outline, then the plan, then the finished band, then the
 * rows"). data-band, not a 14th class. */
[data-surface="popup"] .m-mark[data-band="session"] { width: 100%; height: 14px; }
```

Nothing else is needed: `.m-mark:not(:empty) { display: flex; gap: 3px; ... }`, `.m-mark[data-state="ended"]:not(:empty) { border: none; }`, `.m-mark:not(:empty) > .m-row-bar { width: auto; height: 100%; border-radius: var(--m-r-chip); }`, and every `.m-row-bar[data-kind="..."]` paint rule already exist in `extension/meant.css` — this task gives them their first real producer since a prior round left them dead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/popup.spec.ts -g "colored attention band|shows no band" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that runs a session across 2-3 real domains plus some away time, stops it, screenshots the outcome view. Read the screenshot with the Read tool. Confirm: a colored, full-width band sits between the intention sentence and the per-domain text rows, with distinct color swatches (including the away hatch pattern) in the same left-to-right order as the rows below it. Delete the temp spec and screenshot afterward.

- [ ] **Step 6: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both tests.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): a colored attention band on the outcome screen, reusing the dead .m-row-bar CSS"
```

---

## Task 7: Redraw the stale design canvas and fixture files

**Files:**
- Modify: `design/canvas/PopupRunning.dc.html`
- Modify: `design/canvas/PopupIdle.dc.html`
- Modify: `design/fixtures/popup-running.html`

**Interfaces:**
- Consumes: the final, shipped behavior of Tasks 3, 4, and 6 (this task must reflect what was actually built, not a guess — do it last, after all three have landed and passed their own visual checks).
- Produces: nothing code-facing — this is documentation/visual-truth, not app code. No Playwright test for this task.

**Why this task exists**: `CLAUDE.md` states the design canvas outranks written docs as visual truth, and states that when the canvas disagrees with newer work, that must be said rather than silently resolved. `design/canvas/PopupRunning.dc.html` currently draws the attention band as a separate flat 14px strip BELOW the pill with a dashed remainder and a stale 3-step plan list — none of which matches what Tasks 3/4/6 just shipped (the band lives on the pill's own outline now, the remainder is solid, and the plan-list concept was already removed in an earlier round this artboard never caught up to). `design/canvas/PopupIdle.dc.html` still shows the old two-row duration+cycle layout Task 4 just replaced.

- [ ] **Step 1: Read the current artboards and fixtures**

Read `design/canvas/PopupRunning.dc.html`, `design/canvas/PopupIdle.dc.html`, and `design/fixtures/popup-running.html` in full. Read `design/tokens.css` and `docs/design-toolkit.md` §2 (the band's segment-order/gap conventions) to confirm you're matching established visual language, not inventing new markup patterns.

- [ ] **Step 2: Redraw `design/canvas/PopupRunning.dc.html`**

Update the artboard to show: the loop traced around the pill's own outline (not a separate strip below it), starting at top-center, solid remainder (no dashed segments), 2px stroke weight. Remove the stale 3-step plan list entirely. Match the exact segment order and 3px gap convention already established (`docs/design-toolkit.md` §2: attention-1 → attention-2 → attention-3 → remainder).

- [ ] **Step 3: Redraw `design/canvas/PopupIdle.dc.html`**

Update the artboard to show the new progressive-disclosure picker: {25/5, 50/10, custom} always visible, the custom reveal (labelled work/break inputs + until-I-stop/no-cycles) shown as its own state alongside the default collapsed state — draw both states since this is exactly the kind of "before/after a click" state a static artboard needs to show explicitly.

- [ ] **Step 4: Update `design/fixtures/popup-running.html`**

Follow the redrawn `PopupRunning.dc.html` artboard exactly — this fixture is what the impeccable detector script actually scans (see Step 5), so it must be pixel-accurate to the artboard, not just "close enough."

- [ ] **Step 5: Run the anti-pattern floor check**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs design/fixtures/popup-running.html design/fixtures/popup-idle.html`
Expected: clean (no findings), or any findings addressed before proceeding.

- [ ] **Step 6: Visual verification (required)**

Open both redrawn artboards and the updated fixture directly (not through Playwright — these are static HTML files) and confirm by eye by reading them as image files if they render to one, or by reading the raw markup carefully if not: the running artboard's loop matches what Task 3 actually shipped (top-center start, solid remainder, on-the-pill not below it, no stale plan list); the idle artboard's picker matches what Task 4 actually shipped (3-chip level 1, the custom reveal state drawn separately).

- [ ] **Step 7: Commit**

```bash
git add design/canvas/PopupRunning.dc.html design/canvas/PopupIdle.dc.html design/fixtures/popup-running.html
git commit -m "docs: redraw the popup running/idle artboards to match the shipped round-5 behavior"
```

---

## Final review

Once all 7 tasks land, dispatch a final whole-branch review on the most capable available model, matching every prior round's process. Specifically re-check:

- **`extension/popup.js` coherence across Tasks 3, 4, 5, and 6** — all four touch this one file. Confirm the final merged state of `running()` (Tasks 3 and 5 both touch it) and `idle()` (Task 4) is coherent, not just that each individual diff looked fine against its own base — re-read the actual final file, not just the diff hunks in isolation.
- **The loop's unconditional-draw decision (Task 3)** — this plan resolved an ambiguity the design spec itself didn't explicitly cover (the old `if (phase)` gate is removed entirely). Independently verify this reading is correct and doesn't contradict anything else in the spec.
- **`session.tally`'s bug fix (Task 2)** — independently verify the `??` vs. bare-`{}` fallback bug this plan found and fixed is real and correctly fixed, and that no other code path still writes the old bare `tally: {}` shape anywhere.
- **The `restore()` function's every branch (Task 4)** — this is the most state-heavy piece of new logic in the whole round; re-verify all 5 rows of the design spec's truth table (§6.2) against the actual shipped `cycleDurationPicker()`/`restore()` code, not just the tests that happened to be written.
- **No live tick anywhere**: `grep -rn "setInterval" extension/` must return nothing.
- **No hex values**: `grep -rn "#[0-9A-Fa-f]\{6\}" extension/popup.js extension/meant.css` must return nothing (excluding pre-existing, unrelated hex values this plan didn't touch, if any — flag and distinguish rather than assume).
- Run a production `next build` before considering the whole batch done.
