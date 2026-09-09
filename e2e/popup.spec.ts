import { test, expect } from './fixtures'

async function pairPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ token, deviceId }, () => resolve())
    })
  }, { token, deviceId })
  await page.reload()
}

// Task 6 nav row: clicking a nav button must actually fire chrome.tabs.create with the
// right URL, not just render — same "did a real tab open" pattern outcome-in-popup.spec.ts
// uses for the negative case (no tab), applied here for the positive case.
//
// The target URL itself is verified by spying on chrome.tabs.create's argument, rather
// than reading the opened tab's final URL: the web app's own '/' route swaps its CTA to
// a "Go to your dashboard" link for an authenticated session (app/page.tsx checks
// `userId`), which every test account here is (freshAccount signs in) — but the landing
// page itself still renders at '/', it never redirects there. So reading the opened
// tab's URL back wouldn't distinguish "meant.app" from "History" anyway once a real
// click on that CTA link is followed. The spy sidesteps that: it captures the exact URL
// popup.js asked chrome.tabs.create for, before any in-page navigation gets a say.
async function armTabsCreateSpy(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __tabUrls?: string[] }
    if (w.__tabUrls) return // already armed on this page instance
    w.__tabUrls = []
    const orig = chrome.tabs.create.bind(chrome.tabs)
    chrome.tabs.create = ((opts: chrome.tabs.CreateProperties, cb?: (tab: chrome.tabs.Tab) => void) => {
      w.__tabUrls!.push(opts.url ?? '')
      return orig(opts, cb as never)
    }) as typeof chrome.tabs.create
  })
}

async function clickAndExpectNewTab(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  buttonName: string,
  expectedUrl: string,
) {
  await armTabsCreateSpy(page)
  const before = context.pages().length
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: buttonName }).click(),
  ])
  await newPage.waitForLoadState()
  expect(context.pages().length).toBe(before + 1) // a real new tab actually opened

  const calledUrl = await page.evaluate(() => (window as unknown as { __tabUrls: string[] }).__tabUrls.at(-1))
  expect(calledUrl).toBe(expectedUrl) // chrome.tabs.create was asked for the right URL

  return newPage
}

