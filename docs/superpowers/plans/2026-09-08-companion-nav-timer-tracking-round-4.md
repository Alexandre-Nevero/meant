# Companion Hover Pill, Timer Loop, Nav Icons, Chip Density, Tracking Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real, still-open tracking bug (a second, unpatched code path that lets a junk domain display on the review page), grow and enhance the floating companion (bigger, a real hover-reveal intention pill instead of a native tooltip), redesign the running popup's timer pill (a segmented outline traced around its full perimeter via SVG instead of one flat strip), relocate the popup's nav links to icon buttons in a new top-right header, and tighten the cycle-preset chip row's visual grouping.

**Architecture:** Six independent fixes across `lib/band.ts`/`lib/review-data.ts`, `extension/companion-overlay.js` (two separate tasks), and `extension/popup.js`/`extension/meant.css` (three separate tasks). Task order is chosen for risk (cheapest, most isolated first) and file-overlap sequencing (three tasks share `extension/popup.js`, ordered so each one's own `show(...)` argument-list changes don't collide with the next).

**Tech Stack:** Next.js (App Router) web app, plain-ES-modules Chrome MV3 extension (no bundler), Playwright E2E, Node's built-in test runner for unit tests.

## Global Constraints

- This is a git worktree (`worktree-drift-and-cycles`, on branch `companion-nav-timer-round-4`, based on the latest merged `main`) — no `-C`/`cd` into another worktree, no git operations targeting another worktree.
- Never add AI/assistant attribution to any commit message.
- Tokens-first CSS — `design/tokens.css` values only, never a hex value in a component — **except** the two deliberately-fixed, non-theme-toggled hex values in Task 3 (the companion hover pill): `#F3F1EE` and `#14120F`. This is an explicit, reasoned exception, not an oversight — it mirrors the same fixed-color fix already applied to the companion dot itself in a prior round (a contrast-critical color floating over arbitrary, unknown page backgrounds must not depend on `prefers-color-scheme`, which reflects the OS setting, not the actual page behind it). Do not "fix" this back to a token or a `@media (prefers-color-scheme)` block.
- No new class name beyond the frozen contract (`.m-app .m-mark[data-state] .m-sentence .m-meta .m-field .m-btn[data-variant] .m-answer .m-row .m-row-domain .m-row-bar[data-kind] .m-row-figure .m-rate .m-empty` plus `.m-chip`/`.m-chip-row`/`.m-companion-*` for the extension) — attribute-based extensibility (`data-*`) is fine, new class names are not.
- After every task: `npx playwright test --workers=1` (no `--reporter` flag — it silently drops the JSON reporter this repo's config relies on), `npx tsc --noEmit`, and `npm test` must all be clean.
- Every behavior-changing fix gets a new/extended Playwright case and a `docs/qa-recipe-playwright-e2e.md` lettered-case update — continue lettering from wherever the file currently ends (confirmed at plan-writing time: last case is **AB**, last item number is **66** — so the next case is **AC**, starting at item **67** — but re-check the file's actual current end state before assuming this hasn't shifted, since it's possible another task landed since this plan was written).
- Confirm the dev server (`npm run dev`) is live via `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000` before any Playwright run; start it with `nohup npm run dev > /tmp/dev-server.log 2>&1 & disown` if not.
- Every UI-affecting task (Tasks 2, 3, 4, 5, 6) requires a real screenshot visual check (write a temp spec, screenshot, read it with the Read tool, actually look, then delete the temp spec) before being considered done — per this repo's own CLAUDE.md: "Static code and a clean build are not evidence. Render it and look."
- This machine has intermittently hit real memory pressure during heavy Playwright runs this session. If a full-suite run dies from process/system death (not real assertion failures — e.g. many unrelated tests suddenly failing with connection errors, or the process itself terminating), that's environmental: restart the dev server if needed and retry once; if it recurs, fall back to the specific spec file(s) the task touched plus `tsc`/unit tests as evidence, noting it in the report.
- Do not re-litigate any already-resolved design tension (the companion's 52px size ceiling, the loop-behavior-for-indefinite-timers resolution, the fixed-color hover-pill decision, the no-new-icon-system decision, the conservative chip-grouping-not-a-disclosure decision) — implement exactly what each task specifies, not a menu of alternatives.

---

## Task 1: Domain-tracking hygiene — fix the second, unpatched code path

**Files:**
- Modify: `lib/band.ts` (export the existing shape guard)
- Modify: `lib/review-data.ts` (`getReviewData`)
- Test: `test/review-data.test.js` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `lib/band.ts` now exports `EXTENSION_ID_SHAPE` (previously module-private) — later tasks don't consume this, but any future code touching domain-shape validation should import this rather than redeclare it.

- [ ] **Step 1: Write the failing test**

Create `test/review-data.test.js`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { EXTENSION_ID_SHAPE } from '../lib/band.ts'

// getReviewData() itself hits a real Postgres connection (lib/db.ts's `sql`), so it can't
// be unit-tested directly without a database — this test instead proves the EXACT filter
// condition getReviewData's topAttention computation will use, mirroring the shape of its
// real filter chain rather than calling the function itself.
test('the topAttention filter shape excludes an extension-ID-shaped domain', () => {
  const rows = [
    { kind: 'attention', domain: 'chatgpt.com', seconds: 60 },
    { kind: 'attention', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 30 },
  ]
  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .slice(0, 3)
    .map((r) => ({ domain: r.domain, seconds: r.seconds }))
  assert.equal(topAttention.length, 1)
  assert.equal(topAttention[0].domain, 'chatgpt.com')
})

test('the topAttention filter shape still includes localhost', () => {
  const rows = [{ kind: 'attention', domain: 'localhost', seconds: 45 }]
  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .slice(0, 3)
    .map((r) => ({ domain: r.domain, seconds: r.seconds }))
  assert.equal(topAttention.length, 1)
  assert.equal(topAttention[0].domain, 'localhost')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/review-data.test.js`
Expected: FAIL — `EXTENSION_ID_SHAPE` isn't exported from `lib/band.ts` yet (import error), so both tests fail before even reaching their assertions.

- [ ] **Step 3: Export the shape guard from `lib/band.ts`**

In `lib/band.ts`, change:

```typescript
const EXTENSION_ID_SHAPE = /^[a-p]{32}$/
```

to:

```typescript
export const EXTENSION_ID_SHAPE = /^[a-p]{32}$/
```

No other change to this file — `toBand()`'s own behavior is unaffected by exporting a constant it already used internally.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/review-data.test.js`
Expected: PASS.

- [ ] **Step 5: Fix `getReviewData()`'s real `topAttention` computation**

In `lib/review-data.ts`, add the import:

```typescript
import { sql } from '@/lib/db'
import { EXTENSION_ID_SHAPE } from '@/lib/band'
```

And change:

```typescript
  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain)
    .slice(0, 3)
    .map((r) => ({ domain: r.domain as string, seconds: r.seconds }))
```

to:

```typescript
  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .slice(0, 3)
    .map((r) => ({ domain: r.domain as string, seconds: r.seconds }))
```

- [ ] **Step 6: Write a real E2E test proving the fix on the actual review page**

Add to `e2e/review.spec.ts`:

```typescript
test('the review page never shows an extension-ID-shaped domain in its per-domain row list', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('tracking hygiene test')
  await setupPage.getByRole('button', { name: 'Start' }).click()
  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Inject one real attention row and one extension-ID-shaped row directly via the same
  // API sw.js's own flush() uses — deterministic, no dependency on real tab-switching
  // timing, matching this suite's own established precedent for injecting review-data
  // fixtures.
  const deviceOnly = await context.request.newContext()
  await deviceOnly.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      sessionId,
      events: [
        { kind: 'attention', domain: 'chatgpt.com', seconds: 90, at: new Date().toISOString() },
        { kind: 'attention', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 30, at: new Date().toISOString() },
      ],
    },
  })

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  const reviewPage = await context.newPage()
  await reviewPage.goto(`/review/${sessionId}`)
  await expect(reviewPage.getByText('chatgpt.com')).toBeVisible()
  await expect(reviewPage.getByText('emnalgngpciahekjdcgpbgnhmkpjhlhi')).toHaveCount(0)
})
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test e2e/review.spec.ts -g "never shows an extension-ID-shaped domain" --workers=1`
Expected: PASS. Before landing, temporarily revert Step 5's filter (remove the
`&& !EXTENSION_ID_SHAPE.test(r.domain)` clause) and rerun this exact test — confirm it
genuinely FAILS (the junk domain visible on the page), then restore the fix and confirm
it passes again. This project's history has repeatedly found real test-design bugs that
only surfaced when someone actually reverted the fix and reran — do not skip this.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 9: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both the unit test and the E2E test (check the file's actual current end state first — plan-writing time was Case AB / item 66).

- [ ] **Step 10: Commit**

```bash
git add lib/band.ts lib/review-data.ts test/review-data.test.js e2e/review.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(review): exclude extension-ID-shaped domains from the per-domain row list too"
```

---

## Task 2: Companion size — 36px to 52px

**Files:**
- Modify: `extension/companion-overlay.js`
- Test: `e2e/companion.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — a single constant change with no new exports.

- [ ] **Step 1: Write the failing test**

Add to `e2e/companion.spec.ts`, inside the existing `test.describe('floating companion', ...)` block:

```typescript
test('the companion is 52px, not the old 36px', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const page = await context.newPage()
  await page.goto('https://example.com')
  const box = (await page.locator(HOST_SELECTOR).boundingBox())!
  expect(box.width).toBe(52)
  expect(box.height).toBe(52)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/companion.spec.ts -g "52px, not the old 36px" --workers=1`
Expected: FAIL — `SIZE` is still `36`.

- [ ] **Step 3: Implement the fix**

In `extension/companion-overlay.js`:

```javascript
const DEFAULT_POSITION = { right: 24, bottom: 24 }
const SIZE = 52
```

No other change — `positionHost`, `onDrag`, `endDrag` all already derive every measurement from the `SIZE` constant.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "52px, not the old 36px" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec at `e2e/_tmp-companion-size-visual.spec.ts` that pairs and starts a
session, navigates to a real page, and screenshots the companion. Read the screenshot with
the Read tool. Confirm: the dot reads as noticeably more substantial than the prior 36px
size without dominating the page — still clearly a small, ambient corner presence, not a
focal element. Delete the temp spec and screenshot afterward.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test (check the file's actual current end state
first).

- [ ] **Step 8: Commit**

```bash
git add extension/companion-overlay.js e2e/companion.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(companion): grow the companion from 36px to 52px"
```

---

## Task 3: Companion hover-reveal intention pill

**Files:**
- Modify: `extension/companion-overlay.js`
- Test: `e2e/companion.spec.ts`

**Interfaces:**
- Consumes: `SIZE` (from Task 2, now `52` — the hover pill's positioning is relative to
  `:host`, so it automatically sits above/below whatever `SIZE` currently is; no
  size-specific math needed in this task).
- Produces: nothing new exported — purely internal to this file.

**Real, current-code fact this task must account for**: there is currently **no
module-level variable holding the current session** in this file — `applyState(session,
companionState)` only ever receives `session` as a per-call parameter, and the hover
listeners (registered once, inside `ensureMounted()`, which runs only on first mount) need
a way to read whatever the *latest* session is at the moment of a *later* hover, which
could happen long after that render. This task adds a module-level `currentSession`
variable, set every time `applyState()` runs.

- [ ] **Step 1: Write the failing test**

Add to `e2e/companion.spec.ts`:

```typescript
test('hovering the companion reveals a pill showing the intention, styled and positioned above the dot', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId, 'write the quarterly report')

  const page = await context.newPage()
  await page.goto('https://example.com')
  const host = page.locator(HOST_SELECTOR)
  const pill = host.locator('[data-companion-hover-pill="true"]')

  await expect(pill).toHaveCSS('opacity', '0')

  const dotWrap = host.locator('.dot-wrap')
  await dotWrap.hover()
  await expect(pill).toHaveCSS('opacity', '1', { timeout: 1_000 })
  await expect(pill).toHaveText('write the quarterly report')

  const dotBox = (await host.boundingBox())!
  const pillBox = (await pill.boundingBox())!
  expect(pillBox.y + pillBox.height).toBeLessThan(dotBox.y) // pill sits above the dot

  await page.mouse.move(0, 0) // move away, outside the companion entirely
  await expect(pill).toHaveCSS('opacity', '0', { timeout: 1_000 })

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

This requires extending the existing `pairAndStart` helper at the top of
`e2e/companion.spec.ts` to accept an optional intention string (it currently hardcodes
`'companion test'`):

```typescript
async function pairAndStart(page: import('@playwright/test').Page, extensionId: string, intention = 'companion test') {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await page.reload()
  await page.locator('input.m-field').first().fill(intention)
  await page.getByRole('button', { name: 'Start' }).click()
}
```

Every existing call site (`pairAndStart(setupPage, extensionId)`) still works unchanged,
since the new parameter has a default.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/companion.spec.ts -g "reveals a pill showing the intention" --workers=1`
Expected: FAIL — `[data-companion-hover-pill="true"]` doesn't exist yet.

- [ ] **Step 3: Implement the fix**

In `extension/companion-overlay.js`, add a module-level variable alongside the existing
ones:

```javascript
let hostEl = null
let shadow = null
let dot = null
let dragState = null
let returnTimer = null
let currentSession = null
let hoverPill = null
let hoverTimer = null
```

Add the hover-pill CSS to the `css()` function's returned template literal, right after
the existing `.dot` rules and before the `@media (prefers-reduced-motion: reduce)` block:

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

Add the three new functions (`showHoverPill`, `hideHoverPill`, and inline construction
inside `ensureMounted`) — full `ensureMounted()` becomes:

```javascript
async function ensureMounted() {
  if (hostEl) return
  hostEl = document.createElement('div')
  hostEl.dataset.meantCompanion = 'true'
  shadow = hostEl.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css()
  dot = document.createElement('div')
  dot.className = 'dot-wrap'
  const ring = document.createElement('div')
  ring.className = 'ring'
  const core = document.createElement('div')
  core.className = 'dot'
  dot.append(ring, core)
  hoverPill = document.createElement('p')
  hoverPill.dataset.companionHoverPill = 'true'
  shadow.append(style, dot, hoverPill)
  document.documentElement.append(hostEl)
  await positionHost()

  dot.addEventListener('pointerdown', startDrag)
  dot.addEventListener('pointermove', onDrag)
  dot.addEventListener('pointerup', endDrag)
  dot.addEventListener('pointercancel', endDrag)
  dot.addEventListener('pointerenter', showHoverPill)
  dot.addEventListener('pointerleave', hideHoverPill)
}

function showHoverPill() {
  if (!currentSession?.intention) return
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    hoverPill.textContent = currentSession.intention
    hoverPill.style.opacity = '1'
    hoverPill.style.bottom = 'calc(100% + 8px)'
    hoverPill.style.top = ''
    hoverPill.style.left = '50%'
    hoverPill.style.transform = 'translateX(-50%)'
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
  if (hoverPill) hoverPill.style.opacity = '0'
}
```

Update `unmount()` to also clear `hoverPill`/`hoverTimer` state (matching the existing
pattern of nulling every mount-scoped variable):

```javascript
function unmount() {
  if (!hostEl) return
  hostEl.remove()
  hostEl = null
  shadow = null
  dot = null
  hoverPill = null
  clearTimeout(returnTimer)
  clearTimeout(hoverTimer)
}
```

Update `applyState()` to set `currentSession` on every call:

```javascript
async function applyState(session, companionState) {
  if (!session) {
    unmount()
    currentSession = null
    return
  }
  currentSession = session
  await ensureMounted()
  applyVisualState(companionState === 'drifting' ? 'drift' : 'focus')
  dot.title = session.intention || ''
}
```

The existing `dot.title = session.intention || ''` line stays exactly as-is — the native
`title` attribute remains a supplementary fallback (helps a keyboard/assistive-tech user
who can't hover), it is not replaced by the new pill, only supplemented.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "reveals a pill showing the intention" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that pairs and starts a session with a real intention, navigates to
a real page with a plain white background, hovers the companion, screenshots it, and reads
the screenshot with the Read tool. Confirm: the pill is clearly legible (dark text on a
light card), sits directly above the dot with a visible gap, doesn't look clipped or
oddly positioned. Also test hovering the companion when it's dragged near the very top of
the viewport (drag it there first) — confirm the pill flips to render BELOW the dot
instead of clipping off the top of the screen. Delete the temp spec and screenshots
afterward.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test (check the file's actual current end state
first).

- [ ] **Step 8: Commit**

```bash
git add extension/companion-overlay.js e2e/companion.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(companion): a real styled pill on hover, showing the intention, instead of only a native tooltip"
```

---

## Task 4: Running popup's timer pill — outline as a static segmented loop

**Files:**
- Modify: `extension/popup.js` (`running`)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `cyclePhase(session)` (already exists, unchanged signature/return shape —
  `{ phase, elapsedInPhaseMs, phaseMs, remainingMinutes } | null`).
- Produces: nothing new exported — this only changes how `running()` renders the existing
  fill data.

**Scope boundary:** stays static — recomputed only on the popup's own natural re-render,
never a live tick, never a circular dial. This replaces the *rendering technique* the
prior round shipped (a flat 3px strip on the bottom edge only) with an SVG stroke traced
around the pill's full existing rounded-rect shape — the corner radius itself is
unchanged (still 26px, matching `--m-r-field`), this is not a new capsule/stadium shape.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`, inside the existing `'popup, running state'` describe block:

```typescript
test('the intention pill\'s progress is drawn as an SVG loop around its full perimeter, not a bottom-only strip', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5' }).click()
  await page.locator('input.m-field').first().fill('loop test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap).toBeVisible()
  const svg = pillWrap.locator('svg')
  await expect(svg).toBeVisible()
  const rects = svg.locator('rect')
  await expect(rects).toHaveCount(2) // one track rect, one progress rect

  // The progress rect's stroke-dasharray should reflect a genuine, non-zero elapsed
  // fraction of the perimeter, not a fixed placeholder value.
  const dasharray = await rects.nth(1).getAttribute('stroke-dasharray')
  expect(dasharray).toBeTruthy()
  const [filled, total] = dasharray!.split(' ').map(Number)
  expect(filled).toBeGreaterThan(0)
  expect(filled).toBeLessThan(total)

  // The wrapper's own CSS border is suppressed while the SVG carries the visible outline.
  await expect(pillWrap).toHaveCSS('border-style', 'none')

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the pill keeps its plain CSS border, no SVG, when no cycle is configured', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: 'no cycles' }).click()
  await page.locator('input.m-field').first().fill('no cycle loop test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap).toBeVisible()
  await expect(pillWrap.locator('svg')).toHaveCount(0)
  await expect(pillWrap).not.toHaveCSS('border-style', 'none')

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/popup.spec.ts -g "SVG loop around its full perimeter|plain CSS border, no SVG" --workers=1`
Expected: FAIL — no `<svg>` exists inside `[data-timer-pill]` yet; the fill still lives on
a separate nested `.m-mark` bottom strip.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`, replace the `if (phase) { ... }` block inside `running()` that
currently builds the nested `.m-mark` strip:

```javascript
  // The intention's own box doubles as the cycle's static progress indicator: an SVG
  // stroke traced around the pill's existing rounded-rect shape (same 26px corner radius
  // as --m-r-field — this doesn't change the pill's shape, only how its outline is
  // drawn), instead of a flat strip on one edge. `.m-field`/`.m-sentence` cannot show a
  // two-tone border directly (an <input> can't hold child DOM nodes, and CSS
  // border-image doesn't combine reliably with border-radius across browsers) — an SVG
  // sibling avoids both problems. Static only — recomputed on the popup's own natural
  // re-render, never a live tick; getTotalLength() gives the exact rendered perimeter for
  // THIS pill's real, measured size (it can grow to two lines), no manual formula needed.
  const pillWrap = el('div')
  pillWrap.dataset.timerPill = 'true'
  pillWrap.append(sentenceNode)
  if (phase) {
    requestAnimationFrame(() => {
      const { width, height } = pillWrap.getBoundingClientRect()
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;'

      const r = 26
      function track(strokeColor) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', '0.75')
        rect.setAttribute('y', '0.75')
        rect.setAttribute('width', String(width - 1.5))
        rect.setAttribute('height', String(height - 1.5))
        rect.setAttribute('rx', String(r))
        rect.setAttribute('ry', String(r))
        rect.setAttribute('fill', 'none')
        rect.setAttribute('stroke', strokeColor)
        rect.setAttribute('stroke-width', '1.5')
        return rect
      }

      const remainderTrack = track('var(--m-edge)')
      remainderTrack.setAttribute('stroke-dasharray', '3 3')
      const elapsedTrack = track('var(--m-clay)')
      svg.append(remainderTrack, elapsedTrack)
      pillWrap.append(svg)
      pillWrap.style.border = 'none'

      const perimeter = elapsedTrack.getTotalLength()
      const elapsedFraction = phase.elapsedInPhaseMs / phase.phaseMs
      elapsedTrack.setAttribute('stroke-dasharray', `${perimeter * elapsedFraction} ${perimeter}`)
    })
  }
```

`[data-timer-pill]`'s existing CSS rule in `extension/meant.css` keeps its plain
`border: var(--m-stroke) solid var(--m-ink); border-radius: var(--m-r-field);` as the
default (unchanged) — the JS above only sets `pillWrap.style.border = 'none'` inline when
`phase` exists, so the no-cycle case (no `phase`, no `requestAnimationFrame` callback ever
runs) keeps the plain CSS border exactly as it renders today. Add one small addition to
`extension/meant.css`'s existing `[data-timer-pill]` block: nothing needs to change there
— the CSS itself already only defines the border/radius; suppression is handled entirely
via the inline style set above, matching the existing precedent of `pillWrap.style.border`
being an instance-level override, not a stylesheet rule.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/popup.spec.ts -g "SVG loop around its full perimeter|plain CSS border, no SVG" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that starts a session with the `25/5` preset, pushes
`session.startedAt` back ~10 minutes (matching this suite's own established pattern for
landing partway into a phase without a real wait), reloads the popup, and screenshots it at
its native 360px width. Read the screenshot with the Read tool. Confirm: the pill's full
outline (not just the bottom edge) shows the two-tone split — solid clay for elapsed,
dashed for remaining — tracing the pill's existing rounded corners cleanly (no visible
gaps or overlaps at the corners), the intention text is still legible inside, and the phase
text still sits directly under the pill. Also click into the intention field (should be
editable, within the grace window) and screenshot — confirm the `:focus-visible` outline
is not clipped anywhere along the pill's edge. Delete the temp spec and screenshots
afterward.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both tests, and update (don't duplicate) the existing
case for the prior round's bottom-strip version, noting the rendering technique changed
from a flat strip to a full-perimeter SVG loop.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): trace the intention pill's cycle progress around its full outline via SVG, not a bottom-only strip"
```

---

## Task 5: Popup top-right nav icons, new header row

**Files:**
- Modify: `extension/popup.js` (`idle`, `running`, `navRow`)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `pillWrap` (from Task 4 — this task's own change to `running()`'s
  `show(...)` call must preserve `pillWrap` as the second argument, unaffected by the
  header change to the first argument).
- Produces: `navRow()` gains icon-only buttons (still returns the same `{ }`-free plain
  DOM node shape it does today — a `.m-chip-row` div — no signature change, only its
  internal button construction changes).

**Read the CURRENT actual `idle()`/`running()` functions before starting** — Task 4 will
have already landed and changed `running()`'s exact `show(...)` argument list by the time
this task runs; confirm the second argument is still `pillWrap` (not `sentenceNode`
directly) before writing this task's own diff.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`:

```typescript
test('History and meant.app render as icon buttons in a header row, top-right, not full-width text buttons at the bottom', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const header = page.locator('[data-popup-header="true"]')
  await expect(header).toBeVisible()
  const historyButton = header.getByRole('button', { name: 'View session history' })
  const meantButton = header.getByRole('button', { name: 'Open meant.app' })
  await expect(historyButton).toBeVisible()
  await expect(meantButton).toBeVisible()

  // Icon-only: no visible text content, an SVG (or the reused .m-mark glyph) inside.
  await expect(historyButton).toHaveText('')
  await expect(meantButton.locator('svg')).toHaveCount(1)

  // The header's mark and nav row sit side by side, mark on the left.
  const markBox = (await header.locator('.m-mark').boundingBox())!
  const navBox = (await header.locator('.m-chip-row').boundingBox())!
  expect(navBox.x).toBeGreaterThan(markBox.x)

  // No separate nav row at the very bottom anymore.
  await expect(page.locator('#root > .m-chip-row').last()).not.toBeVisible({ timeout: 500 }).catch(() => {})
});
```

Note: the last assertion above is a soft sanity check (its own `.catch` swallows a false
negative if the selector doesn't match the real DOM shape) — the load-bearing assertions
are the ones before it (the header exists, both buttons are inside it, they're icon-only).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "header row, top-right" --workers=1`
Expected: FAIL — `[data-popup-header="true"]` doesn't exist yet; "History"/"meant.app" are
still full-width text buttons at the bottom.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`, replace `navRow()`:

```javascript
function navRow() {
  const row = el('div', 'm-chip-row')
  const history = el('button', 'm-btn')
  history.dataset.variant = 'quiet'
  history.setAttribute('aria-label', 'View session history')
  history.append(markGlyph())
  history.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/dashboard' })
  })
  const landing = el('button', 'm-btn')
  landing.dataset.variant = 'quiet'
  landing.setAttribute('aria-label', 'Open meant.app')
  landing.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M6 2H2v10h10V8M8 2h4v4M12 2 6 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>'
  landing.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/' })
  })
  row.append(history, landing)
  return row
}

// The "History" icon reuses the existing decorative mark glyph (the same
// .m-mark[data-state="ended"] already used everywhere a completed/past session is
// represented) — no new icon system, per this product's own explicit rule that the mark
// is the only icon this product has.
function markGlyph() {
  const glyph = el('p', 'm-mark', '')
  glyph.dataset.state = 'ended'
  return glyph
}
```

Add a `header()` helper and use it in both `idle()` and `running()`:

```javascript
function header(mark) {
  const wrap = el('div')
  wrap.dataset.popupHeader = 'true'
  wrap.append(mark, navRow())
  return wrap
}
```

In `idle()`, change the top of the function and its `show(...)` call:

```javascript
// was: const mark = el('p', 'm-mark', ''); mark.dataset.state = 'idle'
const mark = el('p', 'm-mark', '')
mark.dataset.state = 'idle'
// ... (everything else in idle() between mark's construction and its show() call is unchanged) ...

// was: show(mark, label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start, disconnect, navRow())
show(header(mark), label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start, disconnect)
```

(Do the same for `idle()`'s other `show(...)` call sites that currently start with `mark`
and end with `navRow()` — read the full function to find every one, since it has more than
one render path, e.g. the start-failed error path.)

In `running()`, change only the final `show(...)` call:

```javascript
// was: show(mark, pillWrap, ...(phaseLine ? [phaseLine] : []), elapsed, ...(blockedList ? [blockedList] : []), stop, navRow())
show(header(mark), pillWrap, ...(phaseLine ? [phaseLine] : []), elapsed, ...(blockedList ? [blockedList] : []), stop)
```

In `extension/meant.css`, add:

```css
/* ---------- [data-popup-header] — mark + nav icons, top-right ---------- */
[data-popup-header] {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
[data-popup-header] .m-chip-row { gap: 8px; }
[data-popup-header] .m-btn {
  width: auto;
  padding: 8px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "header row, top-right" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that opens the idle popup and the running popup, screenshotting
both at 360px width. Read both screenshots with the Read tool. Confirm: the mark glyph and
the two icon buttons sit on one row, mark left, icons right, nothing overlapping or
misaligned; the icon buttons read as clearly clickable (not just decorative) at a glance
even without visible text; the popup no longer has the old full-width "History"/"meant.app"
text buttons anywhere at the bottom. Delete the temp spec and screenshots afterward.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`. Pay particular
attention to any OTHER existing test that asserted on the old "History"/"meant.app" text-
button behavior (e.g. a prior test clicking `getByRole('button', { name: 'History' })` by
its visible text name) — these will now need to target the new `aria-label` instead
(`getByRole('button', { name: 'View session history' })`); find and update every such
call site rather than leaving a now-broken assertion.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test, and update (don't duplicate) any existing
case that referenced the old text-button nav row by name.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): move History/meant.app into a top-right icon header, reusing the mark glyph instead of a new icon system"
```

---

## Task 6: Cycle-preset chip row — visual grouping without breaking exclusive selection

**Files:**
- Modify: `extension/popup.js` (`cyclePicker`)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `chipGroup()` (unchanged signature — this task does not modify `chipGroup`
  itself, only how `cyclePicker()` tags the row it returns).
- Produces: nothing new exported.

**A real correction to the original design spec, found while researching this task**: the
spec described reusing the existing `data-chip-layout="cluster"` pattern for this row, but
that pattern wraps two *separate* label+chipGroup pairs (see `idle()`'s `whereGroup`/
`blockGroup`/`siteCluster`) — the cycle-preset row is a *single* `chipGroup()` call with
all 4 options as direct sibling buttons in one `.m-chip-row`, relying on that ONE group's
own internal `aria-pressed` exclusivity logic. Splitting it into two separate `chipGroup()`
calls (to reuse the literal cluster pattern) would break that exclusivity — selecting a
preset in one group wouldn't un-press "custom" in a different group. The correct fix is a
CSS-only visual gap between the 2nd and 3rd chip, within the same single group, not a
DOM/structural split.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`:

```typescript
test('the cycle-preset row visually separates the two duration presets from custom/no cycles', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const cycleRow = page.locator('[data-chip-layout="paired"]')
  await expect(cycleRow).toBeVisible()
  const chips = cycleRow.locator('.m-chip')
  await expect(chips).toHaveCount(4)

  const secondBox = (await chips.nth(1).boundingBox())! // "50/10"
  const thirdBox = (await chips.nth(2).boundingBox())! // "custom"
  const firstGap = (await chips.nth(1).boundingBox())!.x - ((await chips.nth(0).boundingBox())!.x + (await chips.nth(0).boundingBox())!.width)
  const groupGap = thirdBox.x - (secondBox.x + secondBox.width)
  expect(groupGap).toBeGreaterThan(firstGap) // the gap between groups is wider than the gap within a group

  // Exclusive selection still works correctly across the whole row, including across
  // the new visual gap — clicking "custom" (in the second visual group) must un-press
  // "25/5" (in the first visual group), proving this is still ONE chipGroup, not two.
  await chips.first().click() // 25/5
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true')
  await chips.nth(2).click() // custom
  await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true')
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'false')
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "visually separates the two duration presets" --workers=1`
Expected: FAIL — `[data-chip-layout="paired"]` doesn't exist yet, and the gap between all
4 chips is currently uniform (no wider gap before "custom").

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`, find where `cyclePicker(...)` is called inside `idle()` (the line
constructing `const cycle = cyclePicker(...)`) and add, immediately after that line:

```javascript
const cycle = cyclePicker(lastChoice ? lastChoice.cycle : { work: 50, break: 10 })
cycle.row.dataset.chipLayout = 'paired'
```

In `extension/meant.css`, add near the existing `[data-chip-layout]` rules:

```css
/* The cycle-preset row is ONE chipGroup (exclusive single-select must span all 4
 * options), so it can't be split into two separate groups the way "cluster" wraps two
 * independent label+chipGroup pairs elsewhere in this file — this adds a visual gap
 * before the 3rd chip only, keeping all 4 buttons siblings in the same group. */
[data-surface="popup"] [data-chip-layout="paired"] > .m-chip:nth-child(3) {
  margin-left: 12px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "visually separates the two duration presets" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that opens the idle popup and screenshots the cycle-preset row at
360px width. Read the screenshot with the Read tool. Confirm: the two numeric presets
("25/5", "50/10") read as one visual pair, with a clearly larger gap before "custom",
which reads together with "no cycles" as a second pair — the row overall looks less like
one undifferentiated strip of 4 identical chips. Delete the temp spec and screenshot
afterward.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test (check the file's actual current end state
first).

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(popup): visually group the cycle-preset row into presets vs. custom/no-cycles, without splitting exclusive selection"
```

---

## Final review

Once all 6 tasks land, dispatch a final whole-branch review on the most capable available
model, the same way the prior rounds did: `scripts/review-package` over the full range
(the branch's fork point from `main` through the last task's commit), specifically
re-checking:
- `extension/companion-overlay.js`'s coherence across Tasks 2 and 3 (the size change and
  the new hover-pill's positioning math both depend on `SIZE`/`:host` geometry — confirm
  no stale assumption from one task leaked into the other).
- `extension/popup.js`'s coherence across Tasks 4, 5, and 6 (all three touch this one
  file — confirm Task 5's `header()` wrapper and Task 4's `pillWrap` compose correctly in
  `running()`'s final `show(...)` call, and that Task 6's `cycle.row.dataset.chipLayout`
  assignment doesn't collide with anything Task 5 changed in `idle()`).
- Independently re-verify the hover pill's fixed, non-theme-toggled colors are genuinely
  unaffected by `prefers-color-scheme` (this was a real, hard-won lesson from a bug in this
  exact file in a prior round — confirm it wasn't accidentally reintroduced).
- Independently re-verify the SVG timer loop stays static (no `setInterval`/`setTimeout`/
  `requestAnimationFrame`-in-a-loop driving it after its one-time construction, and its
  flex/dasharray values don't change without a real popup re-render).
- Run a production `next build` before considering the whole batch done.
