/** ADR-0060: "Build the arithmetic before the judge." The sibling of attention-contrast.ts.
 *
 *  Rize's Focus Hub exists to answer "what time of day do I focus the best?" — this answers the
 *  version of that question this product can actually support: not "focus", which it does not
 *  measure, but the outcome answer, which is the most informative column in the schema.
 *
 *  ADR-0051 permits reasoning FROM the outcome answer; it forbids valence, not use.
 *
 *  THE HOUR MUST ALREADY BE LOCAL TO THE USER. This module takes `startedAtLocalHour`, not a
 *  timestamp, precisely so the timezone question cannot be answered by accident inside it — a
 *  UTC bucket would state a confident regularity about the person that is an artefact of server
 *  geography, which is exactly what ADR-0053 exists to prevent. */

export const PARTS = [
  { name: 'morning' as const, covers: (h: number) => h >= 5 && h < 12 },
  { name: 'afternoon' as const, covers: (h: number) => h >= 12 && h < 17 },
  { name: 'evening' as const, covers: (h: number) => h >= 17 && h < 22 },
  { name: 'night' as const, covers: (h: number) => h >= 22 || h < 5 },
]

export type PartName = (typeof PARTS)[number]['name']
export type PartOfDayRow = { startedAtLocalHour: number; outcome: string }
export type PartOfDayContrast = {
  part: PartName
  finished: number
  unfinished: number
  /** DISTINCT answered sessions IN `part` — the rows this claim actually rests on, which is
   *  what contrastByOutcome counts for its domain. The I6 evidence floor counts these. */
  sessions: number
}

/** EVERY qualifying part of day, widest gap first — not the single widest.
 *
 *  Returning one meant a thin bucket silently suppressed a thick qualifying one: morning
 *  8 yes / 6 no (14 answered) beside evening 1 yes / 5 no (6 answered) returned evening, whose
 *  six sessions are below the I6 floor, so the caller gated on evening and the sentence about
 *  mornings — which had fourteen sessions behind it — never rendered at all. Under ADR-0066 it
 *  also handed the single slot to the domain contrast on a claim that never had to compete.
 *
 *  The caller takes the first entry that clears `PATTERN_MIN_SESSIONS`, exactly as it does with
 *  contrastByOutcome. Ranking is this module's job; the evidence floor is the caller's. */
export function contrastByPartOfDay(rows: PartOfDayRow[]): PartOfDayContrast[] {
  const byPart = new Map<PartName, { yes: number; no: number }>()

  for (const row of rows) {
    // `unanswered` is the absence of an answer, not a third outcome to compare against.
    if (row.outcome !== 'yes' && row.outcome !== 'no') continue
    const hour = row.startedAtLocalHour
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
    const part = PARTS.find((p) => p.covers(hour))!.name
    const entry = byPart.get(part) ?? { yes: 0, no: 0 }
    entry[row.outcome === 'yes' ? 'yes' : 'no'] += 1
    byPart.set(part, entry)
  }

  return (
    [...byPart.entries()]
      // BOTH arms required. One arm is not a contrast, and stating one would be a pattern claim
      // from a single side — I6 as amended by ADR-0050.
      .filter(([, e]) => e.yes > 0 && e.no > 0)
      // The evidence is the named part's own sessions, not every answered session. Counting the
      // whole day would clear the I6 gate on hours this sentence never mentions — the same
      // inflation the domain contrast's per-session fold exists to prevent.
      .map(([part, e]) => ({ part, finished: e.yes, unfinished: e.no, sessions: e.yes + e.no }))
      .sort(
        (a, b) =>
          // Widest gap in EITHER direction: a part of day you rarely finish in is as informative
          // as one you usually do.
          Math.abs(b.unfinished - b.finished) - Math.abs(a.unfinished - a.finished) ||
          // Equal gaps used to fall back to Map insertion order, which is the order Postgres
          // happened to return rows in — and the query has no ORDER BY. The same six rows in two
          // orders produced `morning` and `evening`, so the sentence about the user could flip
          // between two page loads with no data change. ADR-0066 defined the tie BETWEEN claims;
          // this is the tie WITHIN one. PARTS declaration order settles it — earlier in the day
          // wins — because it is a property of this file rather than of the database.
          PARTS.findIndex((p) => p.name === a.part) - PARTS.findIndex((p) => p.name === b.part),
      )
  )
}