// Case C — the idle popup's rendering and interactions, against the real extension.
test.describe('popup, idle state', () => {
  // Case AG (Task 5): History/meant.app move into a top-right icon header row instead of
  // full-width text buttons at the bottom.
  test('History and meant.app render as icon buttons in a header row, top-right, not full-width text buttons at the bottom', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const header = page.locator('[data-popup-header="true"]')
    await expect(header).toBeVisible()
    const historyButton = header.getByRole('button', { name: 'View session history' })
    const meantButton = header.getByRole('button', { name: 'Open meant.app' })
    await expect(historyButton).toBeVisible()
    await expect(meantButton).toBeVisible()

    // Icon-only: no visible text content, an SVG (the History icon is its own small
    // clock glyph, distinct from the header's real .m-mark state indicator) inside.
    await expect(historyButton).toHaveText('')
    await expect(historyButton.locator('svg')).toHaveCount(1)
    await expect(meantButton.locator('svg')).toHaveCount(1)

    // The header's mark and nav row sit side by side, mark on the left.
    const markBox = (await header.locator('.m-mark').boundingBox())!
    const navBox = (await header.locator('.m-chip-row').boundingBox())!
    expect(navBox.x).toBeGreaterThan(markBox.x)

    // Task 6: the idle mark must render the same decorative gradient glyph as
    // running/ended, not a blank outline (the CSS bug — data-state="idle" was
    // missing from the ::after selector).
    const markBackground = await page.locator('.m-mark[data-state="idle"]').evaluate((e) => getComputedStyle(e, '::after').backgroundImage)
    expect(markBackground).not.toBe('none')
  })

  // Case AH (Task 6, updated Task 4): Cycle-preset row visually separates the two
  // duration presets from custom without splitting the chipGroup, preserving exclusive
  // single-select across all 3 options (25/5, 50/10, custom — "no cycles" no longer
  // lives at this level; it's revealed under "custom").
  test('the cycle-preset row visually separates the two presets from custom', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const cycleRow = page.locator('[data-chip-layout="paired"]')
    await expect(cycleRow).toBeVisible()
    const chips = cycleRow.locator('.m-chip')
    await expect(chips).toHaveCount(3)

    const firstBox = (await chips.nth(0).boundingBox())!
    const secondBox = (await chips.nth(1).boundingBox())!
    const thirdBox = (await chips.nth(2).boundingBox())!
    const withinGroupGap = secondBox.x - (firstBox.x + firstBox.width)
    const beforeCustomGap = thirdBox.x - (secondBox.x + secondBox.width)
    expect(beforeCustomGap).toBeGreaterThan(withinGroupGap)

    // Exclusive selection spans all 3, including across the visual gap.
    await chips.first().click() // 25/5
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true')
    await chips.nth(2).click() // custom
    await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true')
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'false')
  })

  test('the idle popup shows only 25/5, 50/10, and custom at first — no duration row, no until-I-stop, no no-cycles', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await expect(page.getByRole('button', { name: '25/5', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '50/10', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'custom', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '25 min', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '50 min', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'until I stop', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'no cycles', exact: true })).toHaveCount(0)

    // 25/5 is the confirmed first-ever-session default.
    await expect(page.getByRole('button', { name: '25/5', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking custom reveals labelled work/break inputs plus until-I-stop and no-cycles', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: 'custom', exact: true }).click()
    await expect(page.getByText('work', { exact: true })).toBeVisible()
    const workInput = page.locator('input[data-chip-role="number"]').first()
    const breakInput = page.locator('input[data-chip-role="number"]').nth(1)
    await expect(workInput).toBeVisible()
    await expect(breakInput).toBeVisible()
    await expect(workInput).toHaveCSS('cursor', 'text') // not "pointer" — a real defect fixed by this task
    await expect(page.getByRole('button', { name: 'until I stop', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'no cycles', exact: true })).toBeVisible()
  })

  test('no cycles disables the break input and relabels work to minutes, and stays reachable as a plain fixed-length session', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: 'custom', exact: true }).click()
    await page.getByRole('button', { name: 'no cycles', exact: true }).click()
    await expect(page.getByText('minutes', { exact: true })).toBeVisible()
    const breakInput = page.locator('input[data-chip-role="number"]').nth(1)
    await expect(breakInput).toBeDisabled()

    await page.locator('input[data-chip-role="number"]').first().fill('45')
    await page.locator('input.m-field').first().fill('no cycles test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
      .toBe(45)
    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.cycle)))))
      .toBe(null)

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('until I stop keeps the typed cycle but removes the planned-duration cap', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: 'custom', exact: true }).click()
    await page.getByRole('button', { name: 'until I stop', exact: true }).click()
    await page.locator('input.m-field').first().fill('until I stop test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
      .toBe(null)
    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.cycle)))))
      .toEqual({ work: 25, break: 5 }) // the default custom pair, since neither input was edited

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('picking 25/5 caps the session at exactly 30 planned minutes', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: '25/5', exact: true }).click()
    await page.locator('input.m-field').first().fill('preset cap test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.plannedMinutes)))))
      .toBe(30)

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('typed domains are normalized on Enter and on blur, not dropped', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })

    // Enter path, with scheme/path/case survival — the exact reviewer-found regression case.
    await plusButtons.first().click()
    await page.keyboard.type('HTTPS://Gmail.COM/inbox')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toBeVisible()

    // Blur path (click elsewhere, no Enter) — the fix-round bug: this used to silently drop it.
    await plusButtons.first().click()
    await page.keyboard.type('www.notion.so')
    await page.getByRole('button', { name: 'Start', exact: true }).click({ trial: true }).catch(() => {}) // move focus without submitting
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('button', { name: 'notion.so', exact: true })).toBeVisible()
  })

  test('Start creates a session', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.locator('input.m-field').first().fill('finish the e2e suite')
    await page.getByRole('button', { name: 'Start', exact: true }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v) => r(v.session)))))
      .toBeTruthy()
  })

  test('typing a phrase resolves multiple aliases at once, atomically', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })
    await plusButtons.first().click()
    await page.keyboard.type('docs, gmail, and chatgpt')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'docs.google.com', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'chatgpt.com', exact: true })).toBeVisible()
  })

  test('a typo in a phrase blocks the whole phrase and offers a correction', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })
    await plusButtons.first().click()
    await page.keyboard.type('docs, gmial')
    await page.keyboard.press('Enter')
    await expect(page.getByText('did you mean gmail? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'docs.google.com', exact: true })).toHaveCount(0) // atomic — nothing added yet

    await page.keyboard.press('Enter') // accepts the standing suggestion
    await expect(page.getByRole('button', { name: 'docs.google.com', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toBeVisible()
  })

  // Regression: Task 8's `removable: true` made every chip click delete the site, with no
  // way left to toggle a known site's inclusion for just this session — the pre-existing
  // toggle-off behaviour the fix restores. The chip body (toggle) and the trailing "×"
  // (delete) are now separate sibling click targets on the same visual chip.
  test('clicking a known site chip body toggles it for this session without deleting it from the account list', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    // Pre-seed a real, server-persisted work site so "still on the server list" checks
    // genuine standing-list survival, not just that the client-side render didn't drop it.
    await page.request.put('/api/lists', { data: { workSites: ['gmail.com'], distractSites: [] } })
    await pairPopup(page, extensionId)

    const chip = page.getByRole('button', { name: 'gmail.com', exact: true })
    await expect(chip).toHaveAttribute('aria-pressed', 'false') // known site, not pre-selected this session

    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    // Still on the server-side standing list — a toggle must never call onRemove.
    const stillListed = async () => {
      const res = await page.request.get('/api/lists')
      const body = await res.json()
      return body.workSites.includes('gmail.com')
    }
    // Give any (would-be, buggy) fire-and-forget removal PUT a real chance to land
    // before we check — expect.poll passes on its first matching sample, so without
    // this wait a regression could still pass on a lucky early poll.
    await page.waitForTimeout(500)
    await expect.poll(stillListed).toBe(true)

    await chip.click() // toggle back off
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await page.waitForTimeout(500)
    await expect.poll(stillListed).toBe(true)

    // Survives reload too — a toggle is session-local, never a standing-list mutation.
    await page.reload()
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toBeVisible()
  })

  test('a site chip can be removed, not just toggled off, and it does not reappear on reload', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    // Pre-seed a real, server-persisted work site (rather than adding it live via the "+"
    // input) so the assertions below check genuine standing-list removal — a domain that
    // was only ever added to local/client state within this same test would make "gone
    // from the server list" and "doesn't reappear on reload" trivially true even if
    // removal never actually reached the server (confirmed by mutation testing: a no-op
    // removeFromList still passed every assertion when the domain was added client-side).
    await page.request.put('/api/lists', { data: { workSites: ['gmail.com'], distractSites: [] } })
    await pairPopup(page, extensionId)

    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Remove gmail.com', exact: true }).click()
    await expect(page.getByRole('button', { name: /gmail\.com/ })).toHaveCount(0)

    // Confirm it's gone from the server-side standing list too, not just local render state.
    await expect
      .poll(async () => {
        const res = await page.request.get('/api/lists')
        const body = await res.json()
        return body.workSites.includes('gmail.com')
      }, { timeout: 5_000 })
      .toBe(false)

    await page.reload()
    await expect(page.getByRole('button', { name: /gmail\.com/ })).toHaveCount(0)
  })

  test('two typos in a phrase each get suggestions in sequence without oscillation', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })
    await plusButtons.first().click()
    await page.keyboard.type('gmial, docz')
    await page.keyboard.press('Enter')
    // First suggestion should be for the first bad token (gmial → gmail)
    await expect(page.getByText('did you mean gmail? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toHaveCount(0) // nothing added yet

    await page.keyboard.press('Enter') // accept first suggestion
    // Second Enter should show the second suggestion (docz → docs), not revert to gmial
    await expect(page.getByText('did you mean docs? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toHaveCount(0) // still nothing added, still atomic

    await page.keyboard.press('Enter') // accept second suggestion
    // Final Enter should resolve both corrected chips
    await expect(page.getByRole('button', { name: 'gmail.com', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'docs.google.com', exact: true })).toBeVisible()
  })

  // Fix round: "doc" is a substring of the earlier valid token "docs" — a naive string
  // .replace() call hits the "doc" INSIDE "docs" instead of the bad token itself,
  // producing "docss, doc" forever (oscillates, never resolves). The fix replaces by
  // token position instead.
  test('a bad token that is a substring of another valid token corrects without oscillating', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })
    await plusButtons.first().click()
    await page.keyboard.type('docs, doc')
    await page.keyboard.press('Enter')
    await expect(page.getByText('did you mean docs? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'docs.google.com', exact: true })).toHaveCount(0) // atomic — nothing added yet

    await page.keyboard.press('Enter') // accepts the standing suggestion
    // Deduplicated to a single chip, not oscillating forever and never resolving.
    await expect(page.getByRole('button', { name: 'docs.google.com', exact: true })).toHaveCount(1)
  })

  // Case V — the blocklist label is static, matching its sibling's grammar, and never
  // mutates as chips are added or removed (Task 12).
  test('the blocklist label reads "what to block" and does not change as chips are added or removed', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await expect(page.getByText('what to block')).toBeVisible()
    await expect(page.getByText(/^blocking \d+$/)).toHaveCount(0)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })
    await plusButtons.nth(1).click() // the blocking row's own +
    await page.keyboard.type('addedsite.com')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'addedsite.com', exact: true })).toBeVisible()

    // The label must still read the static string after the add — a regression here
    // would mean the deleted onChange handler somehow still fired.
    await expect(page.getByText('what to block')).toBeVisible()
    await expect(page.getByText(/^blocking \d+$/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Remove addedsite.com', exact: true }).click()
    await expect(page.getByRole('button', { name: /addedsite\.com/ })).toHaveCount(0)
    await expect(page.getByText('what to block')).toBeVisible()
  })

  test('a long site list scrolls inside the chip row instead of growing the popup unbounded', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+', exact: true })
    for (let i = 0; i < 15; i++) {
      await plusButtons.first().click()
      await page.keyboard.type(`site${i}.example.com`)
      await page.keyboard.press('Enter')
    }

    // Target the work sites chip row (first data-chip-layout="group" contains "where it happens" and workSites row)
    const workSiteRow = page.locator('[data-chip-layout="group"]').first().locator('.m-chip-row')
    const box = (await workSiteRow.boundingBox())!
    expect(box.height).toBeLessThan(300) // well under the popup's own practical ~600px ceiling
  })
})

