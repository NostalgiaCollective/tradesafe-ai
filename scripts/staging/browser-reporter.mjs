import { mkdirSync, writeFileSync } from 'node:fs'
import { gitIdentity } from './evidence.mjs'
export default class SafeStagingReporter {
  rows = []
  onTestEnd(test, result) {
    const status = result.status === 'passed' ? 'PASS' : result.status === 'skipped' ? 'BLOCKED' : 'FAIL'
    const name = test.titlePath().filter(Boolean).join(' / ')
    this.rows.push({ name, status })
    console.log(status + ': ' + name)
  }
  onError() { console.error('FAIL: browser runner error. Raw diagnostics suppressed to protect credentials.') }
  onStdOut() { /* Test/browser logs may contain URLs or authentication data. */ }
  onStdErr() { /* Never forward provider errors or Playwright fill call arguments. */ }
  onEnd(result) {
    const blocked = this.rows.some(row => row.status === 'BLOCKED')
    const status = result.status === 'passed' && blocked ? 'blocked' : result.status
    mkdirSync('test-results', { recursive: true })
    writeFileSync('test-results/staging-browser.json', JSON.stringify({
      ...gitIdentity(), timestamp: new Date().toISOString(),
      status, scenarios: this.rows,
    }, null, 2))
    if (blocked) return { status: 'failed' }
  }
}
