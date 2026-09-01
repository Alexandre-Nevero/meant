import { auth } from '@/lib/auth/server'
import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { Answer } from './answer'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function minutes(seconds: number) {
  return Math.round(seconds / 60)
}

export const dynamic = 'force-dynamic'

export default async function Review({ params }: { params: Promise<{ sessionId: string }> }) {
  const { data: authSession } = await auth.getSession()
  const userId = authSession?.user?.id
  if (!userId) redirect('/')

  const { sessionId } = await params
  if (!UUID.test(sessionId)) notFound()

  const [session] = await sql`
    select id, intention, outcome, started_at, ended_at
      from session where id = ${sessionId} and user_id = ${userId}`
  if (!session) notFound()

  const rows = await sql`
    select kind, domain, coalesce(sum(seconds), 0)::int as seconds, count(*)::int as hits
      from event where session_id = ${sessionId}
     group by kind, domain
     order by seconds desc`

  const attention = rows.filter((r) => r.kind === 'attention' && r.domain)
  const awaySeconds = rows
    .filter((r) => r.kind === 'away')
    .reduce((total, r) => total + r.seconds, 0)
  const blocked = rows
    .filter((r) => r.kind === 'block_hit')
    .reduce((total, r) => total + r.hits, 0)

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session where user_id = ${userId}`

  return (
    <>
      <p className="m-mark" data-state="ended" />
      {session.intention ? (
        <>
          <p className="m-meta">You meant to</p>
          <p className="m-sentence">{session.intention}</p>
        </>
      ) : (
        <p className="m-meta">You didn&apos;t say what you meant to do.</p>
      )}

      {attention.map((row) => (
        <div className="m-row" key={row.domain}>
          <span className="m-row-domain">{row.domain}</span>
          <span className="m-row-bar" data-kind="attention" />
          <span className="m-row-figure">{minutes(row.seconds)} min</span>
        </div>
      ))}

      {awaySeconds > 0 && (
        <div className="m-row">
          <span className="m-row-domain">away</span>
          <span className="m-row-bar" data-kind="away" />
          <span className="m-row-figure">{minutes(awaySeconds)} min</span>
        </div>
      )}

      <p className="m-meta">off by {minutes(awaySeconds)} min</p>
      {blocked > 0 && <p className="m-meta">{blocked} blocked attempts</p>}

      {session.outcome === 'unanswered' ? (
        <>
          <p className="m-meta">Did you?</p>
          <Answer sessionId={session.id} />
        </>
      ) : (
        <p className="m-meta">
          {session.outcome === 'yes'
            ? `Good. That's ${counts.finished} of ${counts.answered}.`
            : 'Noted. It carries over.'}
        </p>
      )}
    </>
  )
}
