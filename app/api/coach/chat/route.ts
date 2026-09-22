import { currentUserId } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { type EventRow } from '@/lib/dashboard-figures'
import { buildCoachContext } from '@/lib/coach-context'
import { buildCoachMessages, type ChatTurn } from '@/lib/coach-prompt'
import { costOf } from '@/lib/inference-cost'
import { DAILY_COACH_TURNS } from '@/lib/thresholds'

export const dynamic = 'force-dynamic'

// ADR-0079. The larger tier over the judge's cheaper default: a conversational surface is
// judged on quality, and DAILY_COACH_TURNS already bounds the volume this runs at.
const COACH_MODEL = 'openai/gpt-oss-120b'

function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  const out: ChatTurn[] = []
  for (const m of value) {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const history = parseHistory(body?.messages)
  const intention = typeof body?.intention === 'string' ? body.intention.trim() : ''

  const userId = await currentUserId()
  if (!userId) {
    return Response.json({ error: 'not signed in' }, { status: 401 })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    // Never a fabricated reply: an unconfigured server says so, rather than inventing
    // coaching advice with no model behind it.
    return Response.json({ reply: 'The coach is not configured yet — no API key set.', stats: null })
  }

  const turnsToday = (await sql`
    select count(*) from inference_call
     where user_id = ${userId}
       and model = ${COACH_MODEL}
       and at >= date_trunc('day', now())`) as { count: string }[]

  if (Number(turnsToday[0]?.count ?? 0) >= DAILY_COACH_TURNS) {
    return Response.json({
      reply: `You've reached today's conversation limit (${DAILY_COACH_TURNS} turns). Your record is unaffected — come back tomorrow.`,
      stats: null,
    })
  }

  const monthSessions = (await sql`
    select outcome from session
     where user_id = ${userId}
       and started_at >= date_trunc('month', now())`) as { outcome: string | null }[]

  const eventRows = (await sql`
    select e.kind, e.domain, e.seconds, e.label
      from event e
      join session s on s.id = e.session_id
     where s.user_id = ${userId}
       and s.started_at >= date_trunc('month', now())`) as unknown as EventRow[]

  const context = buildCoachContext(monthSessions, eventRows)
  const messages = buildCoachMessages(context, intention, history)

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: COACH_MODEL, temperature: 0.4, messages }),
  })

  if (!res.ok) {
    // Never print the body: on some errors it echoes the request (ADR-0072).
    console.error(`coach: HTTP ${res.status} ${res.statusText}`)
    return Response.json({ reply: "I couldn't reach the coach just now — try again in a moment.", stats: null })
  }

  const data = await res.json()
  const reply: string =
    data.choices?.[0]?.message?.content?.trim() || "I don't have a reply for that — try rephrasing?"
  const inputTokens = data.usage?.prompt_tokens ?? 0
  const outputTokens = data.usage?.completion_tokens ?? 0

  await sql`
    insert into inference_call (user_id, session_ids, model, input_tokens, output_tokens, cost_usd)
    values (
      ${userId}, '{}', ${COACH_MODEL}, ${inputTokens}, ${outputTokens},
      ${costOf({ model: COACH_MODEL, inputTokens, outputTokens })}
    )`

  return Response.json({ reply, stats: context })
}
