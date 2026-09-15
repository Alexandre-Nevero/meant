import test from 'node:test'
import assert from 'node:assert/strict'
import { toBand } from '../lib/band.ts'

test('toBand excludes a row whose domain is shaped like a chrome-extension ID, even with real seconds', () => {
  const rows = [
    { kind: 'attention', domain: 'facebook.com', seconds: 240 },
    { kind: 'attention', domain: 'emnalgngpciahekjdcgpbgnhmkpjhlhi', seconds: 60 },
  ]
  const segments = toBand(rows)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].flex, 240)
})

test('toBand still includes localhost — a real, legitimate dotless tracked domain', () => {
  // A blanket "must contain a dot" rule would silently exclude this, a real domain
  // this codebase already tracks and tests (e2e/session-lifecycle.spec.ts). The filter
  // must target the SHAPE of a chrome-extension ID specifically (32 chars, a-p only),
  // not dot-presence in general.
  const rows = [
    { kind: 'attention', domain: 'facebook.com', seconds: 100 },
    { kind: 'attention', domain: 'localhost', seconds: 50 },
  ]
  const segments = toBand(rows)
  assert.equal(segments.length, 2)
})

test('toBand excludes an extension-ID-shaped string even if it happens to contain a dot-adjacent character elsewhere', () => {
  // Guards against a regex that's accidentally too loose (e.g. matching a substring
  // instead of the whole string) — a real domain that merely CONTAINS 32 a-p characters
  // somewhere must not be excluded; only a domain that IS exactly that shape, start to
  // end, should be.
  const rows = [
    { kind: 'attention', domain: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.com', seconds: 30 },
  ]
  const segments = toBand(rows)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].flex, 30)
})

test('a session that recorded nothing renders the dashed remainder, not a full band', () => {
  // An empty segment list produces a CHILDLESS .m-mark, which matches
  // .m-mark:empty[data-state="ended"]::after (globals.css) and paints the decorative brand
  // glyph — then [data-surface="ledger"] .m-row .m-mark stretches it to the full column with
  // no :not(:empty) guard. Observed on the ledger: a session with zero events drew the
  // fullest, most complete-looking band on the page.
  const segments = toBand([])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].kind, 'remainder')
})

test('a session whose only rows are zero-length also renders the remainder', () => {
  const segments = toBand([{ kind: 'attention', domain: 'a.com', seconds: 0 }])
  assert.equal(segments[0].kind, 'remainder')
})

test('a session with real attention is unchanged', () => {
  const segments = toBand([{ kind: 'attention', domain: 'a.com', seconds: 60 }])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].kind, 'attention-1')
})
