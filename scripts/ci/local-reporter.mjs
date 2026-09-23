import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
export default class LocalReporter {
  rows = []
  onTestEnd(test, result) {
    const lines = [...new Set(result.errors.flatMap(e => [...(e.stack || '').matchAll(/(?:(?:workflows|restored|follow-up|trades|concerns|crew|sites|daily-brief)\.spec|follow-up|concerns|crew|sites|daily-brief)\.mjs:(\d+)/g)].map(m => Number(m[1]))))]
    const assertions=result.errors.flatMap(e=>{
      // Strip terminal formatting before extracting method names, never field values/URLs.
      const message=(e.message||'').replace(/\x1b\[[0-9;]*m/g,'')
      return [...message.matchAll(/(?:expect\(locator\)\.(\w+)\(\)|(?:locator|page)\.(click|goto|waitForURL): Timeout)/g)].map(m=>m[1]||m[2]).concat(message.includes('strict mode violation')?['strict_locator']:[])
    })
    const failureKinds=result.errors.map(e=>['interrupted by another navigation','cancelled','NSURLErrorDomain','ERR_CONNECTION','Target page, context or browser has been closed','Timeout'].find(k=>(e.message||'').includes(k))||'assertion or other error')
    this.rows.push({ failureKinds, name: test.title, status: result.status, failureLines: lines, failureAssertions:assertions })
    console.log(result.status.toUpperCase() + ': ' + test.title + (lines.length ? ' at lines ' + lines.join(',') : '') + (assertions.length?' assertions '+assertions.join(','):''))
  }
  onStdOut() {}
  onStdErr() {}
  onError() { console.error('FAIL: browser infrastructure error (sensitive diagnostics suppressed)') }
  onEnd(result) {
    const skipped = this.rows.filter(r => r.status === 'skipped').length
    const recovery = process.env.RECOVERY_VALIDATION === '1'
    const status = result.status === 'passed' && this.rows.length === (recovery ? 1 : 10) && !skipped ? 'passed' : 'failed'
    // These receipts contain only synthetic IDs, hashes and named checks, never credentials.
    if(!recovery&&existsSync('test-results/concern-stage.json'))console.log('CONCERN_STAGE '+readFileSync('test-results/concern-stage.json','utf8'))
    if(!recovery&&existsSync('test-results/crew-stage.json'))console.log('CREW_STAGE '+readFileSync('test-results/crew-stage.json','utf8'))
    if(!recovery&&existsSync('test-results/site-stage.json'))console.log('SITE_STAGE '+readFileSync('test-results/site-stage.json','utf8'))
    if (!recovery) for (const trade of ['plumbing', 'roofing']) {
      const path = 'test-results/trade-journeys/' + trade + '.json'
      if (existsSync(path)) console.log('TRADE_JOURNEY ' + readFileSync(path, 'utf8'))
    }
    mkdirSync('test-results', { recursive: true })
    writeFileSync(recovery ? 'test-results/local-recovery-browser.json' : 'test-results/local-webkit.json', JSON.stringify({
      commit: process.env.GITHUB_SHA, at: new Date().toISOString(), status,
      engine: 'Playwright WebKit, Linux, mobile emulation', target: 'disposable loopback Supabase and Next application',
      executed: this.rows.length - skipped, skipped, scenarios: this.rows,
      limitations: ['Local email capture only; no external delivery', 'Not hosted staging or physical iPhone', recovery ? 'Synthetic restore only; no hosted recovery or operational RPO/RTO' : 'Source fixture verification before backup'],
    }, null, 2))
    return { status }
  }
}
