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

export type ContrastRow = { domain: string; seconds: number; outcome: string }
export type Contrast = {
  domain: string
  finishedAvgSeconds: number
  unfinishedAvgSeconds: number
  sessions: number
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

export function contrastByOutcome(rows: ContrastRow[]): Contrast[] {
  const byDomain = new Map<string, { yes: number[]; no: number[] }>()
  for (const row of rows) {
    // `unanswered` is not a third outcome to average — it is the absence of an answer.
    if (row.outcome !== 'yes' && row.outcome !== 'no') continue
    if (!row.domain || EXTENSION_ID_SHAPE.test(row.domain)) continue
    const entry = byDomain.get(row.domain) ?? { yes: [], no: [] }
    entry[row.outcome === 'yes' ? 'yes' : 'no'].push(row.seconds)
    byDomain.set(row.domain, entry)
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
    .sort(
      (a, b) =>
        Math.abs(b.unfinishedAvgSeconds - b.finishedAvgSeconds) -
        Math.abs(a.unfinishedAvgSeconds - a.finishedAvgSeconds),
    )
}
