import { test, expect } from './fixtures'

// #21. A brand-new account has added nothing yet — the two list forms below are blank
// either way, so without this the page just looks unfinished, not deliberately empty.
test('a first run with no sites says so, and the line clears once one is added', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await page.goto('/setup')

  const surface = page.locator('[data-surface="setup"]')
  const emptyLine = surface.getByText('You haven’t added any sites yet. Add a few, or skip for now.')
  await expect(emptyLine).toBeVisible()

  const work = page.locator('section', { hasText: 'Where do you work?' })
  await work.getByPlaceholder('add a site and press enter').fill('github.com')
  await work.getByPlaceholder('add a site and press enter').press('Enter')

  await expect(emptyLine).toHaveCount(0)
})

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

// #42, P1. A failed read rendered as "you have configured no sites", and the page stayed
// editable from that fabricated state — so one added site replaced the real list wholesale.
test('a failed read never fabricates an empty list, and cannot be saved over', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)

  // Seed a real list through the API, so there is something to destroy.
  const seeded = await page.request.put('/api/lists', {
    data: { workSites: ['docs.google.com', 'github.com'], distractSites: ['x.com'] },
  })
  expect(seeded.ok()).toBeTruthy()

  await page.route('**/api/lists', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
  )
  await page.goto('/setup')

  await expect(page.locator('[data-surface="setup"]').getByRole('alert')).toBeVisible()
  // The load-bearing assertion: nothing editable exists, so nothing can be saved over.
  await expect(page.getByPlaceholder('add a site and press enter')).toHaveCount(0)

  await page.unroute('**/api/lists')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('docs.google.com')).toBeVisible()
  await expect(page.getByText('github.com')).toBeVisible()

  // And the stored list survived the whole episode.
  const after = await page.request.get('/api/lists')
  expect((await after.json()).workSites.sort()).toEqual(['docs.google.com', 'github.com'])
})

// #42, second half. A silent write failure is worse than a visible one.
test('a failed save is announced and rolled back, not shown as saved', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await page.goto('/setup')

  const work = page.locator('section', { hasText: 'Where do you work?' })
  await work.getByPlaceholder('add a site and press enter').fill('github.com')
  await work.getByPlaceholder('add a site and press enter').press('Enter')
  await expect(work.getByText('github.com')).toBeVisible()

  await page.route('**/api/lists', (route) =>
    route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
  )
  await work.getByPlaceholder('add a site and press enter').fill('gitlab.com')
  await work.getByPlaceholder('add a site and press enter').press('Enter')

  await expect(page.locator('[data-surface="setup"]').getByRole('alert')).toBeVisible()
  // Rolled back: the interface must not claim a site is saved when it is not.
  await expect(work.getByText('gitlab.com')).toHaveCount(0)
  await expect(work.getByText('github.com')).toBeVisible()
})
