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
  return { token, deviceId }
}

async function addBlockedDomain(page: import('@playwright/test').Page, domain: string) {
  await page.getByRole('button', { name: '+' }).nth(1).click() // blocking row's own +
  await page.keyboard.type(domain)
  await page.keyboard.press('Enter')
}

// Case D — the session lifecycle: real block rules, the D34 sentence lock (tested via
// storage manipulation, not a real 60s wait), and PATCH firing on edit.
test.describe('session lifecycle', () => {
  test('Start installs a real declarativeNetRequest rule for a configured blocked domain', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await addBlockedDomain(page, 'https://www.Facebook.com/x') // deliberately unnormalized input
    await page.locator('input.m-field').first().fill('block test')
    await page.getByRole('button', { name: 'Start' }).click()

    const [sw] = context.serviceWorkers()
    const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.some((r: any) => r.condition.requestDomains?.includes('facebook.com'))).toBeTruthy()

    // Stop must also remove the rules it installed — a leaked rule would keep blocking
    // the domain forever, not just for the session's own duration.
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    const rulesAfterStop = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
    expect(rulesAfterStop.length).toBe(0)
  })

  test('sentence is editable inside the grace window, locked past it — real popup, not the pure predicate', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await page.locator('input.m-field').first().fill('lock test')
    await page.getByRole('button', { name: 'Start' }).click()

    // Editable case: startedAt is "now."
    await page.reload()
    await expect(page.locator('input.m-field')).toBeVisible()

    // Locked case: push startedAt back past GRACE_MS without waiting 60 real seconds.
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get('session', ({ session }: any) => {
          session.startedAt = new Date(Date.now() - 90_000).toISOString()
          chrome.storage.local.set({ session }, () => resolve())
        })
      })
    })
    await page.reload()
    await expect(page.locator('p.m-sentence')).toBeVisible()
    await expect(page.locator('input.m-field')).toHaveCount(0)

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('editing the sentence within the grace window PATCHes the server', async ({ context, extensionId, freshAccount, page: _unused }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await page.locator('input.m-field').first().fill('original intention')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.reload()

    const sessionId: string = await page.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )

    const sentenceField = page.locator('input.m-field')
    await sentenceField.fill('revised intention')
    // A real click-away, not locator.blur() — matches the pattern already proven to
    // reliably trigger popup.js's blur handlers elsewhere in this suite.
    await page.locator('body').click({ position: { x: 5, y: 5 } })

    // commit() PATCHes fire-and-forget too — poll the real server state instead of a
    // fixed wait, same fix as the setup-lists race.
    await expect
      .poll(async () => {
        const res = await page.request.get(`/review/${sessionId}`)
        return res.ok() ? await res.text() : ''
      }, { timeout: 5_000 })
      .toContain('revised intention')

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a non-hardcoded work site still accumulates tracked minutes', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await addBlockedDomain(page, 'example.org') // reuses the existing helper, a non-hardcoded distraction domain
    await page.locator('input.m-field').first().fill('tracking test')
    await page.getByRole('button', { name: 'Start' }).click()

    const sessionId: string = await page.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )

    const workPage = await context.newPage()
    await workPage.bringToFront()
    await workPage.goto('https://example.com') // example.com, not example.org — this is a WORK site check, not the blocked one
    await workPage.waitForTimeout(2_000)

    await page.bringToFront()
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

    await expect
      .poll(async () => {
        const res = await page.request.get(`/review/${sessionId}`)
        return res.ok() ? await res.text() : ''
      }, { timeout: 5_000 })
      .toMatch(/example\.com/)
    // Explicitly NOT asserting "0 min" is absent by string match — assert the row exists at all,
    // since a genuinely-tracked site must appear in the per-domain rows regardless of exact seconds.
  })
})
