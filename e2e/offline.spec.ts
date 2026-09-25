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

// Case E — the local-first guarantee (Task 3): starting a session must never wait on
// the network, and a start attempted offline must still queue and sync later.
test('starting a session offline does not hang, and syncs once back online', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  await context.setOffline(true)
  await page.locator('input.m-field').first().fill('offline start test')
  const startedAt = Date.now()
  await page.getByRole('button', { name: 'Start' }).click()
  // Local-first: Start must succeed instantly, offline — the running view (consolidated
  // elapsed+phase line) should appear right away, not hang waiting on a network round-trip.
  // The default cycle (25/5) shows the consolidated format: "X min · Y min left"
  await expect(page.getByText(/^\d+ min · \d+ min left$/)).toBeVisible({ timeout: 3_000 })
  const elapsedMs = Date.now() - startedAt
  expect(elapsedMs).toBeLessThan(3_000)

  const sessionId = await page.evaluate(
    () => new Promise<string | undefined>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session?.sessionId))),
  )
  expect(sessionId).toBeTruthy()

  // Reconnect BEFORE stopping: endSession (sw.js:97) clears the TICK alarm in its
  // `finally` (sw.js:109) — the alarm that would otherwise drain the queue every 30s —
  // and makes exactly one flush() attempt of its own right there (sw.js:112) so a
  // queued end-of-session PATCH doesn't have to wait for the next session. That
  // attempt only succeeds if connectivity is already back by the time endSession
  // runs; stop while still offline and nothing is left to trigger a later sync until
  // the next session starts or the browser restarts (documented, not a bug — a
  // scenario this test isn't exercising).
  await context.setOffline(false)
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  await expect
    .poll(async () => {
      const res = await page.request.get(`/review/${sessionId}`)
      return res.status()
    }, { timeout: 10_000, intervals: [1_000] })
    .toBe(200)
})

// #21. post() (extension/api.js:33) queues a failed write into chrome.storage.local's
// `queue` and returns as if nothing happened — the popup said nothing about it, so an
// offline user had no way to tell whether their work was being recorded. Seeding `queue`
// directly (rather than actually going offline) isolates this from flush()'s own timing —
// it drains the moment a request succeeds, including ones this test's own setup makes.
test('the idle popup states plainly how many writes are waiting to sync', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  await page.evaluate(
    () => new Promise<void>((resolve) => {
      chrome.storage.local.set({
        queue: [
          { method: 'POST', path: '/api/events', body: {}, at: new Date().toISOString() },
          { method: 'PATCH', path: '/api/sessions/x', body: {}, at: new Date().toISOString() },
        ],
      }, () => resolve())
    }),
  )
  await page.reload()

  await expect(page.getByText('2 updates are waiting. They will send next time MEANT reaches the app.')).toBeVisible()
})
