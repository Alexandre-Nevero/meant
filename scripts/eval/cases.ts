/** Reads eval/judge-cases.json (ADR-0085) into the exact rows the production route reads —
 *  SessionRow, EventRow, PathEntry — so the eval goes through the real buildCases, not a
 *  copy of it. Pure: no fs, no network. */
import type { SessionRow, EventRow, PathEntry } from '../../lib/judge/corpus.ts'

export type EvalLabel = 'focused' | 'supportive' | 'neutral' | 'drift' | 'unknown'
export type EvalVisit = { host: string; seconds: number; paths: string[]; label: EvalLabel; reason: string }
export type EvalSession = {
  id: string
  intention: string
  outcome: 'yes' | 'no'
  localHour: number
  workSites: string[]
  blockedDomains: string[]
  visits: EvalVisit[]
}
export type EvalSet = { sessions: EvalSession[] }
export type Truth = { sessionId: string; host: string; label: EvalLabel }

export const EVAL_LABELS: EvalLabel[] = ['focused', 'supportive', 'neutral', 'drift', 'unknown']

/** Throws on the first thing that would make a row unscoreable. */
export function validateSet(set: EvalSet): void {
  const ids = new Set<string>()
  for (const s of set.sessions) {
    if (ids.has(s.id)) throw new Error(`session ${s.id} appears twice`)
    ids.add(s.id)
    if (!s.intention || (s.outcome !== 'yes' && s.outcome !== 'no')) throw new Error(`session ${s.id} is not judgeable`)
    const hosts = new Set<string>()
    for (const v of s.visits) {
      // buildCases merges a session's visits by host, so one host is one scored row.
      if (hosts.has(v.host)) throw new Error(`session ${s.id} repeats ${v.host}`)
      hosts.add(v.host)
      if (!EVAL_LABELS.includes(v.label)) throw new Error(`${s.id} ${v.host}: label ${v.label} is not in the vocabulary`)
      if (!v.reason || !v.reason.trim()) throw new Error(`${s.id} ${v.host}: no reason`)
      if (!(v.seconds > 0)) throw new Error(`${s.id} ${v.host}: no dwell`)
    }
  }
}

const DAY = 86_400_000
const BASE = Date.parse('2026-08-03T00:00:00Z')

export function toInputs(set: EvalSet): { sessions: SessionRow[]; events: EventRow[]; paths: PathEntry[]; truth: Truth[] } {
  const sessions: SessionRow[] = []
  const events: EventRow[] = []
  const paths: PathEntry[] = []
  const truth: Truth[] = []

  set.sessions.forEach((s, i) => {
    const start = BASE + i * DAY + s.localHour * 3_600_000
    sessions.push({
      id: s.id,
      intention: s.intention,
      outcome: s.outcome,
      started_at: new Date(start).toISOString(),
      started_at_local_hour: s.localHour,
      work_sites: s.workSites,
      blocked_domains: s.blockedDomains,
    })
    let at = start
    for (const v of s.visits) {
      events.push({ session_id: s.id, kind: 'attention', domain: v.host, seconds: v.seconds, at: new Date(at).toISOString() })
      v.paths.forEach((path, j) => paths.push({ sessionId: s.id, host: v.host, path, at: at + j * 1000 }))
      truth.push({ sessionId: s.id, host: v.host, label: v.label })
      at += v.seconds * 1000
    }
  })

  return { sessions, events, paths, truth }
}
