import { requestUserId } from '@/lib/device-auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ADR-0087, issue #20, ADR-0059. "Forget what you know about me": clears everything the
// record has INFERRED about the user, but never the record of what they did. Session and
// event rows survive untouched except for event.label, which is itself an inference (the
// companion's one-tap self-report, ADR-0058) rather than an observation.
export async function POST(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  try {
    await sql.transaction([
      // Everything the record has learned, except the two kinds that are the user's own
      // configuration, not an inference about them: 'list' (work/distraction sites) and
      // 'setting' (feature switches, and forget_at itself, written right after this batch).
      sql`delete from memory where user_id = ${userId} and kind not in ('list', 'setting')`,
      // The companion's one-tap self-report (ADR-0058) is an inference the user volunteered
      // about themselves, not an observation — it goes, the event row (attention/away time)
      // it rode in on stays.
      sql`update event set label = null
           where session_id in (select id from session where user_id = ${userId})`,
      // judgment references analysis (NO ACTION) — must go first, in the same transaction,
      // or the analysis delete below fails against a row that still references it.
      sql`delete from judgment
           where session_id in (select id from session where user_id = ${userId})`,
      sql`delete from analysis where user_id = ${userId}`,
      // Recorded last, in the same transaction as the clears above: a forgetAt with no
      // corresponding clear (or vice versa) would be a broken promise either way.
      sql`insert into memory (user_id, kind, key, value)
          values (${userId}, 'setting', 'forget_at', ${JSON.stringify(new Date().toISOString())}::jsonb)
          on conflict (user_id, kind, key) do update set value = excluded.value, updated_at = now()`,
    ])
  } catch (err) {
    console.error(`me/forget: unexpected ${err instanceof Error ? err.name : typeof err}`)
    return Response.json({ error: 'could not forget — try again' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
