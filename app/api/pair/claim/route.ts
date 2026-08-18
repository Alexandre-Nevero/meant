import { createHash, randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : null
  if (!code) return Response.json({ error: 'bad request' }, { status: 400 })

  const claimed = await sql`
    update pairing_code set claimed_at = now()
     where code = ${code} and claimed_at is null and expires_at > now()
     returning user_id`
  if (claimed.length === 0) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const [device] = await sql`
    insert into device (user_id, token_hash)
    values (${claimed[0].user_id}, ${tokenHash})
    returning id`

  return Response.json({ deviceId: device.id, token })
}
