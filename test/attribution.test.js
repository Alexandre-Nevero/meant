import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, emptySlice, idleMode } from '../extension/lib/attribution.js'

const T0 = 1_700_000_000_000
const at = (s) => T0 + s * 1000
const iso = (ms) => new Date(ms).toISOString()
const slice = (over) => ({ domain: null, since: at(0), mode: 'attention', awayCarryMs: 0, ...over })

test('attention closes into one attention event', () => {
  const { events, state } = advance(slice({ domain: 'docs.google.com' }), { at: at(90), mode: 'attention', domain: 'claude.ai' })
  assert.deepEqual(events, [{ kind: 'attention', domain: 'docs.google.com', seconds: 90, at: iso(at(90)) }])
  assert.equal(state.domain, 'claude.ai')
  assert.equal(state.since, at(90))
})

test('going away closes the attention slice and emits no away event yet', () => {
  const { events, state } = advance(slice({ domain: 'docs.google.com' }), { at: at(30), mode: 'away', domain: null })
  assert.deepEqual(events, [{ kind: 'attention', domain: 'docs.google.com', seconds: 30, at: iso(at(30)) }])
  assert.equal(state.mode, 'away')
})

test('an away slice over the floor emits away with a null domain', () => {
  const { events } = advance(slice({ mode: 'away' }), { at: at(300), mode: 'attention', domain: 'claude.ai' })
  assert.deepEqual(events, [{ kind: 'away', domain: null, seconds: 300, at: iso(at(300)) }])
})

test('FN3: short away gaps accumulate instead of inflating the open domain', () => {
  // Three 6-second alt-tabs = 18s. Today all 18s is credited to the domain.
  let s = slice({ domain: 'docs.google.com' })
  const all = []
  for (let i = 0; i < 3; i++) {
    let r = advance(s, { at: at(10 + i * 20), mode: 'away', domain: null }); all.push(...r.events); s = r.state
    r = advance(s, { at: at(16 + i * 20), mode: 'attention', domain: 'docs.google.com' }); all.push(...r.events); s = r.state
  }
  const away = all.filter((e) => e.kind === 'away')
  assert.equal(away.length, 1, 'one away event once the carry crosses the floor')
  assert.equal(s.awayCarryMs, 0, 'carry resets after emitting')
  const credited = all.filter((e) => e.kind === 'attention').reduce((n, e) => n + e.seconds, 0)
  // 56s of wall clock: 38s genuinely in the foreground, 18s away. The old settleFocus()
  // discarded every sub-60s gap and credited all 56s to the domain. Pin the exact split
  // rather than a bound, so a regression in either direction fails loudly.
  assert.equal(credited, 38, 'only real foreground time is credited')
  assert.equal(away[0].seconds, 18, 'the three 6s gaps became one 18s away event')
  assert.equal(credited + away[0].seconds, 56, 'conserved: nothing lost, nothing double-counted')
})

test('the away carry survives an intervening break, and totals stay conserved', () => {
  // away(6s) → break(30s) → attention(100s) → away(14s). The two away episodes are 20s
  // together and are reported as one 20s event, not two. Deliberate: the carry bridges
  // other activity (see FN3), and nothing reads away-event timestamps — only the totals.
  let s = { domain: 'x.com', since: at(0), mode: 'away', awayCarryMs: 0 }
  const all = []
  for (const next of [
    { at: at(6), mode: 'break', domain: 'youtube.com' },
    { at: at(36), mode: 'attention', domain: 'docs.google.com' },
    { at: at(136), mode: 'away', domain: null },
    { at: at(150), mode: 'attention', domain: 'docs.google.com' },
  ]) {
    const r = advance(s, next)
    all.push(...r.events)
    s = r.state
  }
  const total = (kind) => all.filter((e) => e.kind === kind).reduce((n, e) => n + e.seconds, 0)
  assert.equal(total('break'), 30)
  assert.equal(total('attention'), 100)
  assert.equal(total('away'), 20, 'both away episodes, summed, reported once')
  assert.equal(all.filter((e) => e.kind === 'away').length, 1)
  assert.equal(total('break') + total('attention') + total('away'), 150, 'conserved against wall clock')
  assert.equal(s.awayCarryMs, 0, 'carry resets after emitting')
})

test('FP5: break time is its own kind, and carries the domain it happened on', () => {
  // A break is not away and not attention. Keeping the domain lets the review say WHERE the
  // break was spent without it counting as work or as drift.
  const { events, state } = advance(slice({ domain: 'youtube.com', mode: 'break' }), { at: at(300), mode: 'attention', domain: 'docs.google.com' })
  assert.deepEqual(events, [{ kind: 'break', domain: 'youtube.com', seconds: 300, at: iso(at(300)) }])
  assert.equal(state.mode, 'attention')
})

test('a break with no domain still records the time', () => {
  const { events } = advance(slice({ mode: 'break' }), { at: at(300), mode: 'attention', domain: 'a.com' })
  assert.deepEqual(events, [{ kind: 'break', domain: null, seconds: 300, at: iso(at(300)) }])
})

test('break slices have no minimum — a 5 second break is still a break', () => {
  const { events } = advance(slice({ mode: 'break' }), { at: at(5), mode: 'attention', domain: 'a.com' })
  assert.equal(events.length, 1)
  assert.equal(events[0].seconds, 5)
})

test('sub-second transitions emit nothing and keep the timestamp', () => {
  const { events, state } = advance(slice({ domain: 'a.com' }), { at: T0 + 400, mode: 'attention', domain: 'b.com' })
  assert.deepEqual(events, [])
  assert.equal(state.since, T0 + 400)
})

test('a null domain in attention mode emits nothing (chrome://, new tab)', () => {
  assert.deepEqual(advance(slice(), { at: at(60), mode: 'attention', domain: 'a.com' }).events, [])
})

test('emptySlice starts in attention, no domain, no carry', () => {
  assert.deepEqual(emptySlice(at(0)), { domain: null, since: at(0), mode: 'attention', awayCarryMs: 0 })
})

test('idleMode maps all three chrome.idle states exhaustively', () => {
  assert.equal(idleMode('active', false), 'attention')
  assert.equal(idleMode('active', true), 'attention')
  assert.equal(idleMode('idle', false), 'away')
  assert.equal(idleMode('idle', true), null, 'audio playing: stay on the domain')
  assert.equal(idleMode('locked', false), 'away')
  assert.equal(idleMode('locked', true), 'away', 'a locked screen is never watching')
})

test('idleMode fails safe on an unknown state rather than dropping time', () => {
  // advance() has explicit mode branches, so an unmapped mode emits no event while state
  // still advances — the elapsed time vanishes. This is the guard that makes that
  // unreachable from sw.js.
  assert.equal(idleMode('hibernating', false), 'away')
  assert.equal(idleMode(undefined, false), 'away')
})
