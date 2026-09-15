import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers');
const {webkit,chromium,devices,expect}=await import('@playwright/test');
const a=JSON.parse(readFileSync('.staging/recovery-email-account.json')),g=JSON.parse(readFileSync('.staging/hosted-access.json'));
const hosted=process.argv.includes('--hosted'),origin=hosted?'https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com':'https://localhost:3000';
const result={kind:'Chromium/WebKit mobile emulation; synthetic intercepted uploads; no draft writes',origin,checks:[]};
for(const [engineName,engine] of [['webkit',webkit],['chromium',chromium]]){
const b=await engine.launch(),c=await b.newContext({...devices['iPhone 14 Pro Max'],...(hosted?{httpCredentials:{username:g.username,password:g.password}}:{})}),p=await c.newPage();
try{
await p.goto(origin+'/auth/login',{waitUntil:'networkidle'});await p.getByLabel('Email',{exact:true}).fill(a.email);await p.getByLabel('Password',{exact:true}).fill(a.currentPassword);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL('**/dashboard');
const links=await p.locator('a[href^="/report/"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
for(const link of [...new Set(links)]){await p.goto(origin+link,{waitUntil:'networkidle'});if(await p.locator('#evidence-file').count())break}
assert.equal(await p.locator('#evidence-file').count(),1);
const base=origin+'/api/reports/'+new URL(p.url()).pathname.split('/')[2]+'/evidence';
let fault='validation',posts=0,saved=false,ids=[];
await c.route(base,async r=>{if(r.request().method()==='POST'){posts++;ids.push(r.request().headers()['x-evidence-id']);if(fault==='network')return r.abort();if(fault==='success'){await new Promise(resolve=>setTimeout(resolve,600));saved=true;return r.fulfill({status:200,contentType:'application/json',body:'{"state":"ready"}'})}return r.fulfill({status:fault==='session'||fault==='gate'?401:fault==='denied'?403:422,headers:fault==='gate'?{'www-authenticate':'Basic realm="staging"'}:{},contentType:'application/json',body:JSON.stringify({error:fault==='denied'?'You do not have permission for this action.':'Synthetic image validation rejection'})})}return r.fulfill({status:saved?503:200,contentType:'application/json',body:saved?'{}':'[]'})});
await p.locator('#evidence-file').setInputFiles({name:'synthetic.jpeg',mimeType:'image/jpeg',buffer:Buffer.alloc(3*1024*1024+1)});await p.locator('#evidence-caption').fill('Synthetic fault test');
const upload=p.getByRole('button',{name:'Upload photo',exact:true});assert.equal(await upload.evaluate(e=>!!e.form),false);await upload.click();await expect(p.getByRole('alert').filter({hasText:'3 MiB'})).toBeInViewport();assert.equal(posts,0);result.checks.push(engineName+': size rejection visible, no request');
await p.locator('#evidence-file').setInputFiles({name:'synthetic.jpeg',mimeType:'image/jpeg',buffer:Buffer.from('synthetic')});
for(fault of ['validation','session','gate','denied','network']){
await upload.click();const text={validation:'Synthetic image',session:'session has expired',gate:'Staging access',denied:'permission',network:'Check your connection'}[fault];await expect(p.getByRole('alert').filter({hasText:text})).toBeInViewport();assert.equal(await p.locator('#evidence-file').evaluate(e=>e.files.length),1);assert.equal(await p.locator('#evidence-caption').inputValue(),'Synthetic fault test');result.checks.push(engineName+': '+fault+' visible; file/caption retained');
}
fault='success';await upload.click();await expect(p.getByRole('status').filter({hasText:'Uploading photo'})).toBeVisible();await expect(p.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeInViewport();await expect(p.getByRole('alert').filter({hasText:'list could not refresh'})).toBeInViewport();assert.equal(await p.locator('#evidence-file').evaluate(e=>e.files.length),0);assert.equal(new Set(ids).size,1);result.checks.push(engineName+': progress, acknowledged success survives refresh failure, same retry ID');
await c.unroute(base);await c.clearCookies();assert.equal((await p.request.get(base)).status(),401);result.checks.push(engineName+': real missing-session evidence authorization denied');
}finally{await b.close()}}
result.status='PASS';mkdirSync('test-results/photo-feedback',{recursive:true});writeFileSync('test-results/photo-feedback/'+(hosted?'hosted':'local')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
