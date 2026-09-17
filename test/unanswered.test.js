import test from 'node:test'
import assert from 'node:assert/strict'
import { answerableBacklog, ANSWERABLE_WINDOW_DAYS } from '../lib/unanswered.ts'

const NOW = new Date('2026-09-17T12:00:00Z')
const ago = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
const row = (id, outcome, endedDaysAgo, endedAt = ago(endedDaysAgo)) => ({
  id, outcome, endedAt, intention: 'a thing',
})

test('only unanswered sessions are answerable', () => {
  const rows = [row('a', 'yes', 1), row('b', 'no', 1), row('c', 'unanswered', 1)]
  assert.deepEqual(answerableBacklog(rows, NOW).map((r) => r.id), ['c'])
})

test('a running session is not a backlog item — it has not ended yet', () => {
  // endedAt null means running. Asking "did you?" of a session still in progress is incoherent.
  //
  // This uses a `now` close to the epoch (day 5) rather than NOW above. With NOW, `new
  // Date(null).getTime()` is 0 and the fourteen-day window filter alone would already drop the
  // row — the test would pass even with the `endedAt !== null` guard deleted, which is not
  // coverage. With a `now` five days after the epoch, the window floor (now - 14 days) is
  // negative, so epoch-zero falls *inside* the window and only the explicit null guard excludes
  // the row. That makes the assertion actually exercise the guard it names.
  const localNow = new Date(5 * 86_400_000)
  const rows = [{ id: 'a', outcome: 'unanswered', endedAt: null, intention: 'x' }]
  assert.deepEqual(answerableBacklog(rows, localNow), [])
})

test('oldest first — the one most likely to be forgotten is the one to ask about', () => {
  const rows = [row('new', 'unanswered', 1), row('old', 'unanswered', 5)]
  assert.deepEqual(answerableBacklog(rows, NOW).map((r) => r.id), ['old', 'new'])
})

test('sessions past the window are dropped rather than asked about forever', () => {
  // Honesty over completeness: nobody can accurately answer "did you finish it" about a session
  // three weeks gone, and a backlog that only grows is a guilt ledger, which §9 refuses.
  const rows = [row('stale', 'unanswered', ANSWERABLE_WINDOW_DAYS + 1), row('fresh', 'unanswered', 1)]
  assert.deepEqual(answerableBacklog(rows, NOW).map((r) => r.id), ['fresh'])
})

test('the window boundary is inclusive, so a session exactly at the edge is still answerable', () => {
  const rows = [row('edge', 'unanswered', ANSWERABLE_WINDOW_DAYS)]
  assert.equal(answerableBacklog(rows, NOW).length, 1)
})
