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
/** The shape extension/lib/visit-label.js writes into session.labels (ADR-0058, ADR-0062). */
type VisitLabel = { domain: string; label: string; at: number }

test.describe('floating companion', () => {
  test('appears on arbitrary pages as long as extension is on, even with no session, and unmounts when disabled', async ({ context, extensionId, freshAccount }) => {
    // 1. Before any session starts, companion is present on arbitrary pages
    const pageBeforeSession = await context.newPage()
    await pageBeforeSession.goto('https://example.com')
    await expect(pageBeforeSession.locator(HOST_SELECTOR)).toBeVisible()
    await pageBeforeSession.close()

    // 2. While a session runs, companion remains present on external pages
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    for (const url of ['https://example.com', 'https://example.org', 'https://example.net']) {
      const page = await context.newPage()
      await page.goto(url)
      await expect(page.locator(HOST_SELECTOR)).toBeVisible()
      await page.close()
    }

    // 3. Floating companion never shows on the MEANT web app itself (no double companions)
    const dashboardPage = await context.newPage()
    await dashboardPage.goto('/dashboard')
    await expect(dashboardPage.locator(HOST_SELECTOR)).toHaveCount(0)
    await expect(dashboardPage.locator('.m-web-companion-actor')).toBeVisible()
    await dashboardPage.close()

    // 4. After session stops, companion remains present on external pages
    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    const afterStop = await context.newPage()
    await afterStop.goto('https://example.com')
    await expect(afterStop.locator(HOST_SELECTOR)).toBeVisible()

    // 5. Turning the companion off via companionEnabled: false (I9 seam) unmounts it
    const [sw] = context.serviceWorkers()
    await sw.evaluate(async () => {
      await chrome.storage.local.set({ companionEnabled: false })
    })
    await expect(afterStop.locator(HOST_SELECTOR)).toHaveCount(0)

    // 5. Turning companionEnabled back on restores it
    await sw.evaluate(async () => {
      await chrome.storage.local.set({ companionEnabled: true })
    })
    await expect(afterStop.locator(HOST_SELECTOR)).toBeVisible()
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
    // Tolerance adjusted to 15px to account for position recalculation with new SIZE (62px Codex Pet vs old 28px/36px)
    expect(Math.abs(box2.x - newBox.x)).toBeLessThan(15)
    expect(Math.abs(box2.y - newBox.y)).toBeLessThan(15)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('dragging the companion in one tab immediately syncs position to other open tabs', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const tab1 = await context.newPage()
    await tab1.goto('https://example.com')
    await tab1.waitForTimeout(400)

    const tab2 = await context.newPage()
    await tab2.goto('https://example.org')
    await tab2.waitForTimeout(400)

    const host1 = tab1.locator(HOST_SELECTOR)
    const box1 = (await host1.boundingBox())!
    const target = { x: box1.x - 180, y: box1.y - 120 }

    // Drag in tab 1
    await tab1.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2)
    await tab1.mouse.down()
    await tab1.mouse.move(target.x, target.y, { steps: 10 })
    await tab1.mouse.up()

    const draggedBox1 = (await host1.boundingBox())!

    // Tab 2 should immediately receive storage change and reposition
    const host2 = tab2.locator(HOST_SELECTOR)
    await expect.poll(async () => {
      const b = await host2.boundingBox()
      return b ? Math.abs(b.x - draggedBox1.x) : 999
    }, { timeout: 3_000 }).toBeLessThan(15)

    const box2 = (await host2.boundingBox())!
    expect(Math.abs(box2.y - draggedBox1.y)).toBeLessThan(15)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    await tab1.close()
    await tab2.close()
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

    // .dot-wrap, not .dot. The inner core carries `animation: breathe 1.6s infinite`, and
    // Playwright's actionability check waits for an element to stop moving — an infinite
    // animation never stabilises, so clicking .dot could only ever time out. .dot-wrap is
    // also the element that actually carries the pointer handlers (companion-overlay.js:298).
    // The receipt window is now ~180ms (#50) — short enough that expect()'s polling plus
    // round-trip latency can miss it outright. Watch for the attribute via MutationObserver,
    // installed before the click, instead of reading it after the fact and hoping to win
    // the race.
    await dotWrap.evaluate((el: any) => {
      ;(window as any).__sawReturning = false
      new MutationObserver(() => {
        if (el.dataset.returning === 'true') (window as any).__sawReturning = true
      }).observe(el, { attributes: true, attributeFilter: ['data-returning'] })
    })

    await dotWrap.click()

    // The receipt: ADR-0026's freed ring-collapse, reused. A receipt, not a celebration —
    // I2 forbids positive feedback, not telling the user their deliberate action registered.
    await expect.poll(() => page.evaluate(() => (window as any).__sawReturning), { timeout: 2_000 }).toBe(true)
    await expect(dotWrap).toHaveAttribute('data-returning', 'false', { timeout: 2_000 })

    const [sw] = context.serviceWorkers()
    const labels = await sw.evaluate(
      async (): Promise<VisitLabel[]> => {
        // chrome.storage.local.get is typed as { [key: string]: any } but the nested value
        // still widens to {}, so name the shape here rather than at each property access.
        const stored = (await chrome.storage.local.get('session')) as { session?: { labels?: VisitLabel[] } }
        return stored.session?.labels ?? []
      },
    )
    expect(labels).toHaveLength(1)
    expect(labels[0].label).toBe('distract')
    expect(labels[0].domain).toBe('example.com')

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
    await page.close()
  })

  test('dragging the companion does not file a label', async ({ context, extensionId, freshAccount }) => {
    // The companion is draggable, so without the 4px/500ms tap guard every reposition would also
    // report "this isn't the work".
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')
    await expect(dotWrap).toBeVisible()

    // boundingBox() returns null for an element that is not rendered; assert rather than
    // non-null-assert, so a missing companion fails with a useful message instead of a
    // TypeError about reading x of null.
    const box = await dotWrap.boundingBox()
    expect(box, 'the companion dot-wrap has no bounding box - it did not render').not.toBeNull()
    const { x, y, width, height } = box!
    await page.mouse.move(x + width / 2, y + height / 2)
    await page.mouse.down()
    await page.mouse.move(x - 120, y - 80, { steps: 10 })
    await page.mouse.up()

    const [sw] = context.serviceWorkers()
    const labels = await sw.evaluate(
      async (): Promise<VisitLabel[]> => {
        // chrome.storage.local.get is typed as { [key: string]: any } but the nested value
        // still widens to {}, so name the shape here rather than at each property access.
        const stored = (await chrome.storage.local.get('session')) as { session?: { labels?: VisitLabel[] } }
        return stored.session?.labels ?? []
      },
    )
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

  test('the companion accent ring is a fixed contrast-safe color, and the red dot is removed', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.emulateMedia({ colorScheme: 'dark' }) // simulate a user with system dark mode on
    await page.goto('https://example.com')
    const ring = page.locator(HOST_SELECTOR).locator('.ring')
    const ringColor = await ring.evaluate((el) => getComputedStyle(el).borderColor)
    // rgb(199, 91, 57) is --m-clay (#C75B39) — must render as this in EITHER color scheme,
    // never as --m-ink (which used to flip to near-white under dark mode and vanish on a
    // real light-background page).
    expect(ringColor).toBe('rgb(199, 91, 57)')

    // Red dot was removed so the character face is unobstructed
    const dot = page.locator(HOST_SELECTOR).locator('.dot')
    await expect(dot).toHaveCount(0)

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
    expect(box.width).toBe(62)
    expect(box.height).toBe(62)

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the companion is 62px, not the old 52px', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    await page.waitForTimeout(400) // let the wake animation settle
    const box = (await page.locator(HOST_SELECTOR).boundingBox())!
    expect(box.width).toBe(62)
    expect(box.height).toBe(62)

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

  test('hovering the companion without an active session shows Ready to focus', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('https://example.com')
    const host = page.locator(HOST_SELECTOR)
    await expect(host).toBeVisible()
    const pill = host.locator('[data-companion-hover-pill="true"]')
    await expect(pill).toHaveCSS('opacity', '0')

    const dotWrap = host.locator('.dot-wrap')
    await dotWrap.hover()
    await expect(pill).toHaveCSS('opacity', '1', { timeout: 1_000 })
    await expect(pill.locator('span')).toHaveText('Ready to focus')

    await page.mouse.move(0, 0)
    await expect(pill).toHaveCSS('opacity', '0', { timeout: 1_000 })
    await page.close()
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

  // #50. The drift rule is dead code (ADR-0057) and the receipt is mistimed (ADR-0058).
  test('carries no drift motion, and acknowledges a tap at feedback speed', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    await page.waitForTimeout(400) // let the wake animation settle

    const sheet = await page.locator(HOST_SELECTOR).evaluate(
      (host: any) => host.shadowRoot.querySelector('style').textContent,
    )
    expect(sheet).not.toContain('pulse-drift')
    expect(sheet).not.toContain('data-state="drift"')
    expect(sheet).toContain('animation: receipt var(--m-dur-receipt) var(--m-ease-receipt)')
    expect(sheet).toContain('--m-dur-receipt: 420ms')

    const host = page.locator(HOST_SELECTOR)
    // The receipt now clears after 420ms, which a round trip can outlive — so watch for the
    // attribute rather than reading it after the fact and hoping to win the race.
    await host.evaluate((h: any) => {
      const wrap = h.shadowRoot.querySelector('.dot-wrap')
      ;(window as any).__receipt = false
      new MutationObserver(() => {
        if (wrap.dataset.returning === 'true') (window as any).__receipt = true
      }).observe(wrap, { attributes: true, attributeFilter: ['data-returning'] })
    })

    const box = (await host.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => page.evaluate(() => (window as any).__receipt), { timeout: 2_000 }).toBe(true)
  })

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the tap still gets a receipt, without moving anything', async ({ context, extensionId, freshAccount }) => {
      const setupPage = await context.newPage()
      await freshAccount(setupPage)
      await pairAndStart(setupPage, extensionId)

      const page = await context.newPage()
      await page.goto('https://example.com')
      await page.waitForTimeout(400)

      const host = page.locator(HOST_SELECTOR)
      const box = (await host.boundingBox())!
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

      // No animation at all, but the ring changes discretely — otherwise the control is dead.
      // Polled, not read once: the static window is 600ms and a round trip can eat into it.
      await expect
        .poll(() =>
          host.evaluate((h: any) => {
            const cs = getComputedStyle(h.shadowRoot.querySelector('.ring'))
            return `${cs.animationName}|${cs.opacity}|${cs.borderTopWidth}`
          }),
        )
        .toBe('none|1|2px')
    })
  })
})
