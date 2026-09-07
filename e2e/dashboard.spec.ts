import { test, expect } from './fixtures'

test('the dashboard ledger has the approved max-width, not full viewport width', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1600, height: 900 })
  await freshAccount(page)
  await page.goto('/dashboard')

  const ledger = page.locator('[data-surface="ledger"]')
  const box = await ledger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeLessThanOrEqual(1000)
})
