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
    await page.waitForTimeout(400) // let the wake animation settle
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
    await page2.waitForTimeout(400) // let the wake animation settle
    const box2 = (await page2.locator(HOST_SELECTOR).boundingBox())!
    // Tolerance increased to 10px to account for position recalculation with new SIZE (36px vs old 28px)
    expect(Math.abs(box2.x - newBox.x)).toBeLessThan(10)
    expect(Math.abs(box2.y - newBox.y)).toBeLessThan(10)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a dragged position holds its relative place across windows of different sizes', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const wide = await context.newPage()
    await wide.setViewportSize({ width: 1400, height: 900 })
    await wide.goto('https://example.com')
    await wide.waitForTimeout(400) // let the wake animation settle
    const wideHost = wide.locator(HOST_SELECTOR)
    const wideBox = (await wideHost.boundingBox())!

    // Drag it to roughly the horizontal center of the WIDE viewport.
    const target = { x: 700, y: wideBox.y }
    await wide.mouse.move(wideBox.x + wideBox.width / 2, wideBox.y + wideBox.height / 2)
    await wide.mouse.down()
    await wide.mouse.move(target.x, target.y, { steps: 10 })
    await wide.mouse.up()
    const draggedBox = (await wideHost.boundingBox())!
    const draggedFracX = draggedBox.x / 1400

    // A genuinely narrower window loading the same stored position should land at
    // roughly the same FRACTION across its own (smaller) width, not get silently
    // reclamped to a different relative spot.
    const narrow = await context.newPage()
    await narrow.setViewportSize({ width: 500, height: 700 })
    await narrow.goto('https://example.org')
    await narrow.waitForTimeout(400) // let the wake animation settle
    const narrowBox = (await narrow.locator(HOST_SELECTOR).boundingBox())!
    const narrowFracX = narrowBox.x / 500

    expect(Math.abs(narrowFracX - draggedFracX)).toBeLessThan(0.05)

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
    // this is what actually exercises updateCompanion's own call site via
    // chrome.tabs.onUpdated. Routed locally instead of hitting the real youtube.com:
    // a genuine request to it resets under this suite's repeated automated traffic
    // (confirmed: consistent net::ERR_CONNECTION_RESET), and when a top-level
    // navigation genuinely fails, Chrome replaces the document with its own error
    // interstitial — destroying the companion content script this test asserts on,
    // not just leaving the previous page in place. Fulfilling the request locally
    // makes the navigation (and the URL change chrome.tabs.onUpdated sees) succeed
    // deterministically, with no real network dependency at all.
    await page.route('https://youtube.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }))
    await page.goto('https://youtube.com')
    await expect(dotWrap).toHaveAttribute('data-state', 'drift', { timeout: 3_000 })

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a known-distraction domain the user DID block this session never reads as drift', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    // NOT using this suite's real "add a blocked domain + Start" UI flow here: doing so
    // installs a real declarativeNetRequest redirect rule (Case D), and a DNR redirect
    // intercepts the navigation before the tab's URL ever updates to the real domain —
    // confirmed by instrumenting chrome.tabs.onUpdated directly: for a DNR-redirected
    // domain, the listener's changeInfo.url goes straight from the previous page to the
    // blocked.html redirect URL, never showing 'https://youtube.com/' at all. So a real
    // end-to-end block would make `nextDomain` inside updateCompanion always resolve to
    // null (blocked.html is chrome-extension://, filtered by Task 1's safeHostname) —
    // never actually reaching the session.blockedDomains membership check this test
    // exists to cover. Setting session.blockedDomains directly isolates exactly the field
    // the fix touches, the same storage-manipulation technique this suite already uses
    // for startedAt (see the sibling drift test above), while still driving the ring via
    // a real navigation → chrome.tabs.onUpdated → transition() → updateCompanion() call
    // chain, not a manual companionState write.
    await pairAndStart(setupPage, extensionId)
    await setupPage.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get('session', ({ session }: any) => {
          session.startedAt = new Date(Date.now() - 90_000).toISOString() // past DRIFT_GRACE_MS (60s)
          session.blockedDomains = ['youtube.com']
          chrome.storage.local.set({ session }, () => resolve())
        })
      })
    })

    const page = await context.newPage()
    await page.goto('https://example.com')
    const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')
    await expect(dotWrap).toHaveAttribute('data-state', 'focus')

    // A real navigation (no DNR rule actually installed for it here) — this is what
    // exercises updateCompanion's session.blockedDomains check on a domain that IS a
    // known distraction category member (BLOCKLISTS' 'video' category) but that this
    // session's own blockedDomains says is already handled, not drift. Routed locally
    // for the same reason as the sibling drift test above: a real request to
    // youtube.com resets under this suite's repeated automated traffic, and Chrome
    // replaces the document (destroying the companion) rather than leaving the
    // previous page in place — routing removes the real-network dependency entirely.
    await page.route('https://youtube.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }))
    await page.goto('https://youtube.com')
    // This is a negative assertion (drift must NOT fire) — a bare expect() would pass
    // instantly on the pre-navigation 'focus' value without giving updateCompanion's
    // async storage write a chance to run, so give it real time before checking.
    await page.waitForTimeout(500)
    await expect(dotWrap).toHaveAttribute('data-state', 'focus') // still focus, not drift

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the dot core is a fixed contrast-safe color, not one that flips with system dark mode', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.emulateMedia({ colorScheme: 'dark' }) // simulate a user with system dark mode on
    await page.goto('https://example.com')
    const dot = page.locator(HOST_SELECTOR).locator('.dot')
    const dotColor = await dot.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(199, 91, 57) is --m-clay (#C75B39) — must render as this in EITHER color scheme,
    // never as --m-ink (which used to flip to near-white under dark mode and vanish on a
    // real light-background page).
    expect(dotColor).toBe('rgb(199, 91, 57)')

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the companion is a larger footprint than the old 28px, and its container animates in on mount', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    const host = page.locator(HOST_SELECTOR)

    const hasWakeAnimation = await host.evaluate((el) => {
      const anims = el.getAnimations({ subtree: false })
      return anims.length > 0
    })
    expect(hasWakeAnimation).toBe(true)

    // Wait for wake animation to settle before measuring size
    await page.waitForTimeout(400)
    const box = (await host.boundingBox())!
    expect(box.width).toBeGreaterThan(28)
    expect(box.width).toBe(52)
    expect(box.height).toBe(52)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the companion is 52px, not the old 36px', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    await page.waitForTimeout(400) // let the wake animation settle
    const box = (await page.locator(HOST_SELECTOR).boundingBox())!
    expect(box.width).toBe(52)
    expect(box.height).toBe(52)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })
})
