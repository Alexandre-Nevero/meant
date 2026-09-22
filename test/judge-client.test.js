import test from 'node:test'
import assert from 'node:assert/strict'
import { selectPathsForSessions } from '../extension/lib/judge-client.js'

test('selects only the entries for the given sessions', () => {
  const log = [
    { sessionId: 's1', host: 'a.com', path: '/x', at: 1 },
    { sessionId: 's2', host: 'b.com', path: '/y', at: 2 },
    { sessionId: 's1', host: 'c.com', path: '/z', at: 3 },
  ]
  const selected = selectPathsForSessions(log, ['s1'])
  assert.equal(selected.length, 2)
  assert.ok(selected.every((p) => p.sessionId === 's1'))
})

test('an empty or missing log selects nothing', () => {
  assert.deepEqual(selectPathsForSessions([], ['s1']), [])
  assert.deepEqual(selectPathsForSessions(undefined, ['s1']), [])
})

test('multiple requested sessions are all included', () => {
  const log = [
    { sessionId: 's1', host: 'a.com', path: '/x', at: 1 },
    { sessionId: 's2', host: 'b.com', path: '/y', at: 2 },
    { sessionId: 's3', host: 'c.com', path: '/z', at: 3 },
  ]
  const selected = selectPathsForSessions(log, ['s1', 's3'])
  assert.deepEqual(selected.map((p) => p.sessionId).sort(), ['s1', 's3'])
})
