import test from 'node:test'
import assert from 'node:assert/strict'
import { contrastByPartOfDay, PARTS } from '../lib/time-of-day.ts'

// ADR-0060: build the arithmetic before the judge. This is the second sentence the product can
// say for free, and the one Rize's Focus Hub is built to answer ("what time of day do I focus
// the best?") — answered here with arithmetic over the outcome column, no model.

const at = (hour, outcome) => ({ startedAtLocalHour: hour, outcome })

// contrastByPartOfDay returns EVERY qualifying part, widest gap first — the caller applies the
// evidence floor and takes the first entry that clears it. `top` is that first entry where the
// test is about ranking rather than about selection.
const top = (rows) => contrastByPartOfDay(rows)[0]

test('needs both arms — a part of day with only finished sessions is not a contrast', () => {
  // I6 as amended by ADR-0050: stating one side is a pattern claim from a single side.
  const rows = [at(9, 'yes'), at(10, 'yes'), at(11, 'yes')]
  assert.deepEqual(contrastByPartOfDay(rows), [])
})

test('unanswered sessions are not a third outcome and are excluded', () => {
  // Fix round 1, finding 1: the unanswered row must share a part of day with a `yes` row. If the
  // outcome guard were deleted, the ternary would coerce 'unanswered' into the `no` arm, morning
  // would suddenly have both arms (yes=1, no=1), and this would return a contrast instead of
  // nothing. A row in a different, still-single-arm part of day could never prove that.
  const rows = [at(9, 'yes'), at(9, 'unanswered')]
  assert.deepEqual(contrastByPartOfDay(rows), [])
})

test('picks the part of day with the widest split, in either direction', () => {
  // Fix round 1, finding 2: TWO parts now clear the both-arms filter — evening (yes=1, no=2,
  // gap 1) and morning (yes=4, no=1, gap 3) — with evening's rows listed first, so a sort that
  // is deleted, no-op, or reversed returns evening (wrong) instead of morning (right, wider gap).
  const rows = [
    at(20, 'yes'), at(20, 'no'), at(21, 'no'),
    at(9, 'yes'), at(9, 'yes'), at(10, 'yes'), at(10, 'yes'), at(9, 'no'),
  ]
  const r = top(rows)
  assert.equal(r.part, 'morning')
  assert.equal(r.finished, 4)
  assert.equal(r.unfinished, 1)
})

test('picks the part where unfinished exceeds finished, when that gap is wider', () => {
  // Fix round 1, finding 2's second half: "either direction" was never exercised. Morning finishes
  // more than it doesn't (gap 1); night does not finish far more than it does (gap 3, reversed
  // direction). If the comparator used a signed difference instead of Math.abs, morning's +1 would
  // sort ahead of night's -3 and this would report the wrong part.
  const rows = [
    at(9, 'yes'), at(9, 'yes'), at(10, 'no'),
    at(23, 'no'), at(23, 'no'), at(23, 'no'), at(0, 'no'), at(1, 'yes'),
  ]
  const r = top(rows)
  assert.equal(r.part, 'night')
  assert.equal(r.finished, 1)
  assert.equal(r.unfinished, 4)
})

