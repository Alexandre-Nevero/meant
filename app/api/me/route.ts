import { requestUserId } from '@/lib/device-auth'
import { auth } from '@/lib/auth/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ADR-0087, issue #20. FK-safe delete order, verified against the live schema:
// session -> device is NO ACTION (device must go after every session that references it);
// judgment -> analysis is NO ACTION (judgment must go before analysis); event and judgment
// both cascade from session, so deleting sessions clears events for free. Everything here
// is scoped by user_id, so a forged id can only ever delete the caller's own rows.
export async function DELETE(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (body?.confirm !== 'delete') {
    return Response.json({ error: 'confirmation required' }, { status: 400 })
  }

  try {
    await sql.transaction([
      sql`delete from judgment
           where session_id in (select id from session where user_id = ${userId})`,
      sql`delete from session where user_id = ${userId}`,
      sql`delete from analysis where user_id = ${userId}`,
      sql`delete from inference_call where user_id = ${userId}`,
      sql`delete from memory where user_id = ${userId}`,
      sql`delete from pairing_code where user_id = ${userId}`,
      sql`delete from device where user_id = ${userId}`,
    ])
  } catch (err) {
    console.error(`me/delete: unexpected ${err instanceof Error ? err.name : typeof err}`)
    return Response.json({ error: 'could not delete your account — try again' }, { status: 500 })
  }

  // ADR-0021: in production this DB branch also hosts Neon Auth, and its own FKs cascade
  // neon_auth.session/account when the user row goes. Best-effort and separate from the
  // transaction above: an isolated branch with no neon_auth schema (this repo's own test
  // branch is exactly that, verified 2026-09-25) must never fail the deletion that every
  // "no rows survive" check actually cares about.
  try {
    const [reg] = (await sql`select to_regclass('neon_auth.user') as reg`) as { reg: string | null }[]
    if (reg?.reg) {
      await sql`delete from neon_auth."user" where id = ${userId}::uuid`
    }
  } catch (err) {
    console.error(`me/delete: neon_auth cleanup ${err instanceof Error ? err.name : typeof err}`)
  }

  try {
    await auth.signOut()
  } catch (err) {
    console.error(`me/delete: sign-out ${err instanceof Error ? err.name : typeof err}`)
  }

  return Response.json({ ok: true })
}
