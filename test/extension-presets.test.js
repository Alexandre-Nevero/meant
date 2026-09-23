import test from 'node:test'
import assert from 'node:assert/strict'
import { BLOCKLISTS, PRESETS } from '../extension/blocklists.js'
import { words, siteName, matchPreset, presetBlockSet } from '../extension/lib/presets.js'

test('the four presets exist, in priority order, with every field', () => {
  assert.deepEqual(Object.keys(PRESETS), ['writing', 'research', 'study', 'admin'])
  for (const [id, p] of Object.entries(PRESETS)) {
    assert.equal(typeof p.label, 'string', id)
    assert.equal(typeof p.describe, 'string', id)
    assert.ok(p.keywords.length > 0, id)
    assert.ok(p.keywords.every((k) => k === k.toLowerCase() && /^[a-z0-9]+$/.test(k)), `${id}: keywords are single lowercase words`)
    assert.ok(Array.isArray(p.block) && Array.isArray(p.allow), id)
    assert.ok(p.allow.every((d) => !p.block.includes(d)), `${id}: a site is never both blocked and allowed`)
  }
})

test('words lowercases and splits on anything that is not a letter or digit', () => {
  assert.deepEqual(words('Write the client-letter, NOW!'), ['write', 'the', 'client', 'letter', 'now'])
  assert.deepEqual(words(''), [])
})

test('siteName takes the registrable label, and refuses names under 3 letters', () => {
  assert.equal(siteName('instagram.com'), 'instagram')
  assert.equal(siteName('news.ycombinator.com'), 'ycombinator')
  assert.equal(siteName('bbc.co.uk'), 'bbc')
  assert.equal(siteName('x.com'), null)
})

test('a keyword picks its preset', () => {
  assert.equal(matchPreset('write the letter to the landlord'), 'writing')
  assert.equal(matchPreset('Research competitor pricing'), 'research')
  assert.equal(matchPreset('revise for the biology exam'), 'study')
  assert.equal(matchPreset('clear my inbox'), 'admin')
})

test('whole words only: a keyword inside a longer word does not match', () => {
  assert.equal(matchPreset('rewrite nothing'), null)
})

test('the first preset in file order wins when two match', () => {
  assert.equal(matchPreset('research for my essay'), 'writing')
})

test('no keyword, no preset', () => {
  assert.equal(matchPreset('quarterly numbers'), null)
  assert.equal(matchPreset(''), null)
})

test('the block set is the standing list plus the preset, deduplicated', () => {
  const preset = { block: ['x.com', 'reddit.com'], allow: [] }
  assert.deepEqual(presetBlockSet({ standing: ['reddit.com', 'espn.com'], preset }).sort(), ['espn.com', 'reddit.com', 'x.com'])
})

test('allowed sites leave the block set, even from the standing list', () => {
  const preset = { block: ['reddit.com'], allow: ['youtube.com'] }
  assert.deepEqual(presetBlockSet({ standing: ['youtube.com'], preset }), ['reddit.com'])
})

test('selected work sites leave the block set', () => {
  const preset = { block: ['linkedin.com', 'x.com'], allow: [] }
  assert.deepEqual(presetBlockSet({ standing: [], preset, workSites: ['linkedin.com'] }), ['x.com'])
})

// The defining case (PRD §1.2): Instagram at 4pm is the job.
test('a site the intention names is not blocked', () => {
  assert.equal(matchPreset('schedule instagram posts for the client'), 'admin')
  const set = presetBlockSet({ standing: [], preset: PRESETS.admin, intention: 'schedule instagram posts for the client' })
  assert.ok(!set.includes('instagram.com'))
  assert.ok(set.includes('facebook.com'))
})

test('a site name under 3 letters never matches a word', () => {
  const preset = { block: ['x.com'], allow: [] }
  assert.deepEqual(presetBlockSet({ standing: [], preset, intention: 'mark x on the map' }), ['x.com'])
})

test('research allows youtube; writing blocks every shipped group', () => {
  assert.ok(PRESETS.research.allow.includes('youtube.com'))
  for (const d of [...BLOCKLISTS.social, ...BLOCKLISTS.video, ...BLOCKLISTS.news]) {
    assert.ok(PRESETS.writing.block.includes(d), d)
  }
})
