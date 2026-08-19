import { createHash } from 'node:crypto'
import { sql } from '@/lib/db'

export async function deviceFromRequest(req: Request) {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const hash = createHash('sha256').update(header.slice(7)).digest('hex')
  const [device] = await sql`select id, user_id from device where token_hash = ${hash}`
  return device ?? null
}
