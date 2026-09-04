import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const sql = neon(process.env.DATABASE_URL)

await sql`create table if not exists _migration (name text primary key, applied_at timestamptz not null default now())`
const applied = new Set((await sql`select name from _migration`).map((r) => r.name))
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

for (const name of files) {
  if (applied.has(name)) { console.log(`  skip  ${name}`); continue }
  const text = await readFile(join(dir, name), 'utf8')
  // Split on a statement-terminating `;`, tolerating a trailing line comment after it
  // (e.g. `int;    -- null = no cycles`) — a bare `;\s*$` misses that and merges statements.
  for (const stmt of text.split(/;[ \t]*(?:--[^\n]*)?$/m).map((s) => s.trim()).filter(Boolean)) await sql.query(stmt)
  await sql`insert into _migration (name) values (${name})`
  console.log(`  apply ${name}`)
}
