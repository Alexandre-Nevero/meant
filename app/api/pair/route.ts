import { auth } from '@/lib/auth/server'
import { sql } from '@/lib/db'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// 256 % 32 === 0, so the modulo is unbiased.
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export async function POST() {
  const { data: session } = await auth.getSession()
  const userId = session?.user?.id
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  for (let i = 0; i < 3; i++) {
    const rows = await sql`
      insert into pairing_code (code, user_id, expires_at)
      values (${newCode()}, ${userId}, now() + interval '10 minutes')
      on conflict (code) do nothing
      returning code, expires_at`
    if (rows.length) {
      return Response.json({ code: rows[0].code, expiresAt: rows[0].expires_at })
    }
  }
  return Response.json({ error: 'could not mint a code' }, { status: 500 })
}
