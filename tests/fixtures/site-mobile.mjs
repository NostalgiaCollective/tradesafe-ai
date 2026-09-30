import {expect as baseExpect} from '@playwright/test'
const expect=baseExpect.configure({timeout:30000})

// Exercise the rendered site controls, not screenshots or mocked layout values.
export async function verifySiteMobile(page,{saved=false,archived=false}={}){
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const actions=page.getByRole('link',{name:/^Site actions \(\d+ outstanding\)$/})
  const controls=archived?[actions]:[page.getByRole('link',{name:'Report a concern',exact:true}),actions]
  for(const control of controls){
   const box=await control.evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top+scrollY,height:r.height}})
   expect(box.top).toBeLessThan(844);expect(box.height).toBeGreaterThanOrEqual(44)
  }
 }
 const nav=page.getByRole('navigation',{name:'On this site',exact:true})
 for(const [label,id] of [...(saved?[['Saved work','site-saved']]:[]),['Daily briefs','site-briefs'],['Trade reports','site-reports'],['Site concerns','site-concerns'],['Daily handover','handover-title']]){
  const link=nav.getByRole('link',{name:label,exact:true});await link.focus();await page.keyboard.press('Enter')
  await expect(page.locator('#'+id)).toBeFocused()
  expect(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none')
 }
 if(!saved)await expect(nav.getByRole('link',{name:'Saved work',exact:true})).toHaveCount(0)
}
