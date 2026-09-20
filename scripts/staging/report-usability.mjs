// Actual browser/server checks; never creates accounts or sends email.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {HOSTED_ORIGIN} from '../../lib/staging/hosted.mjs'

const {env}=requireStaging(),hosted=process.argv.includes('--hosted'),label=hosted?'hosted':'local',origin=hosted?HOSTED_ORIGIN:'https://localhost:3000'
const run=process.env.USABILITY_RUN||'1';assert.match(run,/^[a-z0-9-]+$/)
const receipt='.staging/usability-'+label+'-'+run+'.json',out='test-results/usability-'+label+'-'+run
assert.ok(!existsSync(receipt),'Retain the previous receipt; use a new USABILITY_RUN for an explicitly separate rehearsal.')
mkdirSync(out,{recursive:true})
const secrets=JSON.parse(readFileSync('.staging/reliability-hosted-private.json')),companyId=JSON.parse(readFileSync('.staging/reliability-hosted.json')).companyId,gate=JSON.parse(readFileSync('.staging/hosted-access.json'))
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {observationEntry,selectedPhotoNavigation,retrySaveFeedback,assertPhoneLayout}=await import('../../tests/fixtures/report-usability.mjs')
const {chromium,expect}=await import('@playwright/test'),browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},...(hosted?{httpCredentials:{username:gate.username,password:gate.password}}:{})}),page=await context.newPage()
page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000)
const state={status:'RUNNING',origin,companyId,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim()),checks:[],screens:[],startedAt:new Date().toISOString()},save=()=>writeFileSync(receipt,JSON.stringify(state,null,2)+'\n'),pass=name=>{state.checks.push(name);save();console.log('PASS '+name)},saved=()=>expect(page.locator('.save-state')).toHaveText('Saved'),hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const address='SYNTHETIC usability '+label+' '+run+' - blue cone site',caption='SYNTHETIC blue-site orange cone',note='SYNTHETIC cone isolates a damaged cover.'
async function capture(name){
 const scroll=await page.evaluate(()=>scrollY)
 for(const [width,device] of [[390,'phone'],[1366,'desktop']]){
  await page.setViewportSize({width,height:width===390?844:900})
  const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth}))
  assert.equal(metrics.overflow,false);await page.screenshot({path:out+'/'+name+'-'+device+'.png',fullPage:true});await page.screenshot({path:out+'/'+name+'-'+device+'-viewport.png'})
  state.screens.push({name,device,...metrics});save()
 }await page.setViewportSize({width:390,height:844});await page.evaluate(y=>scrollTo(0,y),scroll)
}
try{
 save();if(hosted){assert.match(process.env.EXPECTED_COMMIT||'',/^[a-f0-9]{40}$/);state.identity=await(await context.request.get(origin+'/api/staging/identity',{timeout:90000})).json();assert.equal(state.identity.commit,process.env.EXPECTED_COMMIT);save()}
 await page.goto(origin+'/auth/login');await page.getByLabel('Email',{exact:true}).fill(secrets.owner.email);await page.getByLabel('Password',{exact:true}).fill(secrets.owner.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard')
 await page.goto(origin+'/report/new?company='+companyId)
 await context.route(origin+'/api/workspace',async route=>{const d=route.request().postDataJSON();if(d.command==='create_report'){state.reportId=d.payload.id;save()}await route.continue()})
 await page.getByRole('button',{name:'Create saved draft',exact:true}).click();await page.waitForURL(/\/report\/[a-f0-9-]{36}/);await context.unroute(origin+'/api/workspace')
 await page.getByLabel('Job address',{exact:true}).fill(address);await page.getByLabel('Work date',{exact:true}).fill('2026-09-20');await saved()
 await page.goto(origin+'/dashboard?company='+companyId);await expect(page.locator('a[href*="'+state.reportId+'"]').first()).toBeVisible();await capture('dashboard');await page.locator('a[href*="'+state.reportId+'"]').first().click();await expect(page.getByLabel('Job address',{exact:true})).toHaveValue(address);await capture('job');await assertPhoneLayout(page);pass('dashboard resume and job phone/desktop layout')
 await retrySaveFeedback(page,context,origin);pass('simulated dropped save, retained input, nearby retry, real saved reload')
 await observationEntry(page,note,capture);pass('keyboard focus, section counts/filter, hidden review errors, answers/notes navigation and real reload')
 await page.getByRole('link',{name:'Add or review photos',exact:true}).click();await expect(page.locator('#photo-evidence')).toBeFocused();await capture('photos')
 const photo=await sharp(Buffer.from('<svg width="800" height="600"><rect width="800" height="600" fill="#153d65"/><path d="M400 70L220 470H580Z" fill="#ff8900"/><text x="40" y="550" fill="white" font-size="28">SYNTHETIC USABILITY CONE</text></svg>')).jpeg().toBuffer()
 await page.getByLabel('Photo file',{exact:true}).setInputFiles({name:'SYNTHETIC-usability-cone.jpg',mimeType:'image/jpeg',buffer:photo});await page.getByLabel('Photo caption',{exact:true}).fill(caption)
 await selectedPhotoNavigation(page,caption,photo.length);await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeVisible();await page.reload();await expect(page.getByText(caption,{exact:true})).toBeVisible();await expect.poll(()=>page.getByRole('img',{name:caption,exact:true}).evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true)
 const base=origin+'/api/reports/'+state.reportId,rows=await(await context.request.get(base+'/evidence')).json();assert.equal(rows.length,1);state.photoId=rows[0].id;state.photoHash=hash(await(await context.request.get(base+'/evidence/'+state.photoId)).body());save();pass('selected photo/caption retained in-page; real upload and saved thumbnail/caption reload')
 await page.getByRole('button',{name:'Continue to review',exact:true}).click();await expect(page.getByRole('heading',{name:'Review your observations',exact:true})).toBeVisible();await capture('review');await page.getByRole('button',{name:'Continue to finalize',exact:true}).click();await expect(page.getByRole('heading',{name:'Finalize this report',exact:true})).toBeVisible();await capture('finalize');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finalize report',exact:true}).click();await expect(page.getByRole('button',{name:'Open PDF',exact:true})).toBeEnabled();await capture('finalized')
 const ordinary=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.equal((await ordinary.auth.signInWithPassword(secrets.owner)).error,null)
 const original=await ordinary.from('ts_reports').select('*').eq('id',state.reportId).single();assert.equal(original.error,null);assert.equal(original.data.lifecycle,'finalized')
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Open PDF',exact:true}).click();const viewer=await popup;await expect(page.getByRole('link',{name:'Open prepared PDF',exact:true})).toHaveAttribute('href',/^blob:/);await viewer.close()
 const job=await(await context.request.get(base+'/exports')).json();state.exportId=job.id;const pdf=await context.request.get(base+'/exports/'+job.id);assert.equal(pdf.status(),200);const bytes=await pdf.body();state.pdfHash=hash(bytes);writeFileSync(out+'/report.pdf',bytes)
 const text=execFileSync(resolve('.staging/poppler-26.07.0-0/poppler-26.07.0/Library/bin/pdftotext.exe'),[out+'/report.pdf','-'],{encoding:'utf8'});for(const value of [address,caption,note])assert.ok(text.includes(value),'Synthetic PDF content missing');await capture('pdf-ready');pass('real finalization, PDF opening, protected bytes and PDF content')
 await page.getByRole('link',{name:'Make a correction',exact:true}).click();await expect(page.getByLabel('Reason for correction',{exact:true})).toBeFocused();await capture('correction')
 await page.goto(origin+'/report/'+state.reportId+'#amend-report');await expect(page.getByLabel('Reason for correction',{exact:true})).toBeFocused()
 await page.getByLabel('Reason for correction',{exact:true}).fill('SYNTHETIC usability correction '+label+' '+run)
 await context.route(origin+'/api/workspace',async route=>{const d=route.request().postDataJSON();if(d.command==='amend'){state.amendmentId=d.payload.id;save()}await route.continue()})
 await page.getByRole('button',{name:'Create correction draft',exact:true}).click();await page.waitForURL(u=>u.pathname==='/report/'+state.amendmentId);await context.unroute(origin+'/api/workspace')
 await page.getByLabel('Client or job reference (optional)',{exact:true}).fill('SYNTHETIC correction saved');await saved();await page.reload();await expect(page.getByLabel('Client or job reference (optional)',{exact:true})).toHaveValue('SYNTHETIC correction saved');await capture('amendment')
 const amendment=await ordinary.from('ts_reports').select('amendment_of').eq('id',state.amendmentId).single();assert.equal(amendment.error,null);assert.equal(amendment.data.amendment_of,state.reportId);assert.deepEqual((await ordinary.from('ts_reports').select('*').eq('id',state.reportId).single()).data,original.data)
 const denied=await context.request.post(origin+'/api/workspace',{headers:{origin},data:{command:'save_report',payload:{companyId,id:state.reportId,revision:original.data.revision,requestId:randomUUID(),document:original.data.document}}});assert.equal(denied.status(),409);assert.equal((await denied.json()).code,'immutable')
 assert.equal(hash(await(await context.request.get(base+'/evidence/'+state.photoId)).body()),state.photoHash);assert.equal(hash(await(await context.request.get(base+'/exports/'+state.exportId)).body()),state.pdfHash);pass('focused correction form, amendment saved/reloaded, unchanged original/photo/PDF and immutable write denial');state.status='PASS'
}catch(e){state.status='FAIL';state.failure={name:e.name,assertion:e.matcherResult?.name||null,lines:[...(e.stack||'').matchAll(/report-usability\.mjs:(\d+)/g)].map(m=>+m[1])};await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});process.exitCode=1}
finally{state.finishedAt=new Date().toISOString();save();await browser.close();console.log(JSON.stringify({status:state.status,checks:state.checks,failure:state.failure,receipt}))}
