# Cycles and the End-of-Session Popup — Implementation Plan (Plan A of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the two stale premium passages. Give the popup's cycle presets readable labels and a cycle count. End a timed session after its last work block. Make the popup open itself at an elapsed end to ask "Did you?".

**Architecture:**
- Cycle arithmetic and the restore-from-`lastChoice` logic move out of `extension/popup.js` into a new pure module, `extension/lib/cycles.js`, so they are unit-testable. The popup's picker consumes that module.
- The auto-open lives entirely in `extension/sw.js`: one `askOutcome()` function, called at elapsed end and again from a `chrome.windows.onFocusChanged` listener.
- A toolbar badge `?` marks an unanswered outcome until the popup's Done clears it.

**Tech Stack:** plain ES-module MV3 extension (no bundler) · `node --test` · Playwright (`e2e/`, loads `extension/` unpacked).

**Spec:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §0, §1, §2.

## Global Constraints

- **`docs/adr/` is canonical (ADR-0063).** Where an ADR and any other document disagree, the ADR is right; reconcile the other document, never silently pick one. An ADR records a decision already taken; one decision per file; append-only.
- **ADR numbers in this plan: 0081 and 0082.** Before Task 2, run `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -3`. If 0081 or 0082 is taken (Plans B and C, or the-real-eval, may land first), use the next free numbers and replace every `0081`/`0082` in this plan with them.
- **TDD is mandatory** (`AGENTS.md`): a failing test before every behaviour change.
- **Definition of done:** `npm test`, `npx tsc --noEmit` and `npm run test:e2e` all pass. `test:e2e` needs `.env.test`; see `.env.test.example`. It refuses to run without it, and that is correct.
- **The popup animates nothing.** Static text only; no ticking numbers (ADR-0045).
- **No hex value in any component or script.** Colours come from `design/tokens.css` via `var(--m-*)`. The badge therefore sets **no colour** (the service worker cannot read CSS variables); Chrome's default badge colour stays.
- **The class contract is frozen.** New shapes use `data-*` attributes (`data-chip-layout`, `data-chip-role`), never a new class name.
- **`extension/lib/*.js` is pure:** no `chrome.*`, no `Date.now()`. Callers pass values in.
- **Every PR links a GitHub Project 16 issue** (`Closes #NN`); create it with `gh issue create` and add it to Project 16 if it does not exist.
- **Never add AI or assistant attribution to a commit message or a pull request description.**
- **Work on a branch off `origin/main`** (the checkout branch `companion-persistence-scale-and-polish` is already merged and stale).

## File map

| File | Change | Responsibility |
|---|---|---|
| `docs/prd-intent.md` | Modify §7.1 | One sentence citing ADR-0075 |
| `PRODUCT.md` | Modify "Who pays" | The same sentence (derived file) |
| `docs/adr/ADR-0081-cycles-gain-a-count-and-end-after-the-last-work-block.md` | Create | Records §1 |
| `docs/adr/ADR-0082-the-popup-opens-itself-to-ask.md` | Create | Records §2 |
| `extension/lib/cycles.js` | Create | `CYCLE_PRESETS`, `MAX_CYCLES`, `clampCount`, `plannedMinutesFor`, `restoreCycle` |
| `test/extension-cycles.test.js` | Create | Unit tests for the above |
| `extension/popup.js` | Modify | Picker UI (labels, stepper), import from `cycles.js`, `clearPending()` |
| `extension/meant.css` | Modify | `paired` row break, `count` stepper, step-chip size |
| `extension/sw.js` | Modify | Badge, `askPending`, `askOutcome()`, focus listener |
| `extension/api.js` | Modify | Clear the badge where a 401 clears `pendingReview` |
| `e2e/popup.spec.ts` | Modify | Rename preset chips, 25-minute math, stepper tests |
| `e2e/session-elapsed.spec.ts` | Modify | Auto-open + badge tests |

---

### Task 1: Reconcile the stale premium passages with ADR-0075

**Files:**
- Modify: `docs/prd-intent.md` (§7.1, the paragraph beginning "Direct consumer subscription.")
- Modify: `PRODUCT.md` (the line beginning `**Who pays (D10, unchanged):**`)

**Interfaces:** Consumes ADR-0075. Produces nothing code depends on.

- [ ] **Step 1: Confirm the passages still read as stale**

Run: `grep -n "Direct consumer subscription" docs/prd-intent.md && grep -n "Who pays (D10" PRODUCT.md && grep -rn "ADR-0075" docs/prd-intent.md PRODUCT.md`
Expected: two matching lines, and no ADR-0075 mention in either file. If ADR-0075 is already cited, skip to Step 4.

- [ ] **Step 2: Add the note to PRD §7.1**

In `docs/prd-intent.md`, directly after the paragraph that ends `…which is the only pricing shape that survives M9.`, insert a blank line and then:

```markdown
> **Suspended for the testing phase (ADR-0075, 2026-09-22).** Every feature this section calls
> paid is free until a later ADR ends the suspension, and no code gates any feature. The paywall's
> placement at the inference cost is not revisited; it is what resumes when the phase ends.
```

- [ ] **Step 3: Add the same note to `PRODUCT.md`**

