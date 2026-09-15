/** Turns repeated per-visit labels into a durable belief about a domain.
 *
 *  ADR-0062: the companion's tap writes the VISIT, never the site. Memory forms only when a
 *  label recurs, because PRD §1.2's defining case is a domain that means opposite things at
 *  different hours — Instagram at 4pm is the job, Instagram at 11am is avoidance. Memorising
 *  at n=1 would make the product confidently wrong about the exact case it exists for.
 *
 *  This NARROWS ADR-0037/D30, which said one-sided evidence resolves at n=1 and the 3/80%
 *  rule governs conflict only. That rule was written for a CORRECTION of a wrong flag, and
 *  ADR-0057 deleted the flag — there are no corrections left, so every label is volunteered,
 *  and the threshold governs all of them.
 *
 *  The tally shape is fixed by the schema: `002-drift.sql:32` specifies domain_class values as
 *  {work_n, distract_n, neutral_n, last_at}. Counts are stored rather than a verdict, so the
 *  evidence survives and a domain can lose its classification when its meaning changes.
 */
export type Label = 'work' | 'distract' | 'neutral'
export type Tally = { work_n: number; distract_n: number; neutral_n: number; last_at: number }

export const EMPTY_TALLY: Tally = { work_n: 0, distract_n: 0, neutral_n: 0, last_at: 0 }

const COLUMN: Record<Label, keyof Tally> = {
  work: 'work_n',
  distract: 'distract_n',
  neutral: 'neutral_n',
}

/** Folds new observations onto an existing tally. `unknown` is the ABSENCE of an observation,
 *  not a fourth class to disagree about, so it is dropped rather than counted. */
export function tally(observations: string[], at: number, prior: Tally = EMPTY_TALLY): Tally {
  const next: Tally = { ...prior, last_at: Math.max(prior.last_at, at) }
  for (const observation of observations) {
    const column = COLUMN[observation as Label]
    if (column && column !== 'last_at') next[column] = next[column] + 1
  }
  return next
}

/** The belief, or null when there is not enough evidence or too much disagreement.
 *
 *  null is meaningful and the caller must act on it: a domain that BECOMES contested has to
 *  lose its stored classification, because a stale verdict on a site whose meaning changed is
 *  worse than no verdict at all. */
export function classify(
  t: Tally,
  { minEvidence, minAgreement }: { minEvidence: number; minAgreement: number },
): { label: Label; confidence: number; evidence_n: number } | null {
  const counts: [Label, number][] = [
    ['work', t.work_n],
    ['distract', t.distract_n],
    ['neutral', t.neutral_n],
  ]
  const total = counts.reduce((sum, [, n]) => sum + n, 0)
  if (total < minEvidence) return null

  const [label, n] = counts.reduce((best, current) => (current[1] > best[1] ? current : best))
  const confidence = n / total
  if (confidence < minAgreement) return null
  return { label, confidence, evidence_n: total }
}
