import { sql } from '@/lib/db'
import { requestUserId } from '@/lib/device-auth'
import { buildCases, type EventRow, type SessionRow, type PathEntry } from '@/lib/judge/corpus'
import { LABELS, schemaFor, buildMessages } from '@/lib/judge/prompt'
import { costOf } from '@/lib/inference-cost'
import { DAILY_ANALYSIS_CAP, PROVISIONAL_MIN_CONFIDENCE, MEMORY_MIN_EVIDENCE, MEMORY_MIN_AGREEMENT, MEMORY_MIN_VERDICTS } from '@/lib/thresholds'
import { tally, classify, upgradeTally, type Tally } from '@/lib/memory-accumulate'

export const dynamic = 'force-dynamic'

// ADR-0080. Matches the judge spike's measured (synthetic) winner. Shares no rate limit with
// the coach despite the same model string — see the session_ids predicate below.
const JUDGE_MODEL = 'openai/gpt-oss-120b'

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function parsePaths(value: unknown): PathEntry[] {
  if (!Array.isArray(value)) return []
  const out: PathEntry[] = []
  for (const p of value) {
    if (
      p && typeof p.sessionId === 'string' && typeof p.host === 'string' &&
      typeof p.path === 'string' && typeof p.at === 'number'
    ) {
      out.push({ sessionId: p.sessionId, host: p.host, path: p.path, at: p.at })
    }
  }
  return out
}

