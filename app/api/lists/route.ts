import { requestUserId } from '@/lib/device-auth'
import { normalizeDomain } from '@/lib/domains'
import { sql } from '@/lib/db'

// deviceFromRequest reads the raw Request's own headers, not next/headers()'s
// cookies()/headers() — the APIs Next's static analysis actually watches for to mark a
// route dynamic. Without this, GET can be treated as cacheable, serving a stale
// unauthorized/authorized verdict for a token that was just revoked or just paired.
export const dynamic = 'force-dynamic'

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const domains = input
    .filter((d): d is string => typeof d === 'string')
    .map(normalizeDomain)
    .filter((d): d is string => d !== null)
  return [...new Set(domains)]
}

export async function GET(req: Request) {
  const userId = await requestUserId(req)
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
  const userId = await requestUserId(req)
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
