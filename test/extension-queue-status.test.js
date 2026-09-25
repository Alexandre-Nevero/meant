import test from 'node:test'
import assert from 'node:assert/strict'
import { queueStatusMessage } from '../extension/lib/queue-status.js'

test('an empty or missing queue has no message', () => {
  assert.equal(queueStatusMessage([]), null)
  assert.equal(queueStatusMessage(undefined), null)
})

test('one queued write is singular', () => {
  assert.equal(
    queueStatusMessage([{ path: '/api/events' }]),
    '1 update is waiting. It will send next time MEANT reaches the app.',
  )
})

test('several queued writes are plural and counted', () => {
  assert.equal(
    queueStatusMessage([{ path: '/api/events' }, { path: '/api/events' }, { path: '/api/sessions/x' }]),
    '3 updates are waiting. They will send next time MEANT reaches the app.',
  )
})
