/** Turns observations about a domain into a durable belief about it.
 *
 *  ADR-0062: the companion's tap writes the VISIT, never the site. Memory forms only when a
 *  label recurs, because PRD §1.2's defining case is a domain that means opposite things at
 *  different hours — Instagram at 4pm is the job, Instagram at 11am is avoidance.
 *
 *  ADR-0078 AMENDS ADR-0039/D32, which made taps the sole writer of memory. Under that rule
 *  memory could only learn as fast as the user labelled, which made the user tap and tap.
 *  The judge may now write too — but into a SEPARATE tally, never summed with the taps, so
 *  "the user told us" stays answerable forever. A weighted single integer would have thrown
 *  that away to save one field.
 *
 *  ADR-0076: the vocabulary is focused | supportive | neutral | drift. `unknown` is the
 *  judge's below-confidence floor and is the ABSENCE of an observation, not a fifth class to
 *  disagree about, so it is dropped rather than counted.
 */
export type Label = 'focused' | 'supportive' | 'neutral' | 'drift'
export type Source = 'tap' | 'verdict'
export type Counts = { focused_n: number; supportive_n: number; neutral_n: number; drift_n: number }
export type Tally = { taps: Counts; verdicts: Counts; last_at: number }

const EMPTY_COUNTS: Counts = { focused_n: 0, supportive_n: 0, neutral_n: 0, drift_n: 0 }
export const EMPTY_TALLY: Tally = { taps: EMPTY_COUNTS, verdicts: EMPTY_COUNTS, last_at: 0 }

const COLUMN: Record<Label, keyof Counts> = {
  focused: 'focused_n',
  supportive: 'supportive_n',
  neutral: 'neutral_n',
  drift: 'drift_n',
}

const total = (c: Counts) => c.focused_n + c.supportive_n + c.neutral_n + c.drift_n

const pairs = (c: Counts): [Label, number][] => [
  ['focused', c.focused_n],
  ['supportive', c.supportive_n],
  ['neutral', c.neutral_n],
  ['drift', c.drift_n],
]

/** Folds new observations from ONE source onto an existing tally. Returns a new object;
 *  never mutates, because the caller round-trips this through Postgres and a mutated
 *  reference would hide the write. */
export function tally(
  observations: string[],
  at: number,
  source: Source,
  prior: Tally = EMPTY_TALLY,
): Tally {
  const key = source === 'tap' ? 'taps' : 'verdicts'
  const next: Counts = { ...(prior[key] ?? EMPTY_COUNTS) }
  for (const observation of observations) {
    const column = COLUMN[observation as Label]
    if (column) next[column] = next[column] + 1
  }
  return {
    taps: key === 'taps' ? next : { ...(prior.taps ?? EMPTY_COUNTS) },
    verdicts: key === 'verdicts' ? next : { ...(prior.verdicts ?? EMPTY_COUNTS) },
    last_at: Math.max(prior.last_at ?? 0, at),
  }
}

function winner(c: Counts, minEvidence: number, minAgreement: number) {
  const n = total(c)
  if (n < minEvidence) return null
  const [label, count] = pairs(c).reduce((best, cur) => (cur[1] > best[1] ? cur : best))
  const confidence = count / n
  if (confidence < minAgreement) return null
  return { label, confidence, evidence_n: n }
}

/** The belief, or null when there is not enough evidence or too much disagreement.
 *
 *  null is meaningful and the caller must act on it: a domain that BECOMES contested has to
 *  lose its stored classification, because a stale verdict on a site whose meaning changed
 *  is worse than no verdict at all.
 *
 *  ADR-0078's resolution order, and the veto is the part that makes this safe to ship: a
 *  single contrary tap blocks the judge from classifying against the user, at n=1, while
 *  still not letting that one tap assert anything on its own (ADR-0062, unchanged). */
export function classify(
  t: Tally,
  { minEvidence, minAgreement, minVerdicts }: { minEvidence: number; minAgreement: number; minVerdicts: number },
): { label: Label; confidence: number; evidence_n: number; source: Source } | null {
  const taps = t.taps ?? EMPTY_COUNTS
  const fromTaps = winner(taps, minEvidence, minAgreement)
  if (fromTaps) return { ...fromTaps, source: 'tap' }

  const fromVerdicts = winner(t.verdicts ?? EMPTY_COUNTS, minVerdicts, minAgreement)
  if (!fromVerdicts) return null

  // The veto. Any tap on a DIFFERENT label means the user has said otherwise, and the user
  // is never overridden by a model.
  const contrary = pairs(taps).some(([label, n]) => n > 0 && label !== fromVerdicts.label)
  if (contrary) return null

  return { ...fromVerdicts, source: 'verdict' }
}
