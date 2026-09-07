import { test, expect } from './fixtures'

// Case J — Task 4: stopping (or an elapsed timeout on) a session no longer auto-opens a
// browser tab to /review/:id. The "Did you...?" outcome question and the per-site elapsed
// summary render inside the popup itself instead, the next time it's opened.
async function pairAndOpenPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
}

test('stopping a session shows the outcome question in the popup, opens no tab', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await page.locator('input.m-field').first().fill('outcome test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pageCountBefore = context.pages().length
  await page.getByRole('button', { name: 'Stop' }).click()

  // endSession awaits a real network PATCH before its finally clears the session — a
  // fixed wait here raced that under full-suite load (confirmed: ~1-in-5 flake). Poll
  // the real state instead, same pattern used everywhere else in this suite.
  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session)))))
    .toBeNull()
  expect(context.pages().length).toBe(pageCountBefore) // no new tab opened

  await page.reload() // popup.html closes/reopens between real popup opens; this simulates that
  await expect(page.getByText('Did you?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Not yet' })).toBeVisible()

  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByText(/Good\. That's \d+ of \d+\./)).toBeVisible()
})

// Fix round: a session started AND stopped while offline never reaches the server
// (POST /api/sessions is still queued), so its pendingReview marker's GET is genuinely
// unreachable, not a real 404/401. That must show as a dismissable transient failure,
// not silently revert to idle and lose the outcome question forever.
test('an offline-started-and-stopped session shows a transient failure, not a silent revert to idle', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  await context.setOffline(true)
  await page.locator('input.m-field').first().fill('offline outcome test')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText(/min elapsed/)).toBeVisible({ timeout: 3_000 })

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  // Still offline: reopening the popup must show the transient message, not idle.
  await page.reload()
  await expect(page.getByText("Can't reach it right now.")).toBeVisible()
  await expect(page.getByText('What do you mean to do?')).toHaveCount(0)
  const doneButton = page.getByRole('button', { name: 'Done' })
  await expect(doneButton).toBeVisible()

  await doneButton.click()
  await expect(page.getByText('What do you mean to do?')).toBeVisible()

  await context.setOffline(false)
})
