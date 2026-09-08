import { createHash } from 'node:crypto'
import { sql } from '@/lib/db'
import { currentUserId } from '@/lib/auth/session'

export async function deviceFromRequest(req: Request) {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const hash = createHash('sha256').update(header.slice(7)).digest('hex')
  const [device] = await sql`
    select id, user_id from device where token_hash = ${hash} and revoked_at is null`
  return device ?? null
}

// The extension (device token) and the web app (session cookie) both need this — try
// the device token first since that's the unambiguous, stateless check, and fall back
// to the browser's session cookie only when there isn't one.
export async function requestUserId(req: Request): Promise<string | null> {
  const device = await deviceFromRequest(req)
  if (device) return device.user_id
  return currentUserId()
}
