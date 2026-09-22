import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { labelsToEvents } from '../extension/lib/visit-label.js'

// Regression guard. The companion's one-tap label (ADR-0058) emits kind 'label'. The events
// route validates against a fixed KINDS list and rejects anything else with a 400.
//
// That is not a dropped label — it is worse. flush() (extension/sw.js) batches ALL of a
// session's queued events into one POST, so a single rejected label makes the whole batch
// fail, res.ok is false, nothing is marked sent, and every attention and away event for that
// session stays queued and retries forever with the same poison payload still in it.
test("the events route accepts every kind the extension can emit", () => {
  const route = readFileSync('app/api/events/route.ts', 'utf8')
  const emitted = new Set(labelsToEvents([{ domain: 'a.com', label: 'drift', at: 1 }]).map((e) => e.kind))
  emitted.add('attention').add('away').add('block_hit')
  const declared = route.match(/const KINDS = \[([^\]]+)\]/)
  assert.ok(declared, 'KINDS not found in the events route')
  for (const kind of emitted) {
    assert.ok(declared[1].includes(`'${kind}'`), `events route rejects kind '${kind}'`)
  }
})

test('the events route persists the label column', () => {
  // event.label already exists (ADR-0044) with work|distract|neutral|unknown. Accepting the
  // kind but dropping the column would store a row that says nothing.
  const route = readFileSync('app/api/events/route.ts', 'utf8')
  assert.ok(/insert into event \([^)]*label/.test(route), 'label column is not inserted')
})
