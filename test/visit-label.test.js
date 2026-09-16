import test from 'node:test'
import assert from 'node:assert/strict'
import { labelCurrentVisit, labelsToEvents } from '../extension/lib/visit-label.js'

// ADR-0058 + ADR-0062. One tap, one meaning: "this isn't the work."
//
// Why one meaning and not two: with no live drift flag, "this IS the work" has nothing to
// correct — nothing claimed otherwise — and the user already declared their work sites at
// session start (ADR-0035). Only the negative label carries information, and it is exactly
// the self-reported drift marker that replaces what ADR-0057 deleted.
//
// A self-report cannot be a false positive. That is the whole point: the failure mode that
// killed the live signal becomes structurally impossible, not merely mitigated.

test('labelCurrentVisit records a per-visit label, not a domain classification', () => {
  // ADR-0062: pencil, not stone. Tapping on instagram.com at 4pm must NOT teach the product
  // that Instagram is always drift — PRD §1.2 is the entire reason this product exists.
  const session = { sessionId: 's1', labels: [] }
  const next = labelCurrentVisit(session, 'instagram.com', 1000)
  assert.deepEqual(next.labels, [{ domain: 'instagram.com', label: 'distract', at: 1000 }])
})

test('labelCurrentVisit appends, so repeated taps accumulate evidence toward memory', () => {
  // Memory forms only past MEMORY_MIN_EVIDENCE (3) / MEMORY_MIN_AGREEMENT (80%), never at
  // n=1. ADR-0037's n=1 rule governs CORRECTIONS of a wrong flag, and there is no flag now.
  // Timestamps deliberately far apart: two taps within DUPLICATE_TAP_MS are one act, which
  // the dedupe test below asserts. Returning to the same site later in a session is not.
  const session = { sessionId: 's1', labels: [{ domain: 'a.com', label: 'distract', at: 1_000 }] }
  assert.equal(labelCurrentVisit(session, 'a.com', 600_000).labels.length, 2)
})

test('labelCurrentVisit is a no-op with no domain', () => {
  const session = { sessionId: 's1', labels: [] }
  assert.deepEqual(labelCurrentVisit(session, null, 1).labels, [])
  assert.deepEqual(labelCurrentVisit(session, undefined, 1).labels, [])
})

test('labelCurrentVisit tolerates a session that predates the labels field', () => {
  // Sessions already in chrome.storage.local when this ships have no `labels` key.
  const next = labelCurrentVisit({ sessionId: 's1' }, 'a.com', 1)
  assert.equal(next.labels.length, 1)
})

test('labelCurrentVisit does not mutate the session it was given', () => {
  const session = { sessionId: 's1', labels: [] }
  labelCurrentVisit(session, 'a.com', 1)
  assert.equal(session.labels.length, 0)
})

test('a second tap on the same domain in the same second is ignored', () => {
  // Double-tap, or a click that fires twice through the drag guard. One deliberate act
  // should be one piece of evidence, or the 3-observation memory threshold is meaningless.
  const session = { sessionId: 's1', labels: [] }
  const once = labelCurrentVisit(session, 'a.com', 1000)
  const twice = labelCurrentVisit(once, 'a.com', 1400)
  assert.equal(twice.labels.length, 1)
  const later = labelCurrentVisit(once, 'a.com', 9000)
  assert.equal(later.labels.length, 2)
})

test('labelsToEvents shapes labels for the events endpoint using the existing label column', () => {
  // event.label already exists with work|distract|neutral|unknown (ADR-0044) and `neutral`
  // is first-class (ADR-0047), so this needs NO migration.
  const events = labelsToEvents([{ domain: 'a.com', label: 'distract', at: 1000 }])
  assert.equal(events.length, 1)
  assert.equal(events[0].kind, 'label')
  assert.equal(events[0].domain, 'a.com')
  assert.equal(events[0].label, 'distract')
  assert.equal(events[0].seconds, 0)
})

test('labelsToEvents returns an empty array for a session with no labels', () => {
  assert.deepEqual(labelsToEvents(undefined), [])
  assert.deepEqual(labelsToEvents([]), [])
})
