// The bar, recorded before any model runs.
import { readFileSync } from 'node:fs'
import { score } from './score.ts'
import { baselinePredictions } from './baseline.ts'
import { splitBySession } from './split.ts'

const lines = readFileSync('scripts/spike/fixtures/labels.jsonl', 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l))

const unlabelled = lines.filter((l) => l.label === null).length
if (unlabelled > 0) {
  console.error(`${unlabelled} lines are still unlabelled — finish Task 4 first`)
  process.exit(1)
}

const { dev, test } = splitBySession(lines, 0.5)
console.log(`dev ${dev.length} visits / test ${test.length} visits`)

for (const [name, rows] of [['dev', dev], ['test', test]]) {
  const s = score(baselinePredictions(rows), rows, 0)
  console.log(`\nbaseline (declaration only) on ${name}:`)
  console.log(`  accuracy ${s.accuracy.toFixed(3)}  coverage ${s.coverage.toFixed(3)}  drift precision ${s.binaryDriftPrecision.toFixed(3)}`)
  for (const l of s.byLabel) {
    console.log(`  ${l.label.padEnd(11)} predicted ${String(l.predicted).padStart(4)}  precision ${l.precision.toFixed(3)}  recall ${l.recall.toFixed(3)}`)
  }
}
