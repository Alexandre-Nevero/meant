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

export function score(predictions: Prediction[], truth: Truth[], threshold: number): Score {
  const answers = new Map(truth.map((t) => [key(t), t.label]))
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

  // The only question all three candidate taxonomies can answer. Everything that is not
  // drift collapses together, so a 4-label run and a 2-label run are comparable.
  const asDrift = (l: Label | undefined) => l === 'drift'
  const predictedDrift = kept.filter((p) => asDrift(p.label))
  const binaryDriftPrecision = ratio(
    predictedDrift.filter((p) => asDrift(answers.get(key(p)))).length,
    predictedDrift.length,
  )

  return {
    threshold,
    coverage: ratio(kept.length, truth.length),
    accuracy: ratio(kept.filter((p) => answers.get(key(p)) === p.label).length, kept.length),
    byLabel,
    binaryDriftPrecision,
  }
}

/** The confidence curve ADR-0073 needs: the floor is a number this produces, not one
 *  anybody picks. */
export function sweep(predictions: Prediction[], truth: Truth[]): Score[] {
  const out: Score[] = []
  for (let i = 0; i < 20; i++) out.push(score(predictions, truth, i * 0.05))
  return out
}
