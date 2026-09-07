import { defineConfig } from '@playwright/test'

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
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
