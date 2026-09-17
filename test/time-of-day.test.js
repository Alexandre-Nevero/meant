import test from 'node:test'
import assert from 'node:assert/strict'
import { contrastByPartOfDay, PARTS } from '../lib/time-of-day.ts'

// ADR-0060: build the arithmetic before the judge. This is the second sentence the product can
// say for free, and the one Rize's Focus Hub is built to answer ("what time of day do I focus
// the best?") — answered here with arithmetic over the outcome column, no model.

const at = (hour, outcome) => ({ startedAtLocalHour: hour, outcome })

test('needs both arms — a part of day with only finished sessions is not a contrast', () => {
  // I6 as amended by ADR-0050: stating one side is a pattern claim from a single side.
  const rows = [at(9, 'yes'), at(10, 'yes'), at(11, 'yes')]
  assert.equal(contrastByPartOfDay(rows), null)
})

test('unanswered sessions are not a third outcome and are excluded', () => {
  const rows = [at(9, 'unanswered'), at(10, 'unanswered')]
  assert.equal(contrastByPartOfDay(rows), null)
})

test('picks the part of day with the widest split, in either direction', () => {
  // Mornings finish, evenings do not. The gap is what carries information.
  const rows = [
    at(9, 'yes'), at(9, 'yes'), at(10, 'yes'), at(10, 'yes'),
    at(20, 'no'), at(20, 'no'), at(21, 'no'), at(9, 'no'),
  ]
  const r = contrastByPartOfDay(rows)
  assert.equal(r.part, 'morning')
  assert.equal(r.finished, 4)
  assert.equal(r.unfinished, 1)
})

test('reports DISTINCT sessions so the I6 gate counts what it says it counts', () => {
  // The domain contrast had exactly this bug: it counted event rows and would have stated a
  // pattern on five sessions while reporting fifty-three. One row is one session here, and
  // unanswered rows never count as evidence.
  const rows = [at(9, 'yes'), at(9, 'no'), at(14, 'unanswered')]
  assert.equal(contrastByPartOfDay(rows).sessions, 2)
})

test('the evidence count is the named part alone, not every answered session', () => {
  // contrastByOutcome counts only the sessions backing the claim — that domain's yes plus no.
  // This must match (owner, 2026-09-17). A part of day does not inherit evidence from the
  // hours the sentence never mentions: mornings here rest on two sessions, and the claim is
  // about evenings, so the gate must see seven and not nine.
  const rows = [
    at(9, 'yes'), at(9, 'no'),
    at(20, 'yes'), at(20, 'yes'), at(20, 'yes'), at(20, 'yes'), at(20, 'yes'), at(20, 'yes'),
    at(21, 'no'),
  ]
  const r = contrastByPartOfDay(rows)
  assert.equal(r.part, 'evening')
  assert.equal(r.sessions, 7)
})

test('the four parts partition the clock with no gap and no overlap', () => {
  const covered = new Set()
  for (let h = 0; h < 24; h++) {
    const hit = PARTS.filter((p) => p.covers(h))
    assert.equal(hit.length, 1, `hour ${h} matched ${hit.length} parts`)
    covered.add(hit[0].name)
  }
  assert.equal(covered.size, 4)
})
