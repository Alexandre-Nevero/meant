import { test, expect } from './fixtures'

async function pairAndOpenPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await page.reload()
}

// Case H — the auto-end-of-session path (sw.js's TICK alarm handler, lines ~280-284):
// a session with a `plannedMinutes` duration ends itself once elapsed, without the user
// clicking anything. Nothing in the suite exercised this before — every other test stops
// a session via the `{type: 'stop'}` message, which is a different code path (endReason
// 'stopped', not 'elapsed') from a real timeout.
test('a timed session ends itself once its planned duration elapses', async ({ context, extensionId, freshAccount }) => {
  // The default 30s config timeout is too tight for a poll that allows up to 70s for a
  // possible sub-minute alarm clamp — raise it for this test alone rather than globally.
  test.setTimeout(90_000)
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  await page.locator('input.m-field').first().fill('elapsed test')
  // 25 planned minutes via the merged picker: custom's work input defaults to 25.
  await page.getByRole('button', { name: 'custom', exact: true }).click()
  await page.getByRole('button', { name: 'no cycles', exact: true }).click()
  await page.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await page.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Push startedAt back past the 25-minute planned duration — same technique the
  // sentence-lock test uses to avoid a real wait, but here for the TICK handler's own
  // elapsed check (`Date.now() - startedAt >= plannedMinutes * 60_000`) rather than the
  // sentence-lock's grace window.
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('session', ({ session }: any) => {
        session.startedAt = new Date(Date.now() - 26 * 60_000).toISOString()
        chrome.storage.local.set({ session }, () => resolve())
      })
    })
  })

  // Re-arm the real TICK alarm to fire imminently instead of waiting up to 30s for its
  // natural period — chrome.alarms.create with the same name reschedules it. Chromium may
  // still clamp a sub-minute delay for an unpacked extension; the poll below is generous
  // enough to cover either behavior.
  const [sw] = context.serviceWorkers()
  await sw.evaluate(() => chrome.alarms.create('meant-tick', { delayInMinutes: 0.01 }))

  await expect
    .poll(async () => {
      const session = await page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session))))
      return session
    }, { timeout: 70_000, intervals: [2_000] })
    .toBeNull()

  // endSession('elapsed') no longer opens a tab (Task 4) — it just sets pendingReview and
  // removes the block rules it installed. /review/:id itself still resolves on its own.
  await expect
    .poll(async () => {
      const res = await page.request.get(`/review/${sessionId}`)
      return res.status()
    }, { timeout: 10_000, intervals: [1_000] })
    .toBe(200)

  const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
  expect(rules.length).toBe(0)
})

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
