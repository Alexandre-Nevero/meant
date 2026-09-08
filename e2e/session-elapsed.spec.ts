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
  await page.getByRole('button', { name: '25 min' }).click()
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
