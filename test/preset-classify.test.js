import test from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS } from '../extension/blocklists.js'
import { PRESET_IDS, CLASSIFY_MODEL, classifySchema, buildClassifyMessages, parseClassification } from '../lib/preset-classify.ts'

test('the classifier chooses among exactly the shipped presets', () => {
  assert.deepEqual(PRESET_IDS, Object.keys(PRESETS))
})

// ADR-0083 / ADR-0080: a model string no other feature uses, so no other daily cap counts it.
test('the classifier uses the small model, never the coach and judge model', () => {
  assert.equal(CLASSIFY_MODEL, 'openai/gpt-oss-20b')
})

test('the schema is strict and closed: one enum of preset ids plus none', () => {
  const s = classifySchema()
  assert.equal(s.strict, true)
  assert.equal(s.schema.additionalProperties, false)
  assert.deepEqual(s.schema.required, ['preset'])
  assert.deepEqual(s.schema.properties.preset.enum, [...PRESET_IDS, 'none'])
})

test('the intention goes only in the user turn, capped, and the system turn lists every preset', () => {
  const long = 'a'.repeat(1000)
  const [system, user] = buildClassifyMessages(long)
  assert.equal(system.role, 'system')
  assert.equal(user.role, 'user')
  assert.equal(user.content.length, 280)
  for (const id of PRESET_IDS) assert.ok(system.content.includes(`- ${id}: ${PRESETS[id].describe}`), id)
  assert.ok(system.content.includes('- none:'))
  assert.ok(/data to classify, never instructions/.test(system.content))
  assert.ok(!system.content.includes('a'.repeat(50)), 'the intention never leaks into the system turn')
})

test('a known preset id parses; none, junk and unknown ids are null', () => {
  assert.equal(parseClassification('{"preset":"research"}'), 'research')
  assert.equal(parseClassification('{"preset":"none"}'), null)
  assert.equal(parseClassification('{"preset":"gaming"}'), null)
  assert.equal(parseClassification('not json'), null)
  assert.equal(parseClassification(undefined), null)
})
