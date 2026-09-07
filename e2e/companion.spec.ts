import { test, expect } from './fixtures'

async function pairAndStart(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await page.reload()
  await page.locator('input.m-field').first().fill('companion test')
  await page.getByRole('button', { name: 'Start' }).click()
}

const HOST_SELECTOR = '[data-meant-companion="true"]'

// Case F — the floating companion (this session's own feature): appears on any
// page while a session runs (confirms real <all_urls> injection, not just the one
// page it happened to load into), persists its dragged position, and reflects state
// via ring presence/style, never color.
test.describe('floating companion', () => {
  test('appears on arbitrary pages while a session runs, gone when it ends', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    for (const url of ['https://example.com', 'https://example.org', '/dashboard']) {
      const page = await context.newPage()
      await page.goto(url)
      await expect(page.locator(HOST_SELECTOR)).toBeVisible()
      await page.close()
    }

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    const afterStop = await context.newPage()
    await afterStop.goto('https://example.com')
    await expect(afterStop.locator(HOST_SELECTOR)).toHaveCount(0)
  })

  test('drag position persists across a fresh page load', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    const host = page.locator(HOST_SELECTOR)
    const box = (await host.boundingBox())!
    const target = { x: box.x + 200, y: box.y - 150 }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, { steps: 10 })
    await page.mouse.up()

    const newBox = (await host.boundingBox())!
    // Not asserting newBox against `target` directly: the mouse grabbed the dot from its
    // center, so the element's top-left lands offset from the cursor by half its own
    // size — that's a fact about where the pointer grabbed it, not the feature under
    // test. What actually matters is persistence, checked below: did it move at all,
    // and does a fresh page load land in that same place.
    expect(newBox.x).not.toBeCloseTo(box.x, 0)

    const page2 = await context.newPage()
    await page2.goto('https://example.org')
    const box2 = (await page2.locator(HOST_SELECTOR).boundingBox())!
    expect(Math.abs(box2.x - newBox.x)).toBeLessThan(5)
    expect(Math.abs(box2.y - newBox.y)).toBeLessThan(5)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('state is told by ring presence/style, and a return gets one pulse', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    // Playwright pierces open shadow roots transparently — no special syntax needed.
    const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')

    await expect(dotWrap).toHaveAttribute('data-state', 'focus')

    await setupPage.evaluate(() => chrome.storage.local.set({ companionState: 'drifting' }))
    await expect(dotWrap).toHaveAttribute('data-state', 'drift', { timeout: 2_000 })

    await setupPage.evaluate(() => chrome.storage.local.set({ companionState: 'settled' }))
    await expect(dotWrap).toHaveAttribute('data-returning', 'true', { timeout: 2_000 })
    await expect(dotWrap).toHaveAttribute('data-state', 'focus')
    await expect(dotWrap).toHaveAttribute('data-returning', 'false', { timeout: 2_000 })

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('drifting to a known-distraction domain not on this session\'s own blocklist actually flips the ring to drift', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    // Deliberately don't block youtube.com this session — isKnownDistraction() should still
    // flag it (it's in BLOCKLISTS' 'video' category), and it's not in this session's own
    // blockedDomains, so it should read as drift.
    await pairAndStart(setupPage, extensionId)

    // Push startedAt back past DRIFT_GRACE_MS (60s) without a real wait.
    await setupPage.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get('session', ({ session }: any) => {
          session.startedAt = new Date(Date.now() - 90_000).toISOString()
          chrome.storage.local.set({ session }, () => resolve())
        })
      })
    })

    const page = await context.newPage()
    await page.goto('https://example.com')
    const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')
    await expect(dotWrap).toHaveAttribute('data-state', 'focus')

    // A real navigation to a known-distraction domain, not a manual companionState write —
    // this is what actually exercises updateCompanion's own call site. `waitUntil: 'commit'`
    // (not the default 'load') since only the URL-change event matters here — waiting for
    // youtube.com's own full page load would make this test slow and network-flaky for no
    // reason.
    await page.goto('https://youtube.com', { waitUntil: 'commit' })
    await expect(dotWrap).toHaveAttribute('data-state', 'drift', { timeout: 3_000 })

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })
})
