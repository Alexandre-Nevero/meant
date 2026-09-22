import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachMessages } from '../lib/coach-prompt.ts'

const withData = {
  hasData: true,
  totalAttended: '40 min',
  totalAway: '5 min',
  sessionCount: 3,
  finishedCount: 2,
  notYetCount: 1,
  topSites: [{ domain: 'docs.google.com', share: 75 }],
}

const noData = {
  hasData: false,
  totalAttended: '',
  totalAway: '',
  sessionCount: 0,
  finishedCount: 0,
  notYetCount: 0,
  topSites: [],
}

test('the system message states the coach never grades the person', () => {
  const [system] = buildCoachMessages(withData, 'draft the proposal', [])
  assert.equal(system.role, 'system')
  assert.match(system.content, /never/i)
  assert.match(system.content, /grad|score/i)
})

test('the system message states Yes and Not yet are equally valid', () => {
  const [system] = buildCoachMessages(withData, 'draft the proposal', [])
  assert.match(system.content, /not yet/i)
})

test('real figures appear verbatim when there is data', () => {
  const [system] = buildCoachMessages(withData, 'draft the proposal', [])
  assert.match(system.content, /40 min/)
  assert.match(system.content, /5 min/)
  assert.match(system.content, /docs\.google\.com/)
  assert.match(system.content, /75%/)
  assert.match(system.content, /draft the proposal/)
})

test('no data means an honest statement, never an invented figure', () => {
  const [system] = buildCoachMessages(noData, 'draft the proposal', [])
  assert.match(system.content, /no sessions/i)
  assert.doesNotMatch(system.content, /\d+ (hr|min)/)
})

test('conversation history passes through unchanged, after the system message', () => {
  const history = [
    { role: 'user', content: 'how am I doing?' },
    { role: 'assistant', content: 'You have logged some time today.' },
  ]
  const messages = buildCoachMessages(withData, 'draft the proposal', history)
  assert.equal(messages.length, 3)
  assert.deepEqual(messages.slice(1), history)
})
