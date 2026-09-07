import { test, expect } from './fixtures'

// Case G — this session's two review-page fixes: www. stripped from tracked domains
// (matching the bareHostname helper), and the redundant "off by N min" line gone.
test('review page normalizes www. off tracked domains and has no redundant off-by line', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)

  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('review page test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Visit a www.-prefixed page while the session is running, active-tab attribution
  // (activeDomain()/bareHostname()) should record the bare form.
  const workPage = await context.newPage()
  await workPage.bringToFront()
  await workPage.goto('https://www.example.com')
  await workPage.waitForTimeout(1_500) // let the tabs.onActivated/onUpdated handler settle an attention slice

  await setupPage.bringToFront()
  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  await setupPage.waitForTimeout(500)

  const reviewPage = await context.newPage()
  await reviewPage.goto(`/review/${sessionId}`)
  const bodyText = await reviewPage.locator('body').innerText()

  expect(bodyText).not.toContain('www.example.com')
  expect(bodyText).toContain('example.com') // it did get tracked, just normalized
  expect(bodyText).not.toMatch(/off by \d+ min/)

  // Task 4 — the same data, extracted, now also served as JSON for the popup to consume.
  const apiRes = await reviewPage.request.get(`/api/sessions/${sessionId}/review`)
  expect(apiRes.status()).toBe(200)
  const apiData = await apiRes.json()
  expect(apiData.topAttention.some((r: any) => r.domain === 'example.com')).toBe(true)
})
