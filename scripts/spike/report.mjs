// Usage: node scripts/spike/report.mjs <results-file.json> [dev|test]
import { readFileSync } from 'node:fs'
import { score, sweep } from './score.ts'
import { splitBySession } from './split.ts'

const [file, side = 'dev'] = process.argv.slice(2)
if (!file) { console.error('usage: node scripts/spike/report.mjs <results-file.json> [dev|test]'); process.exit(1) }

const lines = readFileSync('scripts/spike/fixtures/labels.jsonl', 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l))
const truth = splitBySession(lines, 0.5)[side === 'test' ? 'test' : 'dev']
const predictions = JSON.parse(readFileSync(file, 'utf8'))

console.log(`${file} on ${side}: ${predictions.length} predictions against ${truth.length} labelled visits\n`)
console.log('thresh  coverage  accuracy  drift-precision')
for (const s of sweep(predictions, truth)) {
  console.log(
    `${s.threshold.toFixed(2)}    ${s.coverage.toFixed(3)}     ${s.accuracy.toFixed(3)}     ${s.binaryDriftPrecision.toFixed(3)}`,
  )
}

const at0 = score(predictions, truth, 0)
console.log('\nper label, no threshold:')
for (const l of at0.byLabel) {
  console.log(`  ${l.label.padEnd(11)} predicted ${String(l.predicted).padStart(4)}  precision ${l.precision.toFixed(3)}  recall ${l.recall.toFixed(3)}`)
}
