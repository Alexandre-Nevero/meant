import { test, expect } from './fixtures'

test('a signed-in visitor to / sees the landing page with a dashboard CTA, not a forced redirect', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  // freshAccount lands on /dashboard after signup — navigate back to / explicitly.
  await page.goto('/')
  await expect(page.getByText('Every other focus app has to ask whether you were focused.')).toBeVisible()
  // Scope to the hero section to avoid strict mode violation (link appears in both hero and ledger)
  await expect(page.locator('#auth').getByRole('link', { name: 'Go to your dashboard' }).first()).toBeVisible()
  await expect(page.getByPlaceholder('Email')).toHaveCount(0) // no auth form for a signed-in visitor
})

test('a signed-out visitor to / still sees the sign-in form', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByText('Every other focus app has to ask whether you were focused.')).toBeVisible()
  // Scope to the first form (sign-in) to avoid strict mode violation
  await expect(page.locator('#auth').locator('form').first().getByPlaceholder('Email')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to your dashboard' })).toHaveCount(0)
})
