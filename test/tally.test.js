import test from 'node:test'
import assert from 'node:assert/strict'
import { withOpenSlice, toSegments } from '../extension/lib/tally.js'

test('toSegments: top three attention domains by seconds, 4th+ dropped', () => {
  const merged = { attention: { a: 100, b: 90, c: 80, d: 70 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  const attentionSegments = segments.filter((s) => s.kind.startsWith('attention'))
  assert.equal(attentionSegments.length, 3)
  assert.deepEqual(attentionSegments.map((s) => s.domain), ['a', 'b', 'c'])
})

test('toSegments: an exact tie keeps first-seen (insertion) order', () => {
  const merged = { attention: { later: 50, earlier: 50 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  assert.deepEqual(segments.map((s) => s.domain), ['later', 'earlier'])
})

test('toSegments: a zero-second domain is dropped', () => {
  const merged = { attention: { real: 30, zeroed: 0 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  assert.equal(segments.filter((s) => s.kind.startsWith('attention')).length, 1)
  assert.equal(segments[0].domain, 'real')
})

test('toSegments: a 32-char [a-p] domain is dropped; localhost is kept', () => {
  const merged = {
    attention: { 'emnalgngpciahekjdcgpbgnhmkpjhlhi': 60, localhost: 40 },
    away: 0,
    break: 0,
  }
  const segments = toSegments(merged)
  const attentionSegments = segments.filter((s) => s.kind.startsWith('attention'))
  assert.equal(attentionSegments.length, 1)
  assert.equal(attentionSegments[0].domain, 'localhost')
})

test('toSegments: away and break become their own segments when present', () => {
  const merged = { attention: { a: 10 }, away: 20, break: 30 }
  const segments = toSegments(merged)
  assert.deepEqual(segments.map((s) => s.kind), ['attention-1', 'away', 'break'])
})

test('toSegments: away/break omitted entirely when zero', () => {
  const merged = { attention: { a: 10 }, away: 0, break: 0 }
  const segments = toSegments(merged)
  assert.deepEqual(segments.map((s) => s.kind), ['attention-1'])
})

test('withOpenSlice: adds an open attention slice to an existing domain total', () => {
  const tally = { attention: { 'a.com': 100 }, away: 0, break: 0 }
  const slice = { domain: 'a.com', since: 1000, mode: 'attention' }
  const merged = withOpenSlice(tally, slice, 1000 + 30_000)
  assert.equal(merged.attention['a.com'], 130)
})

test('withOpenSlice: a null-domain attention slice adds nothing', () => {
  const tally = { attention: {}, away: 0, break: 0 }
  const slice = { domain: null, since: 1000, mode: 'attention' }
  const merged = withOpenSlice(tally, slice, 1000 + 30_000)
  assert.deepEqual(merged.attention, {})
})

test('withOpenSlice: at before slice.since adds nothing (no negative)', () => {
  const tally = { attention: { 'a.com': 50 }, away: 0, break: 0 }
  const slice = { domain: 'a.com', since: 5000, mode: 'attention' }
  const merged = withOpenSlice(tally, slice, 1000)
  assert.equal(merged.attention['a.com'], 50)
})

test('withOpenSlice: away/break slices land in their own buckets, no floor', () => {
  const tally = { attention: {}, away: 5, break: 0 }
  const awaySlice = { domain: null, since: 0, mode: 'away' }
  const merged = withOpenSlice(tally, awaySlice, 3_000) // 3 real seconds, below AWAY_MIN_MS's 15s floor
  assert.equal(merged.away, 8) // 5 + 3, no floor applied on a display read
})

test('withOpenSlice: no tally and no slice returns an empty merged object', () => {
  const merged = withOpenSlice(undefined, null, 1000)
  assert.deepEqual(merged, { attention: {}, away: 0, break: 0 })
})
