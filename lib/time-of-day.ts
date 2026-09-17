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

export function contrastByPartOfDay(rows: PartOfDayRow[]): PartOfDayContrast | null {
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

  const withBothArms = [...byPart.entries()].filter(([, e]) => e.yes > 0 && e.no > 0)
  if (withBothArms.length === 0) return null

  // Widest gap in EITHER direction: a part of day you rarely finish in is as informative as one
  // you usually do.
  const [part, e] = withBothArms.sort(
    (a, b) => Math.abs(b[1].yes - b[1].no) - Math.abs(a[1].yes - a[1].no),
  )[0]

  // The evidence is the named part's own sessions, not every answered session. Counting the
  // whole day would clear the I6 gate on hours this sentence never mentions — the same
  // inflation the domain contrast's per-session fold exists to prevent.
  return { part, finished: e.yes, unfinished: e.no, sessions: e.yes + e.no }
}
