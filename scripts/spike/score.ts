/** Scores any labeller against the hand-made answer key.
 *
 *  Written BEFORE the model runs, on purpose: the bar has to be fixed before anyone sees a
 *  result, or the bar moves to wherever the result landed.
 *
 *  ADR-0037 governs the threshold: below the confidence floor the judge emits `unknown` and
 *  nothing is shown. A dropped prediction is therefore a loss of COVERAGE, never a wrong
 *  answer, and scoring it as a miss would punish exactly the behaviour we want.
 */
export type Label = 'focused' | 'supportive' | 'neutral' | 'drift'
export type Prediction = { sessionId: string; host: string; label: Label; confidence: number }
export type Truth = { sessionId: string; host: string; label: Label }
// `actual` and `recall` are computed over KEPT rows only (confidence >= threshold, in this
// taxonomy) — recall-among-covered, not recall over the whole truth set. A row dropped by the
// threshold or excluded by score()'s taxonomy filter is absent from both numerator and
// denominator, never counted as a miss. Always report `coverage` alongside recall — a low
// coverage can hide a materially lower true recall, and reporting recall alone invites exactly
// that misread ("catches all of it" when several instances were simply never scored).
export type LabelScore = { label: Label; predicted: number; correct: number; precision: number; actual: number; recall: number }
export type Score = {
  threshold: number
  coverage: number
  accuracy: number
  byLabel: LabelScore[]
  binaryDriftPrecision: number
}

const LABELS: Label[] = ['focused', 'supportive', 'neutral', 'drift']
const key = (r: { sessionId: string; host: string }) => `${r.sessionId}\u0000${r.host}`
const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d)

export function score(predictions: Prediction[], truth: Truth[], threshold: number, taxonomy: Label[] = LABELS): Score {
  // A three- or two-label run cannot win a truth row whose real label isn't in its own
  // vocabulary (e.g. a `supportive` row scored against a run that was never offered that
  // word). Scoring it anyway silently caps that run's own accuracy below what it could ever
  // reach and makes cross-taxonomy accuracy comparisons meaningless. Restricting the truth
  // set to the run's own taxonomy scores each run only on the rows it could possibly get
  // right — `binaryDriftPrecision` below remains the one metric safe to compare AS-IS across
  // taxonomies, exactly as the comment on it already says.
  const scoredTruth = truth.filter((t) => taxonomy.includes(t.label))
  const answers = new Map(scoredTruth.map((t) => [key(t), t.label]))
  const kept = predictions.filter((p) => p.confidence >= threshold && answers.has(key(p)))

  const byLabel: LabelScore[] = LABELS.map((label) => {
    const predicted = kept.filter((p) => p.label === label)
    const correct = predicted.filter((p) => answers.get(key(p)) === label).length
    const actual = kept.filter((p) => answers.get(key(p)) === label).length
    return {
      label,
      predicted: predicted.length,
      correct,
      precision: ratio(correct, predicted.length),
      actual,
      recall: ratio(correct, actual),
    }
  })

  // The only question all three candidate taxonomies can answer, and it must be scored
  // against the FULL, unfiltered truth — not `scoredTruth` above. Drift/not-drift is
  // well-defined for every row regardless of which taxonomy a run was given, and a run that
  // predicts `drift` on a row outside its own vocabulary (e.g. a `supportive` row, for a
  // two-label run) is a real false positive on this question even though that row is excluded
  // from `accuracy`/`byLabel` above. Filtering it out here would silently launder exactly the
  // false positives that make this metric worth computing in the first place.
  const fullAnswers = new Map(truth.map((t) => [key(t), t.label]))
  const keptForDrift = predictions.filter((p) => p.confidence >= threshold && fullAnswers.has(key(p)))
  const asDrift = (l: Label | undefined) => l === 'drift'
  const predictedDrift = keptForDrift.filter((p) => asDrift(p.label))
  const binaryDriftPrecision = ratio(
    predictedDrift.filter((p) => asDrift(fullAnswers.get(key(p)))).length,
    predictedDrift.length,
  )

  return {
    threshold,
    coverage: ratio(kept.length, scoredTruth.length),
    accuracy: ratio(kept.filter((p) => answers.get(key(p)) === p.label).length, kept.length),
    byLabel,
    binaryDriftPrecision,
  }
}

/** The confidence curve ADR-0073 needs: the floor is a number this produces, not one
 *  anybody picks. */
export function sweep(predictions: Prediction[], truth: Truth[], taxonomy: Label[] = LABELS): Score[] {
  const out: Score[] = []
  for (let i = 0; i < 20; i++) out.push(score(predictions, truth, i * 0.05, taxonomy))
  return out
}
