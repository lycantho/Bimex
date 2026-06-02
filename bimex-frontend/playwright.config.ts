import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for Bimex Frontend.
 * Issue #51: Configurar tests E2E con Playwright
 *
 * Run locally:
 *   npx playwright test               # headless
 *   npx playwright test --ui          # interactive UI mode
 *   npx playwright show-report        # HTML report after a run
 */
export default defineConfig({
  testDir: './e2e',

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Fail the build on CI if you accidentally left test.only in the source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Run tests serially in CI to avoid port conflicts; parallel locally */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter: list in CI, HTML locally */
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',

    /* Run headless in CI, headed locally (override with --headed flag) */
    headless: true,

    /* Capture screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Record a video only on first retry so CI artefacts are lightweight */
    video: 'on-first-retry',

    /* Full-page trace on first retry to help debugging */
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Vite dev server automatically before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    /** Reuse an already-running server when developing locally */
    reuseExistingServer: !process.env.CI,
    /** Wait up to 120 s for the server to be ready */
    timeout: 120_000,
    /** Silence server stdout so test output stays clean */
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
