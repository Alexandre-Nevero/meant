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
// than reading the opened tab's final URL: the web app's own '/' route redirects an
// authenticated session straight to /dashboard server-side (app/page.tsx:
// `if (userId) redirect('/dashboard')`), which every test account here is (freshAccount
// signs in). So "meant.app"'s landed URL is legitimately /dashboard too — reading it back
// would make the two buttons indistinguishable. The spy sidesteps that: it captures the
// exact URL popup.js asked for, before any server-side redirect gets a say.
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
  test('renders the approved layout: sentence, duration, cycle, site rows, Start', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await expect(page.getByPlaceholder('')).toBeVisible() // the sentence field
    await expect(page.getByRole('button', { name: '25 min' })).toBeVisible()
    await expect(page.getByRole('button', { name: '50 min' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'until I stop' })).toBeVisible()
    await expect(page.getByRole('button', { name: '25/5' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'no cycles' })).toBeVisible()
    await expect(page.getByText('where it happens')).toBeVisible()
    await expect(page.getByText('what to block')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

    // 50/10 is the documented first-ever-session default (Task 6 brief, Step 3) — not
    // "no cycles"; a wrong assumption on my own first pass through this suite.
    await expect(page.getByRole('button', { name: '50/10' })).toHaveAttribute('aria-pressed', 'true')

    // Task 6: the idle mark must render the same decorative gradient glyph as
    // running/ended, not a blank outline (the CSS bug — data-state="idle" was
    // missing from the ::after selector).
    const markBackground = await page.locator('.m-mark').evaluate((e) => getComputedStyle(e, '::after').backgroundImage)
    expect(markBackground).not.toBe('none')

    // Task 6: nav row present in the idle view too, and both buttons actually open a
    // real tab at the right URL (chrome.tabs.create), not just render.
    await expect(page.getByRole('button', { name: 'History' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'meant.app' })).toBeVisible()

    const historyPage = await clickAndExpectNewTab(page, context, 'History', 'http://localhost:3000/dashboard')
    expect(historyPage.url()).toContain('/dashboard')
    await historyPage.close()

    const landingPage = await clickAndExpectNewTab(page, context, 'meant.app', 'http://localhost:3000/')
    await landingPage.close()
  })

  test('multi-select chips toggle independently, not exclusively', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    // Add two chips via the + input, confirm both stay pressed together.
    const plusButtons = page.getByRole('button', { name: '+' })
    await plusButtons.first().click()
    await page.keyboard.type('gmail.com')
    await page.keyboard.press('Enter')
    await plusButtons.first().click()
    await page.keyboard.type('amazon.com')
    await page.keyboard.press('Enter')

    const gmailChip = page.getByRole('button', { name: /gmail\.com/ })
    const amazonChip = page.getByRole('button', { name: /amazon\.com/ })
    await expect(gmailChip).toHaveAttribute('aria-pressed', 'true')
    await expect(amazonChip).toHaveAttribute('aria-pressed', 'true')
    await gmailChip.click() // toggling one must not affect the other
    await expect(amazonChip).toHaveAttribute('aria-pressed', 'true')
  })

  test('typed domains are normalized on Enter and on blur, not dropped', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+' })

    // Enter path, with scheme/path/case survival — the exact reviewer-found regression case.
    await plusButtons.first().click()
    await page.keyboard.type('HTTPS://Gmail.COM/inbox')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'gmail.com' })).toBeVisible()

    // Blur path (click elsewhere, no Enter) — the fix-round bug: this used to silently drop it.
    await plusButtons.first().click()
    await page.keyboard.type('www.notion.so')
    await page.getByRole('button', { name: 'Start' }).click({ trial: true }).catch(() => {}) // move focus without submitting
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('button', { name: 'notion.so' })).toBeVisible()
  })

  test('Start creates a session', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await page.locator('input.m-field').first().fill('finish the e2e suite')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect
      .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v) => r(v.session)))))
      .toBeTruthy()
  })

  test('typing a phrase resolves multiple aliases at once, atomically', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+' })
    await plusButtons.first().click()
    await page.keyboard.type('docs, gmail, and chatgpt')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'docs.google.com' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'chatgpt.com' })).toBeVisible()
  })

  test('a typo in a phrase blocks the whole phrase and offers a correction', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+' })
    await plusButtons.first().click()
    await page.keyboard.type('docs, gmial')
    await page.keyboard.press('Enter')
    await expect(page.getByText('did you mean gmail? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'docs.google.com' })).toHaveCount(0) // atomic — nothing added yet

    await page.keyboard.press('Enter') // accepts the standing suggestion
    await expect(page.getByRole('button', { name: 'docs.google.com' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com' })).toBeVisible()
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

    await expect(page.getByRole('button', { name: /gmail\.com/ })).toBeVisible()

    await page.getByRole('button', { name: 'Remove gmail.com' }).click()
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

    const plusButtons = page.getByRole('button', { name: '+' })
    await plusButtons.first().click()
    await page.keyboard.type('gmial, docz')
    await page.keyboard.press('Enter')
    // First suggestion should be for the first bad token (gmial → gmail)
    await expect(page.getByText('did you mean gmail? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com' })).toHaveCount(0) // nothing added yet

    await page.keyboard.press('Enter') // accept first suggestion
    // Second Enter should show the second suggestion (docz → docs), not revert to gmial
    await expect(page.getByText('did you mean docs? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'gmail.com' })).toHaveCount(0) // still nothing added, still atomic

    await page.keyboard.press('Enter') // accept second suggestion
    // Final Enter should resolve both corrected chips
    await expect(page.getByRole('button', { name: 'gmail.com' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'docs.google.com' })).toBeVisible()
  })

  // Fix round: "doc" is a substring of the earlier valid token "docs" — a naive string
  // .replace() call hits the "doc" INSIDE "docs" instead of the bad token itself,
  // producing "docss, doc" forever (oscillates, never resolves). The fix replaces by
  // token position instead.
  test('a bad token that is a substring of another valid token corrects without oscillating', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+' })
    await plusButtons.first().click()
    await page.keyboard.type('docs, doc')
    await page.keyboard.press('Enter')
    await expect(page.getByText('did you mean docs? Press Enter to use it')).toBeVisible()
    await expect(page.getByRole('button', { name: 'docs.google.com' })).toHaveCount(0) // atomic — nothing added yet

    await page.keyboard.press('Enter') // accepts the standing suggestion
    // Deduplicated to a single chip, not oscillating forever and never resolving.
    await expect(page.getByRole('button', { name: 'docs.google.com' })).toHaveCount(1)
  })

  // Case V — the blocklist label is static, matching its sibling's grammar, and never
  // mutates as chips are added or removed (Task 12).
  test('the blocklist label reads "what to block" and does not change as chips are added or removed', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    await expect(page.getByText('what to block')).toBeVisible()
    await expect(page.getByText(/^blocking \d+$/)).toHaveCount(0)

    const plusButtons = page.getByRole('button', { name: '+' })
    await plusButtons.nth(1).click() // the blocking row's own +
    await page.keyboard.type('addedsite.com')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'addedsite.com' })).toBeVisible()

    // The label must still read the static string after the add — a regression here
    // would mean the deleted onChange handler somehow still fired.
    await expect(page.getByText('what to block')).toBeVisible()
    await expect(page.getByText(/^blocking \d+$/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Remove addedsite.com' }).click()
    await expect(page.getByRole('button', { name: /addedsite\.com/ })).toHaveCount(0)
    await expect(page.getByText('what to block')).toBeVisible()
  })

  test('a long site list scrolls inside the chip row instead of growing the popup unbounded', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    const plusButtons = page.getByRole('button', { name: '+' })
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

    await page.getByRole('button', { name: '+' }).nth(1).click() // the blocking row's own +
    await page.keyboard.type('example.org')
    await page.keyboard.press('Enter')
    await page.locator('input.m-field').first().fill('running state test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect(page.getByText(/^blocking: .*example\.org/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'History' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'meant.app' })).toBeVisible()

    const historyPage = await clickAndExpectNewTab(page, context, 'History', 'http://localhost:3000/dashboard')
    expect(historyPage.url()).toContain('/dashboard')
    await historyPage.close()

    const landingPage = await clickAndExpectNewTab(page, context, 'meant.app', 'http://localhost:3000/')
    await landingPage.close()

    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })

  test('a running session with a cycle configured shows which phase it is in, without a ticking countdown', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)

    // 25/5 is already the picker's own preset (CYCLE_PRESETS[0]).
    await page.getByRole('button', { name: '25/5' }).click()
    await page.locator('input.m-field').first().fill('cycle test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect(page.getByText(/^work — \d+ min left$/)).toBeVisible()

    // Push startedAt into the break phase without a real 25-minute wait.
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get('session', ({ session }: any) => {
          session.startedAt = new Date(Date.now() - 26 * 60_000).toISOString() // 1 min into break
          chrome.storage.local.set({ session }, () => resolve())
        })
      })
    })
    await page.reload()
    await expect(page.getByText(/^break — \d+ min left$/)).toBeVisible()

    // No cycle at all: no phase line should render.
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  });

  test('a running session with no cycle configured shows no phase line', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    await pairPopup(page, extensionId)
    await page.getByRole('button', { name: 'no cycles' }).click()
    await page.locator('input.m-field').first().fill('no cycle test')
    await page.getByRole('button', { name: 'Start' }).click()

    await expect(page.getByText(/min left$/)).toHaveCount(0)
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  });
})
