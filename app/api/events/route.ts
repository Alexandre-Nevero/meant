import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

const KINDS = ['attention', 'away', 'block_hit']

export async function POST(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const events = Array.isArray(body?.events) ? body.events : null
  if (!body || typeof body.sessionId !== 'string' || !events) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  for (const e of events) {
    if (!KINDS.includes(e?.kind)) return Response.json({ error: 'bad kind' }, { status: 400 })
    if (e.domain != null && (typeof e.domain !== 'string' || /[/?#]/.test(e.domain))) {
      return Response.json({ error: 'domain must be a hostname' }, { status: 400 })
    }
    if (typeof e.at !== 'string') return Response.json({ error: 'bad timestamp' }, { status: 400 })
  }

  const owned = await sql`
    select id from session where id = ${body.sessionId} and user_id = ${device.user_id}`
  if (owned.length === 0) return Response.json({ error: 'not found' }, { status: 404 })

  if (events.length > 0) {
    await sql`
      insert into event (session_id, kind, domain, seconds, at)
      select ${body.sessionId}::uuid, k, d, s, a
        from unnest(
          ${events.map((e: { kind: string }) => e.kind)}::text[],
          ${events.map((e: { domain?: string | null }) => e.domain ?? null)}::text[],
          ${events.map((e: { seconds?: number | null }) => e.seconds ?? null)}::int[],
          ${events.map((e: { at: string }) => e.at)}::timestamptz[]
        ) as t(k, d, s, a)`
  }

  return Response.json({ accepted: events.length })
}
