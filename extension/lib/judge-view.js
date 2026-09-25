// "Try the judge" in the popup's outcome view: the pure part. The popup, not the web
// review, because the paths live only in the extension (ADR-0059) and ADR-0042 refused the
// trust boundary that would let a web page reach them.

/** ADR-0086. The judge failed ADR-0085's gate on the held-out test split (precision 0.733
 *  among rendered verdicts, bar 0.80), so nothing renders. This is the one switch. Turn it
 *  on only with a passing eval and its measured floor in lib/thresholds.ts, never alone. */
export const JUDGE_RENDERS = false

/** Mirrors lib/thresholds.ts — plain-JS extension code can't import TS. Pinned by a test. */
export const MAX_SESSIONS_PER_ANALYSIS = 20

const VERDICTS = ['focused', 'supportive', 'neutral', 'drift']

export function analysisIds(sessionIds) {
  return [...new Set(sessionIds)].slice(0, MAX_SESSIONS_PER_ANALYSIS)
}

/** The route keys an analysis by the sorted set of sessions it covers (ADR-0077). */
export function judgedKey(sessionIds) {
  return [...sessionIds].sort().join(',')
}

/** Absent means on: the settings switch writes `judgeEnabled: false` only to turn it off. */
export function shouldOffer({ renders = JUDGE_RENDERS, judgeEnabled }) {
  return renders === true && judgeEnabled !== false
}

/** One of: offline | cap | error | nothing | rows. `unknown` is below the floor and is not
 *  a verdict, so it never becomes a row (ADR-0037). */
export function readAnalysis(res) {
  if (res?.offline) return { kind: 'offline' }
  if (res?.status === 429) return { kind: 'cap' }
  if (!res?.ok || !Array.isArray(res.data?.verdicts)) return { kind: 'error' }
  const seen = new Set()
  const rows = []
  for (const v of res.data.verdicts) {
    if (!VERDICTS.includes(v?.label)) continue
    const key = `${v.sessionId}\u0000${v.host}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ sessionId: v.sessionId, host: v.host, label: v.label })
  }
  return rows.length === 0 ? { kind: 'nothing' } : { kind: 'rows', rows }
}

export function rowText(row) {
  return `${row.host} · ${row.label}`
}
