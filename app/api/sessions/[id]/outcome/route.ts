import { requestUserId } from '@/lib/device-auth'
import { UUID } from '@/lib/review-data'
import { sql } from '@/lib/db'

// See app/api/lists/route.ts for why this is force-dynamic and why the device token
// is tried before the Clerk session cookie — the popup now answers this question too,
// not just the web /review page.
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requestUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (body?.outcome !== 'yes' && body?.outcome !== 'no') {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const updated = await sql`
    update session set outcome = ${body.outcome}, answered_at = now()
     where id = ${id} and user_id = ${userId}
     returning id`
  if (updated.length === 0) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json({ ok: true })
}
