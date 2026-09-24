import { test, expect } from './fixtures'

// ADR-0084. One session, several tasks; blocking follows the active one.
async function pairPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
}
const storage = (page: import('@playwright/test').Page, key: string) =>
  page.evaluate((k) => new Promise<any>((r) => chrome.storage.local.get(k, (v: any) => r(v[k] ?? null))), key)
const send = (page: import('@playwright/test').Page, message: object) =>
  page.evaluate((m) => chrome.runtime.sendMessage(m), message) as Promise<any>
async function ruleDomains(context: import('@playwright/test').BrowserContext) {
  const [sw] = context.serviceWorkers()
  return sw.evaluate(async () =>
    (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => r.condition.requestDomains![0]).sort())
}
const START = { type: 'start', intention: 'write the letter', plannedMinutes: 60, blockedDomains: ['youtube.com'], blocklists: [], workSites: [], cycle: null }

test('adding a task parks the first and swaps the blocks; switching swaps them back; stop ends both', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  expect(start.ok).toBe(true)
  const first = start.sessionId
  expect(await ruleDomains(context)).toEqual(['youtube.com'])

  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: ['x.com'], workSites: [] })
  expect(added.ok).toBe(true)
  expect(await ruleDomains(context)).toEqual(['x.com'])
  const active = await storage(page, 'session')
  expect(active.sessionId).toBe(added.sessionId)
  expect(active.blockId).toBe(first)
  expect(active.startedAt).toBe((await storage(page, 'block')).tasks[0].startedAt) // one shared clock
  const block = await storage(page, 'block')
  expect(block.tasks.map((t: any) => t.sessionId)).toEqual([first])
  expect(typeof block.tasks[0].pausedAt).toBe('number')

  const back = await send(page, { type: 'switch-task', sessionId: first })
  expect(back.ok).toBe(true)
  expect(await ruleDomains(context)).toEqual(['youtube.com'])
  expect((await storage(page, 'session')).sessionId).toBe(first)
  expect((await storage(page, 'block')).tasks.map((t: any) => t.sessionId)).toEqual([added.sessionId])

  await send(page, { type: 'stop' })
  await expect.poll(async () => storage(page, 'session')).toBeNull()
  expect(await storage(page, 'block')).toBeNull()
  expect(await ruleDomains(context)).toEqual([])
  const pending = await storage(page, 'pendingReview')
  expect(pending.sessionId).toBe(first)
  expect([...pending.sessionIds].sort()).toEqual([first, added.sessionId].sort())

  for (const id of [first, added.sessionId]) {
    await expect
      .poll(async () => (await (await page.request.get(`/api/sessions/${id}/review`)).json()).endedAt ?? null, { timeout: 10_000 })
      .not.toBeNull()
  }
})

test('a session holds at most four tasks', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await send(page, START)
  for (const i of [2, 3, 4]) {
    expect((await send(page, { type: 'add-task', intention: `task ${i}`, blockedDomains: [], workSites: [] })).ok).toBe(true)
  }
  expect(await send(page, { type: 'add-task', intention: 'task 5', blockedDomains: [], workSites: [] })).toEqual({ ok: false, error: 'max-tasks' })
  await send(page, { type: 'stop' })
})

test('switching to a task that is not parked changes nothing', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  expect(await send(page, { type: 'switch-task', sessionId: '00000000-0000-4000-8000-000000000000' })).toEqual({ ok: false, error: 'no-task' })
  expect((await storage(page, 'session')).sessionId).toBe(start.sessionId)
  expect(await ruleDomains(context)).toEqual(['youtube.com'])
  await send(page, { type: 'stop' })
})

test('the running popup adds a task and switches back in one tap', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.route('**/api/presets/classify', (r) => r.fulfill({ json: { preset: null } }))

  await page.locator('input.m-field').first().fill('write the letter')
  await page.getByRole('button', { name: 'Start' }).click()

  await page.getByRole('button', { name: '+ task' }).click()
  await page.getByPlaceholder('What else do you mean to do?').fill('research sources')
  await page.getByPlaceholder('What else do you mean to do?').press('Enter')

  await expect(page.locator('[data-timer-pill="true"] input.m-field')).toHaveValue('research sources')
  await expect(page.getByText('other tasks', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to write the letter' }).click()
  await expect(page.locator('[data-timer-pill="true"] input.m-field')).toHaveValue('write the letter')
  await expect(page.getByRole('button', { name: 'Switch to research sources' })).toBeVisible()

  await send(page, { type: 'stop' })
})

test('the + task control disappears once the session holds four tasks', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await send(page, START)
  for (const i of [2, 3, 4]) await send(page, { type: 'add-task', intention: `task ${i}`, blockedDomains: [], workSites: [] })
  await page.reload()
  await expect(page.getByRole('button', { name: '+ task' })).toBeHidden()
  await send(page, { type: 'stop' })
})

