# Popup Round 6 — Alignment, Hover Pill, Live Breakdown, Companion Re-Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real chip-alignment bug, restyle the companion's hover pill closer to a supplied reference while staying on-brand, suppress native browser decorations bleeding through the intention field, add a live per-domain/blocked-domain row list to the running popup, lower the timer loop's cold-start floor from 5% to 2%, and make the companion re-inject into already-open tabs on extension reload/update instead of requiring a manual page refresh.

**Architecture:** Six independent fixes across `extension/meant.css`, `extension/popup.js`, `extension/companion-overlay.js`, `extension/sw.js`, and `extension/manifest.json`. Tasks are ordered cheapest/most-isolated first; the two tasks touching `companion-overlay.js` are sequenced back-to-back so neither's diff goes stale waiting on the other.

**Tech Stack:** Plain ES modules (no bundler, no TypeScript) for the extension; Playwright E2E; Node's built-in test runner for unit tests.

## Global Constraints

- This is a git worktree (`worktree-drift-and-cycles`, branch `popup-round-6`, forked from `main` at `e5b1da4`) — no `-C`/`cd` into another worktree, no git operations targeting another worktree.
- Never add AI/assistant attribution to any commit message.
- No hex values in `extension/popup.js`/`extension/meant.css` changes, EXCEPT the companion hover-pill's already-approved fixed-color exception (`#F3F1EE`, `#14120F`, `#C7C2BB`, and the new `#C75B39` dot — `#C75B39` is `--m-clay`'s own literal value, used here for the same fixed-color reason as the pill's other colors, already justified in a prior round: a contrast-critical element floating over an arbitrary page background must not depend on `prefers-color-scheme`). This exception applies ONLY inside `extension/companion-overlay.js`'s Shadow-DOM CSS — `extension/popup.js`/`extension/meant.css` changes still have zero hex tolerance.
- No new class name beyond the frozen 13-class contract + `.m-chip`/`.m-chip-row`/`.m-companion-*`. This plan reuses `.m-row`/`.m-row-bar`/`.m-row-domain`/`.m-row-figure` (already-existing classes) and `data-kind="step-open"` (already-existing attribute value) — introduces no new class name.
- After every task: `npx playwright test --workers=1` (no `--reporter` flag), `npx tsc --noEmit`, `npm test`, and `node --test test/tally.test.js` must all be clean.
- Confirm the dev server (`npm run dev`) is live via `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000` before any Playwright run; start it with `nohup npm run dev > /tmp/dev-server.log 2>&1 & disown` if not.
- This machine has intermittently hit real memory pressure during heavy Playwright runs, and different unrelated tests can fail on different full-suite runs while passing 3/3 in isolation — this is independently confirmed environmental across the last two rounds, not something to chase to a single perfectly-green full-suite run. If a full-suite run shows failures unrelated to the file(s) this task touches, verify by rerunning just those specific failures in isolation (once); if they pass alone, that's sufficient evidence.
- Every behavior-changing task gets a new/extended Playwright case and a `docs/qa-recipe-playwright-e2e.md` lettered-case update. Confirmed current end-state at plan-writing time: last case is **AM**, last item is **90** — the next new case is **AN**, item **91** — but re-check the file's actual tail before assuming this hasn't shifted.
- Every UI-affecting task requires a real screenshot visual check (temp spec, screenshot, Read tool, actual look, delete both afterward) before being considered done, per this repo's CLAUDE.md.
- Do not re-litigate any already-resolved design decision from `docs/superpowers/specs/2026-09-10-round-6-design-notes.md` (the hover pill staying single-line with a reused dot instead of a new icon, the `spellcheck`-only fix for the native-decoration complaint, the blocked-domains row using a neutral `step-open` swatch not an attention tint, the `scripting`-permission re-injection approach) — implement exactly what that spec already resolved.

---

## Task 1: Cold-start floor 5% → 2%

**Files:**
- Modify: `extension/popup.js`
- Test: `e2e/popup.spec.ts`

