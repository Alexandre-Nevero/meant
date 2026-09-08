import { sql } from '@/lib/db'
import { EXTENSION_ID_SHAPE } from '@/lib/band'

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
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getReviewData(sessionId: string, userId: string): Promise<ReviewData | null> {
  if (!UUID.test(sessionId)) return null

  const [session] = await sql`
    select id, intention, outcome, started_at, ended_at
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
  }
}
