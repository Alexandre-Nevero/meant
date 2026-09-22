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

// Frozen: every call site treats these as read-only defaults, spreading them into a fresh
// object before any write. Freezing turns an accidental `t.taps.drift_n++` on a shared default
// into a thrown error instead of silent cross-tally corruption.
const EMPTY_COUNTS: Counts = Object.freeze({ focused_n: 0, supportive_n: 0, neutral_n: 0, drift_n: 0 })
export const EMPTY_TALLY: Tally = Object.freeze({ taps: EMPTY_COUNTS, verdicts: EMPTY_COUNTS, last_at: 0 })

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

/** Upgrades a value read from `memory.value` into the current `Tally` shape.
 *
 *  Caught in review, before this shipped: rows written before ADR-0078 are the tap-era flat
 *  shape (`{work_n, distract_n, neutral_n, last_at}` — 002-drift.sql's own comment, corrected
 *  there in the same commit as this fix). Without this, `tally()` reads `prior.taps`/
 *  `prior.verdicts`, which don't exist on that shape, and would silently fall back to
 *  EMPTY_COUNTS — the next write would then permanently discard a domain's entire accumulated
 *  evidence with no warning. Verified directly against production while fixing this:
 *  `memory.domain_class` currently has zero rows, so no evidence has actually been lost yet.
 *  The risk is real regardless — the live app may still run the pre-ADR-0078 code until this
 *  deploys, and could write a new old-shape row at any point before then — which is why this
 *  is a permanent read-time upgrade rather than a one-time backfill migration: it re-checks
 *  the shape on every read, so it also covers a row written after this file's own migration
 *  already ran. Every read of `memory.value` must pass through this before reaching `tally()`
 *  — there is one such read today (`app/api/events/route.ts`); the judge's future write path
 *  will be a second one and must do the same.
 *
 *  Old evidence upgrades into TAPS, never verdicts: only a tap could write this column before
 *  ADR-0078 existed (a tap cannot mean "supportive" — ADR-0058; `006-verdict-taxonomy.sql`
 *  states the same conclusion independently), so `work_n`/`distract_n` map to
 *  `focused_n`/`drift_n`, `neutral_n` is unchanged, `supportive_n` starts at 0. Detection keys
 *  on `work_n`/`distract_n` specifically (not `neutral_n`, which the current shape's own
 *  `Counts` also happens to name) so a hypothetical future flat shape sharing that one field
 *  name can never be mistaken for this one. */
export function upgradeTally(value: unknown): Tally {
  if (value && typeof value === 'object' && 'taps' in (value as object)) return value as Tally
  const old = (value ?? {}) as { work_n?: number; distract_n?: number; neutral_n?: number; last_at?: number }
  if (old.work_n == null && old.distract_n == null) return EMPTY_TALLY
  return {
    taps: {
      focused_n: old.work_n ?? 0,
      supportive_n: 0,
      neutral_n: old.neutral_n ?? 0,
      drift_n: old.distract_n ?? 0,
    },
    verdicts: EMPTY_COUNTS,
    last_at: old.last_at ?? 0,
  }
}

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