test('ending a two-task session asks Did you? once per task, with identical answers', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: [], workSites: [] })
  await send(page, { type: 'stop' })
  for (const id of [start.sessionId, added.sessionId]) {
    await expect
      .poll(async () => (await (await page.request.get(`/api/sessions/${id}/review`)).json()).endedAt ?? null, { timeout: 10_000 })
      .not.toBeNull()
  }

  await page.reload()
  await expect(page.getByText('Did you?', { exact: true })).toHaveCount(2)
  await expect(page.getByText('write the letter', { exact: true })).toBeVisible()
  await expect(page.getByText('research sources', { exact: true })).toBeVisible()

  // Invariant 1, across tasks too: Yes and Not yet are identical in every property.
  const style = (name: string) => page.getByRole('button', { name, exact: true }).first().evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.color, s.backgroundColor, s.fontSize, s.fontWeight, s.width, s.height, s.transition].join('|')
  })
  expect(await style('Yes')).toBe(await style('Not yet'))

  await page.getByRole('button', { name: 'Yes', exact: true }).first().click()
  await expect(page.getByText('Did you?', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Done' })).toHaveCount(0) // one task still open
  await page.getByRole('button', { name: 'Not yet', exact: true }).first().click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('What do you mean to do?')).toBeVisible()
})

test('each task\'s review lists the other, and a late task\'s earlier time counts as paused, not unrecorded', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  // Ten minutes into the block, a second task starts. Its row shares the block's clock, so those
  // ten minutes belong to it as paused time.
  await page.evaluate(() => new Promise<void>((resolve) => {
    chrome.storage.local.get('session', ({ session }: any) => {
      session.startedAt = new Date(Date.now() - 10 * 60_000).toISOString()
      chrome.storage.local.set({ session }, () => resolve())
    })
  }))
  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: [], workSites: [] })
  await send(page, { type: 'stop' })

  await expect
    .poll(async () => (await (await page.request.get(`/api/sessions/${added.sessionId}/review`)).json()).pausedSeconds ?? 0, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(595)
  const late = await (await page.request.get(`/api/sessions/${added.sessionId}/review`)).json()
  expect(late.unrecordedSeconds).toBeLessThan(30)
  expect(late.siblings.map((s: any) => s.id)).toEqual([start.sessionId])

  await page.goto(`/review/${start.sessionId}`)
  await expect(page.getByText('Also in this session', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'research sources' })).toHaveAttribute('href', `/review/${added.sessionId}`)
})

