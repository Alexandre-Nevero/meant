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
  // Strip `--` line comments before splitting on `;`. A `;` can appear inside a comment
  // (e.g. "-- ...needed;") or right after one on the same line (e.g. "int;  -- null = no
  // cycles") — either way it must not be mistaken for a statement terminator, and it must
  // not produce a bogus comment-only chunk sent to sql.query() on its own.
  const stripped = text.replace(/--[^\n]*/g, '')
  for (const stmt of stripped.split(';').map((s) => s.trim()).filter(Boolean)) await sql.query(stmt)
  await sql`insert into _migration (name) values (${name})`
  console.log(`  apply ${name}`)
}
