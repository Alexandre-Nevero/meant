import { test, expect } from './fixtures'

// Case G — this session's two review-page fixes: www. stripped from tracked domains
// (matching the bareHostname helper), and the redundant "off by N min" line gone.
test('review page normalizes www. off tracked domains and has no redundant off-by line', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)

  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('review page test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Visit a www.-prefixed page while the session is running, active-tab attribution
  // (activeDomain()/bareHostname()) should record the bare form.
  const workPage = await context.newPage()
  await workPage.bringToFront()
  await workPage.goto('https://www.example.com')
  await workPage.waitForTimeout(1_500) // let the tabs.onActivated/onUpdated handler settle an attention slice

  await setupPage.bringToFront()
  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  await setupPage.waitForTimeout(500)

  const reviewPage = await context.newPage()
  await reviewPage.goto(`/review/${sessionId}`)
  const bodyText = await reviewPage.locator('body').innerText()

  expect(bodyText).not.toContain('www.example.com')
  expect(bodyText).toContain('example.com') // it did get tracked, just normalized
  expect(bodyText).not.toMatch(/off by \d+ min/)

  // Task 4 — the same data, extracted, now also served as JSON for the popup to consume.
  const apiRes = await reviewPage.request.get(`/api/sessions/${sessionId}/review`)
  expect(apiRes.status()).toBe(200)
  const apiData = await apiRes.json()
  expect(apiData.topAttention.some((r: any) => r.domain === 'example.com')).toBe(true)
})

// Case R — away row clarifying copy
test('the away row explains what "away" means via a hover title, not new visible text', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('away copy test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Wait for the session-creation POST (fired from sw.js startSession()) to land server-side.
  // The Start button click is fire-and-forget on the client; sessionId is available from storage
  // immediately, but the server row may not exist yet. Matching the pattern from Case G (line 30).
  await setupPage.waitForTimeout(500)

  // Inject a real away event directly via the same API sw.js's own flush() uses —
  // deterministic, no dependency on real idle/focus timing.
  const eventRes = await context.request.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: { sessionId, events: [{ kind: 'away', domain: null, seconds: 120, at: new Date().toISOString() }] },
  })
  expect(eventRes.status()).toBe(200)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  const reviewPage = await context.newPage()
  await reviewPage.goto(`/review/${sessionId}`)
  const awayRow = reviewPage.locator('.m-row:has([data-kind="away"])')
  await expect(awayRow).toHaveAttribute('title', /not measured/i)
})

// Case Z — review page container width matching the dashboard
test('the review page has the same max-width container as the dashboard, not full viewport width', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('review width test')
  await setupPage.getByRole('button', { name: 'Start' }).click()
  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )
  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  const page = await context.newPage()
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(`/review/${sessionId}`)

  const review = page.locator('[data-surface="review"]')
  const box = await review.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeLessThanOrEqual(1000)
})

// Case AC — extension-ID-shaped domains excluded from per-domain row list
test('the review page never shows an extension-ID-shaped domain in its per-domain row list', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('tracking hygiene test')
  await setupPage.getByRole('button', { name: 'Start' }).click()
  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  await setupPage.waitForTimeout(500)

  // Inject one real attention row and one extension-ID-shaped row directly via the same
  // API sw.js's own flush() uses — deterministic, no dependency on real tab-switching
  // timing, matching this suite's own established precedent for injecting review-data
  // fixtures.
  const eventRes = await context.request.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      sessionId,
      events: [
        { kind: 'attention', domain: 'chatgpt.com', seconds: 90, at: new Date().toISOString() },
        { kind: 'attention', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 30, at: new Date().toISOString() },
      ],
    },
  })
  expect(eventRes.status()).toBe(200)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  const reviewPage = await context.newPage()
  await reviewPage.goto(`/review/${sessionId}`)
  await expect(reviewPage.getByText('chatgpt.com')).toBeVisible()
  await expect(reviewPage.getByText('emnalgngpciahekjdcgpbgnhmkpjhlhi')).toHaveCount(0)
})

// #47. The most important write in the product, and it was unchecked.
test('a failed outcome write re-enables both buttons, says so, and retries on the same two', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'outcome failure test' })

  const page = await context.newPage()
  await page.route('**/api/sessions/*/outcome', (route) => route.fulfill({ status: 500, body: '{}' }))
  await page.goto(`/review/${sessionId}`)

  const reviewSurface = page.locator('[data-surface="review"]')
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(reviewSurface.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Not yet' })).toBeEnabled()
  // I1: the retry affordance is the two buttons themselves, never a third control.
  // Scoped to the surface — the app shell contributes its own <button> for Sign out.
  await expect(page.locator('[data-surface="review"] button')).toHaveCount(2)

  await page.unroute('**/api/sessions/*/outcome')
  // The client clears `failed` synchronously before the retry's fetch resolves, so the alert
  // disappears from the DOM well before the PATCH lands server-side — waiting on the response
  // itself (not a guessed delay) is what actually orders this check after the write completes.
  await Promise.all([
    page.waitForResponse('**/api/sessions/*/outcome'),
    page.getByRole('button', { name: 'Yes' }).click(),
  ])
  await expect(reviewSurface.getByRole('alert')).toHaveCount(0)

  const review = await page.request.get(`/api/sessions/${sessionId}/review`)
  expect((await review.json()).outcome).toBe('yes')
})

// #45. The artboard stages the question (Main.dc.html:59, margin-top:auto); the code listed it.
test('the review stages the question at the bottom of the fold, and keeps rows tight', async ({ context, endedSession }) => {
  const sessionId = await endedSession({
    intention: 'staging test',
    events: [{ kind: 'attention', domain: 'chatgpt.com', seconds: 90, at: new Date().toISOString() }],
  })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/review/${sessionId}`)

  const surface = page.locator('[data-surface="review"]')
  const ask = page.locator('.m-review-ask')
  const [surfaceBox, askBox, shellBox] = await Promise.all([
    surface.boundingBox(), ask.boundingBox(), page.locator('.m-shell').boundingBox(),
  ])

  // The shell's height is a real number, so calc(100dvh - var(--m-shell-h)) is honest.
  expect(shellBox!.height).toBeCloseTo(60, 0)
  // The surface fills the fold, so margin-top:auto has somewhere to push.
  expect(surfaceBox!.height).toBeGreaterThanOrEqual(900 - 60 - 1)
  // And the question group sits at its bottom, not 24px under the last row.
  const askBottom = askBox!.y + askBox!.height
  const surfaceBottom = surfaceBox!.y + surfaceBox!.height
  expect(surfaceBottom - askBottom).toBeLessThanOrEqual(73) // the 72px pad, plus a pixel

  await expect(page.locator('.m-review-rows')).toBeVisible()
})

// The narrow breakpoint. The ledger got one in #7; the review never did.
test('the review does not scroll sideways at 390px', async ({ context, endedSession }) => {
  const sessionId = await endedSession({
    intention: 'a deliberately long intention sentence for the narrow breakpoint',
  })

  const page = await context.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/review/${sessionId}`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
