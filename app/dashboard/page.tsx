import { currentUserId } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import { toBand } from '@/lib/band'
import { toWords } from '@/lib/words'
import { Band } from '../band'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const userId = await currentUserId()
  if (!userId) redirect('/')

  const sessions = await sql`
    select s.id, s.intention, s.ended_at, s.outcome,
           coalesce(
             (select json_agg(json_build_object('kind', e.kind, 'domain', e.domain, 'seconds', e.seconds))
                from event e where e.session_id = s.id),
             '[]'
           ) as events
      from session s
     where s.user_id = ${userId}
     order by s.started_at desc
     limit 50`

  if (sessions.length === 0) {
    return (
      <div className="m-empty" data-surface="ledger">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
        <Link className="m-meta" href="/setup">Set up your sites</Link>
      </div>
    )
  }

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session
    where user_id = ${userId} and started_at >= date_trunc('month', now())`

  return (
    <div data-surface="ledger">
      <h1 className="m-rate">
        {toWords(counts.answered)} this month. {toWords(counts.finished)} finished.
      </h1>
      <Link className="m-meta" href="/setup">Set up your sites</Link>

      {sessions.map((s) => (
        <div className="m-row" key={s.id}>
          {s.intention ? (
            <Link className="m-sentence" href={`/review/${s.id}`}>
              {s.intention}
            </Link>
          ) : (
            <Link className="m-meta" href={`/review/${s.id}`}>
              No intention given
            </Link>
          )}
          <Band segments={toBand(s.events as Parameters<typeof toBand>[0])} state={s.ended_at ? 'ended' : 'running'} />
          <p className="m-meta" style={{ color: s.outcome === 'unanswered' ? undefined : 'var(--m-ink)' }}>
            {s.outcome === 'yes' ? 'Yes' : s.outcome === 'no' ? 'Not yet' : 'Unanswered'}
          </p>
        </div>
      ))}
    </div>
  )
}