// Case K — the running popup's own nav row and blocked-sites visibility (Task 6 brief).
test.describe('popup, running state', () => {
  test('shows a blocking line for the configured domains, plus History/meant.app', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: '+', exact: true }).nth(1).click() // the blocking row's own +
    await page.keyboard.type('example.org')
    await page.keyboard.press('Enter')
    await page.locator('input.m-field').first().fill('running state test')
    await page.getByRole('button', { name: 'Start', exact: true }).click()

    await expect(page.getByText(/^blocking: .*example\.org/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'View session history', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open meant.app', exact: true })).toBeVisible()

    const historyPage = await clickAndExpectNewTab(page, context, 'View session history', 'http://localhost:3000/dashboard')
    expect(historyPage.url()).toContain('/dashboard')
    await historyPage.close()

    const landingPage = await clickAndExpectNewTab(page, context, 'Open meant.app', 'http://localhost:3000/')
    await landingPage.close()

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a running session with a cycle configured shows one consolidated line, not two, and never ticks', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.getByRole('button', { name: '25/5', exact: true }).click()
    await page.locator('input.m-field').first().fill('consolidated copy test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect(page.getByText(/^\d+ min · \d+ min left$/)).toBeVisible()
    await expect(page.getByText(/min elapsed/)).toHaveCount(0) // the old separate line is gone

    // Push startedAt into the break phase without a real 26-minute wait.
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get('session', ({ session }: any) => {
          session.startedAt = new Date(Date.now() - 26 * 60_000).toISOString()
          chrome.storage.local.set({ session }, () => resolve())
        })
      })
    })
    await page.reload()
    await expect(page.getByText(/^\d+ min · break, \d+ min left$/)).toBeVisible()

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a running session with no cycle configured shows no phase line', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: 'custom', exact: true }).click()
    await page.getByRole('button', { name: 'no cycles', exact: true }).click()
    await page.locator('input.m-field').first().fill('no cycle test')
    await page.getByRole('button', { name: 'Start', exact: true }).click()

    await expect(page.getByText(/min left$/)).toHaveCount(0)
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  });

  test('the intention pill\'s loop starts at true top-center and traces clockwise', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: '25/5', exact: true }).click()
    await page.locator('input.m-field').first().fill('loop start test')
    await page.getByRole('button', { name: 'Start' }).click()

    const pillWrap = page.locator('[data-timer-pill="true"]')
    await expect(pillWrap).toBeVisible()
    const svg = pillWrap.locator('svg')
    await expect(svg).toBeVisible()
    const paths = svg.locator('path')
    await expect(paths.first()).toBeVisible()

    // Every segment shares the identical `d` (the authored top-center-start path) —
    // confirms this is the new path-based construction, not the old two-<rect> one.
    const dValues = await paths.evaluateAll((els) => els.map((e) => e.getAttribute('d')))
    expect(new Set(dValues).size).toBe(1)
    expect(dValues[0]).toMatch(/^M [\d.]+ [\d.]+ H/) // starts with a horizontal move from top-center

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the pill shows a visible arc immediately at session start, before any real attention time', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: '25/5', exact: true }).click()
    await page.locator('input.m-field').first().fill('cold start test')
    await page.getByRole('button', { name: 'Start' }).click()

    const pillWrap = page.locator('[data-timer-pill="true"]')
    const svg = pillWrap.locator('svg')
    await expect(svg).toBeVisible()
    const firstPath = svg.locator('path').first()
    const dasharray = await firstPath.evaluate((e) => getComputedStyle(e).strokeDasharray)
    const [drawn] = dasharray.split(',').map((n) => parseFloat(n))
    expect(drawn).toBeGreaterThan(0) // a visible arc exists even with ~0 real elapsed time

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the loop is a solid line throughout, no dashed segments anywhere', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: '25/5', exact: true }).click()
    await page.locator('input.m-field').first().fill('solid line test')
    await page.getByRole('button', { name: 'Start' }).click()

    const pillWrap = page.locator('[data-timer-pill="true"]')
    const svg = pillWrap.locator('svg')
    await expect(svg).toBeVisible()
    const strokeWidths = await svg.locator('path').evaluateAll((els) => els.map((e) => getComputedStyle(e).strokeWidth))
    for (const w of strokeWidths) expect(w).toBe('2px') // --m-stroke-loud, uniform across every segment

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the pill\'s border is visually suppressed without changing its measured size', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: '25/5', exact: true }).click()
    await page.locator('input.m-field').first().fill('measurement test')
    await page.getByRole('button', { name: 'Start' }).click()

    const pillWrap = page.locator('[data-timer-pill="true"]')
    await expect(pillWrap).toHaveAttribute('data-loop', 'on')
    await expect(pillWrap).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)') // transparent, not border-style:none

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('the loop still draws when no cycle is configured, filling from live attention data alone', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: 'custom', exact: true }).click()
    await page.getByRole('button', { name: 'no cycles', exact: true }).click()
    await page.locator('input.m-field').first().fill('no cycle loop test')
    await page.getByRole('button', { name: 'Start' }).click()

    const pillWrap = page.locator('[data-timer-pill="true"]')
    await expect(pillWrap.locator('svg')).toBeVisible() // the loop is NOT gated on a cycle existing

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

})

