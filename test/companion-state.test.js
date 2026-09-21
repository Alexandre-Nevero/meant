import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ADR-0057: the live drift signal is REMOVED, not disabled. A constant left behind is a
// constant someone rewires in six months — and the EDEN sheet already marked this work
// "DONE" once while every symbol was still live at sw.js:202-270.

/** Strips comments so these assertions target executable code. A comment that NAMES a
 *  deleted symbol is the institutional memory we want to keep — sw.js deliberately
 *  explains where the companionEnabled check came from. A line of code referencing it
 *  is the resurrection we want to catch. */
function code(path) {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

test('no drift-signal symbol survives in the service worker', () => {
  const sw = code('extension/sw.js')
  for (const symbol of ['updateCompanion', 'isKnownDistraction', 'DRIFT_GRACE_MS', 'DRIFT_WINDOW_MS', 'DRIFT_BUDGET']) {
    assert.equal(sw.includes(symbol), false, `${symbol} still referenced in sw.js code`)
  }
})

test('the companion overlay has no drifting state', () => {
  const overlay = code('extension/companion-overlay.js')
  assert.equal(overlay.includes('drifting'), false, 'drifting state still in companion-overlay.js')
})

test('thresholds.ts no longer declares the five signalling constants', () => {
  const t = readFileSync('lib/thresholds.ts', 'utf8')
  for (const symbol of ['SIGNAL_BUDGET', 'SIGNAL_WINDOW_MS', 'REFRACTORY_MS', 'CONFIDENCE_FLOOR', 'DWELL_MS']) {
    assert.equal(t.includes(symbol), false, `${symbol} still declared in thresholds.ts`)
  }
})

test('thresholds.ts KEEPS the constants ADR-0062 and the cycles still need', () => {
  const t = readFileSync('lib/thresholds.ts', 'utf8')
  for (const symbol of ['MEMORY_MIN_EVIDENCE', 'MEMORY_MIN_AGREEMENT', 'PATTERN_MIN_SESSIONS', 'GRACE_MS', 'CYCLE_PRESETS']) {
    assert.ok(t.includes(symbol), `${symbol} was deleted but is still needed`)
  }
})

test('companionEnabled still gates the companion somewhere — I9 seam must survive', () => {
  // updateCompanion() was the ONLY reader of companionEnabled. Deleting it without moving
  // this check would silently remove the companion's off-switch, breaking I9 ("every feature
  // above the mechanical loop is independently removable") and PRD §9's four-seams rule —
  // and removing the switch that makes the A9 on/off experiment free.
  const sw = code('extension/sw.js')
  assert.ok(sw.includes('companionEnabled'), 'the companion off-switch has no reader left')
})

test('companion-overlay.js reads companionEnabled so the off-switch unmounts it directly', () => {
  const overlay = code('extension/companion-overlay.js')
  assert.ok(overlay.includes('companionEnabled'), 'companion-overlay.js must check companionEnabled')
})

test('companion remains present when session is absent unless companionEnabled is false', () => {
  const overlay = code('extension/companion-overlay.js')
  assert.equal(overlay.includes('if (!session) {\n    unmount()'), false, 'companion must not unmount solely because !session')
})