At the end of the `**Who pays (D10, unchanged):**` line, after `*(Load-bearing on the freemium shape; see PRD §2 and Q6.)*`, append:

```markdown
 **Suspended for the testing phase (ADR-0075):** every feature is free until a later ADR ends it; no code gates anything.
```

- [ ] **Step 4: Verify**

Run: `grep -c "ADR-0075" docs/prd-intent.md PRODUCT.md`
Expected: each file reports at least `1`.

- [ ] **Step 5: Commit**

```bash
git add docs/prd-intent.md PRODUCT.md
git commit -m "docs: reconcile the PRD and PRODUCT.md with ADR-0075's premium suspension"
```

---

### Task 2: Cycle arithmetic as a pure module, and the ADR that records it

**Files:**
- Create: `docs/adr/ADR-0081-cycles-gain-a-count-and-end-after-the-last-work-block.md`
- Create: `extension/lib/cycles.js`
- Test: `test/extension-cycles.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (Task 3 imports every name except `CYCLE_PRESETS` from `./lib/cycles.js`):
  - `CYCLE_PRESETS: {work:number, break:number}[]` — `[{work:25,break:5},{work:50,break:10}]`
  - `MAX_CYCLES: number` — `8`
  - `clampCount(n: unknown): number` — an integer from 1 to 8; a non-finite value becomes 1
  - `plannedMinutesFor({work, break, count}): number` — `c*work + (c-1)*break`, where `c = clampCount(count)`
  - `restoreCycle(lastChoice | null | undefined): {mode:'25/5'|'50/10'|'custom', customMode:'timed'|'open'|'none', work:number, brk:number, count:number}`

- [ ] **Step 1: Confirm the ADR number**

Run: `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -3`
Expected: `ADR-0080` is the highest. Otherwise, use the next free number throughout.

- [ ] **Step 2: Write the ADR**

Create `docs/adr/ADR-0081-cycles-gain-a-count-and-end-after-the-last-work-block.md`:

```markdown
# ADR-0081 — Cycles gain a count, and a timed session ends after its last work block

- **Date:** 2026-09-23
- **Status:** Accepted
- **Amends:** ADR-0045 — its cycle semantics only. No dial and no ticking number, unchanged.
- **Context:** Owner request 2026-09-23, "labels of time on the popup". The presets read `25/5`
  and `50/10`, fractions a first-time user has to decode, and a preset could only ever run one
  cycle (25/5 was a 30-minute session). A longer block meant custom "until I stop", which has no
  end and therefore never asks "Did you?" on its own.
- **Decision:** The presets read `25 work · 5 break` and `50 work · 10 break`. A `× N cycles`
  stepper (1–8, default 1) sits in the preset row before `custom` and applies to the presets and
  to custom "timed"; it is hidden for "until I stop" and "no cycles". A timed session's length is
  `count × work + (count − 1) × break`: **it ends after the last work block**, not after a
  trailing break, so the question arrives when the work does rather than after five minutes the
  user may have walked away from.
- **Consequences:** 25/5 ×1 is now 25 minutes, not 30 — a behaviour change for every returning
  user on a preset. A `lastChoice` saved before this ADR (no `count`) restores as count 1. The
  server stores no new column: `planned_minutes` already carries the length, and `cycle.count`
  lives only on the device. The cycle arithmetic moves to `extension/lib/cycles.js` so it is
  unit-tested rather than living inside the popup's DOM code.
- **Source:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §1; owner brainstorm 2026-09-23.
```

- [ ] **Step 3: Write the failing tests**

Create `test/extension-cycles.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { CYCLE_PRESETS, MAX_CYCLES, clampCount, plannedMinutesFor, restoreCycle } from '../extension/lib/cycles.js'

// ADR-0081. The session ends after the LAST WORK BLOCK — no trailing break inside it.
test('one cycle is the work block alone', () => {
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 1 }), 25)
})

test('n cycles are n work blocks and n-1 breaks', () => {
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 2 }), 55)
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 4 }), 115)
  assert.equal(plannedMinutesFor({ work: 50, break: 10, count: 2 }), 110)
})

test('the count is clamped to 1..MAX_CYCLES and rounded, and junk becomes 1', () => {
  assert.equal(MAX_CYCLES, 8)
  assert.equal(clampCount(0), 1)
  assert.equal(clampCount(-3), 1)
  assert.equal(clampCount(99), 8)
  assert.equal(clampCount(2.6), 3)
  assert.equal(clampCount('3'), 3)
  assert.equal(clampCount(undefined), 1)
  assert.equal(clampCount(NaN), 1)
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 99 }), 8 * 25 + 7 * 5)
})

test('the presets are unchanged', () => {
  assert.deepEqual(CYCLE_PRESETS, [{ work: 25, break: 5 }, { work: 50, break: 10 }])
})

test('no saved choice restores the first-ever default: 25/5, one cycle', () => {
  assert.deepEqual(restoreCycle(null), { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 1 })
  assert.deepEqual(restoreCycle(undefined), restoreCycle(null))
})

test('"no cycles" restores as custom/none with the length in the work field', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 45, cycle: null }), { mode: 'custom', customMode: 'none', work: 45, brk: 5, count: 1 })
})

