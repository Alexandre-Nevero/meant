import { test, expect } from './fixtures'

// ADR-0083. The intention pre-fills "what to block". Keyword first; the AI classifier only when
// no keyword matched; a manual toggle freezes the chips; Start never waits.
async function pairPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
}

const blockChip = (page: import('@playwright/test').Page, domain: string) =>
  page.locator('[data-chip-layout="group"]').filter({ hasText: 'what to block' }).getByRole('button', { name: domain, exact: true })

test('a writing intention pre-fills every shipped group and names the preset', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.locator('input.m-field').first().fill('write the letter to the landlord')
  await expect(page.getByText('Writing preset', { exact: true })).toBeVisible()
  for (const d of ['x.com', 'youtube.com', 'cnn.com']) await expect(blockChip(page, d)).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.blockedDomains ?? [])))))
    .toContain('x.com')
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('research spares youtube even when it is on the user\'s own list', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await page.request.put('/api/lists', { data: { workSites: [], distractSites: ['youtube.com'] } })
  await pairPopup(page, extensionId)

  await page.locator('input.m-field').first().fill('research competitor pricing')
  await expect(page.getByText('Research preset', { exact: true })).toBeVisible()
  await expect(blockChip(page, 'youtube.com')).toHaveAttribute('aria-pressed', 'false')
  await expect(blockChip(page, 'reddit.com')).toHaveAttribute('aria-pressed', 'true')
})

test('a site the intention names is not pre-blocked (the Instagram case)', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await page.locator('input.m-field').first().fill('schedule instagram posts for the client')
  await expect(page.getByText('Admin preset', { exact: true })).toBeVisible()
  await expect(blockChip(page, 'facebook.com')).toHaveAttribute('aria-pressed', 'true')
  await expect(blockChip(page, 'instagram.com')).toHaveAttribute('aria-pressed', 'false')
})

test('one manual toggle freezes the chips for the rest of the view', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.route('**/api/presets/classify', (route) => route.fulfill({ json: { preset: null } }))

  const field = page.locator('input.m-field').first()
  await field.fill('write the letter')
  await blockChip(page, 'x.com').click() // the user's own choice
  await expect(blockChip(page, 'x.com')).toHaveAttribute('aria-pressed', 'false')

  await field.fill('plan the week') // no preset any more — but the chips are the user's now
  await expect(blockChip(page, 'x.com')).toHaveAttribute('aria-pressed', 'false')
  await expect(blockChip(page, 'youtube.com')).toHaveAttribute('aria-pressed', 'true')
})

test('with no keyword, the AI classifier picks the preset', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  let calls = 0
  await page.route('**/api/presets/classify', (route) => { calls++; return route.fulfill({ json: { preset: 'research' } }) })

  await page.locator('input.m-field').first().fill('quarterly numbers for the board')
  await expect(page.getByText('Research preset', { exact: true })).toBeVisible({ timeout: 5_000 })
  expect(calls).toBe(1) // debounced: one call for one settled sentence, not one per keystroke
})

test('an AI answer that arrives after Start changes nothing', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.route('**/api/presets/classify', async (route) => {
    await new Promise((r) => setTimeout(r, 3_000))
    await route.fulfill({ json: { preset: 'writing' } })
  })

  await page.locator('input.m-field').first().fill('quarterly numbers for the board')
  await page.waitForTimeout(900) // past the 800ms debounce, so the slow call is in flight
  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(async () => page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.blockedDomains)))))
    .toEqual([]) // a fresh account's default: its (empty) standing list
  await page.waitForTimeout(3_000)
  expect(await page.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session?.blockedDomains))))).toEqual([])
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})

test('the classify route refuses anonymous callers and answers null for a too-short intention', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  const anon = await page.request.post('/api/presets/classify', { data: { intention: 'quarterly numbers' } })
  expect(anon.status()).toBe(401)

  await freshAccount(page) // signed-in cookie
  const short = await page.request.post('/api/presets/classify', { data: { intention: 'ab' } })
  expect(short.status()).toBe(200)
  expect(await short.json()).toEqual({ preset: null })
})
