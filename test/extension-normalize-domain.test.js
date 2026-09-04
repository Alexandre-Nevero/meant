import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDomain } from '../extension/lib/normalize-domain.js'

// Mirrors test/normalize-domain.test.js exactly — that file covers lib/domains.ts's original;
// this covers the plain-JS extension's duplicate (extension/lib/normalize-domain.js), which
// must behave identically since it's the input popup.js's addable site chips actually use.

test('strips scheme, www, path, port, and lowercases', () => {
  assert.equal(normalizeDomain('https://www.Docs.Google.com/x'), 'docs.google.com')
})

test('bare hostname passes through lowercased', () => {
  assert.equal(normalizeDomain('Slack.com'), 'slack.com')
})

test('strips a port', () => {
  assert.equal(normalizeDomain('localhost:3000'), null)
})

test('strips a port on a real domain', () => {
  assert.equal(normalizeDomain('example.com:8080'), 'example.com')
})

test('http scheme also strips', () => {
  assert.equal(normalizeDomain('http://example.com/a/b?c=1'), 'example.com')
})

test('rejects anything without a dot', () => {
  assert.equal(normalizeDomain('localhost'), null)
})

test('rejects empty input', () => {
  assert.equal(normalizeDomain(''), null)
})

test('rejects whitespace-only input', () => {
  assert.equal(normalizeDomain('   '), null)
})

test('trims surrounding whitespace', () => {
  assert.equal(normalizeDomain('  example.com  '), 'example.com')
})

test('strips a trailing slash with no path', () => {
  assert.equal(normalizeDomain('https://example.com/'), 'example.com')
})

test('the exact failure mode from the reviewer finding: scheme + path survives without this', () => {
  assert.equal(normalizeDomain('https://gmail.com/inbox'), 'gmail.com')
})
