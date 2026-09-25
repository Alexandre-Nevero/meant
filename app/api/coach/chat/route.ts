import { currentUserId } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { type EventRow } from '@/lib/dashboard-figures'
import { buildCoachContext } from '@/lib/coach-context'
import { buildCoachMessages, type ChatTurn } from '@/lib/coach-prompt'
import { costOf } from '@/lib/inference-cost'
import { DAILY_COACH_TURNS } from '@/lib/thresholds'
import { getFeatureSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// ADR-0079, corrected by ADR-0080: the judge also uses openai/gpt-oss-120b (the spike's
// measured winner), not a cheaper tier as first assumed here. The two features cannot
// collide on DAILY_COACH_TURNS regardless: this query's session_ids = '{}' filter only
// ever matches coach turns, never a judge analysis (which always covers real sessions).
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

  // ADR-0087, issue #19. The seam has to be exercised at the boundary that actually spends
  // money, not just hidden in the UI that calls it.
  const { coach } = await getFeatureSettings(userId)
  if (!coach) {
    return Response.json({ error: 'the coach is turned off in Settings' }, { status: 403 })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    // Never a fabricated reply: an unconfigured server says so, rather than inventing
    // coaching advice with no model behind it.
    return Response.json({ reply: 'The coach is not configured yet — no API key set.', stats: null })
  }

  // Everything past this point touches the database or the network. Any failure here must
  // still return the {reply, stats} contract the client relies on — an uncaught throw would
  // fall through to Next's generic error response, breaking that contract on a path no test
  // enumerates. Caught errors are never logged by message/body — same rule as the Groq HTTP
  // branch below (ADR-0072): an error's content can echo query or request data.
  try {
    const turnsToday = (await sql`
      select count(*) from inference_call
       where user_id = ${userId}
         and model = ${COACH_MODEL}
         and session_ids = '{}'
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

    // If this throws, the call was already made (and billed) but never recorded. Accepted:
    // logging the reply here to retry the insert would violate the never-log-content rule,
    // and the alternative (record cost before confirming success) risks charging quota for a
    // call that never returned a reply. Rare either way; caught below either way.
    await sql`
      insert into inference_call (user_id, session_ids, model, input_tokens, output_tokens, cost_usd)
      values (
        ${userId}, '{}', ${COACH_MODEL}, ${inputTokens}, ${outputTokens},
        ${costOf({ model: COACH_MODEL, inputTokens, outputTokens })}
      )`

    return Response.json({ reply, stats: context })
  } catch (err) {
    // Log only the error's name/type, never its message — a DB or parse error's message can
    // carry query text or response content, which is exactly what ADR-0072 forbids logging.
    console.error(`coach: unexpected ${err instanceof Error ? err.name : typeof err}`)
    return Response.json({ reply: "I couldn't reach the coach just now — try again in a moment.", stats: null })
  }
}
