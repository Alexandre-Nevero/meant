import test from 'node:test'
import assert from 'node:assert/strict'
import { toInputs, validateSet } from '../scripts/eval/cases.ts'
import { buildCases } from '../lib/judge/corpus.ts'
import {
  GRID, baseline, presented, accuracyAll, renderedPrecision, pickFloor, gate,
} from '../scripts/eval/score.ts'
import { retryDelayMs, fetchWithRetry } from '../scripts/eval/retry.ts'

const set = {
  sessions: [
    {
      id: 's1', intention: 'schedule the bakery posts', outcome: 'yes', localHour: 10,
      workSites: ['later.com'], blockedDomains: ['reddit.com'],
      visits: [
        { host: 'later.com', seconds: 900, paths: ['/app/calendar', '/app/media'], label: 'focused', reason: 'the scheduler itself' },
        { host: 'instagram.com', seconds: 300, paths: ['/reels/'], label: 'drift', reason: 'reels feed' },
      ],
    },
  ],
}

test('the eval set expands into the rows the production corpus builder reads', () => {
  const { sessions, events, paths, truth } = toInputs(set)
  const cases = buildCases(sessions, events, paths)
  assert.equal(cases.length, 1)
  const [c] = cases
  assert.equal(c.intention, 'schedule the bakery posts')
  assert.equal(c.outcome, 'yes')
  assert.equal(c.localHour, 10)
  assert.deepEqual(c.visits.map((v) => [v.host, v.seconds, v.declared, v.paths]), [
    ['later.com', 900, 'work', ['/app/calendar', '/app/media']],
    ['instagram.com', 300, 'none', ['/reels/']],
  ])
  assert.deepEqual(truth, [
    { sessionId: 's1', host: 'later.com', label: 'focused' },
    { sessionId: 's1', host: 'instagram.com', label: 'drift' },
  ])
})

test('validateSet refuses a missing label, a missing reason, or a repeated host', () => {
  const bad = (visit) => ({ sessions: [{ ...set.sessions[0], visits: [visit] }] })
  assert.throws(() => validateSet(bad({ host: 'a.com', seconds: 1, paths: [], label: 'work', reason: 'x' })))
  assert.throws(() => validateSet(bad({ host: 'a.com', seconds: 1, paths: [], label: 'focused', reason: '' })))
  const v = set.sessions[0].visits[0]
  assert.throws(() => validateSet({ sessions: [{ ...set.sessions[0], visits: [v, v] }] }))
  assert.doesNotThrow(() => validateSet(set))
})

const truth = [
  { sessionId: 's1', host: 'a.com', label: 'focused' },
  { sessionId: 's1', host: 'b.com', label: 'drift' },
  { sessionId: 's2', host: 'c.com', label: 'unknown' },
  { sessionId: 's2', host: 'd.com', label: 'neutral' },
]

test('the grid runs 0.00 to 0.95 in steps of 0.05', () => {
  assert.equal(GRID.length, 20)
  assert.equal(GRID[0], 0)
  assert.equal(GRID[19], 0.95)
  assert.equal(GRID[14], 0.7)
})

test('baseline resolves declarations and fills every undeclared host with one constant', () => {
  const visits = [
    { sessionId: 's1', host: 'a.com', declared: 'work' },
    { sessionId: 's1', host: 'b.com', declared: 'distraction' },
    { sessionId: 's2', host: 'c.com', declared: 'none' },
  ]
  assert.deepEqual([...baseline(visits, 'neutral').values()], ['focused', 'drift', 'neutral'])
  assert.deepEqual([...baseline(visits, 'unknown').values()], ['focused', 'drift', 'unknown'])
})

test('below the floor the judge says unknown; the first prediction per visit wins', () => {
  const preds = [
    { sessionId: 's1', host: 'a.com', label: 'focused', confidence: 0.9 },
    { sessionId: 's1', host: 'a.com', label: 'drift', confidence: 0.9 },
    { sessionId: 's2', host: 'c.com', label: 'drift', confidence: 0.3 },
  ]
  const m = presented(preds, 0.5)
  assert.equal(m.get('s1\u0000a.com'), 'focused')
  assert.equal(m.get('s2\u0000c.com'), 'unknown')
})

test('accuracy is over every labelled row, and an uncovered row counts wrong', () => {
  // a.com right, c.com right (unknown below floor), b.com and d.com have no prediction at all.
  const preds = [
    { sessionId: 's1', host: 'a.com', label: 'focused', confidence: 0.9 },
    { sessionId: 's2', host: 'c.com', label: 'drift', confidence: 0.2 },
  ]
  const a = accuracyAll(presented(preds, 0.5), truth)
  assert.equal(a.total, 4)
  assert.equal(a.correct, 2)
  assert.equal(a.uncovered, 2)
  assert.equal(a.accuracy, 0.5)
})

