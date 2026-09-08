import test from 'node:test'
import assert from 'node:assert/strict'
import { isEditable } from '../extension/lib/sentence-lock.js'

const GRACE_MS = 60_000

test('editable right at session start', () => {
  assert.equal(isEditable(0, 0, GRACE_MS), true)
})

test('editable one ms before the grace window closes', () => {
  assert.equal(isEditable(GRACE_MS - 1, 0, GRACE_MS), true)
})

test('locked exactly at the grace window boundary', () => {
  assert.equal(isEditable(GRACE_MS, 0, GRACE_MS), false)
})

test('locked well past the grace window', () => {
  assert.equal(isEditable(GRACE_MS + 60_000, 0, GRACE_MS), false)
})

test('the reference point is startedAt, not zero', () => {
  const startedAt = 1_700_000_000_000
  assert.equal(isEditable(startedAt + 30_000, startedAt, GRACE_MS), true)
  assert.equal(isEditable(startedAt + 90_000, startedAt, GRACE_MS), false)
})
