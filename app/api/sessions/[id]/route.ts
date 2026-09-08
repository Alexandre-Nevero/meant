import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

const END_REASONS = ['stopped', 'elapsed', 'superseded', 'recovered']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  // D34: the sentence, inside the grace window, on a still-open session.
  if (typeof body.intention === 'string') {
    const updated = await sql`
      update session set intention = ${body.intention}
       where id = ${id} and device_id = ${device.id} and user_id = ${device.user_id}
         and ended_at is null
       returning id`
    if (updated.length === 0) return Response.json({ error: 'not found' }, { status: 404 })
    return Response.json({ ok: true })
  }

  if (typeof body.endedAt === 'string' && END_REASONS.includes(body.endReason)) {
    const updated = await sql`
      update session set ended_at = ${body.endedAt}, end_reason = ${body.endReason}
       where id = ${id} and device_id = ${device.id} and user_id = ${device.user_id}
         and ended_at is null
       returning id`
    if (updated.length === 0) return Response.json({ error: 'not found' }, { status: 404 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'bad request' }, { status: 400 })
}