export async function POST(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) {
    return Response.json({ error: 'not signed in' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const sessionIdsRaw = Array.isArray(body?.sessionIds) ? body.sessionIds : []
  const sessionIds = [...new Set(sessionIdsRaw.filter(isUuid))].sort()
  if (sessionIds.length === 0) {
    return Response.json({ error: 'no session ids given' }, { status: 400 })
  }
  const paths = parsePaths(body?.paths)

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return Response.json({ error: 'the judge is not configured yet — no API key set' }, { status: 500 })
  }

  try {
    // ADR-0077: opening an already-analysed set returns the stored analysis, costs nothing,
    // and consumes no quota. session_ids is sorted above and at insert time, so array
    // equality here is a genuine set comparison, not an order-sensitive coincidence.
    const [existing] = (await sql`
      select id from analysis where user_id = ${userId} and session_ids = ${sessionIds}`) as { id: string }[]
    if (existing) {
      const rows = (await sql`
        select session_id, domain, label, confidence from judgment where analysis_id = ${existing.id}`) as
        { session_id: string; domain: string; label: string; confidence: number }[]
      return Response.json({
        analysisId: existing.id,
        verdicts: rows.map((r) => ({
          sessionId: r.session_id,
          host: r.domain,
          label: r.confidence < PROVISIONAL_MIN_CONFIDENCE ? 'unknown' : r.label,
          confidence: r.confidence,
        })),
      })
    }

    // ADR-0080's rate-limit fix: session_ids <> '{}' is what makes this query count only
    // judge analyses, never a coach turn (which always writes session_ids = '{}').
    const analysesToday = (await sql`
      select count(*) from inference_call
       where user_id = ${userId}
         and model = ${JUDGE_MODEL}
         and session_ids <> '{}'
         and at >= date_trunc('day', now())`) as { count: string }[]
    if (Number(analysesToday[0]?.count ?? 0) >= DAILY_ANALYSIS_CAP) {
      return Response.json({ error: `daily analysis limit reached (${DAILY_ANALYSIS_CAP})` }, { status: 429 })
    }

    // Ownership check: a session id the caller does not own is silently excluded, never a
    // 403 that would confirm or deny whether it exists.
    const sessions = (await sql`
      select id, intention, outcome, started_at, started_at_local_hour, work_sites, blocked_domains
        from session
       where id = any(${sessionIds}) and user_id = ${userId}`) as unknown as SessionRow[]
    if (sessions.length === 0) {
      return Response.json({ error: 'no matching sessions' }, { status: 404 })
    }
    const ownedIds = sessions.map((s) => s.id).sort()

    const events = (await sql`
      select e.session_id, e.kind, e.domain, e.seconds, e.at
        from event e
       where e.session_id = any(${ownedIds})`) as unknown as EventRow[]

    const cases = buildCases(sessions, events, paths)
    if (cases.length === 0) {
      return Response.json({ error: 'nothing to analyze — no session here has both an intention and an answered outcome' }, { status: 400 })
    }

    const allVerdicts: { sessionId: string; host: string; label: string; confidence: number }[] = []
    let inputTokens = 0
    let outputTokens = 0

    for (const c of cases) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: JUDGE_MODEL,
          temperature: 0.1,
          messages: buildMessages(c),
          response_format: { type: 'json_schema', json_schema: schemaFor() },
        }),
      })
      if (!res.ok) {
        // Never print the body: on some errors it echoes the request, which carries paths.
        console.error(`judge: HTTP ${res.status} ${res.statusText}`)
        continue
      }
      const data = await res.json()
      inputTokens += data.usage?.prompt_tokens ?? 0
      outputTokens += data.usage?.completion_tokens ?? 0
      let parsed
      try {
        parsed = JSON.parse(data.choices[0].message.content)
      } catch {
        continue
      }
      for (const v of parsed.visits ?? []) {
        if (!LABELS.includes(v.label)) continue
        allVerdicts.push({ sessionId: c.sessionId, host: v.host, label: v.label, confidence: v.confidence })
      }
    }

    const [{ id: analysisId }] = (await sql`
      insert into analysis (user_id, session_ids, model)
      values (${userId}, ${sessionIds}, ${JUDGE_MODEL})
      returning id`) as { id: string }[]

    for (const v of allVerdicts) {
      await sql`
        insert into judgment (session_id, domain, label, source, confidence, analysis_id, at)
        values (${v.sessionId}, ${v.host}, ${v.label}, 'judge', ${v.confidence}, ${analysisId}, now())`
    }

    // ADR-0078: the judge writes memory too, into the SEPARATE verdicts tally, never
    // overriding a tap. One fold per host touched, using this batch's own verdicts as the
    // observations — the veto against a contrary tap lives in classify(), not here. Same
    // per-domain isolation as app/api/events/route.ts's accumulateMemory: memory is derived
    // and can be rebuilt, so one domain's failure must not fail the judgment rows already
    // written above.
    const byHost = new Map<string, string[]>()
    for (const v of allVerdicts) {
      const list = byHost.get(v.host) ?? []
      list.push(v.label)
      byHost.set(v.host, list)
    }
    const now = Date.now()
    const opts = { minEvidence: MEMORY_MIN_EVIDENCE, minAgreement: MEMORY_MIN_AGREEMENT, minVerdicts: MEMORY_MIN_VERDICTS }
    for (const [host, labels] of byHost) {
      try {
        const [row] = await sql`
          select value from memory where user_id = ${userId} and kind = 'domain_class' and key = ${host}`
        const prior = upgradeTally(row?.value)
        const next: Tally = tally(labels, now, 'verdict', prior)
        const verdict = classify(next, opts)

        if (verdict === null) {
          await sql`delete from memory where user_id = ${userId} and kind = 'domain_class' and key = ${host}`
          continue
        }

        await sql`
          insert into memory (user_id, kind, key, value, evidence_n, updated_at)
          values (${userId}, 'domain_class', ${host}, ${JSON.stringify(next)}::jsonb, ${verdict.evidence_n}, now())
          on conflict (user_id, kind, key)
          do update set value = excluded.value, evidence_n = excluded.evidence_n, updated_at = now()`
      } catch (error) {
        console.error('judge: accumulateMemory failed for a domain', error instanceof Error ? error.name : typeof error)
      }
    }

    await sql`
      insert into inference_call (user_id, session_ids, model, input_tokens, output_tokens, cost_usd)
      values (
        ${userId}, ${sessionIds}, ${JUDGE_MODEL}, ${inputTokens}, ${outputTokens},
        ${costOf({ model: JUDGE_MODEL, inputTokens, outputTokens })}
      )`

    return Response.json({
      analysisId,
      verdicts: allVerdicts.map((v) => ({
        ...v,
        label: v.confidence < PROVISIONAL_MIN_CONFIDENCE ? 'unknown' : v.label,
      })),
    })
  } catch (err) {
    // Same rule as the coach: log only the error's name, never its message — a DB or parse
    // error's message can carry query text or response content.
    console.error(`judge: unexpected ${err instanceof Error ? err.name : typeof err}`)
    return Response.json({ error: 'analysis failed — try again in a moment' }, { status: 500 })
  }
}
