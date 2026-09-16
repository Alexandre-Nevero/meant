import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const EXTENSION_PATH = path.join(__dirname, '..', 'extension')

type Fixtures = {
  context: BrowserContext
  extensionId: string
  freshAccount: (page: Page) => Promise<{ email: string; password: string }>
  endedSession: (opts: { intention: string; events?: unknown[] }) => Promise<string>
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-pw-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    })
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },

  extensionId: async ({ context, baseURL }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')

    // extension/api.js:1 defaults apiBase to http://localhost:3000 — the port this suite used
    // before #18 gave it its own server on 3100. Left unset, every write the EXTENSION makes
    // (sessions, events, pairing claims) goes to whatever is listening on :3000, which on a
    // developer's machine is `next dev` reading .env.local: production. #18's webServer.env
    // guards the page's traffic and the database; it never covered the extension, which talks
    // to an origin of its own. Seeded from the service worker so it lands before any spec runs.
    await sw.evaluate(
      (base) => new Promise<void>((r) => chrome.storage.local.set({ apiBase: base }, () => r())),
      baseURL!,
    )

    await use(sw.url().split('/')[2])
  },

  freshAccount: async ({}, use) => {
    await use(async (page: Page) => {
      const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
      const password = 'e2e-test-password-1'
      // Sign-in/sign-up lives at /sign-in, not the landing page itself — the landing
      // page (/) never carries an inline auth form.
      await page.goto('/sign-in')
      // The signup form is the second <form> on the page (Fields() is shared by both;
      // signup adds a leading Name field) — scope by the "Create an account" button
      // text rather than a brittle nth-of-type guess.
      const signupForm = page.locator('form', { has: page.getByRole('button', { name: 'Create an account' }) })
      await signupForm.getByPlaceholder('Name').fill('E2E Test')
      await signupForm.getByPlaceholder('Email').fill(email)
      await signupForm.getByPlaceholder('Password').fill(password)
      await signupForm.getByRole('button', { name: 'Create an account' }).click()
      await page.waitForURL('**/dashboard')
      return { email, password }
    })
  },

  endedSession: async ({ context, extensionId, freshAccount }, use) => {
    await use(async ({ intention, events = [] }) => {
      const page = await context.newPage()
      await freshAccount(page)
      const mint = await page.request.post('/api/pair')
      const { code } = await mint.json()
      const claim = await page.request.post('/api/pair/claim', { data: { code } })
      const { token, deviceId } = await claim.json()
      await page.goto(`chrome-extension://${extensionId}/popup.html`)
      await page.evaluate(
        ({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())),
        { token, deviceId },
      )
      await page.reload()
      await page.locator('input.m-field').first().fill(intention)
      await page.getByRole('button', { name: 'Start' }).click()
      const sessionId: string = await page.evaluate(
        () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
      )
      // The Start click is fire-and-forget from sw.js startSession(); sessionId is in storage
      // immediately, but the server row may not exist yet. Same wait the open-coded copies use.
      await page.waitForTimeout(500)
      if (events.length > 0) {
        // The same API sw.js's own flush() uses — deterministic, no dependency on real timing.
        const res = await context.request.post('/api/events', {
          headers: { authorization: `Bearer ${token}` },
          data: { sessionId, events },
        })
        if (res.status() !== 200) throw new Error(`event injection failed: ${res.status()}`)
      }
      await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
      await page.waitForTimeout(300)
      return sessionId
    })
  },
})

export { expect } from '@playwright/test'
