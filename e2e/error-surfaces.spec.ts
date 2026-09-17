import { test, expect } from './fixtures'

// #46. A failure must stay inside the product's visual world, and must be announced.
test('a 404 renders in the product, not Next.js stock black-on-white', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)

  // A well-formed UUID that belongs to nobody — review/[sessionId] calls notFound() for it.
  await page.goto('/review/00000000-0000-4000-8000-000000000000')

  await expect(page.locator('[data-surface="not-found"]')).toBeVisible()
  const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(ground).not.toBe('rgba(0, 0, 0, 0)')
  expect(ground).not.toBe('rgb(255, 255, 255)')
  await expect(page.getByRole('link', { name: 'Your sessions' })).toBeVisible()
})

test('a failed sign-in is announced, and does not read as a hint', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/sign-in')

  const form = page.getByRole('form', { name: 'Sign in' })
  await form.getByLabel('Email').fill('nobody@example.com')
  await form.getByLabel('Password').fill('not-the-password')
  await form.getByRole('button', { name: 'Sign in' }).click()

  // Scoped to the form: Next's App Router always mounts its own role="alert" route
  // announcer (node_modules/next/dist/client/components/app-router-announcer.js) for
  // screen-reader navigation announcements, unrelated to this one and matched by an
  // unscoped page.getByRole('alert').
  const alert = form.getByRole('alert')
  await expect(alert).toBeVisible()

  // The defect was that it rendered identically to the word "or" two lines below it.
  const [alertWeight, hintWeight] = await Promise.all([
    alert.evaluate((el) => getComputedStyle(el).fontWeight),
    page.getByText('or', { exact: true }).evaluate((el) => getComputedStyle(el).fontWeight),
  ])
  expect(alertWeight).not.toBe(hintWeight)
})
