import test from 'node:test'
import assert from 'node:assert/strict'
import { computeUnrecorded, UNRECORDED_MIN_SHARE } from '../lib/session-time.ts'

// ADR-0054's build obligation. The served/not-served boundary moved from JOB TITLE to
// BROWSER SHARE, reported at runtime. IDEA §9's warning was never about titles — it is that
// the product "would see a fraction of their day and be confidently wrong about the rest."
// So it stops guessing and says what it did not see.

const rows = (attention, away) => [
  { kind: 'attention', domain: 'a.com', seconds: attention, hits: 1 },
  { kind: 'away', domain: null, seconds: away, hits: 1 },
]

test('computeUnrecorded is wall clock minus attention minus away', () => {
  // 30 minutes of wall clock, 15 accounted for
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', '2026-09-15T10:30:00Z', rows(600, 300)), 900)
})

test('computeUnrecorded floors at zero rather than returning a negative', () => {
  // Clock skew between the extension and the server must never render as "-4 minutes".
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', '2026-09-15T10:01:00Z', rows(9999, 0)), 0)
})

test('computeUnrecorded returns 0 for a session that has not ended', () => {
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', null, rows(60, 0)), 0)
})

test('computeUnrecorded ignores block_hit rows, which carry no duration', () => {
  // block_hit rows have null seconds — the reach is recorded, the dwell never happened.
  const withHits = [...rows(600, 300), { kind: 'block_hit', domain: 'facebook.com', seconds: 0, hits: 4 }]
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', '2026-09-15T10:30:00Z', withHits), 900)
})

test('computeUnrecorded tolerates an unparseable timestamp', () => {
  assert.equal(computeUnrecorded('not-a-date', '2026-09-15T10:30:00Z', []), 0)
})

test('the render threshold is a share of the session, not a fixed number of minutes', () => {
  // A fixed floor would shout on a 10-minute session and stay silent on a 4-hour one.
  assert.ok(UNRECORDED_MIN_SHARE > 0 && UNRECORDED_MIN_SHARE < 1)
})
