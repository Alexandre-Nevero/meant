import test from 'node:test'
import assert from 'node:assert/strict'
import { tally, classify, EMPTY_TALLY } from '../lib/memory-accumulate.ts'
import { MEMORY_MIN_EVIDENCE, MEMORY_MIN_AGREEMENT } from '../lib/thresholds.ts'

const opts = { minEvidence: MEMORY_MIN_EVIDENCE, minAgreement: MEMORY_MIN_AGREEMENT }

// ADR-0062. Labels are written per VISIT; memory forms only when one RECURS.
//
// This narrows ADR-0037/D30, which said one-sided evidence resolves at n=1. That rule was
// written for a CORRECTION of a wrong flag — and ADR-0057 deleted the flag, so there are no
// corrections left. Every label is now volunteered, and a volunteered label means "this
// visit", not "this site forever". Memorising at n=1 would break PRD §1.2 directly: tap once
// on instagram.com at 4pm and the product believes Instagram is always drift, including at
// 11am when it is avoidance — confidently wrong about the exact case it exists for.

test('tally counts per label and matches the schema value shape', () => {
  // 002-drift.sql:32 — domain_class value is {work_n, distract_n, neutral_n, last_at}
  const t = tally(['distract', 'distract', 'work'], 1000)
  assert.equal(t.distract_n, 2)
  assert.equal(t.work_n, 1)
  assert.equal(t.neutral_n, 0)
  assert.equal(t.last_at, 1000)
})

test('tally accumulates onto an existing row rather than replacing it', () => {
  const first = tally(['distract'], 1)
  const second = tally(['distract'], 2, first)
  assert.equal(second.distract_n, 2)
  assert.equal(second.last_at, 2)
})

test('tally ignores unknown, which is the absence of an observation', () => {
  const t = tally(['unknown', 'distract'], 1)
  assert.equal(t.distract_n, 1)
  assert.equal(Object.values(t).filter((v) => typeof v === 'number').reduce((a, b) => a + b, 0) - t.last_at, 1)
})

test('three consistent observations classify the domain', () => {
  assert.deepEqual(classify(tally(['distract', 'distract', 'distract'], 1), opts), {
    label: 'distract',
    confidence: 1,
    evidence_n: 3,
  })
})

test('two consistent observations do NOT classify', () => {
  assert.equal(classify(tally(['distract', 'distract'], 1), opts), null)
})

test('one observation does not classify, even though ADR-0037 once said it would', () => {
  assert.equal(classify(tally(['distract'], 1), opts), null)
})

test('a genuinely ambiguous domain stays unclassified rather than resolving to its majority', () => {
  // PRD §1.2 in data. A site that really does mean both things must not pick a side.
  assert.equal(classify(tally(['distract', 'distract', 'work', 'work'], 1), opts), null)
})

test('agreement exactly at the floor classifies', () => {
  const t = tally(['distract', 'distract', 'distract', 'distract', 'work'], 1)
  assert.deepEqual(classify(t, opts), { label: 'distract', confidence: 0.8, evidence_n: 5 })
})

test('neutral is a first-class outcome, not a fallback', () => {
  // ADR-0047: forcing ambiguous domains into work-or-drift poisons the memory gating the judge.
  assert.deepEqual(classify(tally(['neutral', 'neutral', 'neutral'], 1), opts), {
    label: 'neutral',
    confidence: 1,
    evidence_n: 3,
  })
})

test('an empty tally classifies nothing', () => {
  assert.equal(classify(EMPTY_TALLY, opts), null)
})

test('a domain that BECOMES ambiguous loses its classification', () => {
  // The write path must delete, not keep a stale row: three distract taps then three work taps
  // is a site whose meaning changed, and the old verdict is now actively misleading.
  const settled = tally(['distract', 'distract', 'distract'], 1)
  assert.ok(classify(settled, opts))
  const contested = tally(['work', 'work', 'work'], 2, settled)
  assert.equal(classify(contested, opts), null)
})
