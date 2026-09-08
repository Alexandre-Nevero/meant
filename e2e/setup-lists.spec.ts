import { test, expect } from './fixtures'

// Case A — resolves the one ambiguous finding from the earlier automated pass: was
// /setup's chip-persistence check actually authenticated? Here, yes, for real.
test('setup lists persist across reload, authenticated', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)

  await page.goto('/setup')
  const workGroup = page.locator('section', { hasText: 'Where do you work?' })
  const distractGroup = page.locator('section', { hasText: 'What pulls you away?' })

  for (const domain of ['docs.google.com', 'github.com']) {
    await workGroup.getByPlaceholder('add a site and press enter').fill(domain)
    await workGroup.getByPlaceholder('add a site and press enter').press('Enter')
  }
  for (const domain of ['youtube.com', 'x.com']) {
    await distractGroup.getByPlaceholder('add a site and press enter').fill(domain)
    await distractGroup.getByPlaceholder('add a site and press enter').press('Enter')
  }

  await expect(workGroup.getByText('docs.google.com')).toBeVisible()
  await expect(distractGroup.getByText('x.com')).toBeVisible()

  // app/setup/page.tsx's update() PUTs fire-and-forget (no await, matching the popup's
  // own local-first pattern) — the chips above render from optimistic local state
  // immediately, before the save has necessarily landed. Wait for the real save to
  // land server-side before reloading, or the reload can race it and read stale data.
  await expect
    .poll(async () => {
      const res = await page.request.get('/api/lists')
      const body = await res.json()
      return body.workSites.length === 2 && body.distractSites.length === 2
    }, { timeout: 5_000 })
    .toBe(true)

  await page.reload()
  const workGroupAfter = page.locator('section', { hasText: 'Where do you work?' })
  const distractGroupAfter = page.locator('section', { hasText: 'What pulls you away?' })
  await expect(workGroupAfter.getByText('docs.google.com')).toBeVisible()
  await expect(workGroupAfter.getByText('github.com')).toBeVisible()
  await expect(distractGroupAfter.getByText('youtube.com')).toBeVisible()
  await expect(distractGroupAfter.getByText('x.com')).toBeVisible()

  const res = await page.request.get('/api/lists')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.workSites.sort()).toEqual(['docs.google.com', 'github.com'].sort())
  expect(body.distractSites.sort()).toEqual(['x.com', 'youtube.com'].sort())
})
