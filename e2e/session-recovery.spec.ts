import { test, expect, chromium } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const EXTENSION_PATH = path.join(__dirname, '..', 'extension')

// Case I — browser-restart recovery (extension/sw.js's recoverStaleSession, wired to both
// onInstalled and onStartup): a session left running when the browser closes must not be
// stuck forever. It has its own endReason ('recovered'), deliberately NOT in the
// 'stopped' || 'elapsed' check that opens a review tab (sw.js:~116), so a restart must not
// pop a surprise tab in the user's face.
//
// Confirmed empirically (see docs/dead-ends.md) that for an unpacked extension loaded via
// --load-extension, Chromium fires onInstalled on every relaunch — never onStartup. That's
// this harness's load mechanism, and may not match how Chromium treats a real user's own
// "Load unpacked" install across ordinary restarts (unconfirmed either way; the official
// docs don't say). This test exercises the event that demonstrably does fire here; it does
// not prove onStartup's behavior for a real user, which stays an open, human-only
// verification item — see docs/dead-ends.md's entry on this exact gap.
//
// Not covered by the shared `fixtures.ts` context (it creates one throwaway profile dir per
// test and tears it down after) — this test manages its own persistent profile dir so it
// can close the browser and relaunch against the same one, a real Chromium startup rather
// than a simulated one.
test('a session survives a browser close, and ends itself (without popping a tab) on the next launch', async ({ baseURL }) => {
  test.setTimeout(60_000)
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-pw-recovery-'))
  const launchArgs = {
    channel: 'chromium' as const,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  }

  const context1 = await chromium.launchPersistentContext(userDataDir, launchArgs)
  let sessionId: string
  try {
    let [sw1] = context1.serviceWorkers()
    if (!sw1) sw1 = await context1.waitForEvent('serviceworker')
    const extensionId = sw1.url().split('/')[2]

    // This test owns its context, so fixtures.ts's extensionId fixture — which seeds apiBase —
    // never runs for it. Without this the extension falls back to extension/api.js:1's
    // http://localhost:3000 and posts the session to whatever dev server is on that port,
    // which reads .env.local. The profile dir persists, so context2 inherits this.
    await sw1.evaluate(
      (base) => new Promise<void>((r) => chrome.storage.local.set({ apiBase: base }, () => r())),
      baseURL!,
    )

    const page = await context1.newPage()
    const email = `e2e-recovery-${Date.now()}@example.com`
    // Sign-in/sign-up lives at /sign-in, not the landing page itself.
    await page.goto('/sign-in')
    const signupForm = page.getByRole('form', { name: 'Create an account' })
    await signupForm.getByLabel('Name').fill('E2E Recovery')
    await signupForm.getByLabel('Email').fill(email)
    await signupForm.getByLabel('Password').fill('e2e-test-password-1')
    await signupForm.getByRole('button', { name: 'Create an account' }).click()
    await page.waitForURL('**/dashboard')

    const mint = await page.request.post('/api/pair')
    const { code } = await mint.json()
    const claim = await page.request.post('/api/pair/claim', { data: { code } })
    const { token, deviceId } = await claim.json()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
    await page.reload()
    await page.locator('input.m-field').first().fill('recovery test')
    await page.getByRole('button', { name: 'Start' }).click()

    sessionId = await page.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )
    expect(sessionId).toBeTruthy()

    // startSession's own creation POST is fire-and-forget (extension/sw.js, same
    // local-first pattern as everywhere else in this codebase) — closing the browser
    // immediately after Start can outrace it, killing the in-flight request before the
    // row ever exists server-side. /review/:id renders for a running session too (not
    // only an ended one), so it doubles as the "did creation land" poll target.
    await expect
      .poll(async () => (await page.request.get(`/review/${sessionId}`)).status(), { timeout: 5_000 })
      .toBe(200)
  } finally {
    // A real browser-process close, not just closing a page/tab — onStartup fires on the
    // *next* launch against this same profile dir, which is the actual event under test.
    await context1.close()
  }

  const context2 = await chromium.launchPersistentContext(userDataDir, launchArgs)
  try {
    const pagesBeforeWait = context2.pages().map((p) => p.url())

    let sw2 = context2.serviceWorkers()[0]
    if (!sw2) sw2 = await context2.waitForEvent('serviceworker')
    const extensionId = sw2.url().split('/')[2]
    const checkPage = await context2.newPage()
    await checkPage.goto(`chrome-extension://${extensionId}/popup.html`)

    await expect
      .poll(async () => checkPage.evaluate(() => new Promise((r) => chrome.storage.local.get('session', (v: any) => r(v.session)))))
      .toBeNull()

    // The asymmetry sw.js:116 encodes: 'recovered' must not auto-open a review tab, unlike
    // 'stopped'/'elapsed'. Check both the tabs open at the moment of relaunch and shortly
    // after, since chrome.tabs.create is async.
    await checkPage.waitForTimeout(500)
    const allUrls = [...pagesBeforeWait, ...context2.pages().map((p) => p.url())]
    expect(allUrls.some((u) => u.includes(`/review/${sessionId}`))).toBe(false)

    const rules = await sw2.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
    expect(rules.length).toBe(0)

    const reviewRes = await checkPage.request.get(`/review/${sessionId}`)
    expect(reviewRes.status()).toBe(200)
  } finally {
    await context2.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})

