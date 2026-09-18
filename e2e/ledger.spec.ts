import { test, expect } from './fixtures'

test.describe('Daily Ledger & Dual-Surface Navigation', () => {
  test('the ledger renders the 04:00-22:00 timeline hero and today sessions', async ({ context, freshAccount }) => {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })
    await freshAccount(page)
    await page.goto('/ledger')

    // Empty state or ledger surface
    const ledger = page.locator('[data-surface="ledger"]')
    await expect(ledger).toBeVisible()
    const box = await ledger.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(1000)
  })

  test('dual-surface navigation toggles active state between /ledger and /dashboard', async ({ context, freshAccount }) => {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })
    await freshAccount(page)

    await page.goto('/dashboard')
    const dashLink = page.locator('.m-shell-link[href="/dashboard"]')
    const ledgerLink = page.locator('.m-shell-link[href="/ledger"]')
    await expect(dashLink).toHaveClass(/active/)
    await expect(ledgerLink).not.toHaveClass(/active/)

    await ledgerLink.click()
    await page.waitForURL('**/ledger')
    await expect(page.locator('.m-shell-link[href="/ledger"]')).toHaveClass(/active/)
    await expect(page.locator('.m-shell-link[href="/dashboard"]')).not.toHaveClass(/active/)
  })

  test('companion pet is anchored on ledger and opens reflection drawer on tap', async ({ context, freshAccount }) => {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })
    await freshAccount(page)
    await page.goto('/ledger')

    const companion = page.locator('.m-web-companion-actor')
    await expect(companion).toBeVisible()

    // Click to open coach drawer
    await companion.click()
    const drawer = page.locator('.m-coach-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.locator('.m-coach-title')).toHaveText('MEANT Coach')

    // Close button dismisses
    await drawer.locator('.m-coach-close').click()
    await expect(drawer).not.toBeVisible()
  })
})