test('"until I stop" restores as custom/open', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: null, cycle: { work: 30, break: 10 } }), { mode: 'custom', customMode: 'open', work: 30, brk: 10, count: 1 })
})

test('a new-shape preset choice restores its preset and its count', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 55, cycle: { work: 25, break: 5, count: 2 } }), { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 2 })
  assert.deepEqual(restoreCycle({ plannedMinutes: 110, cycle: { work: 50, break: 10, count: 2 } }), { mode: '50/10', customMode: 'timed', work: 50, brk: 10, count: 2 })
})

test('a new-shape custom pair restores as custom/timed with its count', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 70, cycle: { work: 20, break: 5, count: 3 } }), { mode: 'custom', customMode: 'timed', work: 20, brk: 5, count: 3 })
})

// Saved before ADR-0081: no count, and a timed session was exactly one work + break.
test('a pre-ADR-0081 preset choice restores as that preset with one cycle', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 30, cycle: { work: 25, break: 5 } }), { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 1 })
})

test('a pre-ADR-0081 choice whose length is not one cycle lands in custom/timed', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 50, cycle: { work: 25, break: 5 } }), { mode: 'custom', customMode: 'timed', work: 25, brk: 5, count: 1 })
})

test('a saved count out of range is clamped on restore', () => {
  assert.equal(restoreCycle({ plannedMinutes: 25, cycle: { work: 25, break: 5, count: 40 } }).count, 8)
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `node --test test/extension-cycles.test.js`
Expected: FAIL with `Cannot find module '…/extension/lib/cycles.js'`.

- [ ] **Step 5: Write the module**

Create `extension/lib/cycles.js`:

```js
// ADR-0081. Pure — no chrome.*, no Date.now() — so the picker's arithmetic is unit-tested
// rather than living inside popup.js's DOM code.

// D39. Matches lib/thresholds.ts's CYCLE_PRESETS; the plain-JS extension can't import that TS
// module (same limitation as GRACE_MS in popup.js). Keep them identical.
export const CYCLE_PRESETS = [{ work: 25, break: 5 }, { work: 50, break: 10 }]
export const MAX_CYCLES = 8

export function clampCount(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 1
  return Math.min(MAX_CYCLES, Math.max(1, v))
}

/** A timed session ends after its LAST WORK BLOCK: n work blocks, n − 1 breaks. */
export function plannedMinutesFor({ work, break: brk, count }) {
  const c = clampCount(count)
  return c * work + (c - 1) * brk
}

/** Reconstructs the picker's starting state from a saved { plannedMinutes, cycle } choice, or
 *  the first-ever default when there is none. */
export function restoreCycle(lastChoice) {
  const fresh = { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 1 }
  if (!lastChoice) return fresh
  const { plannedMinutes: pm, cycle: c } = lastChoice
  if (!c) return { ...fresh, mode: 'custom', customMode: 'none', work: pm ?? 25 }
  if (pm == null) return { mode: 'custom', customMode: 'open', work: c.work, brk: c.break, count: 1 }

  let count
  if (c.count == null) {
    // Saved before ADR-0081, when a timed session was exactly one work + break. Any other
    // length is an old-model shape (e.g. 50 min through two 25/5 cycles): custom, one cycle.
    if (pm !== c.work + c.break) return { mode: 'custom', customMode: 'timed', work: c.work, brk: c.break, count: 1 }
    count = 1
  } else {
    count = clampCount(c.count)
  }
  const preset = CYCLE_PRESETS.find((p) => p.work === c.work && p.break === c.break)
  return { mode: preset ? `${preset.work}/${preset.break}` : 'custom', customMode: 'timed', work: c.work, brk: c.break, count }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/extension-cycles.test.js`
Expected: PASS, 12 tests, 0 failures.

- [ ] **Step 7: Run the whole unit suite**

Run: `npm test`
Expected: PASS, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add docs/adr/ADR-0081-cycles-gain-a-count-and-end-after-the-last-work-block.md extension/lib/cycles.js test/extension-cycles.test.js
git commit -m "feat(cycles): cycle count and last-work-block end as a pure module (ADR-0081)"
```

---

### Task 3: The picker shows labels and a cycle count

**Files:**
- Modify: `extension/popup.js` (imports; delete the local `CYCLE_PRESETS` constant at lines 14–16 and the `restore()` function at lines 306–319; `chipGroup`'s single-select handler at line 63; `cycleDurationPicker` at lines 223–304; the comment at line 404)
- Modify: `extension/meant.css` (the `paired` rule at lines 251–257)
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes (Task 2): `MAX_CYCLES`, `clampCount`, `plannedMinutesFor`, `restoreCycle` from `./lib/cycles.js`.
- Produces: `picker.value` returns `{ plannedMinutes, cycle }`, where a timed `cycle` is `{ work, break, count }`, an open one is `{ work, break }`, and none is `null`. The Start handler already forwards `picker.value` to `sw.js` and `lastChoice` unchanged.

- [ ] **Step 1: Update the existing e2e tests to the new labels and math (they will fail)**

In `e2e/popup.spec.ts`, replace the whole test `'the cycle-preset row visually separates the two presets from custom'` with:

```ts
  // ADR-0081: the two labelled presets share the first line; the cycle count and custom
  // share the second. Exclusive single-select still spans all three chips.
  test('the cycle-preset row puts the presets on one line and the count with custom on the next', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const cycleRow = page.locator('[data-chip-layout="paired"]')
    await expect(cycleRow).toBeVisible()
    const chips = cycleRow.locator(':scope > .m-chip')
    await expect(chips).toHaveCount(3)

    const first = (await chips.nth(0).boundingBox())!
    const second = (await chips.nth(1).boundingBox())!
    const custom = (await chips.nth(2).boundingBox())!
    const stepper = (await cycleRow.locator('[data-chip-layout="count"]').boundingBox())!
    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1)   // presets share a line
    expect(custom.y).toBeGreaterThan(first.y + first.height - 1)  // custom starts the next line
    expect(Math.abs(stepper.y - custom.y)).toBeLessThanOrEqual(4) // and the count sits beside it
    expect(stepper.x).toBeLessThan(custom.x)                      // before custom

    await chips.nth(0).click()
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await chips.nth(2).click()
    await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true')
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false')
  })
