import { sql } from '@/lib/db'
import { requestUserId } from '@/lib/device-auth'
import { buildCases, type EventRow, type SessionRow, type PathEntry } from '@/lib/judge/corpus'
import { JUDGE_MODEL, judgeRequestBody, parseVerdicts } from '@/lib/judge/request'
import { costOf } from '@/lib/inference-cost'
import {
  DAILY_ANALYSIS_CAP,
  MAX_SESSIONS_PER_ANALYSIS,
  PROVISIONAL_MIN_CONFIDENCE,
  MEMORY_MIN_EVIDENCE,
  MEMORY_MIN_AGREEMENT,
  MEMORY_MIN_VERDICTS,
} from '@/lib/thresholds'
import { tally, classify, upgradeTally, type Tally } from '@/lib/memory-accumulate'
import { getFeatureSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// ADR-0080: JUDGE_MODEL shares no rate limit with the coach despite the same model string —
// see the session_ids predicate below. The request itself lives in lib/judge/request.ts so the
// eval (ADR-0085) sends byte-for-byte what this route sends.

type Verdict = { sessionId: string; host: string; label: string; confidence: number }

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

// The driver returns timestamptz columns as real Date objects, not strings — buildCases'
// Date.parse(e.at) only worked on the spike's literal-string test fixtures by accident
// (Date.parse coerces a Date via toString(), which drops sub-second precision, so two
// events in the same second could order arbitrarily). Map explicitly rather than casting,
// so the value shape actually matches what EventRow/SessionRow claim.
function toEventRow(row: { session_id: string; kind: string; domain: string | null; seconds: number | null; at: unknown }): EventRow {
  return { ...row, at: row.at instanceof Date ? row.at.toISOString() : String(row.at) }
}
type RawSessionRow = Omit<SessionRow, 'started_at'> & { started_at: unknown }
function toSessionRow(row: RawSessionRow): SessionRow {
  return { ...row, started_at: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at) }
}

function apiLabel(v: { label: string; confidence: number }) {
  return v.confidence < PROVISIONAL_MIN_CONFIDENCE ? 'unknown' : v.label
}

