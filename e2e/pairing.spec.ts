import { expect, request as pwRequest } from '@playwright/test'
import { test as base } from './fixtures'

// Case B — pairing, single-use codes, and the new voluntary-disconnect feature (this
// session's own addition) actually revoking the token server-side, not just locally.
//
// The device-token checks use a bare, cookie-free APIRequestContext (pwRequest.newContext),
// not page.request — page.request shares the signed-in page's session cookie, and
// /api/lists's resolveUserId() deliberately falls back to that cookie when the device
// token fails (dual-auth, by design). Testing via page.request would pass even with a
// revoked token, for the wrong reason: the session cookie, not the token, would be doing
// the authenticating. A first pass here failed exactly this way before the isolation fix.
base('pairing code is single-use, and disconnect actually revokes the device', async ({ context, freshAccount, baseURL }) => {
  const page = await context.newPage()
  await freshAccount(page)

  const mint = await page.request.post('/api/pair')
  expect(mint.ok()).toBeTruthy()
  const { code } = await mint.json()
  expect(code).toMatch(/^[A-Z0-9]{6}$/)

  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  expect(claim.ok()).toBeTruthy()
  const { token, deviceId } = await claim.json()
  expect(typeof token).toBe('string')
  expect(typeof deviceId).toBe('string')

  // Single-use: the same code again must fail, not silently mint a second device.
  const reclaim = await page.request.post('/api/pair/claim', { data: { code } })
  expect(reclaim.status()).toBe(401)

  // baseURL from the config, not a hardcoded :3000 — #18 moved this suite's server to 3100, and
  // :3000 is whatever dev server the developer happens to have running against .env.local.
  const deviceOnly = await pwRequest.newContext({ baseURL })

  // The device token authenticates independently of the session cookie.
  const listsBeforeRevoke = await deviceOnly.get('/api/lists', {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(listsBeforeRevoke.ok()).toBeTruthy()

  const disconnect = await deviceOnly.fetch('/api/device', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(disconnect.ok()).toBeTruthy()

  // The same token must now be rejected — confirms revoked_at gates deviceFromRequest,
  // not just something the client forgot locally.
  const listsAfterRevoke = await deviceOnly.get('/api/lists', {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(listsAfterRevoke.status()).toBe(401)
  await deviceOnly.dispose()
})
