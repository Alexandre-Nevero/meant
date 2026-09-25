import { neon } from '@neondatabase/serverless'
import path from 'node:path'
import fs from 'node:fs'
import { testDatabaseUrlFrom } from '../lib/db-guard'
import { test, expect } from './fixtures'

// ADR-0087, issues #19 and #20. Direct DB assertions, same reasoning as e2e/fixtures.ts's own
// `db()`: row-level facts (event.label, which tables still have rows for a user) have no API
// surface of their own, and shouldn't grow one just to make a test able to see them.
const connect = () =>
  neon(testDatabaseUrlFrom(fs.readFileSync(path.join(__dirname, '..', '.env.test'), 'utf8')))
let handle: ReturnType<typeof connect> | null = null
const db = () => (handle ??= connect())

async function pairAndStart(page: import('@playwright/test').Page, extensionId: string, intention = 'settings test') {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => {
    return new Promise<void>((resolve) => chrome.storage.local.set({ token, deviceId }, () => resolve()))
  }, { token, deviceId })
  await page.reload()
  await page.locator('input.m-field').first().fill(intention)
  await page.getByRole('button', { name: 'Start' }).click()
  return { token, deviceId }
}

const HOST_SELECTOR = '[data-meant-companion="true"]'

test.describe('settings — feature switches', () => {
  test('turning the companion off in Settings unmounts it everywhere, and back on remounts it', async ({
    context,
    extensionId,
    freshAccount,
  }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    // Present before touching Settings at all.
    const page = await context.newPage()
    await page.goto('https://example.com')
    await expect(page.locator(HOST_SELECTOR)).toBeVisible()

    // Turn it off through the real settings surface, not a storage shortcut. The chip
    // flips optimistically before the PUT resolves (see app/settings/page.tsx#setFeature),
    // so wait for the actual response — otherwise the popup below could pull settings
    // before the server has recorded the change.
    await setupPage.goto('/settings')
    const companionRow = setupPage.locator('[data-feature="companion"]')
    await Promise.all([
      setupPage.waitForResponse((res) => res.url().includes('/api/settings') && res.request().method() === 'PUT'),
      companionRow.getByRole('button', { name: 'Off' }).click(),
    ])
    await expect(companionRow.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true')

    // ADR-0042: the extension can't be told — it learns on its next pull. Reopening the
    // popup is that pull (the same fire-and-forget hook sw.js's own startup uses).
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    const [sw] = context.serviceWorkers()
    await expect
      .poll(async () => (await sw.evaluate(() => chrome.storage.local.get('companionEnabled'))).companionEnabled, {
        timeout: 10_000,
      })
      .toBe(false)

    await expect(page.locator(HOST_SELECTOR)).toHaveCount(0)

    // Back on, and the popup's own pull remounts it without a page reload.
    await setupPage.goto('/settings')
    await Promise.all([
      setupPage.waitForResponse((res) => res.url().includes('/api/settings') && res.request().method() === 'PUT'),
      companionRow.getByRole('button', { name: 'On' }).click(),
    ])
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect
      .poll(async () => (await sw.evaluate(() => chrome.storage.local.get('companionEnabled'))).companionEnabled, {
        timeout: 10_000,
      })
      .toBe(true)
    await expect(page.locator(HOST_SELECTOR)).toBeVisible()

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
  })
})

test.describe('settings — forget what you know about me', () => {
  test('clears event.label and the pathLog, but the session survives', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    const { token } = await pairAndStart(setupPage, extensionId)

    const sessionId: string = await setupPage.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )

    // startSession's creation POST (extension/sw.js) is fire-and-forget, so the row may not
    // exist on the server yet — same race e2e/fixtures.ts's endedSession guards against.
    await expect
      .poll(async () => (await setupPage.request.get(`/api/sessions/${sessionId}/review`)).status(), { timeout: 10_000 })
      .toBe(200)

    // A companion tap's own event shape (extension/lib/visit-label.js#labelsToEvents) —
    // injected directly, the same way e2e/fixtures.ts's endedSession injects events.
    const injected = await context.request.post('/api/events', {
      headers: { authorization: `Bearer ${token}` },
      data: { sessionId, events: [{ kind: 'label', domain: 'example.com', label: 'drift', seconds: 0, at: new Date().toISOString() }] },
    })
    expect(injected.status()).toBe(200)

    // A path-log entry recorded well before "now" (see the < forgetAt cutoff below).
    const [sw] = context.serviceWorkers()
    const oldAt = Date.now() - 60_000
    await sw.evaluate(
      (at) => chrome.storage.local.set({ pathLog: [{ sessionId: 'irrelevant', host: 'a.com', path: '/x', at }] }),
      oldAt,
    )

    await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

    // Preconditions, straight from the table forget is supposed to touch.
    const before = await db()`select label from event where session_id = ${sessionId} and label is not null`
    expect(before.length).toBeGreaterThan(0)

    await setupPage.goto('/settings')
    await setupPage.getByRole('button', { name: 'Forget what you know about me' }).click()
    await setupPage.getByRole('button', { name: 'Yes, forget it' }).click()
    await expect(setupPage.getByText('Done — the record above is gone.')).toBeVisible()

    // event.label cleared, but the event (and the session it belongs to) survives.
    const after = await db()`select label from event where session_id = ${sessionId}`
    expect(after.length).toBeGreaterThan(0)
    expect(after.every((r) => r.label === null)).toBe(true)
    const session = await db()`select id from session where id = ${sessionId}`
    expect(session).toHaveLength(1)

    // The device learns the new forgetAt on its next pull and purges the old path entry.
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect
      .poll(
        async () => {
          const { pathLog } = await sw.evaluate(() => chrome.storage.local.get('pathLog'))
          return pathLog
        },
        { timeout: 10_000 },
      )
      .toEqual([])
  })
})

test.describe('settings — delete my account', () => {
  test('leaves no rows for that user in any app table, and lands on /', async ({ context, extensionId, freshAccount }) => {
    const page = await context.newPage()
    await freshAccount(page)
    const { deviceId } = await pairAndStart(page, extensionId)

    const sessionId: string = await page.evaluate(
      () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
    )
    await expect
      .poll(async () => (await page.request.get(`/api/sessions/${sessionId}/review`)).status(), { timeout: 10_000 })
      .toBe(200)
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

    const [device] = await db()`select user_id from device where id = ${deviceId}`
    const userId: string = device.user_id

    // judgment has no user_id column (it's reached only through session_id) — seed one
    // directly so this test actually exercises the judgment -> session delete ordering
    // app/api/me/route.ts depends on (judgment -> analysis is NO ACTION), rather than
    // trivially passing because no judgment row ever existed for this fresh account.
    await db()`
      insert into judgment (session_id, domain, label, source, at)
      values (${sessionId}, 'example.com', 'work', 'own', now())`

    const before = await db()`select 1 from judgment where session_id = ${sessionId}`
    expect(before).toHaveLength(1)

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Delete account' }).click()
    await page.getByRole('button', { name: 'Yes, permanently delete my account' }).click()
    await page.waitForURL('**/')

    const judgmentAfter = await db()`select 1 from judgment where session_id = ${sessionId}`
    expect(judgmentAfter).toHaveLength(0)

    // Table names are a fixed local list, never user input — sql.query() takes them as
    // plain string interpolation because identifiers can't be bound params ($1, $2, ...).
    for (const table of ['session', 'device', 'memory', 'pairing_code', 'analysis', 'inference_call']) {
      const rows = await db().query(`select 1 from ${table} where user_id = $1`, [userId])
      expect(rows, `${table} still has a row for the deleted user`).toHaveLength(0)
    }
  })
})
