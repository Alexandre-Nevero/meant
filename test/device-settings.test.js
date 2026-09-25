import test from 'node:test'
import assert from 'node:assert/strict'
import { settingsPatch, forgetAtMs, syncDeviceSettings } from '../extension/lib/device-settings.js'

// ADR-0087. GET /api/device returns { settings: {companion, judge, coach}, forgetAt }; this
// turns that body into the exact chrome.storage.local patch sw.js/popup.js/companion-overlay.js
// read. The key names are a contract another agent's code reads directly (judgeEnabled).

test('settingsPatch: server says everything is on', () => {
  const patch = settingsPatch({ settings: { companion: true, judge: true, coach: true }, forgetAt: null })
  assert.deepEqual(patch, { companionEnabled: true, judgeEnabled: true, coachEnabled: true })
})

test('settingsPatch: server says companion is off', () => {
  const patch = settingsPatch({ settings: { companion: false, judge: true, coach: true }, forgetAt: null })
  assert.equal(patch.companionEnabled, false)
  assert.equal(patch.judgeEnabled, true)
  assert.equal(patch.coachEnabled, true)
})

test('settingsPatch: a missing settings object defaults every feature on', () => {
  assert.deepEqual(settingsPatch({}), { companionEnabled: true, judgeEnabled: true, coachEnabled: true })
  assert.deepEqual(settingsPatch(null), { companionEnabled: true, judgeEnabled: true, coachEnabled: true })
})

test('settingsPatch never writes anything but real booleans', () => {
  // sw.js/companion-overlay.js compare with === false — a stray string or undefined here
  // would silently break that check.
  const patch = settingsPatch({ settings: { companion: 'off' } })
  assert.equal(typeof patch.companionEnabled, 'boolean')
  assert.equal(typeof patch.judgeEnabled, 'boolean')
  assert.equal(typeof patch.coachEnabled, 'boolean')
})

test('forgetAtMs: parses an ISO string into epoch ms', () => {
  assert.equal(forgetAtMs('2026-01-01T00:00:00.000Z'), Date.parse('2026-01-01T00:00:00.000Z'))
})

test('forgetAtMs: null/undefined/unparseable stays null', () => {
  assert.equal(forgetAtMs(null), null)
  assert.equal(forgetAtMs(undefined), null)
  assert.equal(forgetAtMs('not a date'), null)
})

// Regression: an early build of this called api.js's get() unconditionally, which reads
// apiBase() and — the first time anything asks for it — WRITES a default if unset. Called
// from sw.js's onInstalled, that fired the instant a freshly loaded/unpaired extension
// started, racing (and sometimes clobbering) an e2e fixture's own apiBase override, since
// both are a plain read-then-write against the same storage key. An unpaired device has
// nothing to pull anyway (GET /api/device is device-token auth only), so the fix is to
// never touch storage or the network at all before a token exists.
test('syncDeviceSettings does nothing before the device is paired (no token yet)', async () => {
  const sets = []
  global.chrome = {
    storage: { local: { get: async () => ({}), set: async (obj) => sets.push(obj) } },
  }
  let fetchCalled = false
  global.fetch = async () => {
    fetchCalled = true
    throw new Error('syncDeviceSettings must not touch the network before pairing')
  }
  try {
    await syncDeviceSettings()
  } finally {
    delete global.chrome
    delete global.fetch
  }
  assert.equal(fetchCalled, false)
  assert.deepEqual(sets, [])
})
