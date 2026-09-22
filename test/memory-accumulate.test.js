import test from 'node:test'
import assert from 'node:assert/strict'
import { tally, classify, EMPTY_TALLY } from '../lib/memory-accumulate.ts'

// Deliberately literal, unlike the old version of this file, which imported the constants.
// These tests exercise the FUNCTION's rules; re-tuning MEMORY_MIN_VERDICTS against the eval
// (ADR-0078 says it will be) must not silently rewrite what the tests assert.
const opts = { minEvidence: 3, minAgreement: 0.8, minVerdicts: 8 }
const taps = (labels, at = 1, prior) => tally(labels, at, 'tap', prior)
const verdicts = (labels, at = 1, prior) => tally(labels, at, 'verdict', prior)

test('taps and verdicts accumulate into separate counts', () => {
  const t = verdicts(['focused'], 2, taps(['drift', 'drift'], 1))
  assert.equal(t.taps.drift_n, 2)
  assert.equal(t.verdicts.focused_n, 1)
  assert.equal(t.taps.focused_n, 0)
  assert.equal(t.verdicts.drift_n, 0)
})

test('last_at is the latest observation across both sources', () => {
  const t = verdicts(['focused'], 50, taps(['drift'], 900))
  assert.equal(t.last_at, 900)
})

test('unknown is dropped, not counted as a fourth class', () => {
  const t = verdicts(['unknown', 'drift'], 1)
  assert.equal(t.verdicts.drift_n, 1)
  assert.equal(Object.values(t.verdicts).reduce((a, b) => a + b, 0), 1)
})

test('supportive is a first-class count', () => {
  assert.equal(verdicts(['supportive', 'supportive'], 1).verdicts.supportive_n, 2)
})

test('three agreeing taps classify', () => {
  assert.deepEqual(classify(taps(['drift', 'drift', 'drift'], 1), opts), {
    label: 'drift',
    confidence: 1,
    evidence_n: 3,
    source: 'tap',
  })
})

test('two taps are not enough', () => {
  assert.equal(classify(taps(['drift', 'drift'], 1), opts), null)
})

test('taps below 80% agreement do not classify', () => {
  assert.equal(classify(taps(['drift', 'drift', 'focused', 'focused'], 1), opts), null)
})

test('seven verdicts are not enough; eight are', () => {
  const seven = verdicts(Array(7).fill('focused'), 1)
  assert.equal(classify(seven, opts), null)
  const eight = verdicts(['focused'], 2, seven)
  assert.deepEqual(classify(eight, opts), {
    label: 'focused',
    confidence: 1,
    evidence_n: 8,
    source: 'verdict',
  })
})

test('a single contrary tap vetoes a verdict classification', () => {
  const t = taps(['drift'], 2, verdicts(Array(8).fill('focused'), 1))
  assert.equal(classify(t, opts), null)
})

test('a tap agreeing with the verdicts does not veto them', () => {
  const t = taps(['focused'], 2, verdicts(Array(8).fill('focused'), 1))
  assert.equal(classify(t, opts).label, 'focused')
  assert.equal(classify(t, opts).source, 'verdict')
})

test('taps win outright once they clear their own bar', () => {
  const t = taps(['drift', 'drift', 'drift'], 2, verdicts(Array(20).fill('focused'), 1))
  assert.deepEqual(classify(t, opts), {
    label: 'drift',
    confidence: 1,
    evidence_n: 3,
    source: 'tap',
  })
})

test('a domain that becomes contested loses its classification', () => {
  const settled = taps(['drift', 'drift', 'drift'], 1)
  assert.equal(classify(settled, opts).label, 'drift')
  const contested = taps(['focused', 'focused', 'focused'], 2, settled)
  assert.equal(classify(contested, opts), null)
})

test('EMPTY_TALLY classifies as nothing', () => {
  assert.equal(classify(EMPTY_TALLY, opts), null)
})
