import {expect} from '@playwright/test'

export async function assertPhoneLayout(page) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 const next=page.locator('.report-action-bar .journey-actions button').last()
 await expect(next).toBeInViewport()
 expect(await next.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
}

// Shared actual-browser assertions: used by loopback WebKit and staging Chromium.
export async function observationEntry(page,note,capture=async()=>{}) {
 await page.getByRole('button',{name:'2. Observations',exact:true}).click()
 const answers=page.getByLabel('Observation',{exact:true}),groups=page.locator('.observation-section h3 button')
 await expect(answers).toHaveCount(18);await expect(groups).toHaveCount(6)
 expect(await answers.evaluateAll(es=>es.every(e=>e.value==='unanswered'))).toBe(true)
 await expect(page.getByRole('status').filter({hasText:'0 of 18 answered'})).toBeVisible()
 await capture('observations');await assertPhoneLayout(page)
 await groups.first().focus();await page.keyboard.press('Enter');await expect(answers.first()).toBeHidden()
 await page.keyboard.press('Enter');await page.keyboard.press('Tab');await expect(answers.first()).toBeFocused()
 expect(await answers.first().evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:parseFloat(getComputedStyle(e).outlineWidth)}))).toEqual({style:'solid',width:3})
 await page.getByLabel('Unanswered only',{exact:true}).check()
 await answers.first().selectOption('attention')
 await expect(page.getByLabel('Explanation (required)',{exact:true})).toBeVisible()
 await page.getByLabel('Explanation (required)',{exact:true}).fill(note)
 await page.getByLabel('Explanation (required)',{exact:true}).fill('')
 await groups.first().click() // Missing explanation now hidden by BOTH filter and section.
 await page.getByRole('button',{name:'Continue to review',exact:true}).click()
 await page.getByRole('link',{name:/add an explanation/}).first().click()
 await expect(page.getByLabel('Unanswered only',{exact:true})).not.toBeChecked()
 await expect(groups.first()).toHaveAttribute('aria-expanded','true')
 await expect(page.getByLabel('Explanation (required)',{exact:true})).toBeFocused()
 await page.getByLabel('Explanation (required)',{exact:true}).fill(note)
 await page.getByRole('button',{name:'Continue to review',exact:true}).click()
 await page.getByRole('link',{name:/record an observation/}).last().click()
 await expect(answers.last()).toBeFocused();await expect(groups.last()).toHaveAttribute('aria-expanded','true')
 await answers.last().selectOption('meets')
 await page.getByRole('button',{name:'Back to job',exact:true}).click()
 await page.getByRole('button',{name:'Continue to observations',exact:true}).click()
 await expect(answers.first()).toHaveValue('attention');await expect(answers.last()).toHaveValue('meets')
 await expect(page.getByLabel('Explanation (required)',{exact:true})).toHaveValue(note)
 await expect(page.locator('.save-state')).toHaveText('Saved');await page.reload()
 await expect(answers.first()).toHaveValue('attention');await expect(answers.last()).toHaveValue('meets')
 await expect(page.getByLabel('Explanation (required)',{exact:true})).toHaveValue(note)
 for(const group of await groups.all())if(await group.getAttribute('aria-expanded')==='false')await group.click()
 for(const answer of (await answers.all()).slice(1))await answer.selectOption('meets')
 await expect(page.locator('.save-state')).toHaveText('Saved')
 await expect(page.getByRole('status').filter({hasText:'18 of 18 answered · 0 unanswered'})).toBeVisible()
 await page.getByLabel('Unanswered only',{exact:true}).check()
 await expect(answers.first()).toBeHidden();await expect(page.getByText('All observations have an answer.',{exact:false})).toBeVisible()
 await page.getByLabel('Unanswered only',{exact:true}).uncheck()
 await expect(answers.first()).toHaveValue('attention');await expect(page.getByLabel('Explanation (required)',{exact:true})).toHaveValue(note)
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await assertPhoneLayout(page)
}

export async function selectedPhotoNavigation(page,caption,size) {
 await page.getByRole('button',{name:'Continue to review',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'has not been saved'})).toBeVisible()
 await page.getByRole('link',{name:'Review photos and captions',exact:true}).click()
 await expect(page.locator('#photo-evidence')).toBeFocused()
 await page.getByRole('button',{name:'Back to job',exact:true}).click()
 await page.getByRole('button',{name:'Continue to observations',exact:true}).click()
 await expect(page.getByLabel('Photo caption',{exact:true})).toHaveValue(caption)
 expect(await page.getByLabel('Photo file',{exact:true}).evaluate(e=>e.files[0].size)).toBe(size)
 expect(await page.getByText('Photo upload troubleshooting',{exact:true}).evaluate(e=>e.parentElement.open)).toBe(false)
}

export async function retrySaveFeedback(page,context,origin) {
 await page.getByRole('button',{name:'1. Job',exact:true}).click()
 const url=origin+'/api/workspace'
 await context.route(url,route=>route.request().postDataJSON()?.command==='save_report'?route.abort():route.continue())
 await page.getByLabel('Client or job reference (optional)',{exact:true}).fill('SYNTHETIC retry retained input')
 await expect(page.locator('.save-state')).toHaveText('Not saved')
 await expect(page.getByRole('button',{name:'Retry saving',exact:true})).toBeInViewport()
 await expect(page.getByLabel('Client or job reference (optional)',{exact:true})).toHaveValue('SYNTHETIC retry retained input')
 await context.unroute(url)
 await page.getByRole('button',{name:'Retry saving',exact:true}).click()
 await expect(page.locator('.save-state')).toHaveText('Saved')
 await page.reload();await expect(page.getByLabel('Client or job reference (optional)',{exact:true})).toHaveValue('SYNTHETIC retry retained input')
}
