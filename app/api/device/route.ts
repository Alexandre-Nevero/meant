import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'
import { getFeatureSettings, getForgetAt } from '@/lib/settings'

// ADR-0087. Same reasoning as app/api/lists/route.ts: deviceFromRequest reads the raw
// Request's own headers, which Next's static analysis does not watch — without this a GET
// could be served stale for a token just revoked or just paired.
export const dynamic = 'force-dynamic'

// ADR-0042 refused externally_connectable, so the extension can't be told about a settings
// change — it pulls. Device-token auth only (not requestUserId's session fallback): this
// route exists for the extension, which never has a browser session cookie.
export async function GET(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const [settings, forgetAt] = await Promise.all([
    getFeatureSettings(device.user_id),
    getForgetAt(device.user_id),
  ])
  return Response.json({ settings, forgetAt })
}

// Voluntary unpair: soft-revoke, not delete. `session.device_id` has no cascade —
// a hard delete would fail against any device that ever started a session, or
// worse, silently orphan the user's own history. Revoking just stops the token
// from authenticating; every past session stays exactly as it was.
// There is no server-side "list my devices" surface (I9), so this is scoped to
// "disconnect the device making the request" only.
export async function DELETE(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  await sql`update device set revoked_at = now() where id = ${device.id}`
  return Response.json({ ok: true })
}
