import test from 'node:test'
import assert from 'node:assert/strict'
import { contrastByOutcome } from '../lib/attention-contrast.ts'

// ADR-0060: "Build the arithmetic before the judge."
//
// The single most useful sentence this product can say today needs no model, no page text,
// no permission and no cost. ADR-0051 explicitly permits reasoning FROM the outcome answer —
// it forbids valence, not use. This also becomes the baseline the batched judge must beat:
// if a model cannot outperform averaging, it does not ship.

test('contrastByOutcome averages per domain across finished and unfinished sessions', () => {
  const [top] = contrastByOutcome([
    { domain: 'chatgpt.com', seconds: 540, outcome: 'yes' },
    { domain: 'chatgpt.com', seconds: 600, outcome: 'yes' },
    { domain: 'chatgpt.com', seconds: 1860, outcome: 'no' },
  ])
  assert.equal(top.domain, 'chatgpt.com')
  assert.equal(top.finishedAvgSeconds, 570)
  assert.equal(top.unfinishedAvgSeconds, 1860)
  assert.equal(top.sessions, 3)
})

test('contrastByOutcome omits a domain that appears on only one side of the split', () => {
  // A domain seen only in finished sessions has no contrast, and asserting from one arm
  // would be a pattern claim from a single side — I6 as amended by ADR-0050.
  assert.deepEqual(contrastByOutcome([{ domain: 'a.com', seconds: 100, outcome: 'yes' }]), [])
})

test('contrastByOutcome ignores unanswered sessions entirely', () => {
  // `unanswered` is not a third outcome to average — it is the absence of an answer.
  assert.deepEqual(
    contrastByOutcome([
      { domain: 'a.com', seconds: 100, outcome: 'yes' },
      { domain: 'a.com', seconds: 900, outcome: 'unanswered' },
    ]),
    [],
  )
})

test('contrastByOutcome sorts by the size of the gap, largest first', () => {
  const out = contrastByOutcome([
    { domain: 'small.com', seconds: 100, outcome: 'yes' },
    { domain: 'small.com', seconds: 200, outcome: 'no' },
    { domain: 'big.com', seconds: 100, outcome: 'yes' },
    { domain: 'big.com', seconds: 2000, outcome: 'no' },
  ])
  assert.equal(out[0].domain, 'big.com')
})

test('contrastByOutcome surfaces a gap in EITHER direction', () => {
  // More time on a domain during FINISHED sessions is just as informative — that is the
  // shape of a tool that is working, not a distraction.
  const [top] = contrastByOutcome([
    { domain: 'docs.google.com', seconds: 2400, outcome: 'yes' },
    { domain: 'docs.google.com', seconds: 120, outcome: 'no' },
  ])
  assert.equal(top.finishedAvgSeconds, 2400)
  assert.equal(top.unfinishedAvgSeconds, 120)
})

test('contrastByOutcome excludes extension-ID-shaped domains', () => {
  // Historical event rows predate bareHostname()'s filter and contain raw extension IDs.
  assert.deepEqual(
    contrastByOutcome([
      { domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 100, outcome: 'yes' },
      { domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 900, outcome: 'no' },
    ]),
    [],
  )
})

test('contrastByOutcome handles an empty input', () => {
  assert.deepEqual(contrastByOutcome([]), [])
})
