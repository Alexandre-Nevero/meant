import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'

function durationMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) return null
  return Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
}

export default async function Dashboard() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const sessions = await sql`
    select s.id, s.intention, s.started_at, s.ended_at, s.outcome,
           (select e.domain from event e
             where e.session_id = s.id and e.kind = 'attention' and e.domain is not null
             group by e.domain order by sum(e.seconds) desc limit 1) as top_domain
      from session s
     where s.user_id = ${userId}
     order by s.started_at desc
     limit 50`

  if (sessions.length === 0) {
    return (
      <div className="m-empty">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
      </div>
    )
  }

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session where user_id = ${userId}`

  return (
    <>
      <p className="m-rate">{counts.finished} of {counts.answered} finished</p>

      {sessions.map((session) => {
        const minutes = durationMinutes(session.started_at, session.ended_at)
        return (
          <div className="m-row" key={session.id}>
            <p className="m-mark" data-state="ended" />
            {session.intention ? (
              <Link className="m-sentence" href={`/review/${session.id}`}>
                {session.intention}
              </Link>
            ) : (
              <Link className="m-meta" href={`/review/${session.id}`}>
                No intention given
              </Link>
            )}
            <span className="m-meta">{minutes == null ? 'running' : `${minutes} min`}</span>
            <span className="m-row-domain">{session.top_domain ?? '—'}</span>
            <span className="m-meta">
              {session.outcome === 'yes' ? 'Yes' : session.outcome === 'no' ? 'Not yet' : 'Unanswered'}
            </span>
          </div>
        )
      })}
    </>
  )
}
