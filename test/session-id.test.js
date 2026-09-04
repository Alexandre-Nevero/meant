import test from 'node:test'
import assert from 'node:assert/strict'

test('a client-generated session id is a v4 uuid', () => {
  assert.match(crypto.randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
