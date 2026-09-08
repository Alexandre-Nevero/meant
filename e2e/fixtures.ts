import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const EXTENSION_PATH = path.join(__dirname, '..', 'extension')

type Fixtures = {
  context: BrowserContext
  extensionId: string
  freshAccount: (page: Page) => Promise<{ email: string; password: string }>
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

  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')
    await use(sw.url().split('/')[2])
  },

  freshAccount: async ({}, use) => {
    await use(async (page: Page) => {
      const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
      const password = 'e2e-test-password-1'
      await page.goto('/')
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
})

export { expect } from '@playwright/test'
