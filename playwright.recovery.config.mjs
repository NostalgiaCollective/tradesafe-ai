import { defineConfig } from '@playwright/test'
import local from './playwright.local.config.mjs'
export default defineConfig({ ...local, testDir: './tests/recovery-browser' })
