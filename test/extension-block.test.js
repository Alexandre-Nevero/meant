import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_TASKS, pausedEvent, addTask, switchTask, closingEvents, attendedSeconds } from '../extension/lib/block.js'

const T0 = Date.parse('2026-09-23T10:00:00.000Z')
const task = (id, extra = {}) => ({
  sessionId: id,
  intention: id,
  startedAt: new Date(T0).toISOString(),
  tally: { attention: {}, away: 0, break: 0 },
  slice: { domain: null, since: T0, mode: 'attention', awayCarryMs: 0 },
  dwellSince: T0,
  ...extra,
})

test('a block holds at most four tasks', () => {
  assert.equal(MAX_TASKS, 4)
})

test('pausedEvent is whole seconds, and nothing for under one second or a negative span', () => {
  assert.deepEqual(pausedEvent(T0, T0 + 90_500), { kind: 'paused', domain: null, seconds: 90, at: new Date(T0 + 90_500).toISOString() })
  assert.equal(pausedEvent(T0, T0 + 999), null)
  assert.equal(pausedEvent(T0 + 5_000, T0), null)
})

test('addTask parks the active task and accounts the new one\'s time since the block began', () => {
  const at = T0 + 600_000
  const out = addTask({ id: 'a', tasks: [] }, task('a'), task('b'), at)
  assert.equal(out.active.sessionId, 'b')
  assert.deepEqual(out.block.tasks.map((t) => [t.sessionId, t.pausedAt]), [['a', at]])
  assert.equal(out.block.id, 'a')
  assert.equal(out.paused.seconds, 600)
})

test('addTask refuses a fifth task', () => {
  const full = { id: 'a', tasks: [task('b'), task('c'), task('d')] }
  assert.equal(addTask(full, task('a'), task('e'), T0 + 1000), null)
})

test('switchTask resumes the target with a fresh slice and parks the active one', () => {
  const block = { id: 'a', tasks: [task('b', { pausedAt: T0 + 60_000, slice: { domain: 'x.com', since: T0 + 1, mode: 'away', awayCarryMs: 7 } })] }
  const at = T0 + 180_000
  const out = switchTask(block, task('a'), 'b', at)
  assert.equal(out.active.sessionId, 'b')
  assert.equal('pausedAt' in out.active, false)
  assert.deepEqual(out.active.slice, { domain: null, since: at, mode: 'attention', awayCarryMs: 0 })
  assert.equal(out.active.dwellSince, at)
  assert.deepEqual(out.block.tasks.map((t) => [t.sessionId, t.pausedAt]), [['a', at]])
  assert.equal(out.paused.seconds, 120)
})

test('switchTask to a task that is not parked is null', () => {
  assert.equal(switchTask({ id: 'a', tasks: [] }, task('a'), 'zzz', T0), null)
})

test('closingEvents gives each parked task one paused event, and nothing for no block', () => {
  const block = { id: 'a', tasks: [task('b', { pausedAt: T0 + 60_000 }), task('c', { pausedAt: T0 + 120_000 })] }
  const out = closingEvents(block, T0 + 300_000)
  assert.deepEqual(out.map((e) => [e.sessionId, e.event.seconds]), [['b', 240], ['c', 180]])
  assert.deepEqual(closingEvents(null, T0), [])
})

test('attendedSeconds sums attention only', () => {
  assert.equal(attendedSeconds({ tally: { attention: { 'a.com': 60, 'b.com': 30 }, away: 99, break: 5 } }), 90)
  assert.equal(attendedSeconds({}), 0)
})
