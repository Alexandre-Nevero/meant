import { sql } from '@/lib/db'
import { requestUserId } from '@/lib/device-auth'
import { costOf } from '@/lib/inference-cost'
import { DAILY_PRESET_CLASSIFY_CAP } from '@/lib/thresholds'
import { CLASSIFY_MODEL, buildClassifyMessages, classifySchema, parseClassification } from '@/lib/preset-classify'

export const dynamic = 'force-dynamic'

// ADR-0083. Every non-401 answer is 200 { preset }: the popup treats null as "no preset" and
// carries on with the user's own list, so no failure here can block or delay a session.
export async function POST(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const intention = typeof body?.intention === 'string' ? body.intention.trim() : ''
  if (intention.length < 3) return Response.json({ preset: null })

  const key = process.env.GROQ_API_KEY
  if (!key) return Response.json({ preset: null })

  try {
    const today = (await sql`
      select count(*) from inference_call
       where user_id = ${userId}
         and model = ${CLASSIFY_MODEL}
         and at >= date_trunc('day', now())`) as { count: string }[]
    if (Number(today[0]?.count ?? 0) >= DAILY_PRESET_CLASSIFY_CAP) return Response.json({ preset: null })

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        temperature: 0,
        messages: buildClassifyMessages(intention),
        response_format: { type: 'json_schema', json_schema: classifySchema() },
      }),
    })
    if (!res.ok) {
      // Never print the body: an error can echo the request, which carries the intention.
      console.error(`presets: HTTP ${res.status} ${res.statusText}`)
      return Response.json({ preset: null })
    }
    const data = await res.json()
    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0
    // session_ids keeps its '{}' default: a classify call covers no session.
    await sql`
      insert into inference_call (user_id, model, input_tokens, output_tokens, cost_usd)
      values (${userId}, ${CLASSIFY_MODEL}, ${inputTokens}, ${outputTokens},
              ${costOf({ model: CLASSIFY_MODEL, inputTokens, outputTokens })})`
    return Response.json({ preset: parseClassification(data.choices?.[0]?.message?.content) })
  } catch (error) {
    console.error('presets: classify failed', error instanceof Error ? error.name : 'unknown')
    return Response.json({ preset: null })
  }
}
