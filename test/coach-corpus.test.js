import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const corpus = JSON.parse(readFileSync('lib/coach-corpus.json', 'utf8'))

// ADR-0064. Three rules govern this file, and recency is the weakest of them.

test('every claim carries a source, a label and a checked date', () => {
  for (const c of corpus) {
    assert.ok(c.id, 'a claim has no id')
    assert.ok(c.source, `${c.id} has no source`)
    assert.ok(['verified', 'reported', 'inferred'].includes(c.label), `${c.id} has a bad label`)
    assert.match(c.checked, /^\d{4}-\d{2}-\d{2}$/, `${c.id} has no checked date`)
  }
})

test('no claim is sourced from a content farm', () => {
  // Rule 2: source tier is a GATE, not a preference. This list is not theoretical — these
  // four surfaced in the top results on 2026-09-15 carrying a "2026 Carnegie Mellon study of
  // 3,800 knowledge workers / 26.8 minutes / $1.2 trillion" claim, which is content-farm
  // inflation applied to Gloria Mark's genuine ~23-25 minute finding.
  const banned = ['makerstations.io', 'speakwiseapp.com', 'amraandelma.com', 'wifitalents.com']
  for (const c of corpus) {
    for (const host of banned) {
      assert.equal(c.source.includes(host), false, `${c.id} cites the content farm ${host}`)
    }
  }
})

test('every claim bears on something the product can observe or execute', () => {
  // Rule 1: relevance outranks recency. I5 bans suggesting what the product cannot do, so a
  // claim that informs no observable and no executable action has no business being loaded.
  for (const c of corpus) {
    assert.ok(c.bearsOn, `${c.id} bears on nothing the product can see or do`)
  }
})

test('a reported claim carries a caveat so the coach may not assert it', () => {
  for (const c of corpus.filter((c) => c.label === 'reported')) {
    assert.ok(c.caveat, `${c.id} is reported but carries no caveat`)
  }
})

test('the corpus contains attention material, not only motivation material', () => {
  // The failure this file exists to fix: IDEA §5's C9-C14 is about motivation, reward,
  // presence and goals — none of it about ATTENTION IN A BROWSER, the only thing the
  // product observes.
  const bears = corpus.map((c) => c.bearsOn.toLowerCase()).join(' ')
  assert.ok(/attention|interrupt|switch|drift/.test(bears), 'no attention claim in the corpus')
})

test('ids are unique', () => {
  const ids = corpus.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
})