test('reports DISTINCT sessions so the I6 gate counts what it says it counts', () => {
  // Fix round 1, finding 3: the unanswered row now shares morning, the winning part, with the two
  // real rows. If the outcome guard were deleted it would join the `no` arm there (sessions would
  // read 3, not 2) instead of landing in an already-excluded bucket where its removal changes
  // nothing observable.
  const rows = [at(9, 'yes'), at(9, 'no'), at(10, 'unanswered')]
  assert.equal(top(rows).sessions, 2)
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
  const r = top(rows)
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

test('out-of-range and non-integer hours are not bucketed and do not crash', () => {
  // Fix round 1, finding 4: nothing exercised the range/integer guard. `covers()` uses bare
  // >=/< comparisons, so without the guard: 24 and -1 both satisfy night's `h >= 22 || h < 5`,
  // giving night a spurious both-arms contrast; 9.5 satisfies morning's range too; and NaN
  // matches none of the four predicates, so `PARTS.find(...)!.name` throws instead of returning
  // undefined. Any one of those would break the empty result asserted below.
  const rows = [at(24, 'yes'), at(-1, 'no'), at(9.5, 'yes'), at(NaN, 'no')]
  assert.deepEqual(contrastByPartOfDay(rows), [])
})

test('out-of-range and non-integer hours do not pollute a real bucket', () => {
  // Same guard, proven against a winning bucket rather than an empty result: if 9.5 were
  // accepted it would join morning's `no` arm (sessions 3, not 2); if 24 and -1 were accepted
  // they would seed a competing night contrast. Either failure changes an assertion below.
  const rows = [at(9, 'yes'), at(9, 'no'), at(9.5, 'no'), at(24, 'yes'), at(-1, 'no')]
  const r = top(rows)
  assert.equal(r.part, 'morning')
  assert.equal(r.sessions, 2)
})

test('a thin part of day does not suppress a thick one that clears the floor', () => {
  // The reproduction from the whole-branch review. Evening has the wider gap (1 yes / 5 no,
  // gap 4) and six answered sessions; morning has the narrower gap (8 yes / 6 no, gap 2) and
  // fourteen. Returning only the widest handed the caller evening, whose six sessions are under
  // PATTERN_MIN_SESSIONS, so NOTHING rendered — and under ADR-0066 the domain contrast then took
  // the single slot against a claim that never had to compete. Both entries must come back, in
  // gap order, so the caller can apply the floor itself.
  const rows = [
    ...Array.from({ length: 8 }, () => at(9, 'yes')),
    ...Array.from({ length: 6 }, () => at(9, 'no')),
    at(20, 'yes'),
    ...Array.from({ length: 5 }, () => at(20, 'no')),
  ]
  const r = contrastByPartOfDay(rows)
  assert.deepEqual(r.map((x) => x.part), ['evening', 'morning'])
  // What the dashboard does: the first entry that clears the eight-session floor.
  const claim = r.find((x) => x.sessions >= 8)
  assert.equal(claim.part, 'morning')
  assert.equal(claim.finished, 8)
  assert.equal(claim.unfinished, 6)
})

// Fix wave (post-hoc review of ADR-0084): a 4-task block sharing one block_id lands every row
// in the same part (same started_at_local_hour) by construction, and used to count as 4
// sessions there instead of 1.
test('a 4-task block with the same outcome counts as 1 session in its part, not 4', () => {
  const rows = [
    ...Array.from({ length: 4 }, () => ({ startedAtLocalHour: 9, outcome: 'yes', blockId: 'block-1' })),
    { startedAtLocalHour: 9, outcome: 'no', blockId: 'block-2' },
  ]
  const r = top(rows)
  assert.equal(r.finished, 1) // block-1, not 4
  assert.equal(r.unfinished, 1)
  assert.equal(r.sessions, 2)
})

test('a block whose own tasks disagree on outcome is excluded from its part entirely', () => {
  const rows = [
    { startedAtLocalHour: 9, outcome: 'yes', blockId: 'block-1' },
    { startedAtLocalHour: 9, outcome: 'no', blockId: 'block-1' },
    ...Array.from({ length: 4 }, () => ({ startedAtLocalHour: 9, outcome: 'yes', blockId: 'clean-yes' })).map((r, i) => ({ ...r, blockId: `clean-yes-${i}` })),
    ...Array.from({ length: 4 }, () => ({ startedAtLocalHour: 9, outcome: 'no', blockId: 'clean-no' })).map((r, i) => ({ ...r, blockId: `clean-no-${i}` })),
  ]
  const r = top(rows)
  assert.equal(r.sessions, 8) // block-1 excluded — 4 clean yes + 4 clean no, not 10
})

test('a null block_id (pre-migration, single-task) row still counts as its own session', () => {
  const rows = [
    { startedAtLocalHour: 9, outcome: 'yes', blockId: null },
    { startedAtLocalHour: 9, outcome: 'no', blockId: null },
  ]
  assert.equal(top(rows).sessions, 2)
})

test('equal gaps break by PARTS order, not by the order the rows arrived in', () => {
  // The sort is stable, so before the secondary key equal gaps fell back to Map insertion order
  // — which is whatever Postgres returned, from a query with no ORDER BY. The same six rows in
  // two orders gave `morning` and `evening`, so the sentence about the user could flip between
  // two page loads with no data change. Both orderings must now agree, and on morning, which is
  // first in PARTS. Deleting the tie-break fails the second assertion.
  const morningFirst = [at(9, 'yes'), at(9, 'yes'), at(9, 'no'), at(20, 'yes'), at(20, 'no'), at(20, 'no')]
  const eveningFirst = [at(20, 'yes'), at(20, 'no'), at(20, 'no'), at(9, 'yes'), at(9, 'yes'), at(9, 'no')]
  assert.deepEqual(contrastByPartOfDay(morningFirst).map((x) => x.part), ['morning', 'evening'])
  assert.deepEqual(contrastByPartOfDay(eveningFirst).map((x) => x.part), ['morning', 'evening'])
})
