import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import sharp from 'sharp'
import {largePhoto,jpegAtSize} from '../../tests/fixtures/large-photo.mjs'
import {MAX_IMAGE_BYTES,MAX_NORMALIZED_IMAGE_BYTES} from '../../lib/evidence/limits.mjs'
import {HOSTED_ORIGIN,STAGING_PROJECT} from '../../lib/staging/hosted.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {webkit,chromium,devices,expect}=await import('@playwright/test')
const engineName=process.argv.includes('--chromium')?'chromium':'webkit'
const hosted=process.argv.includes('--hosted'),origin=hosted?HOSTED_ORIGIN:'https://localhost:3000'
const account=JSON.parse(readFileSync('.staging/recovery-email-account.json')),gate=JSON.parse(readFileSync('.staging/hosted-access.json'))
assert.equal(account.projectRef,STAGING_PROJECT)
const receipt='.staging/photo-5mib-'+(hosted?'hosted':'local')+'.json'
const result=existsSync(receipt)?JSON.parse(readFileSync(receipt)):{origin,startedAt:new Date().toISOString(),checks:[]}
assert.equal(result.origin,origin)
if(hosted){assert.match(process.env.EXPECTED_COMMIT||'',/^[a-f0-9]{40}$/);if(result.commit)assert.equal(result.commit,process.env.EXPECTED_COMMIT,'Archive the previous receipt before testing a different commit')}
result.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
result.sourceDirty=Boolean(execFileSync('git',['diff','HEAD','--name-only','--','scripts/staging/photo-limit-browser.mjs'],{encoding:'utf8'}).trim())
result.engine=engineName
result.lastRunStartedAt=new Date().toISOString()
result.status='RUNNING'
const save=()=>writeFileSync(receipt,JSON.stringify(result,null,2)+'\n')
const pass=name=>{if(!result.checks.includes(name))result.checks.push(name);save();console.log('PASS: '+name)}
const b=await (engineName==='chromium'?chromium:webkit).launch(),c=await b.newContext({...devices['iPhone 14 Pro Max'],...(hosted?{httpCredentials:{username:gate.username,password:gate.password}}:{})}),p=await c.newPage()
p.setDefaultTimeout(30000);p.setDefaultNavigationTimeout(90000)
try{
 if(hosted){const identity=await (await c.request.get(origin+'/api/staging/identity',{timeout:90000})).json();assert.equal(identity.commit,process.env.EXPECTED_COMMIT);result.commit=identity.commit;pass('Exact hosted commit')}
 await p.goto(origin+'/auth/login',{waitUntil:'networkidle'});await p.getByLabel('Email',{exact:true}).fill(account.email);await p.getByLabel('Password',{exact:true}).fill(account.currentPassword);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL('**/dashboard')
 if(!result.reportId){await p.goto(origin+'/report/new?company='+account.companyId,{waitUntil:'networkidle'});p.on('request',r=>{if(r.url()===origin+'/api/workspace'&&r.method()==='POST'){const data=r.postDataJSON();if(data.command==='create_report'){result.reportId=data.payload.id;save()}}});await p.getByRole('button',{name:'Create saved draft',exact:true}).click();await p.waitForURL(/\/report\/[a-f0-9-]{36}$/)}
 const base=origin+'/api/reports/'+result.reportId+'/evidence'
 await p.goto(origin+'/report/'+result.reportId+'?step=5',{waitUntil:'networkidle'})
 if(await p.getByLabel('Photo file',{exact:true}).count()){
 const large=await largePhoto(),exact=jpegAtSize(large,MAX_IMAGE_BYTES),over=jpegAtSize(large,MAX_IMAGE_BYTES+1)
 let posts=0;p.on('request',r=>{if(r.url()===base&&r.method()==='POST')posts++})
 await p.getByLabel('Photo file',{exact:true}).setInputFiles({name:'synthetic-over.jpeg',mimeType:'image/jpeg',buffer:over});await p.getByLabel('Photo caption',{exact:true}).fill('SYNTHETIC above input limit');await p.getByRole('button',{name:'Upload photo',exact:true}).tap();await expect(p.getByRole('alert').filter({hasText:'5,242,880 bytes'})).toBeInViewport();assert.equal(posts,0);assert.equal(await p.getByLabel('Photo file',{exact:true}).evaluate(e=>e.files[0].size),MAX_IMAGE_BYTES+1);pass('5 MiB + 1 rejected visibly on mobile; selection retained; no POST')
 for(const [label,bytes] of [['between',large],['exact',exact]]){
 const caption='SYNTHETIC 5MiB '+label;const before=await (await c.request.get(base)).json()
 if(!before.some(r=>r.caption===caption&&r.state==='ready')){
 await p.getByLabel('Photo file',{exact:true}).setInputFiles({name:'synthetic-'+label+'.jpeg',mimeType:'image/jpeg',buffer:bytes});await p.getByLabel('Photo caption',{exact:true}).fill(caption)
 const response=p.waitForResponse(r=>r.url()===base&&r.request().method()==='POST');await p.getByRole('button',{name:'Upload photo',exact:true}).tap();const r=await response;assert.equal(r.status(),200);assert.equal(r.request().headers()['content-type'],'application/octet-stream');await expect(p.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeInViewport()
 }
 const rows=await (await c.request.get(base)).json(),row=rows.find(r=>r.caption===caption&&r.state==='ready');assert.ok(row);assert.ok(row.byte_size<=MAX_NORMALIZED_IMAGE_BYTES)
 const retained=await c.request.get(base+'/'+row.id);assert.equal(retained.status(),200);assert.match(retained.headers()['cache-control'],/private/);const metadata=await sharp(await retained.body()).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);result[label]={inputBytes:bytes.length,normalizedBytes:row.byte_size};pass(label+' valid input accepted and privately retained without EXIF')
 }
 const rejected=await c.request.post(base,{headers:{origin,'Content-Type':'application/octet-stream','X-Evidence-Id':crypto.randomUUID(),'X-Evidence-Caption':'SYNTHETIC oversized server check'},data:over});assert.equal(rejected.status(),422);pass('Server rejects valid JPEG above exact 5 MiB boundary')
 await p.reload({waitUntil:'networkidle'});for(const label of ['between','exact']){const caption='SYNTHETIC 5MiB '+label;const img=p.getByRole('img',{name:caption,exact:true});await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);await expect(p.getByText(caption,{exact:true})).toBeVisible()}pass('Both retained photos and captions display after reload')
 await p.getByRole('button',{name:/Job details/}).click();await p.getByLabel('Job address',{exact:true}).fill('SYNTHETIC 5 MiB photo verification');await p.getByLabel('Work date',{exact:true}).fill('2026-09-15');await expect(p.locator('.save-state')).toHaveText('Saved');await p.getByRole('button',{name:'Continue to observations',exact:true}).click();const answers=p.getByLabel('Observation',{exact:true});for(let i=0;i<await answers.count();i++){await answers.nth(i).selectOption('meets');await expect(p.locator('.save-state')).toHaveText('Saved')}
 await p.getByRole('button',{name:'4. Review',exact:true}).click();await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Finalize report',exact:true}).click();await expect(p.getByRole('heading',{name:'Your finalized report',exact:true})).toBeVisible();pass('Only dedicated synthetic report finalized')
 }
 const exports=origin+'/api/reports/'+result.reportId+'/exports',generated=await c.request.post(exports,{headers:{origin},timeout:90000});assert.equal(generated.status(),200);const job=await generated.json(),download=await c.request.get(origin+job.download);assert.equal(download.status(),200);const pdf=await download.body();assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length<32*1024*1024);result.pdfBytes=pdf.length;pass('New PDF with larger input photos generated and downloaded below 32 MiB')
 await c.clearCookies();assert.equal((await c.request.get(base)).status(),401);pass('Evidence access still requires account session');result.status='PASS';delete result.failure
}catch(error){result.status='FAIL';result.failure={type:error.name,lines:[...(error.stack||'').matchAll(/photo-limit-browser\.mjs:(\d+)/g)].map(m=>Number(m[1]))};process.exitCode=1}
finally{await b.close();result.lastRunFinishedAt=new Date().toISOString();save();console.log(JSON.stringify(result))}
