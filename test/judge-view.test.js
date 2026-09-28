import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JUDGE_RENDERS, MAX_SESSIONS_PER_ANALYSIS, analysisIds, shouldOffer, readAnalysis, rowText, judgedKey,
} from '../extension/lib/judge-view.js'
import { MAX_SESSIONS_PER_ANALYSIS as SERVER_MAX } from '../lib/thresholds.ts'

test('ADR-0086: the judge failed its gate, so rendering is off', () => {
  assert.equal(JUDGE_RENDERS, false)
})

test('the extension mirrors the server cap on sessions per analysis', () => {
  assert.equal(MAX_SESSIONS_PER_ANALYSIS, SERVER_MAX)
})

test('analysisIds dedupes and respects the cap', () => {
  const ids = Array.from({ length: 25 }, (_, i) => `s${i}`)
  assert.equal(analysisIds([...ids, 's0']).length, MAX_SESSIONS_PER_ANALYSIS)
  assert.deepEqual(analysisIds(['a', 'b', 'a']), ['a', 'b'])
})

test('judgedKey is order-independent, like the route keys an analysis (ADR-0077)', () => {
  assert.equal(judgedKey(['b', 'a']), judgedKey(['a', 'b']))
})

test('offered only when rendering is on and the user has not switched it off; absent means on', () => {
  assert.equal(shouldOffer({ renders: true, judgeEnabled: undefined }), true)
  assert.equal(shouldOffer({ renders: true, judgeEnabled: true }), true)
  assert.equal(shouldOffer({ renders: true, judgeEnabled: false }), false)
  assert.equal(shouldOffer({ renders: false, judgeEnabled: true }), false)
  assert.equal(shouldOffer({ judgeEnabled: true }), JUDGE_RENDERS)
})

test('offline, the daily cap, and any other failure are told apart', () => {
  assert.equal(readAnalysis({ ok: false, offline: true }).kind, 'offline')
  assert.equal(readAnalysis({ ok: false, status: 429, data: { error: 'daily analysis limit reached (10)' } }).kind, 'cap')
  assert.equal(readAnalysis({ ok: false, status: 502, data: null }).kind, 'error')
  assert.equal(readAnalysis({ ok: true, status: 200, data: null }).kind, 'error')
})

test('unknown renders nothing (ADR-0037); nothing left is a deliberate "nothing" state', () => {
  const res = { ok: true, status: 200, data: { verdicts: [
    { sessionId: 's1', host: 'a.com', label: 'unknown', confidence: 0.4 },
    { sessionId: 's1', host: 'b.com', label: 'unknown', confidence: 0.6 },
  ] } }
  assert.deepEqual(readAnalysis(res), { kind: 'nothing' })
})

test('verdicts at or above the floor become plain rows, first answer per visit wins', () => {
  const res = { ok: true, status: 200, data: { verdicts: [
    { sessionId: 's1', host: 'docs.google.com', label: 'focused', confidence: 0.9 },
    { sessionId: 's1', host: 'reddit.com', label: 'unknown', confidence: 0.3 },
    { sessionId: 's1', host: 'chatgpt.com', label: 'supportive', confidence: 0.8 },
    { sessionId: 's1', host: 'docs.google.com', label: 'drift', confidence: 0.9 },
    { sessionId: 's1', host: 'x.com', label: 'nonsense', confidence: 0.9 },
  ] } }
  const out = readAnalysis(res)
  assert.equal(out.kind, 'rows')
  assert.deepEqual(out.rows, [
    { sessionId: 's1', host: 'docs.google.com', label: 'focused' },
    { sessionId: 's1', host: 'chatgpt.com', label: 'supportive' },
  ])
  assert.equal(rowText(out.rows[0]), 'docs.google.com · focused')
})
