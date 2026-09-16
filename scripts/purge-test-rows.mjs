#!/usr/bin/env node
/**
 * One-off cleanup of the rows the e2e suite wrote to production before 2026-09-15.
 *
 * `playwright.config.ts` had no webServer block, so every run used whatever dev server was on
 * :3000 — and that server reads .env.local. The damage, measured 2026-09-15: 5,825 auth users
 * of which 5,823 are e2e, and 3,668 sessions of which six are real.
 *
 * Test users are identified by the email `e2e/fixtures.ts` generates —
 * `e2e-${Date.now()}-${random}@example.com` — not by a duration heuristic. That matters: a
 * heuristic ("sessions under two minutes") would also delete a real person who signed up and
 * did nothing, and this script runs against production.
 *
 * DRY RUN BY DEFAULT. Pass --yes to actually delete.
 *
 *   node --env-file-if-exists=.env.local scripts/purge-test-rows.mjs
 *   node --env-file-if-exists=.env.local scripts/purge-test-rows.mjs --yes
 */
import { neon } from '@neondatabase/serverless'

const TEST_EMAIL = 'e2e-%@example.com'
const execute = process.argv.includes('--yes')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Run with --env-file-if-exists=.env.local')
  process.exit(1)
}
const sql = neon(url)

// A single source of truth for "is a test user", so the count and the delete cannot disagree
// about what they are talking about.
const testUserIds = sql`select id::text from neon_auth."user" where email like ${TEST_EMAIL}`

const [counts] = await sql`
  select
    (select count(*) from neon_auth."user" where email like ${TEST_EMAIL})::int as auth_users,
    (select count(*) from neon_auth."user" where email not like ${TEST_EMAIL})::int as real_users,
    (select count(*) from session where user_id in (select id::text from neon_auth."user" where email like ${TEST_EMAIL}))::int as sessions,
    (select count(*) from event e join session s on s.id = e.session_id
      where s.user_id in (select id::text from neon_auth."user" where email like ${TEST_EMAIL}))::int as events,
    (select count(*) from device where user_id in (select id::text from neon_auth."user" where email like ${TEST_EMAIL}))::int as devices,
    (select count(*) from memory where user_id in (select id::text from neon_auth."user" where email like ${TEST_EMAIL}))::int as memories,
    (select count(*) from pairing_code where user_id in (select id::text from neon_auth."user" where email like ${TEST_EMAIL}))::int as pairing_codes`

// console.log does not do printf padding (%-14s is not a Node format specifier), so pad here.
console.log(`\nTest users found: ${counts.auth_users}   (real users kept: ${counts.real_users})`)
console.log('Would delete from public schema:')
for (const k of ['sessions', 'events', 'devices', 'memories', 'pairing_codes']) {
  console.log(`  ${k.padEnd(14)} ${counts[k]}`)
}

if (counts.real_users === 0) {
  console.error('\nRefusing: no non-test users found. That is not a database this script should touch.')
  process.exit(1)
}

if (!execute) {
  console.log('\nDry run. Nothing deleted. Re-run with --yes to apply.\n')
  process.exit(0)
}

// FK-safe order: children before parents.
const ids = (await testUserIds).map((r) => r.id)
console.log('\nDeleting...')
const del = async (label, fn) => { const r = await fn(); console.log(`  ${label.padEnd(14)} done`); return r }
await del('event', () => sql`delete from event where session_id in (select id from session where user_id = any(${ids}))`)
await del('judgment', () => sql`delete from judgment where session_id in (select id from session where user_id = any(${ids}))`)
await del('session', () => sql`delete from session where user_id = any(${ids})`)
await del('device', () => sql`delete from device where user_id = any(${ids})`)
await del('memory', () => sql`delete from memory where user_id = any(${ids})`)
await del('pairing_code', () => sql`delete from pairing_code where user_id = any(${ids})`)

console.log(`
Done — public schema only.

The ${counts.auth_users} rows in neon_auth."user" are left in place deliberately. That schema is
managed by Neon Auth and has its own referencing tables (account, session, verification);
deleting from it by hand risks breaking invariants this script cannot see. They are inert
once their public rows are gone. Remove them through Neon Auth if they ever need to go.
`)