// Fix wave (post-hoc review of ADR-0084): a storage race in extension/sw.js. switchToTask's
// rule swap (swapRules -> installRules -> sweepOpenTabs) redirects an already-open tab that
// sits on the domain the SWITCH TARGET blocks straight to blocked.html — and that redirect
// fires chrome.tabs.onUpdated, which calls transition(), which does its own unguarded read
// of `session` and write back. If that read lands before switchToTask's own read but its
// write lands AFTER switchToTask's `chrome.storage.local.set({ session, block })`, the active
// task silently reverts while `block` has already moved on: the new task is referenced by
// neither key. serialized() in sw.js queues every top-level listener entry point onto one
// promise chain so this interleaving can no longer happen.
//
// Honesty note (see fixwave report): the exact interleave isn't something a test can pin to
// the microtask — it depends on how fast chrome.tabs.update's own onUpdated event dispatches
// relative to switchToTask's remaining awaits, so a single switch call did not reliably hit
// it (confirmed: it passed clean 4/4 against the unfixed code). Looping ten back-and-forth
// switches does: run against the pre-mutex code, it reproduced the exact orphan described
// above (active session silently reverted to the old task, e.g. failing at iteration 5 with
// the active `session.sessionId` still equal to the OTHER task's id) inside a single run.
// Against the fixed code it has passed cleanly on every run tried (3/3, plus the single-pass
// version before the loop was added). That's evidence of the fix, not a proof the race can
// never resurface under different timing — it is not a deterministic repro.
test('a redirect fired mid-switch does not orphan the parked task (storage race)', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const a = await send(page, { ...START, intention: 'task A', blockedDomains: [] })
  expect(a.ok).toBe(true)
  const b = await send(page, { type: 'add-task', intention: 'task B', blockedDomains: ['example.com'], workSites: [] })
  expect(b.ok).toBe(true)
  // Active is now B (blocks example.com), parked is [A]. Switch back so A is active and B —
  // which blocks the domain we're about to open a real tab on — is the parked switch target.
  expect((await send(page, { type: 'switch-task', sessionId: a.sessionId })).ok).toBe(true)

  const tab = await context.newPage()
  await tab.goto('https://example.com') // A is active and does not block it; loads clean.
  await tab.bringToFront()

  // Switching to B installs its example.com rule, and swapRules's own sweepOpenTabs redirects
  // this already-open tab to blocked.html mid-switch — the exact re-entrant transition() call
  // this fix serializes against. Switching back to A does the same thing in reverse
  // (sweepBlockedTabsBack). Neither direction hits the exact interleave every single time in a
  // real browser (see the honesty note above this test), so this loops several back-and-forth
  // switches, checking consistency after every one, to raise the odds of catching it within one
  // run rather than asserting on a single roll.
  for (let i = 0; i < 10; i++) {
    const toB = await send(page, { type: 'switch-task', sessionId: b.sessionId })
    expect(toB.ok).toBe(true)
    await tab.waitForURL(/blocked\.html/, { timeout: 3_000 }).catch(() => {})
    let session = await storage(page, 'session')
    let block = await storage(page, 'block')
    expect(session.sessionId, `iteration ${i}, switched to B`).toBe(b.sessionId)
    let parkedIds = block.tasks.map((t: any) => t.sessionId)
    expect(parkedIds, `iteration ${i}, switched to B`).toEqual([a.sessionId])
    expect(new Set(parkedIds).size).toBe(parkedIds.length)

    const toA = await send(page, { type: 'switch-task', sessionId: a.sessionId })
    expect(toA.ok).toBe(true)
    await tab.waitForURL('https://example.com/', { timeout: 3_000 }).catch(() => {})
    session = await storage(page, 'session')
    block = await storage(page, 'block')
    expect(session.sessionId, `iteration ${i}, switched to A`).toBe(a.sessionId)
    parkedIds = block.tasks.map((t: any) => t.sessionId)
    expect(parkedIds, `iteration ${i}, switched to A`).toEqual([b.sessionId])
    expect(new Set(parkedIds).size).toBe(parkedIds.length)
  }

  await send(page, { type: 'stop' })
})

// Fix wave (post-hoc review of ADR-0084, task 6): computeDailyTimeline already drew one bar
// for a block and sessionCount already counted it once, but the ledger's "Today's Sessions"
// list and the dashboard's "Session Record" list both still mapped the raw per-task rows —
// a two-task session showed as two rows with two outcome dots, contradicting the "1 sessions
// logged" hero above it. This proves the row lists are deduped too, and that a real
// disagreement between the tasks' outcomes renders as joined text rather than being hidden.
test('a two-task session with different outcomes is one row in the ledger and dashboard record lists', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: [], workSites: [] })
  await send(page, { type: 'stop' })
  for (const id of [start.sessionId, added.sessionId]) {
    await expect
      .poll(async () => (await (await page.request.get(`/api/sessions/${id}/review`)).json()).endedAt ?? null, { timeout: 10_000 })
      .not.toBeNull()
  }

  await page.reload()
  await expect(page.getByText('Did you?', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Yes', exact: true }).first().click()
  await page.getByRole('button', { name: 'Not yet', exact: true }).first().click()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.goto('/ledger')
  const ledgerRows = page.locator('[data-surface="ledger"] .m-record-row')
  await expect(ledgerRows).toHaveCount(1)
  await expect(ledgerRows.locator('.m-row-outcome')).toContainText('1 Yes · 1 Not yet')

  await page.goto('/dashboard')
  const dashRows = page.locator('[data-surface="ledger"] .m-record-row')
  await expect(dashRows).toHaveCount(1)
  await expect(dashRows.locator('.m-row-outcome')).toContainText('1 Yes · 1 Not yet')
})
