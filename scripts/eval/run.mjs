// ADR-0085. The judge's eval, re-runnable by anyone with a Groq key.
//
//   npm run eval:judge              # every step, in order
//   npm run eval:judge -- baseline  # one step: baseline | dev | floor | test | report
//
// The order is the eval's integrity: baseline on test, then the judge on dev, then the floor
// from dev alone, then the judge ONCE on test. `test` refuses to run without a floor, and
// refuses to overwrite a recorded test result.
//
// ADR-0072: no prompt or response body is ever printed. Output is counts and scores only.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { buildCases } from '../../lib/judge/corpus.ts'
import { JUDGE_MODEL, judgeRequestBody, parseVerdicts } from '../../lib/judge/request.ts'
import { splitBySession } from '../spike/split.ts'
import { toInputs, validateSet } from './cases.ts'
import { baseline, accuracyAll, pickFloor, gate, MIN_PRECISION, MIN_RENDERED } from './score.ts'
import { fetchWithRetry } from './retry.ts'

const SET = 'eval/judge-cases.json'
const OUT = 'eval/results'
const file = (name) => `${OUT}/${name}.json`
const read = (name) => JSON.parse(readFileSync(file(name), 'utf8'))
const write = (name, value) => writeFileSync(file(name), JSON.stringify(value, null, 2) + '\n')
const fmt = (n) => n.toFixed(3)

function load() {
  const set = JSON.parse(readFileSync(SET, 'utf8'))
  validateSet(set)
  const { sessions, events, paths, truth } = toInputs(set)
  const cases = buildCases(sessions, events, paths)
  const scored = cases.reduce((n, c) => n + c.visits.length, 0)
  if (cases.length !== set.sessions.length || scored !== truth.length) {
    throw new Error(`buildCases kept ${cases.length} sessions / ${scored} visits of ${set.sessions.length} / ${truth.length}`)
  }
  const c = splitBySession(cases, 0.5)
  const t = splitBySession(truth, 0.5)
  return { cases: c, truth: t, all: truth }
}

function baselineStep() {
  const { cases, truth } = load()
  const visits = cases.test.flatMap((c) => c.visits)
  const neutral = accuracyAll(baseline(visits, 'neutral'), truth.test)
  const unknown = accuracyAll(baseline(visits, 'unknown'), truth.test)
  const result = {
    split: 'test',
    sessions: cases.test.length,
    visits: truth.test.length,
    fillNeutral: neutral,
    fillUnknown: unknown,
    stronger: neutral.accuracy >= unknown.accuracy ? 'neutral' : 'unknown',
    accuracy: Math.max(neutral.accuracy, unknown.accuracy),
  }
  write('baseline-test', result)
  console.log(`baseline on test (${result.sessions} sessions, ${result.visits} visits): undeclared=neutral ${fmt(neutral.accuracy)}, undeclared=unknown ${fmt(unknown.accuracy)}; bar ${fmt(result.accuracy)}`)
}

async function judge(side) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is not set (.env.local)')
  const { cases } = load()
  const chosen = cases[side]
  const predictions = []
  const uncovered = []
  let inputTokens = 0
  let outputTokens = 0

  for (const [i, c] of chosen.entries()) {
    const res = await fetchWithRetry(() => fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(judgeRequestBody(c)),
    }))
    // Never print a body: on some errors it echoes the request, which carries paths.
    if (!res || !res.ok) {
      uncovered.push({ sessionId: c.sessionId, why: res ? `HTTP ${res.status}` : 'network' })
      console.error(`\nsession ${i + 1}: ${res ? `HTTP ${res.status}` : 'network error'} — counted uncovered`)
      continue
    }
    const data = await res.json()
    inputTokens += data.usage?.prompt_tokens ?? 0
    outputTokens += data.usage?.completion_tokens ?? 0
    const parsed = parseVerdicts(data.choices?.[0]?.message?.content)
    if (!parsed) {
      uncovered.push({ sessionId: c.sessionId, why: 'unparseable' })
      console.error(`\nsession ${i + 1}: unparseable reply — counted uncovered`)
      continue
    }
    for (const v of parsed) predictions.push({ sessionId: c.sessionId, ...v })
    process.stdout.write(`\r${side}: ${i + 1}/${chosen.length} sessions`)
  }

  write(`judge-${side}`, {
    split: side,
    model: JUDGE_MODEL,
    ranAt: new Date().toISOString(),
    sessions: chosen.length,
    visits: chosen.reduce((n, c) => n + c.visits.length, 0),
    uncoveredSessions: uncovered,
    tokens: { input: inputTokens, output: outputTokens },
    predictions,
  })
  console.log(`\n${side}: ${predictions.length} verdicts, ${uncovered.length} uncovered sessions, ${inputTokens} in / ${outputTokens} out tokens`)
}

function floorStep() {
  const { truth } = load()
  const dev = read('judge-dev')
  const { floor, sweep } = pickFloor(dev.predictions, truth.dev)
  write('floor', { from: 'judge-dev', minPrecision: MIN_PRECISION, minRendered: MIN_RENDERED, floor, sweep })
  console.log('floor  rendered  precision   (dev)')
  for (const s of sweep) console.log(`${s.floor.toFixed(2)}   ${String(s.rendered).padStart(5)}     ${fmt(s.precision)}`)
  console.log(floor === null ? 'no floor: dev precision never reached the bar — the gate fails, test is not run' : `floor = ${floor.toFixed(2)}`)
}

async function testStep() {
  if (!existsSync(file('floor'))) throw new Error('no floor yet — run the dev and floor steps first')
  if (read('floor').floor === null) throw new Error('dev produced no floor — the gate has already failed; test is not run')
  if (existsSync(file('judge-test'))) throw new Error(`${file('judge-test')} exists — the test split runs once. Delete it to re-run on your own copy.`)
  await judge('test')
}

function reportStep() {
  const { truth } = load()
  const floor = read('floor').floor
  const base = read('baseline-test')
  if (floor === null) {
    write('gate', { floor: null, pass: false, why: 'no dev floor' })
    return console.log('gate: FAIL — no dev floor')
  }
  const test = read('judge-test')
  const g = gate({ predictions: test.predictions, truth: truth.test, floor, baselineAccuracy: base.accuracy })
  write('gate', { ...g, sessions: test.sessions, visits: test.visits, uncoveredSessions: test.uncoveredSessions.length })
  console.log(`test, floor ${floor.toFixed(2)}:`)
  console.log(`  (a) accuracy over all ${g.a.total} rows: judge ${fmt(g.a.judge)} vs baseline ${fmt(g.a.baseline)} (${g.a.uncovered} uncovered) — ${g.a.pass ? 'pass' : 'FAIL'}`)
  console.log(`  (b) precision among ${g.b.rendered} rendered: ${fmt(g.b.precision)} — ${g.b.pass ? 'pass' : 'FAIL'}`)
  console.log(`gate: ${g.pass ? 'PASS' : 'FAIL'}`)
}

const step = process.argv[2] ?? 'all'
const steps = { baseline: baselineStep, dev: () => judge('dev'), floor: floorStep, test: testStep, report: reportStep }
try {
  if (step === 'all') {
    for (const name of ['baseline', 'dev', 'floor']) await steps[name]()
    if (read('floor').floor !== null) await steps.test()
    reportStep()
  } else if (steps[step]) {
    await steps[step]()
  } else {
    throw new Error(`unknown step "${step}" — one of: all, ${Object.keys(steps).join(', ')}`)
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