```

Replace the whole test `'the idle popup shows only 25/5, 50/10, and custom at first — no duration row, no until-I-stop, no no-cycles'` with:

```ts
  test('the idle popup shows the two labelled presets, the cycle count, and custom at first', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await expect(page.getByRole('button', { name: '25 work · 5 break', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '50 work · 10 break', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'custom', exact: true })).toBeVisible()
    await expect(page.getByText('× 1 cycle', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'until I stop', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'no cycles', exact: true })).toHaveCount(0)

    // 25/5 is the confirmed first-ever-session default.
    await expect(page.getByRole('button', { name: '25 work · 5 break', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })
```

Replace the whole test `'picking 25/5 caps the session at exactly 30 planned minutes'` with:

```ts
  // ADR-0081: one cycle is the work block alone.
  test('picking 25 work · 5 break with one cycle plans exactly 25 minutes', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: '25 work · 5 break', exact: true }).click()
    await page.locator('input.m-field').first().fill('preset cap test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
      .toBe(25)

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })
```

In the test `'a running session with a cycle configured shows one consolidated line, not two, and never ticks'`, replace:

```ts
    await page.getByRole('button', { name: '25/5', exact: true }).click()
```

with:

```ts
    await page.getByRole('button', { name: '25 work · 5 break', exact: true }).click()
    // Two cycles (55 min), so 26 minutes in is inside the break, not past the end (ADR-0081).
    await page.getByRole('button', { name: 'More cycles' }).click()
