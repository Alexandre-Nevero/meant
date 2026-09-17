import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStartPayload } from '../lib/session-payload.ts'

// ADR-0035 was built in the popup and disconnected from the database: work_sites and
// blocked_domains were non-empty in 0 of 3,668 rows because app/api/sessions/route.ts
// never inserted them. This function is the shape that fix depends on.
//
// It lives in its own module rather than inside the route because the route imports
// '@/lib/db', and `node --test` cannot resolve the '@/' tsconfig alias — the same reason
// test/review-data.test.js mirrors a filter instead of importing getReviewData.

test('normalizeStartPayload carries workSites, blockedDomains and cycle through', () => {
  const out = normalizeStartPayload({
    intention: 'write the proposal',
    plannedMinutes: 30,
    blocklist: ['social'],
    blockedDomains: ['facebook.com'],
    workSites: ['docs.google.com'],
    cycle: { work: 25, break: 5 },
  })
  assert.deepEqual(out.workSites, ['docs.google.com'])
  assert.deepEqual(out.blockedDomains, ['facebook.com'])
  assert.equal(out.cycleWorkMin, 25)
  assert.equal(out.cycleBreakMin, 5)
})

test('normalizeStartPayload defaults a null cycle to null minutes, not zero', () => {
  // "no cycles" is a real user choice (popup.js:299 returns cycle: null) and means one
  // continuous block. Storing 0 would be indistinguishable from a zero-length cycle.
  const out = normalizeStartPayload({ cycle: null })
  assert.equal(out.cycleWorkMin, null)
  assert.equal(out.cycleBreakMin, null)
})

test('normalizeStartPayload coerces non-arrays to empty arrays rather than throwing', () => {
  // The body is client-supplied and therefore untrusted, exactly like body.id.
  const out = normalizeStartPayload({ workSites: 'docs.google.com', blockedDomains: undefined })
  assert.deepEqual(out.workSites, [])
  assert.deepEqual(out.blockedDomains, [])
})

test('normalizeStartPayload stringifies array members so a nested object cannot reach SQL', () => {
  const out = normalizeStartPayload({ workSites: [{ evil: true }, 'ok.com'] })
  assert.deepEqual(out.workSites, ['[object Object]', 'ok.com'])
})

test('normalizeStartPayload rejects a non-integer plannedMinutes', () => {
  assert.equal(normalizeStartPayload({ plannedMinutes: 12.5 }).plannedMinutes, null)
  assert.equal(normalizeStartPayload({ plannedMinutes: '30' }).plannedMinutes, null)
})

test('normalizeStartPayload carries a valid localHour through, including midnight', () => {
  assert.equal(normalizeStartPayload({ localHour: 9 }).localHour, 9)
  // 0 is falsy but a legal hour (midnight) — a truthiness check would wrongly null this out.
  assert.equal(normalizeStartPayload({ localHour: 0 }).localHour, 0)
})

test('normalizeStartPayload nulls an out-of-range, non-integer, wrong-type or missing localHour', () => {
  assert.equal(normalizeStartPayload({ localHour: 24 }).localHour, null)
  assert.equal(normalizeStartPayload({ localHour: -1 }).localHour, null)
  assert.equal(normalizeStartPayload({ localHour: 9.5 }).localHour, null)
  assert.equal(normalizeStartPayload({ localHour: '9' }).localHour, null)
  assert.equal(normalizeStartPayload({ localHour: null }).localHour, null)
  assert.equal(normalizeStartPayload({}).localHour, null)
})
