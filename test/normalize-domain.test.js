import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDomain } from '../lib/domains.ts'

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
