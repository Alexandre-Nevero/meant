import test from 'node:test'
import assert from 'node:assert/strict'
import { CYCLE_PRESETS, MAX_CYCLES, clampCount, plannedMinutesFor, restoreCycle } from '../extension/lib/cycles.js'

// ADR-0081. The session ends after the LAST WORK BLOCK — no trailing break inside it.
test('one cycle is the work block alone', () => {
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 1 }), 25)
})

test('n cycles are n work blocks and n-1 breaks', () => {
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 2 }), 55)
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 4 }), 115)
  assert.equal(plannedMinutesFor({ work: 50, break: 10, count: 2 }), 110)
})

test('the count is clamped to 1..MAX_CYCLES and rounded, and junk becomes 1', () => {
  assert.equal(MAX_CYCLES, 8)
  assert.equal(clampCount(0), 1)
  assert.equal(clampCount(-3), 1)
  assert.equal(clampCount(99), 8)
  assert.equal(clampCount(2.6), 3)
  assert.equal(clampCount('3'), 3)
  assert.equal(clampCount(undefined), 1)
  assert.equal(clampCount(NaN), 1)
  assert.equal(plannedMinutesFor({ work: 25, break: 5, count: 99 }), 8 * 25 + 7 * 5)
})

test('the presets are unchanged', () => {
  assert.deepEqual(CYCLE_PRESETS, [{ work: 25, break: 5 }, { work: 50, break: 10 }])
})

test('no saved choice restores the first-ever default: 25/5, one cycle', () => {
  assert.deepEqual(restoreCycle(null), { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 1 })
  assert.deepEqual(restoreCycle(undefined), restoreCycle(null))
})

test('"no cycles" restores as custom/none with the length in the work field', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 45, cycle: null }), { mode: 'custom', customMode: 'none', work: 45, brk: 5, count: 1 })
})

test('"until I stop" restores as custom/open', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: null, cycle: { work: 30, break: 10 } }), { mode: 'custom', customMode: 'open', work: 30, brk: 10, count: 1 })
})

test('a new-shape preset choice restores its preset and its count', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 55, cycle: { work: 25, break: 5, count: 2 } }), { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 2 })
  assert.deepEqual(restoreCycle({ plannedMinutes: 110, cycle: { work: 50, break: 10, count: 2 } }), { mode: '50/10', customMode: 'timed', work: 50, brk: 10, count: 2 })
})

test('a new-shape custom pair restores as custom/timed with its count', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 70, cycle: { work: 20, break: 5, count: 3 } }), { mode: 'custom', customMode: 'timed', work: 20, brk: 5, count: 3 })
})

// Saved before ADR-0081: no count, and a timed session was exactly one work + break.
test('a pre-ADR-0081 preset choice restores as that preset with one cycle', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 30, cycle: { work: 25, break: 5 } }), { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 1 })
})

test('a pre-ADR-0081 choice whose length is not one cycle lands in custom/timed', () => {
  assert.deepEqual(restoreCycle({ plannedMinutes: 50, cycle: { work: 25, break: 5 } }), { mode: 'custom', customMode: 'timed', work: 25, brk: 5, count: 1 })
})

test('a saved count out of range is clamped on restore', () => {
  assert.equal(restoreCycle({ plannedMinutes: 25, cycle: { work: 25, break: 5, count: 40 } }).count, 8)
})
