import test from 'node:test'
import assert from 'node:assert/strict'
import { assertTestDatabase, isTestDatabase, testDatabaseUrlFrom, TEST_SUFFIX } from '../lib/db-guard.ts'

// Every e2e run before 2026-09-15 wrote to production. playwright.config.ts had no webServer
// block and inherited whatever dev server was on :3000, which reads .env.local. Result:
// 3,668 session rows across 3,651 user ids, six of them real.
//
// The guard keys on the DATABASE NAME, not the host or an env var, because that ties the
// permission to the TARGET rather than the environment: no combination of env vars can make
// production pass. It fails closed — anything it cannot confidently read is not a test db.

test('a database name ending in the suffix is accepted', () => {
  assert.equal(isTestDatabase(`postgresql://u:p@ep-x-pooler.aws.neon.tech/meant${TEST_SUFFIX}?sslmode=require`), true)
})

test('production is rejected', () => {
  assert.equal(isTestDatabase('postgresql://u:p@ep-x-pooler.aws.neon.tech/meant?sslmode=require'), false)
})

test('a name merely containing the word is rejected', () => {
  // "latest" ends in "test". Without the separator this guard would pass a database called
  // latest, which is exactly the kind of near-miss that makes a safety check decorative.
  assert.equal(isTestDatabase('postgresql://u:p@h/latest'), false)
  assert.equal(isTestDatabase('postgresql://u:p@h/test_meant'), false)
  assert.equal(isTestDatabase('postgresql://u:p@h/protest'), false)
})

test('the suffix alone, with no database name in front, is rejected', () => {
  assert.equal(isTestDatabase(`postgresql://u:p@h/${TEST_SUFFIX.replace(/^_/, '')}`), false)
  assert.equal(isTestDatabase(`postgresql://u:p@h/${TEST_SUFFIX}`), false)
})

test('an unparseable, empty or missing url is rejected rather than passed through', () => {
  for (const url of ['', undefined, null, 'not a url', 'postgresql://u:p@h/', 42, {}]) {
    assert.equal(isTestDatabase(url), false, JSON.stringify(url))
  }
})

test('a query string does not leak into the database name', () => {
  assert.equal(isTestDatabase('postgresql://u:p@h/meant?options=--search_path%3D_test'), false)
})

test('assertTestDatabase names the database it refused, so the error is actionable', () => {
  assert.throws(() => assertTestDatabase('postgresql://u:p@h/meant'), /"meant"/)
})

test('assertTestDatabase says (unparseable) rather than throwing a second error', () => {
  assert.throws(() => assertTestDatabase('garbage'), /unparseable/)
})

test('assertTestDatabase returns silently for a test database', () => {
  assert.doesNotThrow(() => assertTestDatabase(`postgresql://u:p@h/meant${TEST_SUFFIX}`))
})

test('testDatabaseUrlFrom reads DATABASE_URL and returns it when it is a test database', () => {
  const url = testDatabaseUrlFrom(`# a comment\nDATABASE_URL=postgresql://u:p@h/meant${TEST_SUFFIX}\nOTHER=1\n`)
  assert.equal(url, `postgresql://u:p@h/meant${TEST_SUFFIX}`)
})

test('testDatabaseUrlFrom strips surrounding quotes', () => {
  assert.equal(
    testDatabaseUrlFrom(`DATABASE_URL="postgresql://u:p@h/meant${TEST_SUFFIX}"`),
    `postgresql://u:p@h/meant${TEST_SUFFIX}`,
  )
})

test('testDatabaseUrlFrom refuses a missing file, rather than returning empty', () => {
  // The branch that matters: no .env.test must stop the run, not start a server with no URL
  // and let it fall through to whatever the process already had.
  assert.throws(() => testDatabaseUrlFrom(''), /unparseable/)
})

test('testDatabaseUrlFrom refuses a production URL in the file', () => {
  assert.throws(() => testDatabaseUrlFrom('DATABASE_URL=postgresql://u:p@h/meant'), /"meant"/)
})

test('testDatabaseUrlFrom is not fooled by a commented-out line', () => {
  assert.throws(() => testDatabaseUrlFrom(`# DATABASE_URL=postgresql://u:p@h/meant${TEST_SUFFIX}`), /unparseable/)
})
