import test from 'node:test'
import assert from 'node:assert/strict'
import { score, sweep } from '../scripts/spike/score.ts'
import { baselinePredictions } from '../scripts/spike/baseline.ts'

const truth = [
  { sessionId: 's1', host: 'a.com', label: 'focused' },
  { sessionId: 's1', host: 'b.com', label: 'drift' },
  { sessionId: 's1', host: 'c.com', label: 'drift' },
  { sessionId: 's1', host: 'd.com', label: 'supportive' },
]

test('a perfect prediction set scores 1', () => {
  const preds = truth.map((t) => ({ ...t, confidence: 1 }))
  const s = score(preds, truth, 0)
  assert.equal(s.accuracy, 1)
  assert.equal(s.coverage, 1)
  assert.equal(s.binaryDriftPrecision, 1)
})

test('precision on drift counts only predicted drifts', () => {
  const preds = [
    { sessionId: 's1', host: 'a.com', label: 'drift', confidence: 1 },
    { sessionId: 's1', host: 'b.com', label: 'drift', confidence: 1 },
    { sessionId: 's1', host: 'c.com', label: 'focused', confidence: 1 },
    { sessionId: 's1', host: 'd.com', label: 'supportive', confidence: 1 },
  ]
  const s = score(preds, truth, 0)
  const drift = s.byLabel.find((l) => l.label === 'drift')
  assert.equal(drift.predicted, 2)
  assert.equal(drift.correct, 1)
  assert.equal(drift.precision, 0.5)
  assert.equal(drift.actual, 2)
  assert.equal(drift.recall, 0.5)
})

test('the threshold drops low-confidence predictions from coverage, not into a wrong answer', () => {
  // ADR-0037: ambiguity stays silent. Below the floor the judge says `unknown` and nothing
  // is shown, so a dropped prediction must not be scored as a miss.
  const preds = [
    { sessionId: 's1', host: 'a.com', label: 'focused', confidence: 0.9 },
    { sessionId: 's1', host: 'b.com', label: 'focused', confidence: 0.2 },
    { sessionId: 's1', host: 'c.com', label: 'drift', confidence: 0.9 },
    { sessionId: 's1', host: 'd.com', label: 'supportive', confidence: 0.1 },
  ]
  const s = score(preds, truth, 0.5)
  assert.equal(s.coverage, 0.5)
  assert.equal(s.accuracy, 1)
})

test('binary drift precision collapses focused, supportive and neutral together', () => {
  // Three candidate taxonomies must be comparable on one question, and only the
  // drift/not-drift split exists in all three.
  const preds = [
    { sessionId: 's1', host: 'a.com', label: 'supportive', confidence: 1 },
    { sessionId: 's1', host: 'b.com', label: 'drift', confidence: 1 },
    { sessionId: 's1', host: 'c.com', label: 'drift', confidence: 1 },
    { sessionId: 's1', host: 'd.com', label: 'neutral', confidence: 1 },
  ]
  assert.equal(score(preds, truth, 0).binaryDriftPrecision, 1)
})

test('a prediction with no matching truth row is ignored, not counted wrong', () => {
  const preds = [{ sessionId: 'zz', host: 'nope.com', label: 'drift', confidence: 1 }]
  const s = score(preds, truth, 0)
  assert.equal(s.coverage, 0)
})

test('sweep walks thresholds from 0 to 0.95 in steps of 0.05', () => {
  const preds = truth.map((t) => ({ ...t, confidence: 1 }))
  const all = sweep(preds, truth)
  assert.equal(all.length, 20)
  assert.equal(all[0].threshold, 0)
  assert.equal(Math.round(all[19].threshold * 100) / 100, 0.95)
})

test('the baseline predicts from declaration alone, at full confidence', () => {
  // ADR-0035 answers the declared sites at session start with no model. This is what the
  // judge has to beat, and ADR-0060 is explicit that a model which cannot does not ship.
  const preds = baselinePredictions([
    { sessionId: 's1', host: 'a.com', declared: 'work' },
    { sessionId: 's1', host: 'b.com', declared: 'distraction' },
    { sessionId: 's1', host: 'd.com', declared: 'none' },
  ])
  assert.deepEqual(preds, [
    { sessionId: 's1', host: 'a.com', label: 'focused', confidence: 1 },
    { sessionId: 's1', host: 'b.com', label: 'drift', confidence: 1 },
    { sessionId: 's1', host: 'd.com', label: 'neutral', confidence: 1 },
  ])
})
