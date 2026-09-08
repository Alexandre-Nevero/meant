import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSitePhrase } from '../extension/lib/resolve-sites.js'

test('resolves a single real domain unchanged', () => {
  assert.deepEqual(resolveSitePhrase('docs.google.com'), { ok: true, domains: ['docs.google.com'] })
})

test('resolves a comma-and-and phrase of aliases and real domains together', () => {
  const result = resolveSitePhrase('docs, gmail, and chatgpt.com')
  assert.equal(result.ok, true)
  assert.deepEqual(result.domains.slice().sort(), ['chatgpt.com', 'docs.google.com', 'gmail.com'])
})

test('rejects the whole phrase on one bad token, with a confident typo suggestion', () => {
  const result = resolveSitePhrase('docs, gmial')
  assert.equal(result.ok, false)
  assert.equal(result.badToken, 'gmial')
  assert.equal(result.suggestion, 'gmail')
})

test('rejects with no suggestion when nothing is close', () => {
  const result = resolveSitePhrase('docs, zzzznotasite')
  assert.equal(result.ok, false)
  assert.equal(result.suggestion, undefined)
})

test('deduplicates repeated resolutions within one phrase', () => {
  const result = resolveSitePhrase('gmail, gmail')
  assert.equal(result.ok, true)
  assert.deepEqual(result.domains, ['gmail.com'])
})

test('a single word with no comma still works, same as today', () => {
  assert.deepEqual(resolveSitePhrase('youtube.com'), { ok: true, domains: ['youtube.com'] })
})

// A bad token that is itself a substring of an earlier, valid token ("doc" inside "docs")
// must be identified by its own token POSITION, not by a substring search — otherwise a
// naive string .replace() call downstream would keep hitting the wrong occurrence and
// oscillate forever (see extension/popup.js's attemptCommit).
test('failure includes badIndex pointing at the failing token position, even when it is a substring of an earlier valid token', () => {
  const result = resolveSitePhrase('docs, doc')
  assert.equal(result.ok, false)
  assert.equal(result.badToken, 'doc')
  assert.equal(result.badIndex, 1)
  assert.equal(result.suggestion, 'docs')
})
