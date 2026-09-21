// Flattens the corpus into one line per visit for hand-labelling. JSONL rather than JSON
// because a single mistyped character can only break one line, and a diff stays readable.
// No labelling UI: 150-300 lines in an editor is faster to do than a tool is to build.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const cases = JSON.parse(readFileSync('scripts/spike/fixtures/corpus.json', 'utf8'))
const out = 'scripts/spike/fixtures/labels.jsonl'

if (existsSync(out)) {
  console.error(`${out} already exists — refusing to overwrite hand-labelled work`)
  process.exit(1)
}

const lines = []
for (const c of cases) {
  for (const v of c.visits) {
    lines.push(JSON.stringify({
      sessionId: c.sessionId,
      intention: c.intention,
      host: v.host,
      paths: v.paths,
      seconds: v.seconds,
      declared: v.declared,
      label: null,
    }))
  }
}
writeFileSync(out, lines.join('\n') + '\n')
console.log(`${lines.length} visits to label in ${out}`)
