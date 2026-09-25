/** ADR-0085's pass criteria, as code. Written and committed before any judge run, so the
 *  bar cannot move to wherever a result lands.
 *
 *  Differs from scripts/spike/score.ts on purpose: there, a dropped prediction was a loss of
 *  coverage only. Here, criterion (a) is accuracy over EVERY labelled row, so a visit the
 *  judge never answered (a session truncated by rate limits, a host missing from the reply)
 *  counts wrong. Nothing is silently dropped. */
import type { EvalLabel, Truth } from './cases.ts'

export type Prediction = { sessionId: string; host: string; label: string; confidence: number }
export type Declared = { sessionId: string; host: string; declared: 'work' | 'distraction' | 'none' }

export const MIN_PRECISION = 0.8
export const MIN_RENDERED = 20
export const GRID: number[] = Array.from({ length: 20 }, (_, i) => Math.round(i * 5) / 100)

export const key = (r: { sessionId: string; host: string }) => `${r.sessionId}\u0000${r.host}`
const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d)

/** The declaration alone (ADR-0035), with one constant for every undeclared host. */
export function baseline(visits: Declared[], fill: 'neutral' | 'unknown'): Map<string, EvalLabel> {
  return new Map(visits.map((v) => [
    key(v),
    v.declared === 'work' ? 'focused' : v.declared === 'distraction' ? 'drift' : fill,
  ]))
}

/** What the product would show: the label at or above the floor, `unknown` below it. */
export function presented(predictions: Prediction[], floor: number): Map<string, string> {
  const out = new Map<string, string>()
  for (const p of predictions) {
    const k = key(p)
    if (out.has(k)) continue // a repeated host in one reply: the first answer stands
    out.set(k, p.confidence >= floor ? p.label : 'unknown')
  }
  return out
}

export function accuracyAll(answers: Map<string, string>, truth: Truth[]) {
  let correct = 0
  let uncovered = 0
  for (const t of truth) {
    const a = answers.get(key(t))
    if (a === undefined) uncovered++
    else if (a === t.label) correct++
  }
  return { correct, total: truth.length, uncovered, accuracy: ratio(correct, truth.length) }
}

export function renderedPrecision(predictions: Prediction[], truth: Truth[], floor: number) {
  const answers = new Map(truth.map((t) => [key(t), t.label]))
  const seen = new Set<string>()
  let rendered = 0
  let correct = 0
  for (const p of predictions) {
    const k = key(p)
    if (seen.has(k) || !answers.has(k)) continue
    seen.add(k)
    if (p.confidence < floor) continue
    rendered++
    if (answers.get(k) === p.label) correct++
  }
  return { rendered, correct, precision: ratio(correct, rendered) }
}

/** The floor is a number the dev split produces, not one anybody picks (ADR-0073). */
export function pickFloor(predictions: Prediction[], truth: Truth[]) {
  const sweep = GRID.map((floor) => ({ floor, ...renderedPrecision(predictions, truth, floor) }))
  const hit = sweep.find((s) => s.rendered >= MIN_RENDERED && s.precision >= MIN_PRECISION)
  return { floor: hit ? hit.floor : null, sweep }
}

export function gate(
  { predictions, truth, floor, baselineAccuracy }:
  { predictions: Prediction[]; truth: Truth[]; floor: number; baselineAccuracy: number },
) {
  const acc = accuracyAll(presented(predictions, floor), truth)
  const prec = renderedPrecision(predictions, truth, floor)
  const a = { judge: acc.accuracy, baseline: baselineAccuracy, correct: acc.correct, total: acc.total, uncovered: acc.uncovered, pass: acc.accuracy > baselineAccuracy }
  const b = { ...prec, pass: prec.rendered >= MIN_RENDERED && prec.precision >= MIN_PRECISION }
  return { floor, a, b, pass: a.pass && b.pass }
}