test('rendered precision counts only verdicts at or above the floor; a rendered verdict on an unknown row is wrong', () => {
  const preds = [
    { sessionId: 's1', host: 'a.com', label: 'focused', confidence: 0.9 },
    { sessionId: 's1', host: 'b.com', label: 'neutral', confidence: 0.8 },
    { sessionId: 's2', host: 'c.com', label: 'drift', confidence: 0.85 },
    { sessionId: 's2', host: 'd.com', label: 'neutral', confidence: 0.1 },
    { sessionId: 's9', host: 'z.com', label: 'drift', confidence: 1 }, // not in truth: ignored
  ]
  const p = renderedPrecision(preds, truth, 0.5)
  assert.equal(p.rendered, 3)
  assert.equal(p.correct, 1)
  assert.ok(Math.abs(p.precision - 1 / 3) < 1e-9)
})

// n rows, all correct at confidence `hi`, plus m wrong rows at confidence `lo`.
function fixture(n, hi, m, lo) {
  const t = []
  const p = []
  for (let i = 0; i < n; i++) {
    t.push({ sessionId: 's', host: `r${i}`, label: 'focused' })
    p.push({ sessionId: 's', host: `r${i}`, label: 'focused', confidence: hi })
  }
  for (let i = 0; i < m; i++) {
    t.push({ sessionId: 's', host: `w${i}`, label: 'drift' })
    p.push({ sessionId: 's', host: `w${i}`, label: 'focused', confidence: lo })
  }
  return { t, p }
}

test('the floor is the lowest grid point with dev precision >= 0.80 on at least 20 rendered verdicts', () => {
  // 24 right at 0.9, 10 wrong at 0.6: at 0.60 precision is 24/34 = 0.71; at 0.65 it is 1.0.
  const { t, p } = fixture(24, 0.9, 10, 0.6)
  assert.equal(pickFloor(p, t).floor, 0.65)
})

test('no floor exists when precision never clears 0.80 on 20 rendered verdicts', () => {
  const { t, p } = fixture(19, 0.9, 0, 0)
  assert.equal(pickFloor(p, t).floor, null)
})

test('the gate needs both: beat the stronger baseline, and precision >= 0.80 on 20 rendered', () => {
  const { t, p } = fixture(24, 0.9, 10, 0.6)
  const pass = gate({ predictions: p, truth: t, floor: 0.65, baselineAccuracy: 0.5 })
  assert.equal(pass.a.judge, 24 / 34) // the 10 wrong rows are below the floor, so `unknown` — still wrong
  assert.equal(pass.a.pass, true)
  assert.equal(pass.b.pass, true)
  assert.equal(pass.pass, true)

  const tie = gate({ predictions: p, truth: t, floor: 0.65, baselineAccuracy: 24 / 34 })
  assert.equal(tie.a.pass, false, 'a tie fails')
  assert.equal(tie.pass, false)

  const thin = gate({ predictions: p.slice(0, 19), truth: t, floor: 0.65, baselineAccuracy: 0 })
  assert.equal(thin.b.rendered, 19)
  assert.equal(thin.b.pass, false, 'fewer than 20 rendered is not a measurement')
})

test('retry delay honours retry-after, else backs off exponentially, capped', () => {
  assert.equal(retryDelayMs(0, '3'), 3000)
  assert.equal(retryDelayMs(0, null), 2000)
  assert.equal(retryDelayMs(2, null), 8000)
  assert.equal(retryDelayMs(10, null), 60000)
  assert.equal(retryDelayMs(0, '9999'), null, 'a wait longer than the cap is given up on')
})

test('fetchWithRetry retries 429, 5xx and network errors, then returns what it got', async () => {
  const slept = []
  const sleep = async (ms) => { slept.push(ms) }
  const responses = [
    new Response('', { status: 429, headers: { 'retry-after': '1' } }),
    new Response('', { status: 503 }),
    'throw',
    new Response('{}', { status: 200 }),
  ]
  const send = async () => {
    const r = responses.shift()
    if (r === 'throw') throw new TypeError('fetch failed')
    return r
  }
  const res = await fetchWithRetry(send, { tries: 5, sleep })
  assert.equal(res.status, 200)
  assert.deepEqual(slept, [1000, 4000, 8000])

  const never = await fetchWithRetry(async () => new Response('', { status: 429 }), { tries: 2, sleep })
  assert.equal(never.status, 429)
  const bad = await fetchWithRetry(async () => new Response('', { status: 400 }), { tries: 3, sleep: async () => assert.fail('a 400 is not retried') })
  assert.equal(bad.status, 400)
  const offline = await fetchWithRetry(async () => { throw new TypeError('x') }, { tries: 2, sleep })
  assert.equal(offline, null)
})
