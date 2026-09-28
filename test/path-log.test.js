import test from 'node:test'
import assert from 'node:assert/strict'
import { appendVisit, purgeExpired, purgeBefore, PATH_TTL_MS } from '../extension/lib/path-log.js'

// ADR-0059. Paths live in chrome.storage.local and NEVER in Postgres. The rule they do not
// break is lib/migrations/002-drift.sql:24 — a title or text column is release-blocking —
// and paths are WORSE than titles, not better: a path is a durable, resolvable handle to a
// specific private document. The browser already stores full history, so the device is not
// a new exposure class; the network boundary is the one that matters.

test('appendVisit splits host from path and keeps the path', () => {
  const log = appendVisit([], { url: 'https://chatgpt.com/c/abc123', at: 1000, sessionId: 's1' })
  assert.equal(log[0].host, 'chatgpt.com')
  assert.equal(log[0].path, '/c/abc123')
  assert.equal(log[0].sessionId, 's1')
  assert.equal(log[0].at, 1000)
})

test('appendVisit drops the query string and the fragment', () => {
  // A query carries search terms and tokens. The path alone distinguishes one area of a
  // site from another, which is all ADR-0059 needs.
  const log = appendVisit([], { url: 'https://x.com/search?q=private+thing#top', at: 1, sessionId: 's1' })
  assert.equal(log[0].path, '/search')
})

test('appendVisit strips www. so the host matches event.domain', () => {
  // bareHostname() (sw.js:89) strips www. before writing event.domain. If this did not
  // match, every www-prefixed site would look like two different hosts to the judge —
  // which is exactly the facebook.com / www.facebook.com double-count already in the data.
  const log = appendVisit([], { url: 'https://www.facebook.com/feed', at: 1, sessionId: 's1' })
  assert.equal(log[0].host, 'facebook.com')
})

test('appendVisit ignores non-http protocols', () => {
  for (const url of ['chrome-extension://abc/page.html', 'chrome://extensions', 'about:blank', 'file:///etc/passwd']) {
    assert.equal(appendVisit([], { url, at: 1, sessionId: 's1' }).length, 0, url)
  }
})

test('appendVisit ignores an unparseable url instead of throwing', () => {
  assert.equal(appendVisit([], { url: 'not a url', at: 1, sessionId: 's1' }).length, 0)
  assert.equal(appendVisit([], { url: undefined, at: 1, sessionId: 's1' }).length, 0)
})

test('appendVisit does not append a consecutive duplicate of the same host+path', () => {
  // transition() fires on tab activation, URL update AND the 30s tick, so the same page
  // would otherwise be logged repeatedly while the user simply sits on it.
  let log = appendVisit([], { url: 'https://a.com/x', at: 1, sessionId: 's1' })
  log = appendVisit(log, { url: 'https://a.com/x', at: 2, sessionId: 's1' })
  assert.equal(log.length, 1)
  log = appendVisit(log, { url: 'https://a.com/y', at: 3, sessionId: 's1' })
  assert.equal(log.length, 2)
})

test('appendVisit does append the same path again in a different session', () => {
  let log = appendVisit([], { url: 'https://a.com/x', at: 1, sessionId: 's1' })
  log = appendVisit(log, { url: 'https://a.com/x', at: 2, sessionId: 's2' })
  assert.equal(log.length, 2)
})

test('purgeExpired removes entries older than the TTL and keeps the rest', () => {
  const now = 10_000_000
  const log = [
    { sessionId: 's1', host: 'a.com', path: '/', at: now - PATH_TTL_MS - 1 },
    { sessionId: 's2', host: 'b.com', path: '/', at: now - 1000 },
  ]
  const kept = purgeExpired(log, now)
  assert.equal(kept.length, 1)
  assert.equal(kept[0].host, 'b.com')
})

test('purgeExpired tolerates a missing or non-array log', () => {
  assert.deepEqual(purgeExpired(undefined, 1), [])
  assert.deepEqual(purgeExpired(null, 1), [])
})

test('the TTL is time-based, and 30 days', () => {
  // ADR-0059: a free-tier user gets tracking and no analysis, so "purge after analysis"
  // would never fire for them and the log would grow without bound.
  assert.equal(PATH_TTL_MS, 30 * 24 * 60 * 60 * 1000)
})

// ADR-0087, issue #20. "Forget what you know about me" moves forget_at forward server-side;
// the device applies it locally by dropping any path recorded before that moment.
test('purgeBefore drops entries recorded before forgetAt and keeps entries at or after it', () => {
  const log = [
    { sessionId: 's1', host: 'a.com', path: '/', at: 1000 },
    { sessionId: 's2', host: 'b.com', path: '/', at: 2000 },
    { sessionId: 's3', host: 'c.com', path: '/', at: 2000 },
  ]
  const kept = purgeBefore(log, 2000)
  assert.deepEqual(kept.map((e) => e.host), ['b.com', 'c.com'])
})

test('purgeBefore with no cutoff (never forgotten) keeps everything', () => {
  const log = [{ sessionId: 's1', host: 'a.com', path: '/', at: 1000 }]
  assert.deepEqual(purgeBefore(log, null), log)
  assert.deepEqual(purgeBefore(log, undefined), log)
})

test('purgeBefore tolerates a missing or non-array log', () => {
  assert.deepEqual(purgeBefore(undefined, 1), [])
  assert.deepEqual(purgeBefore(null, 1), [])
})
