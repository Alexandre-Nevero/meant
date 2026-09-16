import test from 'node:test'
import assert from 'node:assert/strict'
import { costOf, MODEL_PRICES, SUBSCRIPTION_USD, M9_CEILING, shareOfSubscription } from '../lib/inference-cost.ts'

// M9: inference cost per active user per month, as a share of subscription price, under 15%.
// K6: above that for two consecutive months, cut judge frequency or raise price.
// Neither was computable before this file — A11 ("margin survives") is a Medium-confidence
// assumption that has never had an instrument.

test('costOf prices input and output separately, per million tokens', () => {
  const c = costOf({ model: 'claude-haiku-4-5-20251001', inputTokens: 1_000_000, outputTokens: 1_000_000 })
  assert.equal(Math.round(c * 100) / 100, 6) // $1 in + $5 out
})

test('costOf reproduces the figures verified on 2026-09-11', () => {
  // One batched on-demand analysis across ~10 sessions is about 2,700 in / 800 out.
  const t = { inputTokens: 2700, outputTokens: 800 }
  const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0002, `${a} vs ${b}`)
  near(costOf({ model: 'claude-haiku-4-5-20251001', ...t }), 0.0067)
  near(costOf({ model: 'claude-sonnet-5', ...t }), 0.0134)
  near(costOf({ model: 'claude-opus-5', ...t }), 0.0335)
})

test('an unknown model throws rather than costing nothing', () => {
  // A silent zero for an unrecognised model is exactly how a margin failure stays invisible
  // until the invoice arrives.
  assert.throws(() => costOf({ model: 'some-new-model', inputTokens: 10, outputTokens: 10 }), /unknown model/i)
})

test('negative or non-finite token counts are refused', () => {
  for (const bad of [-1, NaN, Infinity, '100']) {
    assert.throws(() => costOf({ model: 'claude-opus-5', inputTokens: bad, outputTokens: 0 }), /token/i, String(bad))
  }
})

test('shareOfSubscription expresses cost the way M9 and K6 are written', () => {
  // M9 is a SHARE, not a dollar figure, because the ceiling moves with the price.
  assert.ok(Math.abs(shareOfSubscription(1.2) - 0.1) < 1e-9)
  assert.equal(shareOfSubscription(0), 0)
})

test('on-demand at frontier quality costs less than per-session at the cheapest model', () => {
  // This is ADR-0060's actual claim, and it is stronger than "it clears the ceiling".
  // BOTH designs clear 15% — the PRD put per-session judging at about 7.5%. What changed
  // is that batching on demand buys a FRONTIER model for less than per-session cost on one
  // of the cheapest, so the saving buys quality rather than margin.
  const t = { inputTokens: 2700, outputTokens: 800 }
  const onDemandOpus = costOf({ model: 'claude-opus-5', ...t }) * 8          // 8 analyses/month
  const perSessionHaiku = costOf({ model: 'claude-haiku-4-5-20251001', ...t }) * 160 // ~8/day

  assert.ok(onDemandOpus < perSessionHaiku, `${onDemandOpus} vs ${perSessionHaiku}`)
  assert.ok(shareOfSubscription(onDemandOpus) < M9_CEILING)
  assert.ok(shareOfSubscription(perSessionHaiku) < M9_CEILING) // both fit; that is the point
  // Roughly a fourfold saving, at a far better model.
  assert.ok(perSessionHaiku / onDemandOpus > 3)
})

test('the constants are stated, not hidden inside a formula', () => {
  assert.equal(M9_CEILING, 0.15)
  assert.equal(SUBSCRIPTION_USD, 12)
  assert.ok(Object.keys(MODEL_PRICES).length >= 3)
})
