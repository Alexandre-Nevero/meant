import { deviceFromRequest } from '@/lib/device-auth'
import { UUID as UUID_RE } from '@/lib/review-data'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.startedAt !== 'string') {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  // Client-supplied (extension mints it locally, offline-first) and therefore untrusted.
  if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  const intention = typeof body.intention === 'string' ? body.intention : ''
  const plannedMinutes = Number.isInteger(body.plannedMinutes) ? body.plannedMinutes : null
  const blocklist = Array.isArray(body.blocklist) ? body.blocklist.map(String) : []

  // Idempotent: a replayed queued start (offline retry) must not overwrite an ended_at
  // that a later PATCH already wrote, so conflicts do nothing rather than update.
  await sql`
    insert into session (id, user_id, device_id, intention, planned_minutes, blocklist, started_at)
    values (${body.id}, ${device.user_id}, ${device.id}, ${intention}, ${plannedMinutes}, ${blocklist}, ${body.startedAt})
    on conflict (id) do nothing`

  return Response.json({ sessionId: body.id })
}
