import test from 'node:test'
import assert from 'node:assert/strict'
import { JUDGE_MODEL, judgeRequestBody, parseVerdicts } from '../lib/judge/request.ts'
import { buildMessages, schemaFor } from '../lib/judge/prompt.ts'

const one = {
  sessionId: 's1',
  intention: 'finish the client proposal',
  outcome: 'no',
  localHour: 9,
  visits: [{ sessionId: 's1', host: 'chatgpt.com', paths: ['/c/abc'], seconds: 1860, order: 0, declared: 'none' }],
}

test('the shipped config is gpt-oss-120b (ADR-0080)', () => {
  assert.equal(JUDGE_MODEL, 'openai/gpt-oss-120b')
})

test('the request body is built from the production prompt and schema, nothing else', () => {
  const body = judgeRequestBody(one)
  assert.equal(body.model, JUDGE_MODEL)
  assert.equal(body.temperature, 0.1)
  assert.deepEqual(body.messages, buildMessages(one))
  assert.deepEqual(body.response_format, { type: 'json_schema', json_schema: schemaFor() })
})

test('parseVerdicts keeps in-vocabulary entries and drops the rest', () => {
  const content = JSON.stringify({
    visits: [
      { host: 'a.com', label: 'focused', confidence: 0.9 },
      { host: 'b.com', label: 'unknown', confidence: 0.9 },
      { host: 'c.com', label: 'drift', confidence: 0.4 },
    ],
  })
  assert.deepEqual(parseVerdicts(content), [
    { host: 'a.com', label: 'focused', confidence: 0.9 },
    { host: 'c.com', label: 'drift', confidence: 0.4 },
  ])
})

test('parseVerdicts returns null on unparseable content', () => {
  assert.equal(parseVerdicts('not json'), null)
  assert.equal(parseVerdicts(undefined), null)
})

test('parseVerdicts tolerates a missing visits array', () => {
  assert.deepEqual(parseVerdicts('{}'), [])
})
