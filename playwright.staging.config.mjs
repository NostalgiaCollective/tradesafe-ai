import { defineConfig } from '@playwright/test'
import { loadStagingEnvironment } from './scripts/staging/config.mjs'
const env = loadStagingEnvironment()
export default defineConfig({
  testDir: './tests/staging-browser', fullyParallel: false, workers: 1, retries: 0,
  timeout: 120000, expect: { timeout: 15000 },
  reporter: './scripts/staging/browser-reporter.mjs',
  outputDir: 'test-results/browser-transient', preserveOutput: 'never',
  use: { baseURL: env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000', browserName: 'chromium',
    trace: 'off', screenshot: 'off', video: 'off', serviceWorkers: 'block' },
  // No TLS bypass. Trust the local development certificate before running.
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})
