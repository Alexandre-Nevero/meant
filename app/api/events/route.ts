import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'
import { tally, classify, EMPTY_TALLY, type Tally } from '@/lib/memory-accumulate'
import { LABELS, normalizeLabel } from '@/lib/label-vocabulary'
import { MEMORY_MIN_EVIDENCE, MEMORY_MIN_AGREEMENT, MEMORY_MIN_VERDICTS } from '@/lib/thresholds'

// 'label' is the companion's one-tap self-report (ADR-0058). It MUST be here: flush()
// batches all of a session's queued events into one POST, so a kind this list rejects
// fails the whole batch — and because nothing is then marked sent, every attention and
// away event for that session requeues and retries forever with the same payload.
const KINDS = ['attention', 'away', 'block_hit', 'label']

export async function POST(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const events = Array.isArray(body?.events) ? body.events : null
  if (!body || typeof body.sessionId !== 'string' || !events) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  for (const e of events) {
    if (!KINDS.includes(e?.kind)) return Response.json({ error: 'bad kind' }, { status: 400 })
    if (e.domain != null && (typeof e.domain !== 'string' || /[/?#]/.test(e.domain))) {
      return Response.json({ error: 'domain must be a hostname' }, { status: 400 })
    }
    if (typeof e.at !== 'string') return Response.json({ error: 'bad timestamp' }, { status: 400 })
    if (e.label != null) {
      const normalized = normalizeLabel(e.label)
      if (normalized === null) return Response.json({ error: 'bad label' }, { status: 400 })
      e.label = normalized
    }
  }

  const owned = await sql`
    select id from session where id = ${body.sessionId} and user_id = ${device.user_id}`
  if (owned.length === 0) return Response.json({ error: 'not found' }, { status: 404 })

  if (events.length > 0) {
    await sql`
      insert into event (session_id, kind, domain, seconds, at, label)
      select ${body.sessionId}::uuid, k, d, s, a, l
        from unnest(
          ${events.map((e: { kind: string }) => e.kind)}::text[],
          ${events.map((e: { domain?: string | null }) => e.domain ?? null)}::text[],
          ${events.map((e: { seconds?: number | null }) => e.seconds ?? null)}::int[],
          ${events.map((e: { at: string }) => e.at)}::timestamptz[],
          ${events.map((e: { label?: string | null }) => e.label ?? null)}::text[]
        ) as t(k, d, s, a, l)`
  }

  await accumulateMemory(device.user_id, events)

  return Response.json({ accepted: events.length })
}

/** ADR-0062. The companion's taps become a belief about a domain only once one RECURS.
 *
 *  Runs after the insert and never blocks it: a failure here must not lose the events, which
 *  are the user's own record. Memory is derived and can be rebuilt from event.label; the
 *  events cannot be rebuilt from anything. */
async function accumulateMemory(userId: string, events: { kind: string; domain?: string | null; label?: string | null; at: string }[]) {
  const byDomain = new Map<string, { labels: string[]; at: number }>()
  for (const e of events) {
    if (e.kind !== 'label' || !e.domain || !e.label) continue
    const entry = byDomain.get(e.domain) ?? { labels: [], at: 0 }
    entry.labels.push(e.label)
    entry.at = Math.max(entry.at, Date.parse(e.at) || 0)
    byDomain.set(e.domain, entry)
  }
  if (byDomain.size === 0) return

  const opts = {
    minEvidence: MEMORY_MIN_EVIDENCE,
    minAgreement: MEMORY_MIN_AGREEMENT,
    minVerdicts: MEMORY_MIN_VERDICTS,
  }
  for (const [domain, { labels, at }] of byDomain) {
    try {
      const [row] = await sql`
        select value from memory
         where user_id = ${userId} and kind = 'domain_class' and key = ${domain}`
      // 'tap': this path only ever handles kind === 'label', which is the companion's
      // one-tap self-report (ADR-0058). The judge writes verdicts through its own path.
      const next: Tally = tally(labels, at, 'tap', (row?.value as Tally) ?? EMPTY_TALLY)
      const verdict = classify(next, opts)

      if (verdict === null) {
        // A domain that BECOMES contested must lose its classification. A stale verdict on a
        // site whose meaning changed is worse than none — it is the Instagram case, memorised.
        await sql`
          delete from memory
           where user_id = ${userId} and kind = 'domain_class' and key = ${domain}`
        continue
      }

      await sql`
        insert into memory (user_id, kind, key, value, evidence_n, updated_at)
        values (${userId}, 'domain_class', ${domain}, ${JSON.stringify(next)}::jsonb, ${verdict.evidence_n}, now())
        on conflict (user_id, kind, key)
        do update set value = excluded.value, evidence_n = excluded.evidence_n, updated_at = now()`
    } catch (error) {
      // Derived data. Log and move on rather than failing the write the user's record depends on.
      console.error('accumulateMemory failed for', domain, error)
    }
  }
}
