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

test('a thin domain with a wide gap does not hide a thick one from the evidence floor', () => {
  // The same defect the part-of-day contrast had, on the caller's side: the dashboard read the
  // first entry and gated on THAT domain's session count, so a two-session claim with a huge gap
  // vetoed an eight-session one and no sentence rendered at all. This module ranks by gap and
  // returns everything; the caller takes the first entry that clears the floor. If either the
  // ranking or the completeness of this list regresses, both assertions below move.
  const rows = [
    { domain: 'thin.com', sessionId: 't1', seconds: 60, outcome: 'yes' },
    { domain: 'thin.com', sessionId: 't2', seconds: 3600, outcome: 'no' },
    ...Array.from({ length: 5 }, (_, i) => ({
      domain: 'thick.com', sessionId: `k${i}`, seconds: 540, outcome: 'yes',
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      domain: 'thick.com', sessionId: `m${i}`, seconds: 1860, outcome: 'no',
    })),
  ]
  const out = contrastByOutcome(rows)
  assert.deepEqual(out.map((c) => c.domain), ['thin.com', 'thick.com'])
  // What the dashboard does: the first entry that clears the eight-session floor.
  assert.equal(out.find((c) => c.sessions >= 8).domain, 'thick.com')
})

// Fix wave (post-hoc review of ADR-0084): sessions counted per row, but a block of 4 tasks
// sharing one block_id is one real browsing session, not 4 — inflating `sessions` and letting
// the I6 evidence floor fire on 2 real sessions worth of rows.
test('a 4-task block with the same outcome counts as 1 session, not 4', () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({
    domain: 'a.com', sessionId: `t${i}`, blockId: 'block-1', seconds: 100, outcome: 'yes',
  }))
  rows.push({ domain: 'a.com', sessionId: 'other', blockId: 'block-2', seconds: 300, outcome: 'no' })
  const [top] = contrastByOutcome(rows)
  assert.equal(top.sessions, 2) // block-1 (1) + block-2 (1), not 4 + 1
  assert.equal(top.finishedAvgSeconds, 400) // (100*4) summed within block-1, averaged over 1 "session"
  assert.equal(top.unfinishedAvgSeconds, 300)
})

test('a block whose own tasks disagree on a domain\'s outcome excludes that domain from the block', () => {
  const rows = [
    { domain: 'mixed.com', sessionId: 't1', blockId: 'block-1', seconds: 100, outcome: 'yes' },
    { domain: 'mixed.com', sessionId: 't2', blockId: 'block-1', seconds: 200, outcome: 'no' },
    // Both arms still need real evidence elsewhere or the domain vanishes entirely (expected —
    // it has nothing left after block-1 is excluded).
  ]
  assert.deepEqual(contrastByOutcome(rows), [])
})

test('a mixed-outcome block is excluded even when the domain has other, clean evidence', () => {
  const rows = [
    { domain: 'mixed.com', sessionId: 't1', blockId: 'block-1', seconds: 100, outcome: 'yes' },
    { domain: 'mixed.com', sessionId: 't2', blockId: 'block-1', seconds: 200, outcome: 'no' },
    ...Array.from({ length: 4 }, (_, i) => ({
      domain: 'mixed.com', sessionId: `y${i}`, blockId: `clean-yes-${i}`, seconds: 50, outcome: 'yes',
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      domain: 'mixed.com', sessionId: `n${i}`, blockId: `clean-no-${i}`, seconds: 900, outcome: 'no',
    })),
  ]
  const [top] = contrastByOutcome(rows)
  assert.equal(top.sessions, 8) // block-1 excluded entirely — 4 clean yes + 4 clean no, not 10
})

test('a null block_id (pre-migration, single-task) row still counts as its own session', () => {
  const rows = [
    { domain: 'a.com', sessionId: 's1', blockId: null, seconds: 100, outcome: 'yes' },
    { domain: 'a.com', sessionId: 's2', blockId: null, seconds: 200, outcome: 'no' },
  ]
  const [top] = contrastByOutcome(rows)
  assert.equal(top.sessions, 2)
})

test('equal gaps break by domain name, not by the order the rows arrived in', () => {
  // Before the secondary key, two domains with identical gaps fell back to Map insertion order —
  // the order Postgres returned the event rows in, from a query with no ORDER BY. The sentence
  // could name a different domain between two page loads with no data change. Both orderings
  // must now agree. Deleting the tie-break fails the second assertion.
  const a = { domain: 'a.com', sessionId: 'a1', seconds: 100, outcome: 'yes' }
  const b = { domain: 'a.com', sessionId: 'a2', seconds: 700, outcome: 'no' }
  const c = { domain: 'z.com', sessionId: 'z1', seconds: 200, outcome: 'yes' }
  const d = { domain: 'z.com', sessionId: 'z2', seconds: 800, outcome: 'no' }
  assert.deepEqual(contrastByOutcome([a, b, c, d]).map((x) => x.domain), ['a.com', 'z.com'])
  assert.deepEqual(contrastByOutcome([c, d, a, b]).map((x) => x.domain), ['a.com', 'z.com'])
})
