import { deviceFromRequest } from '@/lib/device-auth'
import { currentUserId } from '@/lib/auth/session'
import { normalizeDomain } from '@/lib/domains'
import { sql } from '@/lib/db'

// The extension (device token) and the web app (session cookie) both need this route —
// try the device token first since that's the unambiguous, stateless check, and fall
// back to the browser's session cookie only when there isn't one.
async function resolveUserId(req: Request): Promise<string | null> {
  const device = await deviceFromRequest(req)
  if (device) return device.user_id
  return currentUserId()
}

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const domains = input
    .filter((d): d is string => typeof d === 'string')
    .map(normalizeDomain)
    .filter((d): d is string => d !== null)
  return [...new Set(domains)]
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const rows = await sql`
    select key, value from memory
     where user_id = ${userId} and kind = 'list' and key in ('work_sites', 'distract_sites')`

  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value?.domains ?? []]))
  return Response.json({
    workSites: byKey.work_sites ?? [],
    distractSites: byKey.distract_sites ?? [],
  })
}

export async function PUT(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const workSites = normalizeList(body.workSites)
  const distractSites = normalizeList(body.distractSites)

  await sql`
    insert into memory (user_id, kind, key, value)
    values
      (${userId}, 'list', 'work_sites', ${JSON.stringify({ domains: workSites })}),
      (${userId}, 'list', 'distract_sites', ${JSON.stringify({ domains: distractSites })})
    on conflict (user_id, kind, key) do update set value = excluded.value, updated_at = now()`

  return Response.json({ workSites, distractSites })
}
