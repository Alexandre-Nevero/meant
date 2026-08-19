import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.startedAt !== 'string') {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  const intention = typeof body.intention === 'string' ? body.intention : ''
  const plannedMinutes = Number.isInteger(body.plannedMinutes) ? body.plannedMinutes : null
  const blocklist = Array.isArray(body.blocklist) ? body.blocklist.map(String) : []

  const [session] = await sql`
    insert into session (user_id, device_id, intention, planned_minutes, blocklist, started_at)
    values (${device.user_id}, ${device.id}, ${intention}, ${plannedMinutes}, ${blocklist}, ${body.startedAt})
    returning id`

  return Response.json({ sessionId: session.id })
}