```

- [ ] **Step 2: Add the new stepper tests**

In `e2e/popup.spec.ts`, directly after the replaced `'picking 25 work · 5 break with one cycle plans exactly 25 minutes'` test, insert:

```ts
  test('the cycle count multiplies a preset: two cycles of 25/5 plan 55 minutes', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: 'More cycles' }).click()
    await expect(page.getByText('× 2 cycles', { exact: true })).toBeVisible()
    await page.locator('input.m-field').first().fill('two cycles test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
      .toBe(55)
    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.cycle)))))
      .toEqual({ work: 25, break: 5, count: 2 })

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the count stops at 1 and 8', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await expect(page.getByRole('button', { name: 'Fewer cycles' })).toBeDisabled()
    for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'More cycles' }).click()
    await expect(page.getByText('× 8 cycles', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'More cycles' })).toBeDisabled()
  })

  test('the count is hidden for until I stop and no cycles, and shown for custom timed', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const stepper = page.locator('[data-chip-layout="count"]')
    await page.getByRole('button', { name: 'custom', exact: true }).click()
    await expect(stepper).toBeVisible()
    await page.getByRole('button', { name: 'until I stop', exact: true }).click()
    await expect(stepper).toBeHidden()
    await page.getByRole('button', { name: 'until I stop', exact: true }).click() // back to timed
    await expect(stepper).toBeVisible()
    await page.getByRole('button', { name: 'no cycles', exact: true }).click()
    await expect(stepper).toBeHidden()
  })

  test('the last choice restores its preset and its count', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.evaluate(() => new Promise<void>((r) => chrome.storage.local.set({
      lastChoice: { plannedMinutes: 110, cycle: { work: 50, break: 10, count: 2 }, blockedDomains: [], blocklists: [], workSites: [] },
    }, () => r())))
    await page.reload()

    await expect(page.getByRole('button', { name: '50 work · 10 break', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('× 2 cycles', { exact: true })).toBeVisible()
  })
```

- [ ] **Step 3: Run the popup e2e file to verify the new tests fail**

Run: `npx playwright test e2e/popup.spec.ts`
Expected: FAIL. The updated and new tests can't find `'25 work · 5 break'`, `'More cycles'` or `[data-chip-layout="count"]`.

- [ ] **Step 4: Import the pure module and delete the duplicates in `popup.js`**

At the top of `extension/popup.js`, after `import { withOpenSlice, toSegments } from './lib/tally.js'`, add:

```js
import { MAX_CYCLES, clampCount, plannedMinutesFor, restoreCycle } from './lib/cycles.js'
```

Delete these lines (14–16):

```js
// D39. Matches lib/thresholds.ts's CYCLE_PRESETS, same cross-import limitation as GRACE_MS
// above. `custom` is any pair; `null` cycle means one continuous block (today's behaviour).
const CYCLE_PRESETS = [{ work: 25, break: 5 }, { work: 50, break: 10 }]
```

Delete the whole `restore(lastChoice)` function and its doc comment (lines 306–319, from `/** Reconstructs the picker's {mode, customMode, work, brk} starting state` through its closing `}`). `restoreCycle` replaces it.

`popup.js` no longer needs `CYCLE_PRESETS` itself — `restoreCycle` uses it inside `cycles.js` — so it is deliberately not imported.

- [ ] **Step 5: Narrow `chipGroup`'s single-select handler to direct children**

In `chipGroup`, replace:

```js
        for (const b of row.querySelectorAll('.m-chip')) b.setAttribute('aria-pressed', String(b === chip))
```

with:

```js
        // Direct children only: the cycle row nests its stepper's −/+ buttons (also .m-chip)
        // inside the same row, and a single-select click must never stamp aria-pressed on them.
        for (const b of row.querySelectorAll(':scope > .m-chip')) b.setAttribute('aria-pressed', String(b === chip))
```

(Single-select groups are never `removable`, so their chips are always direct children of `row`.)

- [ ] **Step 6: Replace `cycleDurationPicker`**

Replace the whole `cycleDurationPicker` function and its doc comment (from `/** 25/5 · 50/10 · custom — one single-select, always visible.` through the function's closing `}`) with:

```js
/** Two labelled presets, a cycle count, then custom (ADR-0081). Custom reveals labelled
 *  work/break inputs plus two more chips (until I stop / no cycles), at-most-one-of-two. The
 *  count applies to the presets and to custom "timed", and is hidden where it means nothing.
 *  `.value` is `{ plannedMinutes, cycle }` directly — the exact shape the Start handler sends
 *  to sw.js, so nothing downstream of this picker needs to change. */
function cycleDurationPicker(lastChoice) {
  const restored = restoreCycle(lastChoice)
  let mode = restored.mode
  let customMode = restored.customMode
  let count = restored.count

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

  // The count: static text plus −/+ (a stepper, not a dial — ADR-0045 refuses the dial).
  const countText = el('span', 'm-meta')
  const fewer = el('button', 'm-chip', '−')
  fewer.type = 'button'
  fewer.dataset.chipRole = 'step'
  fewer.setAttribute('aria-label', 'Fewer cycles')
  const more = el('button', 'm-chip', '+')
  more.type = 'button'
  more.dataset.chipRole = 'step'
  more.setAttribute('aria-label', 'More cycles')
  const stepper = el('div')
  stepper.dataset.chipLayout = 'count'
  stepper.append(countText, fewer, more)

  function setCount(next) {
    count = clampCount(next)
    countText.textContent = `× ${count} ${count === 1 ? 'cycle' : 'cycles'}`
    fewer.disabled = count <= 1
    more.disabled = count >= MAX_CYCLES
  }
  fewer.addEventListener('click', () => setCount(count - 1))
  more.addEventListener('click', () => setCount(count + 1))
  setCount(count)

  // A count means nothing without an end ("until I stop") or without cycles ("no cycles").
  function syncStepper() {
    stepper.hidden = mode === 'custom' && customMode !== 'timed'
  }

  function setCustomMode(next) {
    customMode = next
    openChip.setAttribute('aria-pressed', String(next === 'open'))
    noneChip.setAttribute('aria-pressed', String(next === 'none'))
    brkInput.disabled = next === 'none'
    workLabelText.textContent = next === 'none' ? 'minutes' : 'work'
    syncStepper()
  }
  openChip.addEventListener('click', () => setCustomMode(customMode === 'open' ? 'timed' : 'open'))
  noneChip.addEventListener('click', () => setCustomMode(customMode === 'none' ? 'timed' : 'none'))
  // Typing in either field is itself a choice of "timed" — editing numbers a pressed
  // chip is ignoring would be a trap. workInput's guard is asymmetric on purpose: under
  // "no cycles" the work field IS the session length, so editing it must not leave "none".
  workInput.addEventListener('input', () => { if (customMode === 'open') setCustomMode('timed') })
  brkInput.addEventListener('input', () => { if (customMode !== 'timed') setCustomMode('timed') })

  const level1 = chipGroup(
    [
      { label: '25 work · 5 break', value: '25/5' },
      { label: '50 work · 10 break', value: '50/10' },
      { label: 'custom', value: 'custom' },
    ],
    { mono: true, value: mode, onChange: (v) => { mode = v; customRow.hidden = v !== 'custom'; syncStepper() } },
  )
  level1.row.dataset.chipLayout = 'paired'
  // Presets on the first line; the count and custom on the second (the owner's layout,
  // 2026-09-23). A zero-height full-width span forces the wrap without a second chipGroup —
  // exclusive single-select has to span all three chips.
  const customChip = level1.row.lastElementChild
  const lineBreak = el('span')
  lineBreak.dataset.chipLayout = 'break'
  level1.row.insertBefore(lineBreak, customChip)
  level1.row.insertBefore(stepper, customChip)
  syncStepper()

  return {
    row: level1.row,
    customRow,
    get value() {
      const w = Number(workInput.value) || 25
      const b = Number(brkInput.value) || 5
      if (level1.value !== 'custom') {
        const [pw, pb] = level1.value.split('/').map(Number)
        return { plannedMinutes: plannedMinutesFor({ work: pw, break: pb, count }), cycle: { work: pw, break: pb, count } }
      }
      if (customMode === 'none') return { plannedMinutes: w, cycle: null }
      if (customMode === 'open') return { plannedMinutes: null, cycle: { work: w, break: b } }
      return { plannedMinutes: plannedMinutesFor({ work: w, break: b, count }), cycle: { work: w, break: b, count } }
    },
  }
}
```

- [ ] **Step 7: Fix the stale comment in `idle()`**

In `idle()`, replace:

```js
  // First ever session: 25/5 (30 min). A returning session recalls last time's pick.
```

with:

```js
  // First ever session: 25/5, one cycle (25 min, ADR-0081). A returning session recalls last time's pick.
```

- [ ] **Step 8: Update the CSS**

In `extension/meant.css`, replace the whole block:

```css
/* The cycle-preset row is ONE chipGroup (exclusive single-select must span all 3
 * options), so it can't be split into two separate groups the way "cluster" wraps two
 * independent label+chipGroup pairs elsewhere in this file — this adds a visual gap
 * before the 3rd chip ("custom"), separating the two numeric presets from it. */
[data-surface="popup"] [data-chip-layout="paired"] > .m-chip:nth-child(3) {
  margin-left: 12px;
}
```

with:

```css
/* The cycle-preset row is ONE chipGroup (exclusive single-select must span all 3
 * options), so it can't be split into two groups. ADR-0081: a zero-height, full-width span
 * breaks it into two lines — the two presets, then the cycle count beside "custom". */
[data-surface="popup"] [data-chip-layout="paired"] > [data-chip-layout="break"] {
  flex-basis: 100%;
  height: 0;
}
[data-surface="popup"] [data-chip-layout="count"] { display: inline-flex; align-items: center; gap: 6px; }
/* display above would override the [hidden] attribute's UA display:none — restore it. */
[data-surface="popup"] [data-chip-layout="count"][hidden] { display: none; }
.m-chip[data-chip-role="step"] { width: 34px; padding: 0; }
.m-chip[data-chip-role="step"]:disabled { color: var(--m-ink-3); border-color: var(--m-edge); cursor: default; }
```

- [ ] **Step 9: Run the popup e2e file to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts`
Expected: PASS, 0 failures. If "presets share a line" fails because the two labels wrap at 320px of content width, do **not** shorten the labels silently. Take a screenshot and raise it with the owner: the labels are the owner's choice.

- [ ] **Step 10: Run the other suites that read the popup**

Run: `npx playwright test e2e/outcome-in-popup.spec.ts e2e/offline.spec.ts e2e/session-elapsed.spec.ts e2e/session-lifecycle.spec.ts && npm test`
Expected: PASS. The default 25/5 ×1 still shows `N min · M min left`.

- [ ] **Step 11: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/popup.spec.ts
git commit -m "feat(popup): labelled cycle presets and a cycle count before custom (ADR-0081)"
```

---

### Task 4: The popup opens itself at an elapsed end, and the badge waits for Done

**Files:**
- Create: `docs/adr/ADR-0082-the-popup-opens-itself-to-ask.md`
- Modify: `extension/sw.js` (`endSession` at lines 196–198; a new `askOutcome` function and a new focus listener)
- Modify: `extension/popup.js` (a new `clearPending()`; the three `chrome.storage.local.remove('pendingReview')` calls in `outcome()`; the Disconnect handler)
- Modify: `extension/api.js` (both 401 branches)
- Test: `e2e/session-elapsed.spec.ts`

**Interfaces:**
- Consumes: the existing `pendingReview` marker (`{ sessionId }`), written by `endSession` for `stopped` and `elapsed`.
- Produces:
  - storage key `askPending: boolean` (true from an elapsed end until the popup opens, or until Done);
  - `self.askOutcome(): Promise<void>` on the service-worker global (tests call it to simulate a focus return);
  - badge text `'?'` while `pendingReview` is set.
  - **Plan C relies on `askOutcome` and `clearPending` existing.**

- [ ] **Step 1: Write the ADR**

Create `docs/adr/ADR-0082-the-popup-opens-itself-to-ask.md`:

```markdown
# ADR-0082 — The popup opens itself to ask, once, when a timed session elapses

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Owner request 2026-09-23: "popup shows up after the session is done and asks."
  Since the review tab stopped auto-opening (docs/superpowers/plans/2026-09-07-real-browser-qa-fixes.md),
  "Did you?" has appeared only when the user happens to open the popup. A session that elapses
  tells the user nothing, and an unanswered outcome is a hole in the column every figure is
  computed from. `chrome.action.openPopup()` has shipped to all extensions since Chrome 127 and
  needs no user gesture, but it only opens into the active, focused browser window. It rejects
  otherwise ("Could not find an active browser window"; Chrome 143 behaviour table,
  w3c/webextensions#160).
- **Decision:** When a session ends by `elapsed`, the service worker sets `askPending` and calls
  `openPopup()`. If that rejects — the user is in another app — a `windows.onFocusChanged`
  listener tries again the next time a Chrome window gains focus, and `askPending` clears on the
  first success. `stopped` never auto-opens: the user pressed Stop inside the popup, which is
  already showing the question. Both `stopped` and `elapsed` set the toolbar badge to `?` until
  the popup's Done clears it. The badge sets no colour: the service worker cannot read
  `design/tokens.css`, and a literal colour would be a hex in code.
- **Consequences:** The popup can appear without a click, once per elapsed session, and never
  during one: I2 holds, since nothing happens on screen while a session runs. The owner rejected
  an OS notification (a new permission, and noise in the notification centre). If Chrome never
  regains focus before the next session starts, the question waits in the popup exactly as it
  did before this ADR.
- **Source:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §2; owner brainstorm 2026-09-23.
```

- [ ] **Step 2: Write the failing e2e tests**

In `e2e/session-elapsed.spec.ts`, append after the existing test:

```ts
// Shared by the two ADR-0082 cases below: start a 25-minute "no cycles" session, push its
// start 26 minutes back, and fire the TICK alarm so endSession('elapsed') runs for real.
async function startAndElapse(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext, intention: string) {
  await page.locator('input.m-field').first().fill(intention)
  await page.getByRole('button', { name: 'custom', exact: true }).click()
  await page.getByRole('button', { name: 'no cycles', exact: true }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.evaluate(() => new Promise<void>((resolve) => {
    chrome.storage.local.get('session', ({ session }: any) => {
      session.startedAt = new Date(Date.now() - 26 * 60_000).toISOString()
      chrome.storage.local.set({ session }, () => resolve())
    })
  }))
  const [sw] = context.serviceWorkers()
  await sw.evaluate(() => chrome.alarms.create('meant-tick', { delayInMinutes: 0.01 }))
  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session)))),
      { timeout: 70_000, intervals: [2_000] })
    .toBeNull()
  return sw
}

