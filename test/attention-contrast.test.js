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
    { sessionId: 's1', domain: 'chatgpt.com', seconds: 540, outcome: 'yes' },
    { sessionId: 's2', domain: 'chatgpt.com', seconds: 600, outcome: 'yes' },
    { sessionId: 's3', domain: 'chatgpt.com', seconds: 1860, outcome: 'no' },
  ])
  assert.equal(top.domain, 'chatgpt.com')
  assert.equal(top.finishedAvgSeconds, 570)
  assert.equal(top.unfinishedAvgSeconds, 1860)
  assert.equal(top.sessions, 3)
})

test('contrastByOutcome omits a domain that appears on only one side of the split', () => {
  // A domain seen only in finished sessions has no contrast, and asserting from one arm
  // would be a pattern claim from a single side — I6 as amended by ADR-0050.
  assert.deepEqual(contrastByOutcome([{ sessionId: 's4', domain: 'a.com', seconds: 100, outcome: 'yes' }]), [])
})

test('contrastByOutcome ignores unanswered sessions entirely', () => {
  // `unanswered` is not a third outcome to average — it is the absence of an answer.
  assert.deepEqual(
    contrastByOutcome([
      { sessionId: 's5', domain: 'a.com', seconds: 100, outcome: 'yes' },
      { sessionId: 's6', domain: 'a.com', seconds: 900, outcome: 'unanswered' },
    ]),
    [],
  )
})

test('contrastByOutcome sorts by the size of the gap, largest first', () => {
  const out = contrastByOutcome([
    { sessionId: 's7', domain: 'small.com', seconds: 100, outcome: 'yes' },
    { sessionId: 's8', domain: 'small.com', seconds: 200, outcome: 'no' },
    { sessionId: 's9', domain: 'big.com', seconds: 100, outcome: 'yes' },
    { sessionId: 's10', domain: 'big.com', seconds: 2000, outcome: 'no' },
  ])
  assert.equal(out[0].domain, 'big.com')
})

test('contrastByOutcome surfaces a gap in EITHER direction', () => {
  // More time on a domain during FINISHED sessions is just as informative — that is the
  // shape of a tool that is working, not a distraction.
  const [top] = contrastByOutcome([
    { sessionId: 's11', domain: 'docs.google.com', seconds: 2400, outcome: 'yes' },
    { sessionId: 's12', domain: 'docs.google.com', seconds: 120, outcome: 'no' },
  ])
  assert.equal(top.finishedAvgSeconds, 2400)
  assert.equal(top.unfinishedAvgSeconds, 120)
})

test('contrastByOutcome excludes extension-ID-shaped domains', () => {
  // Historical event rows predate bareHostname()'s filter and contain raw extension IDs.
  assert.deepEqual(
    contrastByOutcome([
      { sessionId: 's13', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 100, outcome: 'yes' },
      { sessionId: 's14', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 900, outcome: 'no' },
    ]),
    [],
  )
})

test('sessions counts SESSIONS, not event rows', () => {
  // Found against real data: chatgpt.com had 53 attention rows across 5 sessions. Counting
  // rows made the I6 evidence gate fire at 53 while the actual evidence was 5 - below the
  // 8-session floor. The gate exists to stop exactly that claim.
  const rows = [
    { domain: 'a.com', sessionId: 's1', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's1', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's1', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's2', seconds: 600, outcome: 'no' },
  ]
  const [top] = contrastByOutcome(rows)
  assert.equal(top.sessions, 2)
})

test('the average is per session, so a fragmented session does not outweigh a focused one', () => {
  // Three 100s rows in one session is 300s in ONE session, not three observations of 100s.
  const rows = [
    { domain: 'a.com', sessionId: 's1', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's1', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's1', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's2', seconds: 500, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's3', seconds: 60, outcome: 'no' },
  ]
  const [top] = contrastByOutcome(rows)
  assert.equal(top.finishedAvgSeconds, 400) // (300 + 500) / 2 sessions, not 900/4 rows
  assert.equal(top.unfinishedAvgSeconds, 60)
  assert.equal(top.sessions, 3)
})

test('contrastByOutcome handles an empty input', () => {
  assert.deepEqual(contrastByOutcome([]), [])
})
