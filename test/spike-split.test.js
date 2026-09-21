import test from 'node:test'
import assert from 'node:assert/strict'
import { splitBySession } from '../scripts/spike/split.ts'

const rows = [
  { sessionId: 's1', host: 'a.com' },
  { sessionId: 's1', host: 'b.com' },
  { sessionId: 's2', host: 'c.com' },
  { sessionId: 's3', host: 'd.com' },
  { sessionId: 's4', host: 'e.com' },
]

test('no session appears on both sides', () => {
  // Visits inside one session share an intention. Splitting by visit leaks the answer
  // across the boundary and inflates the held-out number.
  const { dev, test: held } = splitBySession(rows, 0.5)
  const devSessions = new Set(dev.map((r) => r.sessionId))
  for (const r of held) assert.equal(devSessions.has(r.sessionId), false)
})

test('every row lands on exactly one side', () => {
  const { dev, test: held } = splitBySession(rows, 0.5)
  assert.equal(dev.length + held.length, rows.length)
})

test('the split is deterministic across runs', () => {
  // A re-run that reshuffles would let a prompt be tuned against a moving test set.
  assert.deepEqual(splitBySession(rows, 0.5), splitBySession(rows, 0.5))
})

test('devShare controls roughly how many sessions land in dev', () => {
  const { dev } = splitBySession(rows, 0.5)
  const devSessions = new Set(dev.map((r) => r.sessionId))
  assert.equal(devSessions.size, 2)
})
