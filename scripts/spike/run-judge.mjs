// The first model call this product has ever made. Free tier, offline from every user
// surface, one call per session.
//
// ADR-0072: Groq with Zero Data Retention, and NO prompt or response body is ever logged.
// The console output below prints counts and scores, never content.
//
// Usage: node --env-file-if-exists=.env.local scripts/spike/run-judge.mjs <taxonomy> <model> [dev|test]
import { readFileSync, writeFileSync } from 'node:fs'
import { buildMessages, schemaFor } from './prompt.ts'
import { splitBySession } from './split.ts'

const [taxonomy = 'four', model = 'openai/gpt-oss-20b', side = 'dev'] = process.argv.slice(2)
const key = process.env.GROQ_API_KEY
if (!key) { console.error('GROQ_API_KEY is not set'); process.exit(1) }

const cases = JSON.parse(readFileSync('scripts/spike/fixtures/corpus.json', 'utf8'))
const chosen = splitBySession(cases, 0.5)[side === 'test' ? 'test' : 'dev']
console.log(`${chosen.length} sessions on ${side}, taxonomy=${taxonomy}, model=${model}`)

const predictions = []
let inputTokens = 0
let outputTokens = 0

for (const [i, c] of chosen.entries()) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: buildMessages(c, taxonomy),
      response_format: { type: 'json_schema', json_schema: schemaFor(taxonomy) },
    }),
  })

  if (!res.ok) {
    // Never print the body: on some errors it echoes the request, which carries paths.
    console.error(`session ${i + 1}: HTTP ${res.status} ${res.statusText}`)
    if (res.status === 429) { console.error('rate limited — free tier is 30 RPM / 8K TPM; wait and re-run'); break }
    continue
  }

  const body = await res.json()
  inputTokens += body.usage?.prompt_tokens ?? 0
  outputTokens += body.usage?.completion_tokens ?? 0

  let parsed
  try {
    parsed = JSON.parse(body.choices[0].message.content)
  } catch {
    console.error(`session ${i + 1}: unparseable response — counted as no prediction`)
    continue
  }

  for (const v of parsed.visits ?? []) {
    predictions.push({ sessionId: c.sessionId, host: v.host, label: v.label, confidence: v.confidence })
  }
  process.stdout.write(`\r${i + 1}/${chosen.length} sessions`)
}

const out = `scripts/spike/fixtures/results-${taxonomy}-${model.replace(/\//g, '_')}-${side}.json`
writeFileSync(out, JSON.stringify(predictions, null, 2))
console.log(`\n${predictions.length} predictions -> ${out}`)
console.log(`tokens: ${inputTokens} in / ${outputTokens} out (free tier allows 200,000 per day)`)
