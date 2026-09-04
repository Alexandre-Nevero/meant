import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

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
