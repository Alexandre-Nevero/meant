import { sql } from '@/lib/db'
import { EXTENSION_ID_SHAPE } from '@/lib/band'
import { computeUnrecorded } from '@/lib/session-time'

export type ReviewRow = { kind: string; domain: string | null; seconds: number; hits: number }
export type ReviewData = {
  intention: string | null
  outcome: 'yes' | 'no' | 'unanswered'
  endedAt: string | null
  rows: ReviewRow[]
  topAttention: { domain: string; seconds: number }[]
  awaySeconds: number
  blockedAttempts: number
  finished: number
  answered: number
  /** Wall clock minus attention, away and break. ADR-0054: say what we did not see. */
  unrecordedSeconds: number
  /** ADR-0084. Time this task sat parked while another task in its session was active. */
  pausedSeconds: number
  /** ADR-0084. The other tasks in this row's session, if it held more than one. */
  siblings: { id: string; intention: string; outcome: string }[]
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getReviewData(sessionId: string, userId: string): Promise<ReviewData | null> {
  if (!UUID.test(sessionId)) return null

  const [session] = await sql`
    select id, intention, outcome, started_at, ended_at, block_id
      from session where id = ${sessionId} and user_id = ${userId}`
  if (!session) return null

  const rows = (await sql`
    select kind, domain, coalesce(sum(seconds), 0)::int as seconds, count(*)::int as hits
      from event where session_id = ${sessionId}
     group by kind, domain
     order by seconds desc`) as ReviewRow[]

  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .slice(0, 3)
    .map((r) => ({ domain: r.domain as string, seconds: r.seconds }))
  const awaySeconds = rows
    .filter((r) => r.kind === 'away')
    .reduce((total, r) => total + r.seconds, 0)
  const blockedAttempts = rows
    .filter((r) => r.kind === 'block_hit')
    .reduce((total, r) => total + r.hits, 0)

  const pausedSeconds = rows
    .filter((r) => r.kind === 'paused')
    .reduce((total, r) => total + r.seconds, 0)
  // user_id on this query too: block_id is client-supplied (ADR-0084), so it may only ever
  // group the caller's own rows.
  const siblings = session.block_id
    ? ((await sql`
        select id, intention, outcome from session
         where user_id = ${userId} and block_id = ${session.block_id} and id <> ${sessionId}
         order by id`) as { id: string; intention: string; outcome: string }[])
    : []

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session where user_id = ${userId}`

  return {
    intention: session.intention,
    outcome: session.outcome,
    endedAt: session.ended_at,
    rows,
    topAttention,
    awaySeconds,
    blockedAttempts,
    finished: counts.finished,
    answered: counts.answered,
    unrecordedSeconds: computeUnrecorded(session.started_at, session.ended_at, rows),
    pausedSeconds,
    siblings,
  }
}
