import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachContext } from '../lib/coach-context.ts'

test('no sessions means no data, not zeroed-out fake data', () => {
  const c = buildCoachContext([], [])
  assert.equal(c.hasData, false)
  assert.equal(c.sessionCount, 0)
  assert.deepEqual(c.topSites, [])
})

test('real sessions produce real aggregates', () => {
  const sessions = [{ outcome: 'yes' }, { outcome: 'no' }, { outcome: 'yes' }]
  const events = [
    { kind: 'attention', domain: 'docs.google.com', seconds: 1800, label: 'focused' },
    { kind: 'attention', domain: 'chatgpt.com', seconds: 600, label: 'focused' },
    { kind: 'away', domain: null, seconds: 300, label: null },
  ]
  const c = buildCoachContext(sessions, events)
  assert.equal(c.hasData, true)
  assert.equal(c.sessionCount, 3)
  assert.equal(c.finishedCount, 2)
  assert.equal(c.notYetCount, 1)
  assert.equal(c.totalAttended, '40 min')
  assert.equal(c.totalAway, '5 min')
  assert.deepEqual(c.topSites, [
    { domain: 'docs.google.com', share: 75 },
    { domain: 'chatgpt.com', share: 25 },
  ])
})

test('sessions with no matching events still count, with zeroed durations', () => {
  const c = buildCoachContext([{ outcome: 'yes' }], [])
  assert.equal(c.hasData, true)
  assert.equal(c.sessionCount, 1)
  assert.equal(c.totalAttended, '0 min')
  assert.deepEqual(c.topSites, [])
})
