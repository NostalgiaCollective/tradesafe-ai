import { defineConfig, devices } from '@playwright/test'
import { APP_ORIGIN } from './scripts/ci/local-environment.mjs'
export default defineConfig({
  testDir: './tests/local-browser', workers: 1, fullyParallel: false, retries: 0,
  timeout: 180000, expect: { timeout: 20000 },
  reporter: './scripts/ci/local-reporter.mjs',
  outputDir: 'test-results/local-transient', preserveOutput: 'never',
  use: { ...devices['iPhone 13'], browserName: 'webkit', baseURL: APP_ORIGIN,
    trace: 'off', screenshot: 'off', video: 'off', serviceWorkers: 'block' },
})
