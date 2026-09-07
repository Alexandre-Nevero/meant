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

  await page.waitForTimeout(500) // give a would-be chrome.tabs.create a moment to fire, if it were going to
  expect(context.pages().length).toBe(pageCountBefore) // no new tab opened

  await page.reload() // popup.html closes/reopens between real popup opens; this simulates that
  await expect(page.getByText('Did you?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Not yet' })).toBeVisible()

  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByText(/Good\. That's \d+ of \d+\./)).toBeVisible()
})
