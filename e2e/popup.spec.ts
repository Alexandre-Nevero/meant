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
    await expect(page.getByText(/^blocking \d+$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

    // 50/10 is the documented first-ever-session default (Task 6 brief, Step 3) — not
    // "no cycles"; a wrong assumption on my own first pass through this suite.
    await expect(page.getByRole('button', { name: '50/10' })).toHaveAttribute('aria-pressed', 'true')
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
})
