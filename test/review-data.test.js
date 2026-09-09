import test from 'node:test'
import assert from 'node:assert/strict'
import { EXTENSION_ID_SHAPE } from '../lib/band.ts'

// getReviewData() itself hits a real Postgres connection (lib/db.ts's `sql`), so it can't
// be unit-tested directly without a database — this test instead proves the EXACT filter
// condition getReviewData's topAttention computation will use, mirroring the shape of its
// real filter chain rather than calling the function itself.
test('the topAttention filter shape excludes an extension-ID-shaped domain', () => {
  const rows = [
    { kind: 'attention', domain: 'chatgpt.com', seconds: 60 },
    { kind: 'attention', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 30 },
  ]
  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .slice(0, 3)
    .map((r) => ({ domain: r.domain, seconds: r.seconds }))
  assert.equal(topAttention.length, 1)
  assert.equal(topAttention[0].domain, 'chatgpt.com')
})

test('the topAttention filter shape still includes localhost', () => {
  const rows = [{ kind: 'attention', domain: 'localhost', seconds: 45 }]
  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .slice(0, 3)
    .map((r) => ({ domain: r.domain, seconds: r.seconds }))
  assert.equal(topAttention.length, 1)
  assert.equal(topAttention[0].domain, 'localhost')
})
