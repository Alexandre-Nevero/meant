import test from 'node:test'
import assert from 'node:assert/strict'
import { settingIsOn } from '../lib/settings-value.ts'

// ADR-0087: companion/judge/coach are stored as memory rows, kind='setting', value 'on'|'off'.
// Absent (never written) means on — a user who never opens Settings gets every feature.

test('settingIsOn: undefined (row never written) is on', () => {
  assert.equal(settingIsOn(undefined), true)
})

test('settingIsOn: null is on', () => {
  assert.equal(settingIsOn(null), true)
})

test('settingIsOn: "on" is on', () => {
  assert.equal(settingIsOn('on'), true)
})

test('settingIsOn: "off" is off', () => {
  assert.equal(settingIsOn('off'), false)
})

test('settingIsOn: any other stored value is treated as on, not off', () => {
  // Only the literal 'off' turns a feature off — a future value must never accidentally
  // gate a feature closed.
  assert.equal(settingIsOn('maybe'), true)
  assert.equal(settingIsOn(''), true)
})