// ADR-0082. openPopup is spied rather than observed: a headless run has no toolbar to open a
// popup into, and the spy is what proves the service worker ASKED. The spy lives on the
// service worker's global, so this test must finish before the worker idles out (~30s).
test('an elapsed session asks by opening the popup, and badges the icon until Done', async ({ context, extensionId, freshAccount }) => {
  test.setTimeout(90_000)
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  const [sw0] = context.serviceWorkers()
  await sw0.evaluate(() => {
    const g = self as any
    g.__opened = 0
    chrome.action.openPopup = (async () => { g.__opened++ }) as typeof chrome.action.openPopup
  })

  const sw = await startAndElapse(page, context, 'auto-open test')

  await expect.poll(async () => sw.evaluate(() => (self as any).__opened)).toBe(1)
  expect(await sw.evaluate(() => chrome.action.getBadgeText({}))).toBe('?')
  expect(await page.evaluate(() => new Promise((r) => chrome.storage.local.get('askPending', (v: any) => r(v.askPending))))).toBe(false)

  await page.reload()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect.poll(async () => sw.evaluate(() => chrome.action.getBadgeText({}))).toBe('')
})

test('when no window can take the popup, it is asked again on the next focus', async ({ context, extensionId, freshAccount }) => {
  test.setTimeout(90_000)
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  const [sw0] = context.serviceWorkers()
  await sw0.evaluate(() => {
    const g = self as any
    g.__opened = 0
    g.__refuse = true
    chrome.action.openPopup = (async () => {
      if (g.__refuse) throw new Error('Could not find an active browser window.')
      g.__opened++
    }) as typeof chrome.action.openPopup
  })

  const sw = await startAndElapse(page, context, 'focus-return test')

  expect(await sw.evaluate(() => (self as any).__opened)).toBe(0)
  expect(await page.evaluate(() => new Promise((r) => chrome.storage.local.get('askPending', (v: any) => r(v.askPending))))).toBe(true)

  // chrome.windows.onFocusChanged cannot be synthesised from a test; its listener's whole body
  // is askOutcome(), exposed on the worker global for exactly this call.
  await sw.evaluate(async () => { (self as any).__refuse = false; await (self as any).askOutcome() })
  expect(await sw.evaluate(() => (self as any).__opened)).toBe(1)
  expect(await page.evaluate(() => new Promise((r) => chrome.storage.local.get('askPending', (v: any) => r(v.askPending))))).toBe(false)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx playwright test e2e/session-elapsed.spec.ts`
Expected: the two new tests FAIL (`__opened` stays 0, badge text `''`, `askOutcome` undefined). The existing test still passes.

- [ ] **Step 4: Add `askOutcome` and the badge to `sw.js`**

In `extension/sw.js`, directly above `export async function endSession(endReason) {`, insert:

```js
/** ADR-0082. Opens the popup to ask "Did you?" — at an elapsed end, and again on the next
 *  window focus if Chrome had no focused window to open it into. No user gesture needed since
 *  Chrome 127; the only failure is "no active browser window", which leaves askPending set. */
async function askOutcome() {
  const { pendingReview, askPending } = await chrome.storage.local.get(['pendingReview', 'askPending'])
  if (!pendingReview || !askPending) return
  try {
    await chrome.action.openPopup()
    await chrome.storage.local.set({ askPending: false })
  } catch {
    // The user is in another app. onFocusChanged below tries again when they come back.
  }
}
self.askOutcome = askOutcome
```

In `endSession`, replace:

```js
  if (endReason === 'stopped' || endReason === 'elapsed') {
    await chrome.storage.local.set({ pendingReview: { sessionId: session.sessionId } })
  }
```

with:

```js
  if (endReason === 'stopped' || endReason === 'elapsed') {
    await chrome.storage.local.set({ pendingReview: { sessionId: session.sessionId } })
    await chrome.action.setBadgeText({ text: '?' }) // ADR-0082: until the popup's Done
  }
  // Only an elapsed end asks by itself: after 'stopped' the popup is already open on the question.
  if (endReason === 'elapsed') {
    await chrome.storage.local.set({ askPending: true })
    await askOutcome()
  }
```

Directly below the existing `chrome.windows.onFocusChanged.addListener(async (windowId) => { … })` block, add:

```js
// ADR-0082. A second listener, not a branch in the one above: that one returns early when no
// session is running, which is exactly when an elapsed session's question is waiting.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) askOutcome()
})
```

- [ ] **Step 5: Clear the badge wherever the marker is cleared, in `popup.js`**

In `extension/popup.js`, directly above `async function outcome(sessionId) {`, insert:

```js
/** ADR-0082. The marker, the pending auto-open and the badge always clear together. */
async function clearPending() {
  await chrome.storage.local.remove(['pendingReview', 'askPending'])
  await chrome.action.setBadgeText({ text: '' })
}
```

In `outcome()`, replace each of the three occurrences of:

```js
      await chrome.storage.local.remove('pendingReview')
```

and

```js
    await chrome.storage.local.remove('pendingReview')
```

with `await clearPending()`, keeping each line's own indentation. The three are the offline Done handler, the `!res.ok || !res.data` branch and the answered-state Done handler.

In the Disconnect handler in `idle()`, replace:

```js
    await chrome.storage.local.set({ token: null, deviceId: null, session: null, pendingReview: null })
```

with:

```js
    await chrome.storage.local.set({ token: null, deviceId: null, session: null, pendingReview: null, askPending: false })
    await chrome.action.setBadgeText({ text: '' })
```

- [ ] **Step 6: Clear the badge on a 401 in `api.js`**

In `extension/api.js`, in **both** `if (res.status === 401 && token) {` blocks (in `get` and in `post`), add this line directly after the `await chrome.storage.local.set({ … })` call:

```js
      await chrome.action.setBadgeText({ text: '' }) // ADR-0082: no question is waiting any more
```

- [ ] **Step 7: Run the elapsed e2e file to verify it passes**

Run: `npx playwright test e2e/session-elapsed.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 8: Run the full suites**

Run: `npm test && npx tsc --noEmit && npm run test:e2e`
Expected: all PASS, 0 failures.

- [ ] **Step 9: Commit**

```bash
git add docs/adr/ADR-0082-the-popup-opens-itself-to-ask.md extension/sw.js extension/popup.js extension/api.js e2e/session-elapsed.spec.ts
git commit -m "feat(popup): open itself to ask when a session elapses, badge until Done (ADR-0082)"
```

---

### Task 5: Real-browser verification and the PR

**Files:** none changed unless verification finds a defect. A defect gets its own failing test, then the fix, then a commit.

- [ ] **Step 1: Load the extension unpacked and look**

Invoke the `meant-qa` skill. Then, against a real Chrome with `extension/` loaded unpacked and `npm run dev` running:
1. Open the popup while idle and take a screenshot. Check: the two presets on line one, `× 1 cycle − +` beside `custom` on line two, no animation.
2. Press `+` twice. The text reads `× 3 cycles`. Start. The running line reads `0 min · 25 min left`.
3. Set a 1-minute custom timed session with a 1-cycle count. Keep Chrome focused and wait for the end. The popup opens on "Did you?" by itself and the icon shows `?`. Answer, press Done, and the badge clears.
4. Repeat step 3, but switch to another app before the minute ends, then click back into Chrome. The popup opens then.

- [ ] **Step 2: Run the design floor check**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs extension/popup.html extension/meant.css`
Expected: no new findings compared with `main` (the same command run on `main`).

- [ ] **Step 3: Open the issue and the PR**

```bash
gh issue create --title "Cycle labels, cycle count, and the popup asks at session end" \
  --body "Plan A of docs/superpowers/specs/2026-09-23-five-asks-design.md (§0–§2). ADR-0081, ADR-0082."
# add the issue to GitHub Project 16 (gh project item-add 16 --owner ED3N-Ventures-Interns --url <issue-url>)
git push -u origin HEAD
gh pr create --base main --title "Cycle labels and count; the popup asks at session end" \
  --body "Closes #<issue>. Plan: docs/superpowers/plans/2026-09-23-cycles-and-end-popup.md. ADR-0081, ADR-0082. Verified: npm test, tsc, test:e2e, real-browser pass with screenshots."
```

- [ ] **Step 4: After merge, prove it landed on main**

Run: `git fetch origin && git merge-base --is-ancestor origin/<branch> origin/main && echo landed`
Expected: `landed`. If not, open a landing PR (`base=main`, `head=<branch>`) immediately.
