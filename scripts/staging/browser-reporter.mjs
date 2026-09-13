import { mkdirSync, writeFileSync } from 'node:fs'
import { gitIdentity } from './evidence.mjs'
import { createHash } from 'node:crypto'
import { loadStagingEnvironment } from './config.mjs'
export default class SafeStagingReporter {
  rows = []
  started = new Date().toISOString()
  identity = gitIdentity()
  write(status) {
    const env = loadStagingEnvironment()
    const evidence = { ...this.identity, timestamp: this.started, updatedAt: new Date().toISOString(),
      projectFingerprint: createHash('sha256').update(env.STAGING_ISOLATED_PROJECT_REF || '').digest('hex'),
      status, scenarios: this.rows }
    mkdirSync('test-results/staging-runs', { recursive: true })
    const serialized = JSON.stringify(evidence, null, 2)
    writeFileSync('test-results/staging-runs/browser-' + this.started.replaceAll(':', '-') + '.json', serialized)
    writeFileSync('test-results/staging-browser.json', serialized)
  }
  onBegin() { this.write('running') }
  onTestEnd(test, result) {
    const status = result.status === 'passed' ? 'PASS' : result.status === 'skipped' ? 'BLOCKED' : 'FAIL'
    const name = test.titlePath().filter(Boolean).join(' / ')
    // Source locations identify failing checks without retaining fill arguments,
    // invitation URLs, provider messages, or expected/actual credentials.
    const locations = []
    const visit = steps => { for (const step of steps) {
      if (step.error && step.location) locations.push({ line: step.location.line, column: step.location.column })
      visit(step.steps || [])
    } }
    visit(result.steps)
    const errors = result.errors || []
    const failureKinds = [...new Set(errors.flatMap(error => {
      const message = error.message || ''
      return ['strict mode violation', 'Timeout', 'toBe', 'toContainText', 'toHaveText', 'net::ERR_CERT_AUTHORITY_INVALID']
        .filter(kind => message.includes(kind))
    }))]
    const sourceLines = [...new Set(errors.flatMap(error => [...(error.stack || '').matchAll(/workflows\.spec\.mjs:(\d+):\d+/g)].map(match => Number(match[1]))))]
    this.rows.push({ name, status, ...(locations.length ? { failureLocations: locations } : {}),
      ...(errors.length ? { failureKinds, sourceLines } : {}) })
    this.write('running')
    console.log(status + ': ' + name)
  }
  onError() { console.error('FAIL: browser runner error. Raw diagnostics suppressed to protect credentials.') }
  onStdOut() { /* Test/browser logs may contain URLs or authentication data. */ }
  onStdErr() { /* Never forward provider errors or Playwright fill call arguments. */ }
  onEnd(result) {
    const blocked = this.rows.some(row => row.status === 'BLOCKED')
    const status = result.status === 'passed' && blocked ? 'blocked' : result.status
    this.write(status)
    if (blocked) return { status: 'failed' }
  }
}
