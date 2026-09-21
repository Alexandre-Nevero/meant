// Reads the recorded sessions for one user, joins them to the locally exported path log,
// and writes the unlabelled corpus. Run with:
//   node --env-file-if-exists=.env.local scripts/spike/export-corpus.mjs <userId>
import { readFileSync, writeFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { buildCases } from './corpus.ts'

const userId = process.argv[2]
if (!userId) {
  console.error('usage: node scripts/spike/export-corpus.mjs <userId>')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

const sessions = await sql`
  select id, intention, outcome, started_at, started_at_local_hour, work_sites, blocked_domains
    from session
   where user_id = ${userId}
     and intention is not null
     and outcome in ('yes', 'no')
   order by started_at`

const events = await sql`
  select e.session_id, e.kind, e.domain, e.seconds, e.at
    from event e
    join session s on s.id = e.session_id
   where s.user_id = ${userId}`

const paths = JSON.parse(readFileSync('scripts/spike/fixtures/path-log.json', 'utf8'))

const cases = buildCases(sessions, events, paths)
writeFileSync('scripts/spike/fixtures/corpus.json', JSON.stringify(cases, null, 2))

const visits = cases.reduce((n, c) => n + c.visits.length, 0)
const withPaths = cases.reduce((n, c) => n + c.visits.filter((v) => v.paths.length > 0).length, 0)
const residual = cases.reduce((n, c) => n + c.visits.filter((v) => v.declared === 'none').length, 0)
console.log(`${cases.length} cases, ${visits} visits, ${withPaths} with paths, ${residual} residual (undeclared)`)
