import { test, expect } from './fixtures'

test('every auth input has a real label, and the two forms are distinguishable', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/sign-in')

  // React 19 server actions render 4 hidden $ACTION_REF/$ACTION_KEY inputs per
  // form (8 total here) to support no-JS submission — present on both forms
  // regardless of labeling, before and after this change. Excluded so the count
  // reflects the fields a user actually sees, which is what this test is about.
  expect(await page.locator('input:not([type="hidden"])').count()).toBe(5)
  expect(await page.locator('label').count()).toBe(5)

  const signIn = page.getByRole('form', { name: 'Sign in' })
  const signUp = page.getByRole('form', { name: 'Create an account' })
  await expect(signIn.getByLabel('Email')).toBeVisible()
  await expect(signUp.getByLabel('Email')).toBeVisible()
  await expect(signUp.getByLabel('Name')).toBeVisible()
})

test('the public surfaces have a main landmark', async ({ context }) => {
  const page = await context.newPage()
  for (const path of ['/', '/sign-in']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toHaveCount(1)
  }
})

test('a shared link previews as more than one word', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/')
  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description).toBeTruthy()
  expect(description!.length).toBeGreaterThan(20)
  // ADR-0061: no page text or title is ever read. The old landing claim must not resurface here.
  expect(description!.toLowerCase()).not.toContain('reads the page')
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
})
