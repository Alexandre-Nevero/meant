# Companion, Popup Timer, and Review-Page Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five independent, real-browser-reported issues: the companion is invisible on light pages and feels too small/static; the review page is unstyled-wide unlike the dashboard; historical junk domain rows can still display; blocked tabs never revert once a session ends; and the running popup's cycle-phase display doesn't match the requested "outline of the pill carries progress, intention stays inside, timer text below" layout.

**Architecture:** Five self-contained fixes across `extension/companion-overlay.js`, `app/globals.css`, `lib/band.ts`, `extension/sw.js`, and `extension/popup.js`/`extension/meant.css`. No task depends on another's code; task order here is chosen for risk (cheapest/safest first) and dependency-adjacency (companion and block-reversion both touch extension internals, popup timer is the most design-sensitive and goes last).

**Tech Stack:** Next.js (App Router) web app, plain-ES-modules Chrome MV3 extension (no bundler), Playwright E2E, Node's built-in test runner for unit tests.

## Global Constraints

- This is a git worktree (`worktree-drift-and-cycles`, on branch `companion-popup-review-fixes`, based on the latest `main`) — no `-C`/`cd` into another worktree, no git operations targeting another worktree.
- Never add AI/assistant attribution to any commit message.
- Tokens-first CSS — `design/tokens.css` values only, never a hex value in a component.
- No new class name beyond the frozen contract (`.m-app .m-mark[data-state] .m-sentence .m-meta .m-field .m-btn[data-variant] .m-answer .m-row .m-row-domain .m-row-bar[data-kind] .m-row-figure .m-rate .m-empty` plus `.m-chip`/`.m-chip-row`/`.m-companion-*` for the extension) — attribute-based extensibility (`data-*`) is fine, new class names are not.
- After every task: `npx playwright test --workers=1` (no `--reporter` flag — it silently drops the JSON reporter this repo's config relies on), `npx tsc --noEmit`, and `npm test` must all be clean.
- Every behavior-changing fix gets a new/extended Playwright case and a `docs/qa-recipe-playwright-e2e.md` lettered-case update — continue lettering from wherever the file currently ends (confirmed at plan-writing time: last case is **X**, last item number is **59** — so the next case is **Y**, starting at item **60** — but re-check the file's actual current end state before assuming this hasn't shifted, since it's possible another task landed since this plan was written).
- Confirm the dev server (`npm run dev`) is live via `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000` before any Playwright run; start it with `nohup npm run dev > /tmp/dev-server.log 2>&1 & disown` if not.
- Every UI-affecting task (Tasks 1, 2, 5) requires a real screenshot visual check (write a temp spec, screenshot, read it with the Read tool, actually look, then delete the temp spec) before being considered done — per this repo's own CLAUDE.md: "Static code and a clean build are not evidence. Render it and look."
- This machine has intermittently hit real memory pressure during heavy Playwright runs this session. If a full-suite run dies from process/system death (not real assertion failures — e.g. many unrelated tests suddenly failing with connection errors, or the process itself terminating), that's environmental: restart the dev server if needed and retry once; if it recurs, fall back to the specific spec file(s) the task touched plus `tsc`/unit tests as evidence, noting it in the report.
- Do not re-litigate the timer-ring-vs-static-progress decision in Task 5 (already resolved directly with the product owner: a static outline showing elapsed/remaining, never a live tick, never a dial or ring) — implement exactly the wrapped-pill-with-bottom-edge-strip approach specified, not a menu of alternatives.

---

## Task 1: Companion redesign — contrast-safe color, bigger size, a wake animation

**Files:**
- Modify: `extension/companion-overlay.js`
- Test: `e2e/companion.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — purely visual/behavioral changes to the existing companion overlay, no new exported functions or storage keys.

- [ ] **Step 1: Write the failing tests**

Add to `e2e/companion.spec.ts`, inside the existing `test.describe('floating companion', ...)` block:

```typescript
test('the dot core is a fixed contrast-safe color, not one that flips with system dark mode', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const page = await context.newPage()
  await page.emulateMedia({ colorScheme: 'dark' }) // simulate a user with system dark mode on
  await page.goto('https://example.com')
  const dot = page.locator(HOST_SELECTOR).locator('.dot')
  const dotColor = await dot.evaluate((el) => getComputedStyle(el).backgroundColor)
  // rgb(199, 91, 57) is --m-clay (#C75B39) — must render as this in EITHER color scheme,
  // never as --m-ink (which used to flip to near-white under dark mode and vanish on a
  // real light-background page).
  expect(dotColor).toBe('rgb(199, 91, 57)')

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the companion is a larger footprint than the old 28px, and its container animates in on mount', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const page = await context.newPage()
  await page.goto('https://example.com')
  const host = page.locator(HOST_SELECTOR)
  const box = (await host.boundingBox())!
  expect(box.width).toBeGreaterThan(28)
  expect(box.width).toBe(36)
  expect(box.height).toBe(36)

  const hasWakeAnimation = await host.evaluate((el) => {
    const anims = el.getAnimations({ subtree: false })
    return anims.length > 0
  })
  expect(hasWakeAnimation).toBe(true)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/companion.spec.ts -g "contrast-safe color|larger footprint" --workers=1`
Expected: FAIL — the color test fails because `.dot` currently reads `var(--m-ink)` (which resolves to `rgb(20, 18, 15)` in light scheme, or `rgb(243, 241, 238)` under the simulated dark scheme — neither matches `rgb(199, 91, 57)`). The size test fails because `SIZE` is still `28`, and `getAnimations()` on the host returns an empty array (no mount animation exists yet).

- [ ] **Step 3: Implement the fix**

In `extension/companion-overlay.js`:

```javascript
const DEFAULT_POSITION = { right: 24, bottom: 24 }
const SIZE = 36
```

Replace the `css()` function's `:host` block and dark-mode override (removing the now-unused `--m-ink` entirely — nothing in this file will read it once `.dot` switches to `--m-clay`) and add a mount animation:

```javascript
function css() {
  return `
    :host {
      --m-ground: #F3F1EE;
      --m-clay: #C75B39;
      --m-ease: cubic-bezier(0.23, 1, 0.32, 1);
      all: initial;
      position: fixed;
      z-index: 2147483647;
      width: ${SIZE}px;
      height: ${SIZE}px;
      animation: wake 360ms var(--m-ease);
    }
    @media (prefers-color-scheme: dark) {
      :host { --m-ground: #14120F; --m-clay: #E06B44; }
    }
    @keyframes wake {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    * { box-sizing: border-box; }

    /* Three nodes, each one job — the same split the prior design used, for the same
     * reason: a running CSS animation overrides a transition on the same property
     * of the same element, so the ring's state-change transition and the dot's
     * always-on breathing animation cannot live on one node. */
    .dot-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      touch-action: none;
    }
    .dot-wrap[data-dragging="true"] { cursor: grabbing; }

    /* .ring — presence + style tells the state. Never a color change (an orbit that
     * changes hue reads as a status light, not a witness) — solid vs. dashed vs. none. */
    .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid var(--m-clay);
      opacity: 0;
      transition: opacity 220ms var(--m-ease);
    }
    .dot-wrap[data-state="focus"] .ring { opacity: 0.55; }
    .dot-wrap[data-state="drift"] .ring {
      opacity: 1;
      border-style: dashed;
      animation: pulse-drift 1.2s ease-out infinite;
    }
    .dot-wrap[data-returning="true"] .ring {
      opacity: 1;
      border-style: solid;
      animation: return-pulse 0.6s ease-out;
    }
    @keyframes pulse-drift {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.35); opacity: 0; }
    }
    @keyframes return-pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* .dot — aliveness, sub-perceptual, always on. Fixed --m-clay fill, not --m-ink:
     * --m-ink used to flip near-black/near-white under prefers-color-scheme, which
     * reflects the user's OS setting, not the actual page's background — a dark-mode
     * user on an ordinary light page got a near-invisible near-white dot. --m-clay
     * (orange in both schemes) has working contrast against both a light and a dark
     * background, so visibility no longer depends on guessing the host page's colors. */
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--m-clay);
      animation: breathe 1.6s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); opacity: 0.92; }
      50% { transform: scale(1.12); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  `
}
```

Note: the `@media (prefers-reduced-motion: reduce)` rule already sets `animation: none !important` on every element, which correctly suppresses the new `wake` animation on `:host` too, and the existing rule needing no changes for this to apply confirms nothing else needs updating for the reduced-motion case.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/companion.spec.ts -g "contrast-safe color|larger footprint" --workers=1`
Expected: PASS

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec at `e2e/_tmp-companion-visual.spec.ts`:

```typescript
import { test } from './fixtures'

async function pairAndStart(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
  await page.locator('input.m-field').first().fill('visual check')
  await page.getByRole('button', { name: 'Start' }).click()
}

test('screenshot the companion on a plain white page', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const page = await context.newPage()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('data:text/html,<html><body style="background:white;height:100vh;margin:0"></body></html>')
  await page.waitForTimeout(500) // let the wake animation settle
  await page.screenshot({ path: '/tmp/companion-on-white.png' })
})
```

Run: `npx playwright test e2e/_tmp-companion-visual.spec.ts --workers=1`, then Read `/tmp/companion-on-white.png`. Confirm: the dot is clearly visible (a solid orange core) against the plain white page, even though the emulated color scheme is dark. Then delete the temp spec and the screenshot: `rm e2e/_tmp-companion-visual.spec.ts /tmp/companion-on-white.png`.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new case documenting both tests (check the file's actual current last case/item number first — written at plan time as Case X / item 59, so this is likely Case Y, items 60-61, but confirm before landing).

- [ ] **Step 8: Commit**

```bash
git add extension/companion-overlay.js e2e/companion.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(companion): fixed contrast-safe dot color, bigger footprint, a wake animation on mount"
```

---

## Task 2: Review page container width, matching the dashboard

**Files:**
- Modify: `app/globals.css`
- Test: `e2e/review.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure CSS addition.

- [ ] **Step 1: Write the failing test**

Add to `e2e/review.spec.ts`:

```typescript
test('the review page has the same max-width container as the dashboard, not full viewport width', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('review width test')
  await setupPage.getByRole('button', { name: 'Start' }).click()
  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )
  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  const page = await context.newPage()
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(`/review/${sessionId}`)

  const review = page.locator('[data-surface="review"]')
  const box = await review.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeLessThanOrEqual(1000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/review.spec.ts -g "same max-width container as the dashboard" --workers=1`
Expected: FAIL — the review surface's bounding box width is close to the full 1600px viewport, since no container rule constrains it.

- [ ] **Step 3: Add the container rule**

In `app/globals.css`, immediately before the existing `[data-surface="review"] > .m-mark:not(:empty)` rule:

```css
[data-surface="review"] {
  max-width: 1000px;
  margin: 0 auto;
  padding: 72px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

```

This matches `[data-surface="ledger"]`'s own rule exactly — same values, for literal visual parity between the two "history" surfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/review.spec.ts -g "same max-width container as the dashboard" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test (check the file's actual current end state first).

- [ ] **Step 7: Commit**

```bash
git add app/globals.css e2e/review.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(review): give the review page the same 1000px container as the dashboard"
```

---

## Task 3: Domain-tracking hygiene — filter extension-ID-shaped rows out of the band

**Files:**
- Modify: `lib/band.ts`
- Test: `test/band.test.js` (new file — a plain `.js` test importing directly from `lib/band.ts` with an explicit `.ts` extension, matching the exact working precedent `test/normalize-domain.test.js` already uses for `lib/domains.ts`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — `toBand`'s signature and `Segment` type are unchanged; this only tightens which rows are included.

- [ ] **Step 1: Write the failing test**

Create `test/band.test.js`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { toBand } from '../lib/band.ts'

test('toBand excludes a row whose domain is shaped like a chrome-extension ID, even with real seconds', () => {
  const rows = [
    { kind: 'attention', domain: 'facebook.com', seconds: 240 },
    { kind: 'attention', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 60 },
  ]
  const segments = toBand(rows)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].flex, 240)
})

test('toBand still includes localhost — a real, legitimate dotless tracked domain', () => {
  // A blanket "must contain a dot" rule would silently exclude this, a real domain
  // this codebase already tracks and tests (e2e/session-lifecycle.spec.ts). The filter
  // must target the SHAPE of a chrome-extension ID specifically (32 chars, a-p only),
  // not dot-presence in general.
  const rows = [
    { kind: 'attention', domain: 'facebook.com', seconds: 100 },
    { kind: 'attention', domain: 'localhost', seconds: 50 },
  ]
  const segments = toBand(rows)
  assert.equal(segments.length, 2)
})

test('toBand excludes an extension-ID-shaped string even if it happens to contain a dot-adjacent character elsewhere', () => {
  // Guards against a regex that's accidentally too loose (e.g. matching a substring
  // instead of the whole string) — a real domain that merely CONTAINS 32 a-p characters
  // somewhere must not be excluded; only a domain that IS exactly that shape, start to
  // end, should be.
  const rows = [
    { kind: 'attention', domain: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.com', seconds: 30 },
  ]
  const segments = toBand(rows)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].flex, 30)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/band.test.js`.
Expected: the first test FAILS (`toBand` currently returns 2 segments, including the extension-ID-shaped one, since nothing filters on domain shape today). The other two pass already (not what's being fixed), but this file won't run at all until the exclusion logic is added, so all three should be run together to confirm the FIRST one is the one actually failing for the right reason.

- [ ] **Step 3: Implement the fix**

In `lib/band.ts`:

```typescript
// 'remainder' is never produced by toBand() below (real attention data has no unmeasured
// gap to reserve) — it exists for static previews (landing) that need to show "nothing
// recorded yet" as the dashed edge .m-row-bar already renders for that kind.
export type Segment = { kind: 'attention-1' | 'attention-2' | 'attention-3' | 'away' | 'remainder'; flex: number }

// Chrome extension IDs are exactly 32 characters, entirely within a-p (the charset
// Chrome uses to encode them) — this can end up recorded as a tracked "domain" if an
// older build's protocol filter (extension/sw.js's safeHostname) was ever bypassed, or
// from historical data recorded before that filter existed. A blanket "must contain a
// dot" rule would be wrong here: this codebase has real, legitimate dotless tracked
// domains (localhost) that must not be excluded — this targets the specific
// extension-ID shape instead.
const EXTENSION_ID_SHAPE = /^[a-p]{32}$/

/** Attention rows for one session → band segments: top 3 domains by time, then away.
 * Takes the raw shape `sql` returns (untyped rows), not a declared row type. */
export function toBand(rows: { kind: string; domain?: string | null; seconds: number }[]): Segment[] {
  const attention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 3)
  const away = rows.filter((r) => r.kind === 'away').reduce((sum, r) => sum + r.seconds, 0)

  const segments: Segment[] = attention.map((r, i) => ({
    kind: (['attention-1', 'attention-2', 'attention-3'] as const)[i],
    flex: r.seconds,
  }))
  if (away > 0) segments.push({ kind: 'away', flex: away })
  return segments.filter((s) => s.flex > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` (this repo's `test` script is `node --test`, which discovers every `test/*.test.js` file automatically — `test/band.test.js` is picked up with no config change needed, same as every other file in that directory).
Expected: PASS, all three new tests plus the existing 47.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean. (No E2E test needs updating for this task — it's a pure data-layer change with no UI surface of its own; the existing `e2e/review.spec.ts` and dashboard tests already exercise `toBand` indirectly and continue to pass since no real session ever produces an extension-ID-shaped domain today.)

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

This is a unit-test-only fix with no new Playwright case — instead, add a short note under the existing case for Task 1 of the original QA-round-2 plan (the `bareHostname`/protocol-filtering fix) cross-referencing this as the defense-in-depth companion fix, so a future reader understands both layers exist. Do not invent a new lettered case for a fix with no E2E coverage.

- [ ] **Step 7: Commit**

```bash
git add lib/band.ts test/band.test.js docs/qa-recipe-playwright-e2e.md
git commit -m "fix(review): exclude extension-ID-shaped domains from the attention band, not just live tracking"
```

---

## Task 4: Blocked tabs revert to the real site once a session ends

**Files:**
- Modify: `extension/sw.js`
- Test: `e2e/session-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `safeHostname(url)` (already exported-in-module-scope function, unchanged shape), `chrome.tabs.query`/`chrome.tabs.update` (browser APIs, unchanged).
- Produces: a new module-scope function `sweepBlockedTabsBack(domains)` — takes the same shape of argument as `installRules`/`sweepOpenTabs` (`domains: string[]`, already-resolved bare hostnames, not category names).

- [ ] **Step 1: Write the failing test**

Add to `e2e/session-lifecycle.spec.ts`:

```typescript
test('a tab sitting on the block page navigates back to the real site once the session ends', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await addBlockedDomain(page, 'example.net')
  await page.locator('input.m-field').first().fill('revert test')
  await page.getByRole('button', { name: 'Start' }).click()

  const [sw] = context.serviceWorkers()
  await expect
    .poll(
      async () =>
        (await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).some((r: any) =>
          r.condition.requestDomains?.includes('example.net'),
        ),
      { timeout: 10_000, intervals: [200] },
    )
    .toBe(true)

  const blockedPage = await context.newPage()
  await blockedPage.bringToFront()
  await blockedPage.goto('https://example.net')
  await expect(blockedPage).toHaveURL(/blocked\.html\?d=example\.net/)

  await page.bringToFront()
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  // The tab that was sitting on blocked.html must navigate back to the real site —
  // declarativeNetRequest only intercepts NEW navigations, so removing the rule alone
  // (already covered by an existing test) never un-redirects an already-redirected tab.
  await expect(blockedPage).toHaveURL('https://example.net/', { timeout: 5_000 })
})

test('a block page for a domain NOT in the ending session\'s own blockedDomains is left alone', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await addBlockedDomain(page, 'example.net')
  await page.locator('input.m-field').first().fill('first session')
  await page.getByRole('button', { name: 'Start' }).click()

  const [sw] = context.serviceWorkers()
  await expect
    .poll(
      async () =>
        (await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).some((r: any) =>
          r.condition.requestDomains?.includes('example.net'),
        ),
      { timeout: 10_000, intervals: [200] },
    )
    .toBe(true)

  const blockedPage = await context.newPage()
  await blockedPage.bringToFront()
  await blockedPage.goto('https://example.net')
  await expect(blockedPage).toHaveURL(/blocked\.html\?d=example\.net/)

  // sweepBlockedTabsBack is scoped to the ending session's OWN blockedDomains — a real
  // stale tab left over from an earlier, already-ended session is one way this could go
  // wrong, but the underlying guard is simpler and directly testable: does the function
  // check membership in the CURRENT session's list at all? Clear this session's own
  // blockedDomains right before it ends and confirm blockedPage is untouched — proving
  // the sweep is genuinely scoped, not a blanket "sweep every blocked.html tab" pass.
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('session', ({ session }: any) => {
        session.blockedDomains = [] // this session (about to end) blocks NOTHING anymore
        chrome.storage.local.set({ session }, () => resolve())
      })
    })
  })
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  // blockedPage must NOT have been swept — session.blockedDomains no longer includes
  // example.net, so this session's own end must not touch it.
  await page.waitForTimeout(500)
  await expect(blockedPage).toHaveURL(/blocked\.html\?d=example\.net/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "navigates back to the real site|is left alone" --workers=1`
Expected: the first test FAILS — `blockedPage` stays on `blocked.html?d=example.net` forever after Stop, since nothing navigates it back today. The second test passes trivially today (nothing sweeps anything yet) — this is expected and will remain a real regression guard once the sweep-back exists.

- [ ] **Step 3: Implement the fix**

In `extension/sw.js`, add a new function near `sweepOpenTabs` (mirroring its shape):

```javascript
// The forward sweep (sweepOpenTabs, above) redirects an already-open tab to blocked.html
// the moment a domain becomes blocked. This is the inverse, run when a session ends: a
// tab sitting on blocked.html for a domain THIS session blocked has nothing that
// navigates it back on its own — declarativeNetRequest only intercepts NEW navigation
// attempts, so removing the rule (removeAllRules, called right after this) never
// un-redirects a tab that's already redirected. Scoped to this session's own
// blockedDomains only — a stale blocked.html tab left over from an earlier,
// already-ended session must not get swept by a DIFFERENT session's own end.
async function sweepBlockedTabsBack(domains) {
  if (!domains || domains.length === 0) return
  const blockedUrlPrefix = chrome.runtime.getURL('blocked.html')
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !tab.url.startsWith(blockedUrlPrefix)) continue
    const blockedDomain = new URL(tab.url).searchParams.get('d')
    if (blockedDomain && domains.includes(blockedDomain)) {
      chrome.tabs.update(tab.id, { url: `https://${blockedDomain}` }).catch(() => {})
    }
  }
}
```

Then call it from `endSession()`'s `finally` block, before `removeAllRules()`:

```javascript
export async function endSession(endReason) {
  const session = await getSession()
  if (!session) return { ok: false }
  try {
    await transition({ mode: session.slice?.mode ?? 'attention', domain: null })
    await flush()
    await post(`/api/sessions/${session.sessionId}`, {
      endedAt: new Date().toISOString(),
      endReason,
    }, { method: 'PATCH' })
  } finally {
    await sweepBlockedTabsBack(session.blockedDomains)
    await removeAllRules()
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null, companionState: null })
    // No session means no alarm to drain the queue later, so try once more now — this is
    // what lets a queued end-of-session PATCH sync without waiting for the next session.
    await flush()
  }

  if (endReason === 'stopped' || endReason === 'elapsed') {
    await chrome.storage.local.set({ pendingReview: { sessionId: session.sessionId } })
  }

  return { ok: true }
}
```

Note: `session` (the local variable captured at the top of `endSession`, from `getSession()`) is what's read here — not `chrome.storage.local` directly — since storage's own `session` key gets cleared to `null` later in this same `finally` block, and `session.blockedDomains` needs to reflect what THIS session actually had configured, not whatever's left in storage by the time cleanup runs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "navigates back to the real site|is left alone" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both tests (check the file's actual current end state first).

- [ ] **Step 7: Commit**

```bash
git add extension/sw.js e2e/session-lifecycle.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(extension): sweep a blocked tab back to the real site when its session ends"
```

---

## Task 5: Running popup — the intention pill's own outline carries cycle progress

**Files:**
- Modify: `extension/popup.js` (`running`)
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `cyclePhase(session)` (already exists, unchanged signature/return shape — `{ phase, elapsedInPhaseMs, phaseMs, remainingMinutes } | null`).
- Produces: nothing new exported — this only restructures `running()`'s internal DOM construction.

**Scope boundary:** this implements exactly the design already resolved directly with the product owner — a static outline (solid = elapsed, dashed = remaining) on the pill that already holds the intention text, recomputed only on the popup's own natural re-render, never a live tick, never a dial or ring. Do not deviate toward a ticking/live-updating variant.

- [ ] **Step 1: Write the failing tests**

Add to `e2e/popup.spec.ts`, inside the existing `'popup, running state'` describe block:

```typescript
test('a running session with a cycle configured shows progress on the intention pill\'s own outline, not a separate mark', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5' }).click()
  await page.locator('input.m-field').first().fill('pill outline test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap).toBeVisible()
  // The intention text is still inside the SAME pill wrapper, not a separate element.
  // A freshly-started session is always within the sentence-edit grace window, so
  // sentenceNode is always the editable <input> here, never the read-only <p>.
  await expect(pillWrap.locator('input.m-field')).toHaveValue('pill outline test')
  // The progress strip lives INSIDE the pill wrapper (not as a top-level sibling mark).
  const progressStrip = pillWrap.locator('.m-mark:not(:empty)')
  await expect(progressStrip).toBeVisible()
  await expect(progressStrip.locator('.m-row-bar[data-kind="attention-1"]')).toHaveCount(1)
  await expect(progressStrip.locator('.m-row-bar[data-kind="remainder"]')).toHaveCount(1)

  // The plain running-state mark (matching idle/ended) still exists as its own
  // top-level element, unaffected — it no longer carries the fill.
  const topLevelMark = page.locator('.m-mark[data-state="running"]')
  await expect(topLevelMark).toBeVisible()
  await expect(topLevelMark.locator('.m-row-bar')).toHaveCount(0)

  // The phase text sits immediately after the pill, not after a separate elapsed line.
  const phaseLine = page.getByText(/^work — \d+ min left$/)
  await expect(phaseLine).toBeVisible()

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the pill shows no progress strip when no cycle is configured', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: 'no cycles' }).click()
  await page.locator('input.m-field').first().fill('no cycle pill test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  await expect(pillWrap).toBeVisible()
  await expect(pillWrap.locator('.m-mark')).toHaveCount(0)
  await expect(page.getByText(/min left$/)).toHaveCount(0)

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/popup.spec.ts -g "pill's own outline|no progress strip when no cycle" --workers=1`
Expected: FAIL — `[data-timer-pill="true"]` doesn't exist yet; the fill still lives on a separate top-level `.m-mark`, not nested inside the sentence wrapper.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`, replace `running(session)`'s body:

```javascript
function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const phase = cyclePhase(session)

  const startedAt = new Date(session.startedAt).getTime()
  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60000)
  const elapsed = el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

  const phaseLine = phase ? el('p', 'm-meta', `${phase.phase} — ${phase.remainingMinutes} min left`) : null

  const blockedList = session.blockedDomains?.length
    ? el('p', 'm-meta', `blocking: ${session.blockedDomains.join(', ')}`)
    : null

  const stop = el('button', 'm-btn', 'Stop')
  stop.dataset.variant = 'quiet'
  stop.addEventListener('click', async () => {
    stop.disabled = true
    await chrome.runtime.sendMessage({ type: 'stop' })
    render()
  })

  let sentenceNode
  if (isEditable(Date.now(), startedAt, GRACE_MS)) {
    sentenceNode = el('input', 'm-field')
    sentenceNode.value = session.intention

    const commit = async () => {
      const value = sentenceNode.value.trim()
      if (!value || value === session.intention) return
      session.intention = value
      await chrome.storage.local.set({ session })
      post(`/api/sessions/${session.sessionId}`, { intention: value }, { method: 'PATCH' })
    }
    sentenceNode.addEventListener('blur', commit)
    sentenceNode.addEventListener('keydown', (e) => { if (e.key === 'Enter') sentenceNode.blur() })
  } else {
    sentenceNode = el('p', 'm-sentence', session.intention)
  }

  // The intention's own box doubles as the cycle's static progress indicator: the pill
  // that already holds the sentence carries the progress on its own outline, instead of
  // a separate small mark glyph elsewhere. `.m-field`/`.m-sentence` cannot show a
  // two-tone border directly (an <input> can't hold child DOM nodes the way the
  // existing .m-mark:not(:empty) fill technique needs, and CSS border-image doesn't
  // combine reliably with border-radius across browsers) — instead a wrapper carries
  // the visible border, and a thin .m-mark:not(:empty) strip (reusing the SAME
  // .m-row-bar[data-kind] fill technique already used elsewhere in this codebase) sits
  // flush with the wrapper's bottom inside edge. Static only — recomputed on the
  // popup's own natural re-render, never a live tick.
  const pillWrap = el('div')
  pillWrap.dataset.timerPill = 'true'
  pillWrap.append(sentenceNode)
  if (phase) {
    const progressMark = el('p', 'm-mark', '')
    const filled = el('span', 'm-row-bar')
    filled.dataset.kind = 'attention-1'
    filled.style.flex = String(phase.elapsedInPhaseMs)
    const remainder = el('span', 'm-row-bar')
    remainder.dataset.kind = 'remainder'
    remainder.style.flex = String(Math.max(phase.phaseMs - phase.elapsedInPhaseMs, 1))
    progressMark.append(filled, remainder)
    pillWrap.append(progressMark)
  }

  const disconnect = el('button', 'm-btn', 'Disconnect')
  disconnect.dataset.variant = 'quiet'
  disconnect.addEventListener('click', async () => {
    disconnect.disabled = true
    await post('/api/device', undefined, { method: 'DELETE', queue: false })
    await chrome.storage.local.set({ token: null, deviceId: null, session: null, pendingReview: null })
    render()
  })

  show(mark, pillWrap, ...(phaseLine ? [phaseLine] : []), elapsed, ...(blockedList ? [blockedList] : []), stop, navRow())
}
```

Note: this removes the now-orphaned `disconnect` button that previously lived elsewhere in this function's tail — check the current file's exact tail past this point before landing this edit (the brief above reconstructs the whole function body from what's already been read this session; if the live file has additional trailing logic not shown here, preserve it exactly, only changing the `mark`/`sentenceNode`/`phaseLine` construction and the final `show(...)` call's argument list and order).

In `extension/meant.css`, add near the existing `.m-field`/`.m-sentence` rules:

```css
/* ---------- [data-timer-pill] — the running popup's intention box, doubling as the
 * cycle's static progress indicator. The pill's own border carries the progress signal
 * directly instead of a separate mark glyph elsewhere. */
[data-timer-pill] {
  position: relative;
  border: var(--m-stroke) solid var(--m-ink);
  border-radius: var(--m-r-field);
  overflow: hidden;
}
[data-timer-pill] > .m-field,
[data-timer-pill] > .m-sentence {
  border: none;
}
[data-timer-pill] > .m-mark:not(:empty) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 3px;
  border: none;
  border-radius: 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/popup.spec.ts -g "pill's own outline|no progress strip when no cycle" --workers=1`
Expected: PASS

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec at `e2e/_tmp-pill-visual.spec.ts` that starts a session with the `25/5` preset, pushes `session.startedAt` back 10 minutes (matching this suite's own established pattern elsewhere for landing partway into a phase without a real wait), reloads the popup, and screenshots it at its native 360px width. Read the screenshot with the Read tool. Confirm: the intention text is legible inside the pill, the pill's bottom edge shows a visible two-segment strip (solid + dashed), the phase text sits directly under the pill, nothing overlaps or clips awkwardly, and — specifically check this — the input's own `:focus-visible` outline (if you click into the field during the grace window) is not visually clipped by the wrapper's `overflow: hidden`. If it is clipped, add enough padding on `[data-timer-pill]` to give the offset outline room, or remove `overflow: hidden` and instead clip only the progress strip itself via `border-radius` on the strip element. Then delete the temp spec and screenshot.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both tests, and update (don't duplicate) the existing case for the prior cycle-phase-display task, noting the structural change (progress moved from a separate mark to the pill's own outline).

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): the intention pill's own outline carries cycle progress, not a separate mark"
```

---

## Final review

Once all 5 tasks land, dispatch a final whole-branch review on the most capable available
model, the same way the two prior QA-round plans did: `scripts/review-package` over the
full range (base commit before Task 1 through the last task's commit), specifically
re-checking:
- `extension/sw.js`'s coherence between the existing `sweepOpenTabs` (forward) and the new
  `sweepBlockedTabsBack` (backward) — same domain-resolution conventions, no drift between
  the two.
- `extension/popup.js`'s `running()` restructuring doesn't regress anything else in that
  function (the `disconnect` button, `navRow()`, the editable-vs-read-only sentence
  branch) — re-read the function's actual current tail before the review, since this
  plan's Task 5 reconstructs the whole function body from what was read earlier in this
  session and the live file may have grown additional logic since.
- Run a production `next build` before considering the whole batch done (this plan's
  changes are extension + `lib/band.ts` + one `app/globals.css` rule — low risk to the
  build, but confirm anyway, matching this project's own established discipline).
