/** Builds the judge's input set, and nothing beyond it.
 *
 *  ADR-0061 fixes that set exactly: hostname, path, dwell, sequence, time of day, the
 *  declared work and distraction sites, and the outcome answer. No page text and no page
 *  title, ever — post-hoc they do not exist to read.
 *
 *  Pure on purpose: the database read lives in the route so this can be tested with no
 *  connection and no network. Relocated from scripts/spike/corpus.ts unchanged — this is
 *  that module's first real caller (ADR-0080), exactly as the judge spike's plan predicted.
 */
export type PathEntry = { sessionId: string; host: string; path: string; at: number }
export type EventRow = { session_id: string; kind: string; domain: string | null; seconds: number | null; at: string }
export type SessionRow = {
  id: string
  intention: string | null
  outcome: string | null
  started_at: string
  started_at_local_hour: number | null
  work_sites: string[]
  blocked_domains: string[]
}
export type Visit = {
  sessionId: string
  host: string
  paths: string[]
  seconds: number
  order: number
  declared: 'work' | 'distraction' | 'none'
}
export type Case = {
  sessionId: string
  intention: string
  outcome: 'yes' | 'no'
  localHour: number | null
  visits: Visit[]
}

/** Chrome extension IDs are 32 characters entirely within a-p. Copied from lib/band.ts
 *  rather than imported, because scripts/ must not depend on lib/ for a throwaway. */
const EXTENSION_ID_SHAPE = /^[a-p]{32}$/

export function buildCases(sessions: SessionRow[], events: EventRow[], paths: PathEntry[]): Case[] {
  const cases: Case[] = []

  for (const session of sessions) {
    // The judge judges against the sentence (ADR-0048), and ADR-0051 permits reasoning from
    // the outcome column. A case missing either cannot be scored, so it is not a case.
    if (!session.intention) continue
    if (session.outcome !== 'yes' && session.outcome !== 'no') continue

    const work = new Set(session.work_sites ?? [])
    const blocked = new Set(session.blocked_domains ?? [])

    // 'attention' only. 'away' is chrome.idle — the user was not at the machine (ADR-0034) —
    // and 'break' is declared by the cycle timer, never inferred. Neither is a visit.
    const byHost = new Map<string, { seconds: number; firstAt: number }>()
    for (const e of events) {
      if (e.session_id !== session.id) continue
      if (e.kind !== 'attention') continue
      if (!e.domain || EXTENSION_ID_SHAPE.test(e.domain)) continue
      const at = Date.parse(e.at) || 0
      const prior = byHost.get(e.domain)
      byHost.set(e.domain, {
        seconds: (prior?.seconds ?? 0) + (e.seconds ?? 0),
        firstAt: prior ? Math.min(prior.firstAt, at) : at,
      })
    }

    const pathsByHost = new Map<string, string[]>()
    for (const p of paths) {
      if (p.sessionId !== session.id) continue
      const list = pathsByHost.get(p.host) ?? []
      if (!list.includes(p.path)) list.push(p.path)
      pathsByHost.set(p.host, list)
    }

    const visits: Visit[] = [...byHost.entries()]
      .sort((a, b) => a[1].firstAt - b[1].firstAt)
      .map(([host, agg], order) => ({
        sessionId: session.id,
        host,
        paths: pathsByHost.get(host) ?? [],
        seconds: agg.seconds,
        order,
        // Marked, never resolved away: ADR-0035 answers the declared sites at session start
        // with no model, and the whole question of this spike is what the RESIDUAL is worth.
        declared: work.has(host) ? 'work' : blocked.has(host) ? 'distraction' : 'none',
      }))

    if (visits.length === 0) continue
    cases.push({
      sessionId: session.id,
      intention: session.intention,
      outcome: session.outcome,
      localHour: session.started_at_local_hour,
      visits,
    })
  }

  return cases
}
