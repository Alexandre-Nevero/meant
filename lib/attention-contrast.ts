import { EXTENSION_ID_SHAPE } from './band.ts'

/** ADR-0060: "Build the arithmetic before the judge."
 *
 *  The most useful sentence this product can say today costs nothing to produce:
 *
 *    "The sessions you finished averaged nine minutes on chatgpt.com.
 *     The ones you did not averaged thirty-one."
 *
 *  No model, no page text, no permission. ADR-0051 permits reasoning FROM the outcome answer
 *  (it forbids valence, not use), and `session.outcome` is the single most informative column
 *  in the schema.
 *
 *  It is also the baseline the batched judge has to beat. If a model cannot outperform
 *  averaging, it does not ship. */

/** One attention row. Several rows share a sessionId when a session returned to the same
 *  domain — which is the common case, and the reason sessionId is required here. */
export type ContrastRow = { domain: string; sessionId: string; seconds: number; outcome: string }
export type Contrast = {
  domain: string
  finishedAvgSeconds: number
  unfinishedAvgSeconds: number
  /** DISTINCT sessions, not event rows. The I6 evidence floor counts sessions. */
  sessions: number
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

export function contrastByOutcome(rows: ContrastRow[]): Contrast[] {
  // Fold to one total per (domain, session) FIRST. Without this both outputs are wrong, and
  // wrong in the direction that matters: `sessions` would count event rows, so the I6
  // evidence gate fires far too early — real data had 53 rows for chatgpt.com across 5
  // sessions, which would have stated a pattern on 5 sessions while reporting 53. And the
  // average would weight a fragmented session above a focused one with the same total time.
  const perSession = new Map<string, { domain: string; outcome: string; seconds: number }>()
  for (const row of rows) {
    // `unanswered` is not a third outcome to average — it is the absence of an answer.
    if (row.outcome !== 'yes' && row.outcome !== 'no') continue
    if (!row.domain || EXTENSION_ID_SHAPE.test(row.domain)) continue
    const key = `${row.domain}\u0000${row.sessionId}`
    const seen = perSession.get(key)
    if (seen) seen.seconds += row.seconds
    else perSession.set(key, { domain: row.domain, outcome: row.outcome, seconds: row.seconds })
  }

  const byDomain = new Map<string, { yes: number[]; no: number[] }>()
  for (const { domain, outcome, seconds } of perSession.values()) {
    const entry = byDomain.get(domain) ?? { yes: [], no: [] }
    entry[outcome === 'yes' ? 'yes' : 'no'].push(seconds)
    byDomain.set(domain, entry)
  }
  return [...byDomain.entries()]
    // BOTH arms required. One arm is not a contrast, and stating one would be a pattern claim
    // from a single side — I6 as amended by ADR-0050.
    .filter(([, e]) => e.yes.length > 0 && e.no.length > 0)
    .map(([domain, e]) => ({
      domain,
      finishedAvgSeconds: mean(e.yes),
      unfinishedAvgSeconds: mean(e.no),
      sessions: e.yes.length + e.no.length,
    }))
    // Largest gap first, in EITHER direction: more time during finished sessions is just as
    // informative as less — that is the shape of a tool that is working.
    //
    // The caller takes the first entry that clears the evidence floor, not this one: a thin
    // domain with a wide gap must not suppress a thick one that qualifies. Ranking is this
    // module's job; the floor is the caller's.
    .sort(
      (a, b) =>
        Math.abs(b.unfinishedAvgSeconds - b.finishedAvgSeconds) -
          Math.abs(a.unfinishedAvgSeconds - a.finishedAvgSeconds) ||
        // Two domains with equal gaps used to fall back to Map insertion order, which is the
        // order Postgres happened to return the event rows in — and that query has no ORDER BY,
        // so the sentence could name a different domain between two page loads with no data
        // change. Domain name settles it, by plain code-unit comparison rather than
        // localeCompare, so the answer does not depend on the runtime's ICU data.
        (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0),
    )
}
