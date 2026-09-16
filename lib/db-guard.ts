/** Refuses to let the e2e suite point at anything but a test database.
 *
 *  Before 2026-09-15 every Playwright run wrote to production. `playwright.config.ts` had no
 *  `webServer` block — its comment said the dev server "is assumed already running at
 *  localhost:3000" — so the suite inherited whatever server was there, and that server reads
 *  `.env.local`. The result: 3,668 session rows across 3,651 user ids, of which six were real.
 *  M1-M4 became unmeasurable, and anything the judge or memory learned would have been
 *  learning the test suite.
 *
 *  Keyed on the DATABASE NAME rather than the host or an env flag, deliberately. That ties
 *  the permission to the TARGET instead of the environment, so no combination of environment
 *  variables can make production pass. A Neon branch of production is not enough on its own —
 *  a branch inherits its parent's database name and would otherwise sail through.
 *
 *  Fails closed: anything it cannot confidently read is not a test database.
 */
export const TEST_SUFFIX = '_test'

export function isTestDatabase(url: unknown): boolean {
  const name = databaseName(url)
  // `name.length > TEST_SUFFIX.length` rejects a database called exactly "_test" or "test":
  // the suffix must follow an actual name, or "latest" and friends start slipping through.
  return name !== null && name.length > TEST_SUFFIX.length && name.endsWith(TEST_SUFFIX)
}

export function assertTestDatabase(url: unknown): void {
  if (isTestDatabase(url)) return
  const name = databaseName(url)
  throw new Error(
    `Refusing to run e2e against database ${name === null ? '(unparseable)' : `"${name}"`}. ` +
      `Its name must end in "${TEST_SUFFIX}". Point DATABASE_URL in .env.test at a Neon branch ` +
      `whose database is named accordingly — a branch alone is not enough, because it inherits ` +
      `production's database name.`,
  )
}

/** Reads DATABASE_URL out of a .env file's contents and asserts it is a test database.
 *  Pure, so the refusal path is testable — playwright.config.ts cannot be imported in a unit
 *  test (it imports @playwright/test), and the refusal is the branch that actually matters. */
export function testDatabaseUrlFrom(fileContents: string): string {
  const line = fileContents.split('\n').find((l) => l.trimStart().startsWith('DATABASE_URL='))
  const url = line === undefined ? '' : line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  assertTestDatabase(url)
  return url
}

/** The database name, or null if the URL cannot be read. `new URL().pathname` already
 *  excludes the query string, so `?options=--search_path%3D_test` cannot masquerade as one. */
function databaseName(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0) return null
  try {
    const name = new URL(url).pathname.replace(/^\//, '')
    return name.length === 0 ? null : name
  } catch {
    return null
  }
}
