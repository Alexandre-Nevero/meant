import { defineConfig } from '@playwright/test'
import fs from 'node:fs'
import { testDatabaseUrlFrom } from './lib/db-guard.ts'

// Every e2e run before 2026-09-15 wrote to production. There was no webServer block, so the
// suite used whatever dev server happened to be on :3000 — and that server reads .env.local.
// 3,668 session rows across 3,651 user ids, six of them real.
//
// DATABASE_URL is injected through webServer.env rather than by setting NODE_ENV=test. Next's
// documented load order puts `process.env` FIRST, above .env.local, so this is deterministic;
// NODE_ENV=test would also skip .env.local, but `next dev` force-assigns NODE_ENV=development,
// so that route depends on behaviour we would rather not rely on.
//
// The assertion runs at config load, before any server starts: a wrong URL fails immediately
// rather than after the first test has already written a row.
const DATABASE_URL = testDatabaseUrlFrom(
  fs.existsSync('.env.test') ? fs.readFileSync('.env.test', 'utf8') : '',
)
const PORT = Number(process.env.E2E_PORT ?? 3100) // distinct ports let separate worktrees run the suite at once

// Headless by default (Playwright's own chromium channel supports loading an unpacked
// extension headless — no visible window). No webServer block: the dev server is assumed
// already running at localhost:3000, matching every prior task's own manual verification.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false, // extension tests share a persistent context per file; keep it simple
  workers: 1, // each test launches a full persistent Chromium; running files in parallel
              // contended for resources and caused spurious "context closed"/timeout failures
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  // reuseExistingServer:false is the load-bearing line. Left true, a dev server already on
  // this port is reused — and reusing a server someone else started is precisely the bug.
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
