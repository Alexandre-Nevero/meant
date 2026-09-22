/** Makes M9 and K6 computable — before the first model call rather than after the first bill.
 *
 *  M9: inference cost per active user per month, as a share of subscription price, under 15%.
 *  K6: above that for two consecutive months, cut judge frequency or raise price. Do not ship
 *  at negative margin.
 *
 *  Both were committed in PRD §8 and neither had a mechanism, which makes K6 a kill criterion
 *  that cannot fire. The figures are comfortable today — that is exactly why this gets skipped,
 *  and why the first month they stop being true would go unnoticed.
 *
 *  Model tier is explicitly a BUSINESS decision and not a quality one (PRD §7). This is the
 *  number that decision needs in front of it.
 */

/** USD per million tokens. Anthropic verified 2026-09-11; Groq verified 2026-09-21 from
 *  console.groq.com/docs/models. ADR-0072 selects Groq; the Anthropic rows stay because the
 *  eval compares tiers and an unpriced model throws. */
export const MODEL_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  'claude-haiku-4-5-20251001': { inPerM: 1, outPerM: 5 },
  'claude-sonnet-5': { inPerM: 2, outPerM: 10 },
  'claude-opus-5': { inPerM: 5, outPerM: 25 },
  'openai/gpt-oss-20b': { inPerM: 0.075, outPerM: 0.3 },
  'openai/gpt-oss-120b': { inPerM: 0.15, outPerM: 0.6 },
}

/** §7.1 prices against Focusmate ($8/mo annual, $12/mo monthly) — the software competing for
 *  the subscription slot — not against human coaches at $300–700/mo. */
export const SUBSCRIPTION_USD = 12
export const M9_CEILING = 0.15

export function costOf({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string
  inputTokens: number
  outputTokens: number
}): number {
  const price = MODEL_PRICES[model]
  // Never fall back to zero. An unrecognised model silently costing nothing is how a margin
  // failure stays invisible until the invoice — and new model ids appear without warning.
  if (!price) throw new Error(`unknown model for costing: ${model}`)
  for (const [name, n] of [['inputTokens', inputTokens], ['outputTokens', outputTokens]] as const) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      throw new Error(`invalid ${name}: ${n}`)
    }
  }
  return (inputTokens / 1_000_000) * price.inPerM + (outputTokens / 1_000_000) * price.outPerM
}

/** M9 and K6 are both written as a SHARE of price, not a dollar figure, because the ceiling
 *  moves when the price does. Keep the comparison in those terms. */
export function shareOfSubscription(monthlyCostUsd: number): number {
  return monthlyCostUsd / SUBSCRIPTION_USD
}
