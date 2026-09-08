import { test, expect } from './fixtures'

test('a signed-in visitor to / sees the landing page with a dashboard CTA, not a forced redirect', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  // freshAccount lands on /dashboard after signup — navigate back to / explicitly.
  await page.goto('/')
  await expect(page.getByText('Say what you mean. It knows if you did.')).toBeVisible()
  // Header nav: dashboard link
  await expect(page.locator('header').getByRole('link', { name: 'Go to your dashboard' })).toBeVisible()
  // Ledger section: also has a dashboard link, verifying CTA swap works in both locations
  await expect(page.locator('section.m-landing-ledger').getByRole('link', { name: 'Go to your dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0) // no sign-in CTA for a signed-in visitor
})

test('a signed-out visitor to / sees a sign-in CTA, not an inline auth form', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByText('Say what you mean. It knows if you did.')).toBeVisible()
  // Header nav: sign-in link, pointing at the dedicated /sign-in route
  const headerSignIn = page.locator('header').getByRole('link', { name: 'Sign in' })
  await expect(headerSignIn).toBeVisible()
  await expect(headerSignIn).toHaveAttribute('href', '/sign-in')
  // Ledger section: also a sign-in link
  await expect(page.locator('section.m-landing-ledger').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByPlaceholder('Email')).toHaveCount(0) // no inline auth form on the landing page itself
  await expect(page.getByRole('link', { name: 'Go to your dashboard' })).toHaveCount(0)
})

test('the sign-in route hosts the real auth form, and redirects an already-signed-in visitor to the dashboard', async ({ context, freshAccount }) => {
  const signedOut = await context.newPage()
  await signedOut.goto('/sign-in')
  await expect(signedOut.getByPlaceholder('Email').first()).toBeVisible()
  await expect(signedOut.getByRole('button', { name: 'Create an account' })).toBeVisible()

  const page = await context.newPage()
  await freshAccount(page)
  await page.goto('/sign-in')
  await expect(page).toHaveURL(/\/dashboard/)
})