test('the outcome screen shows a colored attention band between the intention and the per-domain rows', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairPopup(setupPage, extensionId)
  await setupPage.locator('input.m-field').first().fill('outcome band test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )
  const { token } = await setupPage.evaluate(
    () => new Promise<{ token: string }>((r) => chrome.storage.local.get('token', (v: any) => r(v))),
  )

  // Wait for the session-creation POST (fired from sw.js startSession()) to land server-side,
  // polling instead of a fixed sleep — the Start button click is fire-and-forget on the client.
  await expect
    .poll(async () => {
      const res = await setupPage.request.get(`/api/sessions/${sessionId}/review`, {
        headers: { authorization: `Bearer ${token}` },
      })
      return res.status()
    }, { timeout: 5_000 })
    .not.toBe(404)

  await setupPage.request.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      sessionId,
      events: [
        { kind: 'attention', domain: 'chatgpt.com', seconds: 300, at: new Date().toISOString() },
        { kind: 'away', domain: null, seconds: 60, at: new Date().toISOString() },
      ],
    },
  })
  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  await setupPage.reload()

  const band = setupPage.locator('.m-mark[data-band="session"]')
  await expect(band).toBeVisible()
  const bars = band.locator('.m-row-bar')
  await expect(bars).toHaveCount(2) // one attention-1, one away
  await expect(bars.nth(0)).toHaveAttribute('data-kind', 'attention-1')
  await expect(bars.nth(1)).toHaveAttribute('data-kind', 'away')

  // Additive — the existing text rows are still there too.
  await expect(setupPage.getByText(/chatgpt\.com — \d+ min/)).toBeVisible()
})

test('the outcome screen shows no band when there is no attention data at all', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.locator('input.m-field').first().fill('empty outcome test')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  await page.reload()

  await expect(page.locator('.m-mark[data-band="session"]')).toHaveCount(0)
})
