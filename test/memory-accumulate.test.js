import test from 'node:test'
import assert from 'node:assert/strict'
import { tally, classify, upgradeTally, EMPTY_TALLY } from '../lib/memory-accumulate.ts'

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

// A real bug caught in review: memory.value rows written before ADR-0078 shipped are the
// tap-era flat shape ({work_n, distract_n, neutral_n, last_at} — see 002-drift.sql's own
// comment). tally() reads prior.taps/prior.verdicts, which don't exist on that shape, so it
// silently fell back to EMPTY_COUNTS and the next write permanently discarded a domain's
// entire accumulated evidence with no warning. upgradeTally() must be called on every value
// read from Postgres before it reaches tally(), so old evidence survives the transition.
test('upgradeTally converts the pre-ADR-0078 flat shape, preserving evidence as taps', () => {
  const old = { work_n: 5, distract_n: 2, neutral_n: 1, last_at: 777 }
  const upgraded = upgradeTally(old)
  assert.deepEqual(upgraded, {
    taps: { focused_n: 5, supportive_n: 0, neutral_n: 1, drift_n: 2 },
    verdicts: { focused_n: 0, supportive_n: 0, neutral_n: 0, drift_n: 0 },
    last_at: 777,
  })
})

test('upgradeTally leaves an already-current shape untouched', () => {
  const current = {
    taps: { focused_n: 1, supportive_n: 0, neutral_n: 0, drift_n: 0 },
    verdicts: { focused_n: 0, supportive_n: 0, neutral_n: 0, drift_n: 3 },
    last_at: 42,
  }
  assert.deepEqual(upgradeTally(current), current)
})

test('upgradeTally treats null/undefined (a domain never seen before) as EMPTY_TALLY', () => {
  assert.deepEqual(upgradeTally(null), EMPTY_TALLY)
  assert.deepEqual(upgradeTally(undefined), EMPTY_TALLY)
})

test('old evidence upgraded from the flat shape still counts toward classification', () => {
  // 5 old work_n taps upgrade to 5 focused taps — already enough to classify on their own,
  // proving the upgrade path feeds real evidence into classify(), not just a passthrough.
  const upgraded = upgradeTally({ work_n: 5, distract_n: 0, neutral_n: 0, last_at: 1 })
  assert.deepEqual(classify(upgraded, opts), {
    label: 'focused',
    confidence: 1,
    evidence_n: 5,
    source: 'tap',
  })
})

test('a new tap folds onto upgraded old evidence instead of resetting it to zero', () => {
  // This is the exact failure mode from the bug report: an existing user's old-shape row
  // must not be silently zeroed the next time they tap the same domain.
  const oldRow = { work_n: 2, distract_n: 0, neutral_n: 0, last_at: 100 }
  const next = tally(['focused'], 200, 'tap', upgradeTally(oldRow))
  assert.equal(next.taps.focused_n, 3) // 2 preserved + 1 new, NOT reset to 1
  assert.equal(next.last_at, 200)
})
