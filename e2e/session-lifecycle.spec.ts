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

    // installRules() is still in flight when Start's click handler resolves (it
    // resolves once the async message handler yields, not once installRules has
    // actually finished) — poll instead of reading the rules synchronously.
    const [sw] = context.serviceWorkers()
    await expect
      .poll(async () => (await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).length, { timeout: 10_000, intervals: [200] })
      .toBeGreaterThan(0)
    const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
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

  test('a blocked domain not in the old hardcoded list is still redirected to blocked.html', async ({ context, extensionId, freshAccount }) => {
    // Regression test for Task 1: declarativeNetRequest redirect requires host permission
    // for the target domain. github.com was not in the old manifest's hardcoded host_permissions,
    // so this test verifies the fix allows redirect to work for non-hardcoded domains.
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await addBlockedDomain(page, 'github.com') // not in old hardcoded host_permissions
    await page.locator('input.m-field').first().fill('blocking test')
    await page.getByRole('button', { name: 'Start' }).click()

    // installRules() is still in flight when Start's click handler resolves (same race
    // as the "Start installs a real declarativeNetRequest rule" test above) — navigating
    // before the rule actually exists loads the real github.com instead of getting
    // redirected, and DNR only intercepts NEW navigation attempts, so it never
    // re-navigates to blocked.html afterward. Poll for the rule first.
    const [sw] = context.serviceWorkers()
    await expect
      .poll(
        async () =>
          (await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).some((r: any) =>
            r.condition.requestDomains?.includes('github.com'),
          ),
        { timeout: 10_000, intervals: [200] },
      )
      .toBe(true)

    const blockedPage = await context.newPage()
    await blockedPage.bringToFront()
    await blockedPage.goto('https://github.com')

    // Verify the redirect rule executed and the page landed on blocked.html
    await expect(blockedPage).toHaveURL(/blocked\.html\?d=github\.com/)

    await page.bringToFront()
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a tab already open on a domain being blocked gets swept to blocked.html on Start', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)

    const alreadyOpen = await context.newPage()
    await alreadyOpen.goto('https://example.org') // open BEFORE Start, on the domain we're about to block

    await addBlockedDomain(page, 'example.org')
    await page.locator('input.m-field').first().fill('sweep test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect(alreadyOpen).toHaveURL(/blocked\.html/, { timeout: 3_000 })

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('visiting the extension\'s own pages during a session is never tracked as a domain', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await page.locator('input.m-field').first().fill('scheme filter test')
    await page.getByRole('button', { name: 'Start' }).click()

    const sessionId: string = await page.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )

    // Visit the popup's own chrome-extension:// URL as a real page. Must wait long
    // enough for advance() to emit an event (it floors milliseconds to seconds, so 500ms
    // would be 0s and never fire). 2000ms ensures we cross the 1-second floor.
    const extPage = await context.newPage()
    await extPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await extPage.waitForTimeout(2000)

    await page.bringToFront()
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

    await expect
      .poll(async () => {
        const res = await page.request.get(`/review/${sessionId}`)
        return res.ok() ? await res.text() : ''
      }, { timeout: 5_000 })
      .not.toMatch(new RegExp(extensionId))
  })

  // Case V — the block page names the blocked domain in its time-left line (Task 12).
  test('the block page names the blocked domain in its time-left line', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)
    await addBlockedDomain(page, 'example.net')
    await page.locator('input.m-field').first().fill('domain label test')
    await page.getByRole('button', { name: 'Start' }).click()

    // installRules() is still in flight when Start's click handler resolves (same race
    // as the "Start installs a real declarativeNetRequest rule" test above) — navigating
    // before the rule actually exists loads the real example.net instead of getting
    // redirected, and DNR only intercepts NEW navigation attempts, so it never
    // re-navigates to blocked.html afterward. Poll for the rule first.
    const [sw] = context.serviceWorkers()
    await expect
      .poll(
        async () =>
          (await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).some((r: any) =>
            r.condition.requestDomains?.includes('example.net'),
          ),
        { timeout: 10_000, intervals: [200] },
      )
      .toBe(true)

    const blockedPage = await context.newPage()
    await blockedPage.bringToFront()
    await blockedPage.goto('https://example.net')
    await expect(blockedPage).toHaveURL(/blocked\.html\?d=example\.net/)

    // The domain now appears folded into the existing muted time-left line, not a new element.
    await expect(blockedPage.locator('.m-row-figure')).toHaveText(/^example\.net — \d+ minutes left$/)

    await page.bringToFront()
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the already-focused tab starts accumulating attention time immediately on Start, with no tab switch needed', async ({ context, extensionId, freshAccount }) => {
    const workPage = await context.newPage()
    await workPage.goto('https://example.com')
    await workPage.bringToFront()

    const page = await context.newPage()
    await freshAccount(page)
    await pairAndOpenPopup(page, extensionId)

    // Bring workPage back to focus RIGHT BEFORE Start, so it's the active tab
    // at the moment startSession() runs. Then immediately check session.slice.domain
    // without any further tab switches — this isolates startSession's own seed from
    // the pre-existing onActivated listener (which would otherwise also seed the
    // domain and mask a missing fix).
    await workPage.bringToFront()
    await page.locator('input.m-field').first().fill('seed test')
    await page.getByRole('button', { name: 'Start' }).click()

    // Read internal state directly, immediately after Start returns — proves that
    // startSession's seed is working, independent of any subsequent tab-activation events.
    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.slice?.domain)))))
      .toBe('example.com')

    const sessionId: string = await page.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )

    // Stay on the already-focused tab long enough for time to accumulate — the 2 second
    // wait is needed to cross the 1-second floor that attribution.js uses for event emission.
    await workPage.waitForTimeout(2_000)

    await page.bringToFront()
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

    await expect
      .poll(async () => {
        const res = await page.request.get(`/review/${sessionId}`)
        return res.ok() ? await res.text() : ''
      }, { timeout: 5_000 })
      .toMatch(/example\.com/)
  })
})