export async function POST(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) {
    return Response.json({ error: 'not signed in' }, { status: 401 })
  }

  // ADR-0087, issue #19. The seam has to be exercised at the boundary that actually spends
  // money, not just hidden in the UI that calls it.
  const { judge } = await getFeatureSettings(userId)
  if (!judge) {
    return Response.json({ error: 'the judge is turned off in Settings' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const sessionIdsRaw = Array.isArray(body?.sessionIds) ? body.sessionIds : []
  // Lowercased before dedup/sort: Postgres canonicalises uuid to lowercase on cast, but
  // isUuid() is case-insensitive and JS string sort is not — an uppercase id would sort
  // differently than the same id lowercase, breaking both the dedup Set and the array
  // equality the idempotency check (ADR-0077) depends on.
  const requestedIds = [...new Set(sessionIdsRaw.filter(isUuid).map((s: string) => s.toLowerCase()))].sort()
  if (requestedIds.length === 0) {
    return Response.json({ error: 'no session ids given' }, { status: 400 })
  }
  if (requestedIds.length > MAX_SESSIONS_PER_ANALYSIS) {
    return Response.json({ error: `at most ${MAX_SESSIONS_PER_ANALYSIS} sessions per analysis` }, { status: 400 })
  }
  const paths = parsePaths(body?.paths)

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return Response.json({ error: 'the judge is not configured yet — no API key set' }, { status: 500 })
  }

  try {
    // Ownership check FIRST, before anything is keyed by session_ids: an analysis must be
    // identified by the sessions it actually covers (ADR-0077), never by what the caller
    // merely asked for. Silently excludes any id the caller doesn't own — never a 403 that
    // would confirm or deny whether it exists.
    const sessionRows = (await sql`
      select id, intention, outcome, started_at, started_at_local_hour, work_sites, blocked_domains
        from session
       where id = any(${requestedIds}) and user_id = ${userId}`) as unknown as (SessionRow & { started_at: unknown })[]
    if (sessionRows.length === 0) {
      return Response.json({ error: 'no matching sessions' }, { status: 404 })
    }
    const sessions = sessionRows.map(toSessionRow)
    const ownedIds = sessions.map((s) => s.id).sort()

    // ADR-0077: opening an already-analysed set returns the stored analysis, costs nothing,
    // and consumes no quota. Keyed by ownedIds (what was actually covered), matching what
    // both inserts below write.
    const [existing] = (await sql`
      select id from analysis where user_id = ${userId} and session_ids = ${ownedIds}`) as { id: string }[]
    if (existing) {
      const rows = (await sql`
        select session_id, domain, label, confidence from judgment where analysis_id = ${existing.id}`) as
        { session_id: string; domain: string; label: string; confidence: number }[]
      return Response.json({
        analysisId: existing.id,
        verdicts: rows.map((r) => ({ sessionId: r.session_id, host: r.domain, label: apiLabel(r), confidence: r.confidence })),
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

    const eventRows = (await sql`
      select e.session_id, e.kind, e.domain, e.seconds, e.at
        from event e
       where e.session_id = any(${ownedIds})`) as unknown as { session_id: string; kind: string; domain: string | null; seconds: number | null; at: unknown }[]
    const events = eventRows.map(toEventRow)

    const cases = buildCases(sessions, events, paths)
    if (cases.length === 0) {
      return Response.json({ error: 'nothing to analyze — no session here has both an intention and an answered outcome' }, { status: 400 })
    }

    const allVerdicts: Verdict[] = []
    let inputTokens = 0
    let outputTokens = 0

    for (const c of cases) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(judgeRequestBody(c)),
      })
      if (!res.ok) {
        // Never print the body: on some errors it echoes the request, which carries paths.
        console.error(`judge: HTTP ${res.status} ${res.statusText}`)
        continue
      }
      const data = await res.json()
      inputTokens += data.usage?.prompt_tokens ?? 0
      outputTokens += data.usage?.completion_tokens ?? 0
      const parsed = parseVerdicts(data.choices?.[0]?.message?.content)
      if (!parsed) continue
      for (const v of parsed) allVerdicts.push({ sessionId: c.sessionId, ...v })
    }

    // A total Groq failure (every call non-ok, or every response unparseable) must stay
    // retryable — writing an empty analysis row here would cache "no verdicts" permanently
    // against this exact session set, with no path back to a real attempt.
    if (allVerdicts.length === 0) {
      return Response.json({ error: 'the judge got no usable verdicts back — try again in a moment' }, { status: 502 })
    }

    // Recorded before the analysis/judgment rows: Groq has already been called and billed
    // at this point regardless of what happens next, so the spend must count toward
    // DAILY_ANALYSIS_CAP even if a later insert throws or loses the race below. If this
    // insert itself throws, the call was made but never recorded — rare, and accepted for
    // the same reason the coach route accepts the analogous gap.
    await sql`
      insert into inference_call (user_id, session_ids, model, input_tokens, output_tokens, cost_usd)
      values (
        ${userId}, ${ownedIds}, ${JUDGE_MODEL}, ${inputTokens}, ${outputTokens},
        ${costOf({ model: JUDGE_MODEL, inputTokens, outputTokens })}
      )`

    // Two near-simultaneous requests for the same session set can both reach here past the
    // idempotency check above. `do nothing` turns the loser's unique-index violation
    // (analysis_user_sessions_idx) into an empty result instead of an unhandled 23505 — the
    // loser then reads and returns the winner's already-committed verdicts below, rather
    // than writing a second analysis or double-counting into memory.
    const inserted = (await sql`
      insert into analysis (user_id, session_ids, model)
      values (${userId}, ${ownedIds}, ${JUDGE_MODEL})
      on conflict (user_id, session_ids) do nothing
      returning id`) as { id: string }[]

    if (inserted.length === 0) {
      const [winner] = (await sql`
        select id from analysis where user_id = ${userId} and session_ids = ${ownedIds}`) as { id: string }[]
      const rows = (await sql`
        select session_id, domain, label, confidence from judgment where analysis_id = ${winner.id}`) as
        { session_id: string; domain: string; label: string; confidence: number }[]
      return Response.json({
        analysisId: winner.id,
        verdicts: rows.map((r) => ({ sessionId: r.session_id, host: r.domain, label: apiLabel(r), confidence: r.confidence })),
      })
    }
    const analysisId = inserted[0].id

    for (const v of allVerdicts) {
      await sql`
        insert into judgment (session_id, domain, label, source, confidence, analysis_id, at)
        values (${v.sessionId}, ${v.host}, ${v.label}, 'judge', ${v.confidence}, ${analysisId}, now())`
    }

    // ADR-0078: the judge writes memory too, into the SEPARATE verdicts tally, never
    // overriding a tap. Filtered to PROVISIONAL_MIN_CONFIDENCE first — 006-verdict-taxonomy.sql
    // is explicit that below-floor output must never feed the tally that gates the judge's
    // own future classifications; judgment itself keeps the raw, unfiltered row regardless.
    // Same per-domain isolation as app/api/events/route.ts's accumulateMemory: memory is
    // derived and can be rebuilt, so one domain's failure must not fail the judgment rows
    // already written above.
    const byHost = new Map<string, string[]>()
    for (const v of allVerdicts) {
      if (v.confidence < PROVISIONAL_MIN_CONFIDENCE) continue
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

    return Response.json({
      analysisId,
      verdicts: allVerdicts.map((v) => ({ ...v, label: apiLabel(v) })),
    })
  } catch (err) {
    // Same rule as the coach: log only the error's name, never its message — a DB or parse
    // error's message can carry query text or response content.
    console.error(`judge: unexpected ${err instanceof Error ? err.name : typeof err}`)
    return Response.json({ error: 'analysis failed — try again in a moment' }, { status: 500 })
  }
}
