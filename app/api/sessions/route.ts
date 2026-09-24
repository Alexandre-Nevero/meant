import { deviceFromRequest } from '@/lib/device-auth'
import { UUID as UUID_RE } from '@/lib/review-data'
import { sql } from '@/lib/db'
import { normalizeStartPayload } from '@/lib/session-payload'

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
  // ADR-0035's three questions reach the database here or nowhere. Before 2026-09-15 this
  // route inserted seven columns and silently dropped workSites/blockedDomains/cycle, which
  // the extension had been posting since round 6 — work_sites was non-empty in 0 of 3,668 rows.
  const p = normalizeStartPayload(body)

  // Idempotent: a replayed queued start (offline retry) must not overwrite an ended_at
  // that a later PATCH already wrote, so conflicts do nothing rather than update.
  await sql`
    insert into session (
      id, user_id, device_id, intention, planned_minutes, blocklist, started_at,
      work_sites, blocked_domains, cycle_work_min, cycle_break_min, started_at_local_hour, block_id)
    values (
      ${body.id}, ${device.user_id}, ${device.id}, ${p.intention}, ${p.plannedMinutes},
      ${p.blocklist}, ${body.startedAt},
      ${p.workSites}, ${p.blockedDomains}, ${p.cycleWorkMin}, ${p.cycleBreakMin}, ${p.localHour}, ${p.blockId})
    on conflict (id) do nothing`

  return Response.json({ sessionId: body.id })
}
