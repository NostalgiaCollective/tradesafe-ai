import {expect as baseExpect} from '@playwright/test'
const expect=baseExpect.configure({timeout:30000})

// Real provider sign-in and server requests. Cookie loss is explicitly injected,
// once after the server has accepted the session, to test the return-to-login path.
export async function siteSignInWorkflow({browser,origin,accounts,siteId,siteName,options={},record=()=>{},expectSessionFeedback=true}){
 const {localOnly,apiOrigin,...settings}=options,context=await browser.newContext({viewport:{width:390,height:844},...settings}),page=await context.newPage(),site='/sites/'+siteId
 page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000)
 if(localOnly)await context.route('**/*',r=>[origin,apiOrigin].includes(new URL(r.request().url()).origin)?r.continue():r.abort())
 const session=async()=>(await context.request.get(origin+'/api/auth/session')).status()
 const enter=async role=>{await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeEnabled();await page.getByLabel('Email',{exact:true}).fill(accounts[role].email);await page.getByLabel('Password',{exact:true}).fill(accounts[role].password);await page.getByRole('button',{name:'Sign In',exact:true}).click()}
 const opened=async()=>{await expect(page).toHaveURL(origin+site);await expect(page.getByRole('heading',{name:siteName,exact:true})).toBeVisible();expect(await session()).toBe(200)}
 const denied=async()=>{await expect(page).toHaveURL(url=>url.pathname==='/auth/login'&&url.searchParams.get('redirect')===site);expect(await session()).toBe(401)}
 let stage='supervisor-login',loss=false
 try{
  await page.goto(origin+site);await denied();await enter('supervisor');await opened();await page.reload();await opened()
  record('Supervisor actual site sign-in, session cookie and reload PASS')
  stage='supervisor-signout';await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(origin+'/');expect(await session()).toBe(401);await page.goto(origin+site);await denied()
  stage='worker-account-switch';await enter('worker');await opened();await page.reload();await opened();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(origin+'/');expect(await session()).toBe(401);await page.goto(origin+site);await denied()
  record('Supervisor sign-out, worker sign-in/reload/sign-out in the same browser, and intended-site return PASS')
  stage='lost-session-after-confirmation'
  await context.route(origin+'/api/auth/session',async route=>{if(loss){await route.continue();return}const response=await route.fetch();if(response.status()===200){loss=true;await context.clearCookies()}await route.fulfill({response})})
  await enter('supervisor');await expect.poll(()=>loss).toBe(true);await expect(page).toHaveURL(url=>url.pathname==='/auth/login');await context.unroute(origin+'/api/auth/session');await denied()
  const alert=page.getByRole('alert').filter({hasText:/sign-in session|credentials were accepted|Sign-in/}),feedback=await alert.count()>0?await alert.innerText():''
  record('Injected cookie loss after accepted session returns to sign-in',{stage,providerSessionAccepted:true,cookieLossInjected:true,feedbackPresent:!!feedback,feedback})
  if(expectSessionFeedback)await expect(alert).toContainText('If you just signed in')
  stage='explicit-retry';await enter('supervisor');await opened();await page.reload();await opened()
  record('Explicit supervisor retry reaches the original site; reload remains authenticated PASS')
  stage='loss-before-confirmation';await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(origin+'/');await page.goto(origin+site);await denied();await context.route(origin+'/api/auth/session',async route=>{await context.clearCookies();await route.continue({headers:{...route.request().headers(),cookie:''}})});await enter('supervisor');await expect(page.getByRole('alert').filter({hasText:'this browser did not retain a usable session'})).toBeVisible();await expect(page).toHaveURL(url=>url.pathname==='/auth/login');await context.unroute(origin+'/api/auth/session')
  record('Cookie loss before server confirmation stays on sign-in with actionable feedback PASS')
  stage='middleware-session-feedback';await context.clearCookies();await page.goto(origin+'/dashboard');await expect(page).toHaveURL(url=>url.pathname==='/auth/login'&&url.searchParams.get('redirect')==='/dashboard');await expect(page.getByRole('alert').filter({hasText:'If you just signed in'})).toBeVisible()
  record('Middleware and server-page session redirects both explain missing authentication PASS')
 }catch(e){record('Site sign-in check failed',{stage,errorName:e.name,assertion:e.matcherResult?.name||null,lines:[...(e.stack||'').matchAll(/site-signin\.mjs:(\d+):(\d+)/g)].map(m=>({line:+m[1],column:+m[2]})),kind:['strict mode violation','toHaveURL','Timeout','certificate','route.fetch','interrupted by another navigation'].find(k=>(e.message||'').includes(k))||'other'});throw e}finally{await context.close()}
}
