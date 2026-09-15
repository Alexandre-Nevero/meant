import { test, expect } from './fixtures'

async function pairAndStart(page: import('@playwright/test').Page, extensionId: string, intention = 'companion test') {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await page.reload()
  await page.locator('input.m-field').first().fill(intention)
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

  // ADR-0057 removed the live drift signal. Three tests were deleted here on 2026-09-15:
  //   - 'state is told by ring presence/style, and a return gets one pulse'
  //   - 'drifting to a known-distraction domain ... actually flips the ring to drift'
  //   - 'a known-distraction domain the user DID block this session never reads as drift'
  // All three asserted a dashed ring and a drift->focus return pulse. Neither exists now:
  // the ring is solid for the whole session and I2 is absolute again, with no named
  // exception. The test below asserts the ABSENCE, which is what we now depend on.
  //
  // The 0.6s return-pulse machinery is still in companion-overlay.js, unreferenced by
  // state: ADR-0058 reuses that exact motion as the receipt for the one-tap label.

  test('tapping the companion records a per-visit label and plays one receipt', async ({ context, extensionId, freshAccount }) => {
    // ADR-0058. The companion stopped telling the user things and became how the user tells
    // it things. A self-report cannot be a false positive, which is the whole reason this
    // replaces the drift signal rather than repairing it.
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')
    await expect(dotWrap).toBeVisible()

    await page.locator(HOST_SELECTOR).locator('.dot').click()

    // The receipt: ADR-0026's freed ring-collapse, reused. A receipt, not a celebration —
    // I2 forbids positive feedback, not telling the user their deliberate action registered.
    await expect(dotWrap).toHaveAttribute('data-returning', 'true', { timeout: 2_000 })
    await expect(dotWrap).toHaveAttribute('data-returning', 'false', { timeout: 2_000 })

    const [sw] = context.serviceWorkers()
    const labels = await sw.evaluate(async () => (await chrome.storage.local.get('session')).session?.labels)
    expect(labels).toHaveLength(1)
    expect(labels[0].label).toBe('distract')
    expect(labels[0].domain).toBe('example.com')

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    await page.close()
  })

  test('dragging the companion does not file a label', async ({ context, extensionId, freshAccount }) => {
    // The dot is draggable, so without the 4px/500ms tap guard every reposition would also
    // report "this isn't the work".
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    const dot = page.locator(HOST_SELECTOR).locator('.dot')
    await expect(dot).toBeVisible()

    const box = await dot.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 120, box.y - 80, { steps: 10 })
    await page.mouse.up()

    const [sw] = context.serviceWorkers()
    const labels = await sw.evaluate(async () => (await chrome.storage.local.get('session')).session?.labels)
    expect(labels).toEqual([])

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    await page.close()
  })

  test('the companion never enters a drift state, even on a known-distraction domain', async ({ context, extensionId, freshAccount }) => {
    // youtube.com is in the built-in video list, so this is the exact case that used to
    // flip the ring to drift when it was not on this session's own blocklist.
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://www.youtube.com/')
    await page.waitForTimeout(600)

    const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')
    await expect(dotWrap).toHaveAttribute('data-state', 'focus')

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    await page.close()
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

  test('hovering the companion reveals a pill showing the intention, styled and positioned above the dot', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId, 'write the quarterly report')

    const page = await context.newPage()
    await page.goto('https://example.com')
    const host = page.locator(HOST_SELECTOR)
    const pill = host.locator('[data-companion-hover-pill="true"]')

    await expect(pill).toHaveCSS('opacity', '0')

    const dotWrap = host.locator('.dot-wrap')
    await dotWrap.hover()
    await expect(pill).toHaveCSS('opacity', '1', { timeout: 1_000 })
    await expect(pill.locator('span')).toHaveText('write the quarterly report')
    const dotStyle = await pill.evaluate((e) => getComputedStyle(e, '::before').backgroundColor)
    expect(dotStyle).not.toBe('none')
    expect(dotStyle).not.toBe('')

    const dotBox = (await host.boundingBox())!
    const pillBox = (await pill.boundingBox())!
    expect(pillBox.y + pillBox.height).toBeLessThan(dotBox.y) // pill sits above the dot

    await page.mouse.move(0, 0) // move away, outside the companion entirely
    await expect(pill).toHaveCSS('opacity', '0', { timeout: 1_000 })

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a second injection of companion-overlay.js into a tab that already has it mounted does not create a duplicate host', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    await expect(page.locator(HOST_SELECTOR)).toHaveCount(1)

    // A raw second injection (no clear-first step — that's reinjectCompanion()'s own
    // job, tested separately below) into a tab that's already mounted. Verified
    // empirically: executeScript does NOT get a fresh module scope here (Chrome reuses
    // the tab's existing isolated world since the frame never navigated), so only a
    // DOM-level guard (checked at the top of companion-overlay.js, before any module
    // state) can prevent a second host element from appearing. Resolve the real tab id
    // via the service worker's own chrome.tabs.query — a content script can't read its
    // own tabId directly.
    const [sw] = context.serviceWorkers()
    await sw.evaluate(async (urlPattern) => {
      const [tab] = await chrome.tabs.query({ url: urlPattern })
      await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['companion-overlay.js'] })
    }, 'https://example.com/*')

    await expect(page.locator(HOST_SELECTOR)).toHaveCount(1) // still exactly one, not two

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('reinjectCompanion mounts the companion into an already-open tab that never had it, simulating post-reload recovery', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.org')
    await expect(page.locator(HOST_SELECTOR)).toHaveCount(1) // mounted normally via content_scripts

    // Directly clear the host to simulate the "orphaned after extension reload" state —
    // the real regression this task fixes — then call the service worker's own
    // reinjectCompanion() the same way onInstalled/onStartup would, and confirm it
    // recovers the tab without the user refreshing anything.
    await page.evaluate(() => document.querySelector('[data-meant-companion]')?.remove())
    await expect(page.locator(HOST_SELECTOR)).toHaveCount(0)

    const [sw] = context.serviceWorkers()
    await sw.evaluate(() => (self as any).reinjectCompanion?.())
    await expect(page.locator(HOST_SELECTOR)).toHaveCount(1)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('reinjectCompanion replaces an already-mounted host with a genuinely fresh one, the realistic post-reload scenario', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.org')
    await expect(page.locator(HOST_SELECTOR)).toHaveCount(1) // mounted normally via content_scripts
    await page.waitForTimeout(500) // let the original mount's own wake-in animation fully finish

    // The realistic post-reload state, unlike the sibling test above: an extension
    // reload kills the OLD instance's chrome.* access but leaves the DOM element it
    // already built untouched — do NOT remove the host first. reinjectCompanion() must
    // still produce a working companion: clear the stale leftover itself, then mount a
    // genuinely new one. A brand-new host plays its own wake-in animation on attach (see
    // "...its container animates in on mount" above) — if reinjectCompanion() had only
    // hit the DOM guard and done nothing (the bug this test exists to catch), the
    // ORIGINAL host — whose wake animation finished 500ms ago — would still be sitting
    // there, inert, with no active animation.
    const [sw] = context.serviceWorkers()
    await sw.evaluate(() => (self as any).reinjectCompanion?.())

    await expect(page.locator(HOST_SELECTOR)).toHaveCount(1) // exactly one, never zero, never two
    const hasFreshWakeAnimation = await page.locator(HOST_SELECTOR).evaluate((el) => el.getAnimations({ subtree: false }).length > 0)
    expect(hasFreshWakeAnimation).toBe(true)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })
})
