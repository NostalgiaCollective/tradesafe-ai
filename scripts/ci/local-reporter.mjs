import { writeFileSync, mkdirSync } from 'node:fs'
export default class LocalReporter {
  rows = []
  onTestEnd(test, result) {
    const lines = [...new Set(result.errors.flatMap(e => [...(e.stack || '').matchAll(/workflows\.spec\.mjs:(\d+)/g)].map(m => Number(m[1]))))]
    this.rows.push({ name: test.title, status: result.status, failureLines: lines })
    console.log(result.status.toUpperCase() + ': ' + test.title + (lines.length ? ' at lines ' + lines.join(',') : ''))
  }
  onStdOut() {}
  onStdErr() {}
  onError() { console.error('FAIL: browser infrastructure error (sensitive diagnostics suppressed)') }
  onEnd(result) {
    const skipped = this.rows.filter(r => r.status === 'skipped').length
    const status = result.status === 'passed' && this.rows.length === 3 && !skipped ? 'passed' : 'failed'
    mkdirSync('test-results', { recursive: true })
    writeFileSync('test-results/local-webkit.json', JSON.stringify({
      commit: process.env.GITHUB_SHA, at: new Date().toISOString(), status,
      engine: 'Playwright WebKit, Linux, mobile emulation', target: 'disposable loopback Supabase and Next application',
      executed: this.rows.length - skipped, skipped, scenarios: this.rows,
      limitations: ['Local email capture only; no external delivery', 'Not hosted staging or physical iPhone', 'Fresh installation, not backup restoration'],
    }, null, 2))
    return { status }
  }
}
