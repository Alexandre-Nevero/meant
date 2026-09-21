import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCases } from '../scripts/spike/corpus.ts'

const session = {
  id: 's1',
  intention: 'finish the client proposal',
  outcome: 'no',
  started_at: '2026-09-01T09:00:00.000Z',
  started_at_local_hour: 9,
  work_sites: ['docs.google.com'],
  blocked_domains: ['instagram.com'],
}

const events = [
  { session_id: 's1', kind: 'attention', domain: 'chatgpt.com', seconds: 1860, at: '2026-09-01T09:01:00.000Z' },
  { session_id: 's1', kind: 'attention', domain: 'docs.google.com', seconds: 720, at: '2026-09-01T09:35:00.000Z' },
  { session_id: 's1', kind: 'away', domain: null, seconds: 300, at: '2026-09-01T09:50:00.000Z' },
  { session_id: 's1', kind: 'break', domain: null, seconds: 300, at: '2026-09-01T09:55:00.000Z' },
]

const paths = [
  { sessionId: 's1', host: 'chatgpt.com', path: '/c/abc', at: 1 },
  { sessionId: 's1', host: 'chatgpt.com', path: '/gpts', at: 2 },
  { sessionId: 's1', host: 'docs.google.com', path: '/document/d/xyz', at: 3 },
]

test('one visit per attention domain, carrying its paths', () => {
  const [c] = buildCases([session], events, paths)
  assert.equal(c.visits.length, 2)
  assert.deepEqual(c.visits[0], {
    sessionId: 's1',
    host: 'chatgpt.com',
    paths: ['/c/abc', '/gpts'],
    seconds: 1860,
    order: 0,
    declared: 'none',
  })
})

test('away and break never become visits', () => {
  // A break is DECLARED by the cycle timer (ADR-0045), never inferred. A judge that
  // could emit it would be able to contradict the timer, so it never sees one.
  const [c] = buildCases([session], events, paths)
  assert.equal(c.visits.some((v) => v.host === null), false)
  assert.equal(c.visits.length, 2)
})

test('declared work and distraction sites are marked, not resolved away', () => {
  const [c] = buildCases([session], events, paths)
  assert.equal(c.visits.find((v) => v.host === 'docs.google.com').declared, 'work')
  const withBlocked = buildCases(
    [session],
    [...events, { session_id: 's1', kind: 'attention', domain: 'instagram.com', seconds: 60, at: '2026-09-01T09:58:00.000Z' }],
    paths,
  )
  assert.equal(withBlocked[0].visits.find((v) => v.host === 'instagram.com').declared, 'distraction')
})

test('order follows the first attention timestamp, which is the sequence the judge reads', () => {
  const [c] = buildCases([session], events, paths)
  assert.deepEqual(c.visits.map((v) => v.order), [0, 1])
  assert.equal(c.visits[0].host, 'chatgpt.com')
})

test('a visit with no recorded path still becomes a case', () => {
  const [c] = buildCases([session], events, [])
  assert.deepEqual(c.visits[0].paths, [])
})

test('sessions with no intention or no answer are excluded', () => {
  // The judge judges against the sentence (ADR-0048) and ADR-0051 permits reasoning from
  // the outcome column. A case missing either cannot be scored.
  assert.deepEqual(buildCases([{ ...session, intention: null }], events, paths), [])
  assert.deepEqual(buildCases([{ ...session, outcome: null }], events, paths), [])
  assert.deepEqual(buildCases([{ ...session, outcome: 'unanswered' }], events, paths), [])
})

test('extension-id hosts are dropped', () => {
  const junk = { session_id: 's1', kind: 'attention', domain: 'abcdefghijklmnop'.repeat(2), seconds: 10, at: '2026-09-01T09:59:00.000Z' }
  const [c] = buildCases([session], [...events, junk], paths)
  assert.equal(c.visits.length, 2)
})