**Interfaces:** none — a single constant change.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts` (near the existing `'the pill shows a visible arc immediately at session start...'` test):

```typescript
test('the cold-start floor is 2%, not 5%', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '25/5', exact: true }).click()
  await page.locator('input.m-field').first().fill('floor test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pillWrap = page.locator('[data-timer-pill="true"]')
  const svg = pillWrap.locator('svg')
  await expect(svg).toBeVisible()
  const firstPath = svg.locator('path').first()
  const dasharray = await firstPath.evaluate((e) => getComputedStyle(e).strokeDasharray)
  const [drawn, total] = dasharray.split(',').map((n) => parseFloat(n))
  const fraction = drawn / (drawn + total)
  // 2% of the loop, with a wide tolerance for the GAP subtraction and MIN_DRAWN rounding
  // already baked into the segment-layout algorithm — this asserts "closer to 2% than
  // 5%", not an exact figure.
  expect(fraction).toBeLessThan(0.035)
  expect(fraction).toBeGreaterThan(0.005)

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "cold-start floor is 2%" --workers=1`
Expected: FAIL — the current floor is 5%, so `fraction` is ≈0.05, failing the `toBeLessThan(0.035)` assertion.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`, change:
```js
const MIN_ARC = 0.05 * L // item D — never render nothing at t≈0
```
to:
```js
const MIN_ARC = 0.02 * L // item D — never render nothing at t≈0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "cold-start floor is 2%" --workers=1`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test (check the file's actual current last case/item before assuming Case AN / item 91).

- [ ] **Step 7: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(popup): lower the timer loop's cold-start floor from 5% to 2%"
```

---

## Task 2: Suppress native spellcheck on the intention field

**Files:**
- Modify: `extension/popup.js` (`idle`, `running`)
- Test: `e2e/popup.spec.ts`

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`:

```typescript
test('the intention field has native spellcheck disabled, in both idle and running states', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await expect(page.locator('input.m-field').first()).toHaveAttribute('spellcheck', 'false')

  await page.locator('input.m-field').first().fill('spellcheck test')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('[data-timer-pill="true"] input.m-field')).toHaveAttribute('spellcheck', 'false')

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "native spellcheck disabled" --workers=1`
Expected: FAIL — no `spellcheck` attribute is set today, so Playwright's `toHaveAttribute` fails (attribute absent).

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`'s `idle()`, immediately after:
```js
  const field = el('input', 'm-field')
  field.placeholder = ''
```
add:
```js
  field.spellcheck = false
```

In `running()`, immediately after:
```js
    sentenceNode = el('input', 'm-field')
    sentenceNode.value = session.intention
```
add:
```js
    sentenceNode.spellcheck = false
```

(Do NOT add this to `unpaired()`'s pairing-code field — that field already has its own distinct styling/behavior and isn't part of this complaint.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "native spellcheck disabled" --workers=1`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test.

- [ ] **Step 7: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(popup): disable native spellcheck on the intention field"
```

---

## Task 3: Custom-picker chip alignment

**Files:**
- Modify: `extension/meant.css`
- Test: `e2e/popup.spec.ts`

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`:

```typescript
test('the custom-reveal chips share one consistent height, not a mismatched row', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: 'custom', exact: true }).click()

  const workInput = page.locator('input[data-chip-role="number"]').first()
  const untilChip = page.getByRole('button', { name: 'until I stop', exact: true })
  const workBox = (await workInput.boundingBox())!
  const untilBox = (await untilChip.boundingBox())!
  // Same explicit height across a number-input chip and a button chip — within 1px
  // rounding, not a multi-pixel visual mismatch.
  expect(Math.abs(workBox.height - untilBox.height)).toBeLessThanOrEqual(1)

  // The digit is vertically centered inside its chip, not sitting high — check the
  // input's own line-height renders as a real value, not the UA default (which would
  // leave the text baseline noticeably above center at this padding).
  const lineHeight = await workInput.evaluate((e) => getComputedStyle(e).lineHeight)
  expect(lineHeight).not.toBe('normal')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "one consistent height" --workers=1`
Expected: FAIL — `.m-chip[data-chip-role="number"]` has no `line-height`, and neither chip variant has an explicit `height`, so the two boxes' measured heights differ and `lineHeight` computes to `'normal'`.

- [ ] **Step 3: Implement the fix**

In `extension/meant.css`, find the base `.m-chip` rule:
```css
.m-chip {
  padding: 8px 14px;
  font-family: var(--m-body);
  font-size: 13px;
  color: var(--m-ink-3);
  background: transparent;
  border: var(--m-stroke-hair) solid var(--m-edge);
  border-radius: var(--m-r-chip);
  cursor: pointer;
}
```
add `height: 34px;` to it (right after `padding`):
```css
.m-chip {
  padding: 8px 14px;
  height: 34px;
  font-family: var(--m-body);
  font-size: 13px;
  color: var(--m-ink-3);
  background: transparent;
  border: var(--m-stroke-hair) solid var(--m-edge);
  border-radius: var(--m-r-chip);
  cursor: pointer;
}
```

Then find `.m-chip[data-chip-role="number"]`:
```css
.m-chip[data-chip-role="number"] {
  width: 56px;
  cursor: text;
  font-family: var(--m-figure);
  font-size: 12px;
  text-align: center;
  color: var(--m-ink);
}
```
and add `line-height: 1;` to it:
```css
.m-chip[data-chip-role="number"] {
  width: 56px;
  cursor: text;
  font-family: var(--m-figure);
  font-size: 12px;
  line-height: 1;
  text-align: center;
  color: var(--m-ink);
}
```
(`height: 34px` is inherited from the base `.m-chip` rule above — no need to repeat it here. `box-sizing: border-box` already applies globally in this file — confirm this before assuming `height: 34px` includes the padding correctly; if the file's global reset doesn't cover `.m-chip`, add `box-sizing: border-box;` explicitly to the base `.m-chip` rule alongside `height`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "one consistent height" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that opens the idle popup, clicks `custom`, screenshots the whole reveal row. Read the screenshot with the Read tool. Confirm: the "25"/"5" digits sit centered inside their pills (not high), and all chips in the row — number inputs and buttons alike — read as the same height, no visual stagger. Delete the temp spec and screenshot afterward.

- [ ] **Step 6: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean — pay attention to any OTHER existing chip-based test that might assert on the old, unset `height` (unlikely, but check `e2e/popup.spec.ts` for any bounding-box assertion on `.m-chip` elsewhere).

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting this test.

- [ ] **Step 8: Commit**

```bash
git add extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(popup): align the custom-reveal chips to one consistent height and center the digits"
```

---

## Task 4: Hover pill — closer to the reference, still on-brand

**Files:**
- Modify: `extension/companion-overlay.js`
- Test: `e2e/companion.spec.ts`

**Interfaces:** none — this only restyles the existing hover pill.

- [ ] **Step 1: Write the failing test**

Update the existing `'hovering the companion reveals a pill showing the intention, styled and positioned above the dot'` test in `e2e/companion.spec.ts` — the text content assertion changes since the intention now lives inside a child `<span>`, not as the pill's own direct text node, and a new dot indicator should be present:

```typescript
// was: await expect(pill).toHaveText('write the quarterly report')
// now:
await expect(pill.locator('span')).toHaveText('write the quarterly report')
const dotStyle = await pill.evaluate((e) => getComputedStyle(e, '::before').backgroundColor)
expect(dotStyle).not.toBe('none')
expect(dotStyle).not.toBe('')
```

(Read the full existing test first — only the one assertion line changes, everything else about hover-trigger timing, positioning, and edge-flip behavior is unchanged and must not be touched.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/companion.spec.ts -g "reveals a pill showing the intention" --workers=1`
Expected: FAIL — the pill's text is currently a direct text node (no child `<span>`), and there's no `::before` dot yet.

- [ ] **Step 3: Implement the fix**

In `extension/companion-overlay.js`, replace the `[data-companion-hover-pill]` CSS block:

```css
    /* Deliberate exception to tokens-first: a contrast-critical pill floating over an
     * arbitrary, unknown page background must not depend on the OS dark-mode preference,
     * which reflects nothing about the actual page behind it. Do not tokenize these. */
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

In `showHoverPill()`, change:
```js
    hoverPill.textContent = currentSession.intention
```
to:
```js
    hoverPill.replaceChildren(document.createElement('span'))
    hoverPill.firstChild.textContent = currentSession.intention
```
(No other line in `showHoverPill()`/`hideHoverPill()` changes — the positioning/edge-flip logic that follows still reads `hoverPill.getBoundingClientRect()` the same way, now measuring the flex row including the dot.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "reveals a pill showing the intention" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that starts a session with a real intention, hovers the companion, screenshots the pill. Read the screenshot with the Read tool. Confirm: a small solid dot sits to the left of the intention text, the pill reads with more visual weight (larger padding/font) than before, and it still looks like it belongs to this product (same font, same fixed colors) rather than a copy of the reference image's own dark-mode card. Delete the temp spec and screenshot afterward.

- [ ] **Step 6: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Update the existing hover-pill case (don't duplicate it) to describe the new dot + span structure.

- [ ] **Step 8: Commit**

```bash
git add extension/companion-overlay.js e2e/companion.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(companion): give the hover pill more presence — a reused dot indicator, larger padding/type"
```

---

## Task 5: Live per-domain and blocked-domain row lists in the running popup

**Files:**
- Modify: `extension/popup.js` (`running`)
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `segments` (already computed in `running()` via `toSegments(withOpenSlice(...))` — each entry is `{kind, domain, flex}` in seconds; `domain` has existed on this shape since Task 1 of round 5 but has never been read until now).
- Produces: nothing new exported.

- [ ] **Step 1: Write the failing tests**

Add to `e2e/popup.spec.ts`:

```typescript
test('the running popup shows a live per-domain row list, matching the outcome screen\'s row vocabulary', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairPopup(setupPage, extensionId)
  await setupPage.locator('input.m-field').first().fill('live rows test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )
  const { token } = await setupPage.evaluate(
    () => new Promise<{ token: string }>((r) => chrome.storage.local.get('token', (v: any) => r(v))),
  )
  await expect
    .poll(async () => {
      const res = await setupPage.request.get(`/api/sessions/${sessionId}/review`, {
        headers: { authorization: `Bearer ${token}` },
      })
      return res.status()
    }, { timeout: 5_000 })
    .not.toBe(404)
  await setupPage.request.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      sessionId,
      events: [{ kind: 'attention', domain: 'chatgpt.com', seconds: 300, at: new Date().toISOString() }],
    },
  })
  await setupPage.evaluate(({ sessionId, at }: any) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('session', ({ session }: any) => {
        session.tally = { attention: { 'chatgpt.com': 300 }, away: 0, break: 0 }
        chrome.storage.local.set({ session }, () => resolve())
      })
    })
  }, { sessionId, at: new Date().toISOString() })
  await setupPage.reload()

  const row = setupPage.locator('.m-row', { hasText: 'chatgpt.com' })
  await expect(row).toBeVisible()
  await expect(row.locator('.m-row-bar')).toHaveAttribute('data-kind', 'attention-1')
  await expect(row.locator('.m-row-figure')).toHaveText(/\d+ min/)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the blocking list renders as rows, one per blocked domain, not a single sentence', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: '+', exact: true }).nth(1).click() // blocking row's own +
  await page.keyboard.type('youtube.com, facebook.com')
  await page.keyboard.press('Enter')
  await page.locator('input.m-field').first().fill('blocking rows test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText(/^blocking: /)).toHaveCount(0) // the old single-sentence line is gone
  await expect(page.getByText('blocking', { exact: true })).toBeVisible() // a plain label instead
  const youtubeRow = page.locator('.m-row', { hasText: 'youtube.com' })
  const facebookRow = page.locator('.m-row', { hasText: 'facebook.com' })
  await expect(youtubeRow).toBeVisible()
  await expect(facebookRow).toBeVisible()
  await expect(youtubeRow.locator('.m-row-bar')).toHaveAttribute('data-kind', 'step-open')
  await expect(youtubeRow.locator('.m-row-figure')).toHaveCount(0) // no time figure for a blocked-list row

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/popup.spec.ts -g "live per-domain row list|blocking list renders as rows" --workers=1`
Expected: FAIL — `running()` doesn't render `.m-row` elements at all today; the blocked list is still one `.m-meta` sentence.

- [ ] **Step 3: Implement the fix**

In `extension/popup.js`'s `running()`, replace:
```js
  const blockedList = session.blockedDomains?.length
    ? el('p', 'm-meta', `blocking: ${session.blockedDomains.join(', ')}`)
    : null
```
with:
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

  const blockingLabel = session.blockedDomains?.length ? el('p', 'm-meta', 'blocking') : null
  const blockedRows = (session.blockedDomains ?? []).map((domain) => {
    const row = el('div', 'm-row')
    const bar = el('span', 'm-row-bar')
    bar.dataset.kind = 'step-open' // neutral outline swatch — blocked domains are config, not measured attention
    const label = el('p', 'm-row-domain', domain)
    row.append(bar, label)
    return row
  })
```

Note: `segments` is already computed earlier in `running()` (`const merged = withOpenSlice(session.tally, session.slice, Date.now()); const segments = toSegments(merged)`) — this task adds no new computation, only a new rendering of data that already exists.

Then find the final `show(...)` call:
```js
  show(header(mark), pillWrap, phaseLine, ...(blockedList ? [blockedList] : []), stop)
```
and replace it with:
```js
  show(
    header(mark),
    pillWrap,
    phaseLine,
    ...attentionRows,
    ...(blockingLabel ? [blockingLabel] : []),
    ...blockedRows,
    stop,
  )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/popup.spec.ts -g "live per-domain row list|blocking list renders as rows" --workers=1`
Expected: PASS.

- [ ] **Step 5: Visual verification (required)**

Write a temporary spec that starts a session, browses 2 real domains for a bit, adds a blocked domain, reopens the popup, and screenshots the running view at 360px width. Read the screenshot with the Read tool. Confirm: the colored attention rows appear below the phase line (matching the outcome screen's own row look), the "blocking" label + neutral-swatch rows appear below that, and the whole view doesn't feel cramped or overwhelming at the popup's fixed width (this product's own stated invariant is a calm, uncluttered popup — if the added rows make the view feel crowded, note this in the report rather than silently shipping it). Delete the temp spec and screenshot afterward.

- [ ] **Step 6: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`. Pay particular attention to any OTHER existing test asserting on the old `'blocking: ...'` sentence text (search the whole `e2e/` directory, not just `popup.spec.ts`) — update every such assertion to the new row-based structure rather than leaving a broken one.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both tests, and update (don't duplicate) any existing case that referenced the old single-sentence blocking line.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): show live per-domain attention rows and blocked-domain rows while a session runs"
```

---

## Task 6: Companion re-injects into already-open tabs, without a manual refresh

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/sw.js`
- Modify: `extension/companion-overlay.js`
- Test: `e2e/companion.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `extension/sw.js` gains a new function `reinjectCompanion()`, registered on both `chrome.runtime.onInstalled` and `chrome.runtime.onStartup`.

**Real double-mount risk this task must guard against, already resolved by the design spec — implement exactly this, do not skip it**: a `chrome.scripting.executeScript()` call gives the injected script a FRESH module scope every time — so `companion-overlay.js`'s own existing `hostEl` module-level guard does NOT protect against a second injection of the same script from `reinjectCompanion()` re-running on top of a tab where the declarative `content_scripts` entry already mounted it normally. The guard must live in the page's DOM, checked at the very top of the script, before any of its existing module-level `let` declarations.

- [ ] **Step 1: Write the failing test**

Add to `e2e/companion.spec.ts`:

```typescript
test('a second injection of companion-overlay.js into a tab that already has it mounted does not create a duplicate host', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const page = await context.newPage()
  await page.goto('https://example.com')
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1)

  // Simulate reinjectCompanion() running against a tab that's already mounted —
  // executeScript gives the script a fresh module scope, so only a DOM-level guard
  // (checked at the top of companion-overlay.js, before any module state) can prevent
  // a second host element from appearing. Resolve the real tab id via the service
  // worker's own chrome.tabs.query — a content script can't read its own tabId directly.
  const [sw] = context.serviceWorkers()
  await sw.evaluate(async (urlPattern) => {
    const [tab] = await chrome.tabs.query({ url: urlPattern })
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['companion-overlay.js'] })
  }, 'https://example.com/*')

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1) // still exactly one, not two

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

`chrome.tabs.query`'s `url` filter accepts a match pattern — `'https://example.com/*'` matches regardless of the exact normalized form `page.goto('https://example.com')` produces (with or without a trailing slash).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/companion.spec.ts -g "does not create a duplicate host" --workers=1`
Expected: FAIL — with no DOM-level guard, the second injection runs completely independently and appends a second `[data-meant-companion]` host element, so the count is `2`, not `1`.

- [ ] **Step 3: Implement the fix**

In `extension/manifest.json`, change:
```json
  "permissions": ["declarativeNetRequest", "tabs", "storage", "alarms", "idle"],
```
to:
```json
  "permissions": ["declarativeNetRequest", "tabs", "storage", "alarms", "idle", "scripting"],
```

In `extension/companion-overlay.js`, add this as the very first lines of the file, BEFORE the existing top-of-file comment block and BEFORE any `const`/`let` declaration:
```js
// A second injection of this same script (from reinjectCompanion() in sw.js, e.g. after
// a browser restart re-runs onStartup on a tab this exact version already mounted into
// normally) must not create a second host element. This check has to live in the DOM,
// not in this module's own scope — a fresh chrome.scripting.executeScript() call gets a
// fresh module scope every time, so a module-level guard would never see the first
// injection's state.
if (document.documentElement.querySelector('[data-meant-companion]')) {
  throw new Error('meant-companion-already-mounted')
}

```
(Keep the file's existing top-of-file comment block and all existing code below this new guard, completely unchanged.)

In `extension/sw.js`, add near the other top-level `chrome.runtime`/`chrome.tabs` listener registrations (search for the existing `chrome.runtime.onInstalled.addListener`/`chrome.runtime.onStartup.addListener` calls — this file already has some for `recoverStaleSession`/`flush`; add these alongside them, don't duplicate the listener registration pattern into a new location):
```js
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
      // A tab can still reject injection for reasons outside our control (it navigated
      // away between the query and the injection attempt, or already has this exact
      // script mounted and threw the DOM-guard error above) — skip it, don't let one
      // tab's failure stop the rest.
    }
  }
}
chrome.runtime.onInstalled.addListener(reinjectCompanion)
chrome.runtime.onStartup.addListener(reinjectCompanion)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "does not create a duplicate host" --workers=1`
Expected: PASS.

- [ ] **Step 5: Write a second test proving the actual re-injection behavior end to end**

```typescript
test('reinjectCompanion mounts the companion into an already-open tab that never had it, simulating post-reload recovery', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const page = await context.newPage()
  await page.goto('https://example.org')
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1) // mounted normally via content_scripts

  // Directly clear the host to simulate the "orphaned after extension reload" state —
  // the real regression this task fixes — then call the service worker's own
  // reinjectCompanion() the same way onInstalled/onStartup would, and confirm it
  // recovers the tab without the user refreshing anything.
  await page.evaluate(() => document.querySelector('[data-meant-companion]')?.remove())
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(0)

  const [sw] = context.serviceWorkers()
  await sw.evaluate(() => (self as any).reinjectCompanion?.())
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

This requires `reinjectCompanion` to be reachable from the service worker's own global scope for the test to call it directly (`sw.evaluate(() => (self as any).reinjectCompanion?.())`) — since `extension/sw.js` is a module-type service worker, a top-level `function reinjectCompanion() {}` declaration is NOT automatically a property of `self`. Add `self.reinjectCompanion = reinjectCompanion` (or expose it however this file's existing test-support pattern already does for other functions — check `extension/sw.js` for whether any other function is already exposed this way for testing, and follow that exact convention if one exists; if none exists, add the plain `self.reinjectCompanion = reinjectCompanion` line directly after the function's own declaration).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "reinjectCompanion mounts the companion" --workers=1`
Expected: PASS.

- [ ] **Step 7: Visual verification (required)**

This task's behavior can't be meaningfully screenshotted (it's a background re-injection mechanism, not a new visual element) — skip the screenshot requirement for this task specifically, but do manually verify once in a real loaded-unpacked Chrome instance if convenient: start a session, open a real tab, reload the extension in `chrome://extensions`, and confirm the companion reappears on that already-open tab within a moment, with no manual page refresh. Note in the report whether this manual check was actually performed or not.

- [ ] **Step 8: Run the full suite**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`, `node --test test/tally.test.js`.
Expected: all clean.

- [ ] **Step 9: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case documenting both new tests.

- [ ] **Step 10: Commit**

```bash
git add extension/manifest.json extension/sw.js extension/companion-overlay.js e2e/companion.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(extension): re-inject the companion into already-open tabs on install/update, no manual refresh needed"
```

---

## Final review

Once all 6 tasks land, dispatch a final whole-branch review on the most capable available model, matching every prior round's process. Specifically re-check:

- **`extension/companion-overlay.js` coherence across Tasks 4 and 6** — both touch this one file. Confirm the new DOM-guard (Task 6) sits genuinely before any of the file's existing module-scope declarations, and that Task 4's hover-pill CSS/JS changes weren't accidentally placed above or interleaved with the guard.
- **The `scripting` permission's actual runtime behavior** — independently verify `chrome.scripting.executeScript` with only `files: [...]` (no explicit `world` option) runs in the same isolated world the declarative `content_scripts` entry would have used, so the re-injected script has access to the same extension APIs the normal injection path does.
- **No live tick anywhere**: `grep -rn "setInterval" extension/` must return nothing.
- **No hex values outside the two already-approved exceptions**: `grep -rn "#[0-9A-Fa-f]\{6\}" extension/popup.js extension/meant.css` must return nothing; `grep -rn "#[0-9A-Fa-f]\{6\}" extension/companion-overlay.js` should show only the pill's already-approved fixed colors plus the new `#C75B39` dot, nothing else new.
- **The live per-domain row list (Task 5) doesn't make the popup feel overwhelming** — this product's own explicit invariant is a calm, minimal popup; re-check the visual evidence from Task 5's own report and form an independent judgment, not just trust the implementer's own screenshot description.
- Run a production `next build` before considering the whole batch done.