// Case J — the toolbar badge is only ever SET inside endSession (sw.js's endReason ===
// 'stopped' || 'elapsed' branch); nothing re-applies it after a service-worker restart or
// extension update. Whether Chrome itself persists badge text across a restart is
// unconfirmed (no docs either way), so this proves the badge is right regardless: sw.js's
// resyncBadge, wired to onInstalled/onStartup next to recoverStaleSession above for the
// same reason, re-derives it from the persisted pendingReview flag on every relaunch.
//
// Seeds pendingReview directly rather than running a whole session to elapse — resyncBadge
// only ever reads that one key, so this exercises the real function without the scaffolding
// of starting and elapsing a session.
test('the badge resyncs to "?" after a browser restart when a review is still pending', async () => {
  test.setTimeout(60_000)
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-pw-badge-'))
  const launchArgs = {
    channel: 'chromium' as const,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  }

  const context1 = await chromium.launchPersistentContext(userDataDir, launchArgs)
  try {
    let sw1 = context1.serviceWorkers()[0]
    if (!sw1) sw1 = await context1.waitForEvent('serviceworker')

    await sw1.evaluate(() => new Promise<void>((r) =>
      chrome.storage.local.set({ pendingReview: { sessionId: 'badge-resync-test' } }, () => r()),
    ))
  } finally {
    await context1.close()
  }

  const context2 = await chromium.launchPersistentContext(userDataDir, launchArgs)
  try {
    let sw2 = context2.serviceWorkers()[0]
    if (!sw2) sw2 = await context2.waitForEvent('serviceworker')

    await expect.poll(async () => sw2.evaluate(() => chrome.action.getBadgeText({}))).toBe('?')
  } finally {
    await context2.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})

// The negative case: a badge left over from a state that no longer holds must not survive
// a restart just because nothing wrote over it.
test('the badge resyncs to empty after a restart when no review is pending', async () => {
  test.setTimeout(60_000)
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-pw-badge-none-'))
  const launchArgs = {
    channel: 'chromium' as const,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  }

  const context1 = await chromium.launchPersistentContext(userDataDir, launchArgs)
  try {
    let sw1 = context1.serviceWorkers()[0]
    if (!sw1) sw1 = await context1.waitForEvent('serviceworker')
    // No pendingReview set. Force a stale '?' so a restart clearing it proves the resync,
    // not just a fresh profile's default empty text.
    await sw1.evaluate(() => chrome.action.setBadgeText({ text: '?' }))
  } finally {
    await context1.close()
  }

  const context2 = await chromium.launchPersistentContext(userDataDir, launchArgs)
  try {
    let sw2 = context2.serviceWorkers()[0]
    if (!sw2) sw2 = await context2.waitForEvent('serviceworker')

    await expect.poll(async () => sw2.evaluate(() => chrome.action.getBadgeText({}))).toBe('')
  } finally {
    await context2.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
