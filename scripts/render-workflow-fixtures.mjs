// Static layout review of actual components using synthetic props. No auth/service verification.
// Outputs outside app routes. Controls are not hydrated or connected to any service.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getTemplate,buildChecklistState } from '../lib/domain/templates.ts'
const require=createRequire(import.meta.url),root=process.cwd(),cache=new Map()
function load(file){
 let name=file
 if(!fs.existsSync(name)||fs.statSync(name).isDirectory())name=['.tsx','.jsx','.ts','.js'].map(ext=>file+ext).find(n=>fs.existsSync(n))
 if(!name)throw new Error('Fixture module not found')
 if(cache.has(name))return cache.get(name).exports
 const compiled={exports:{}};cache.set(name,compiled)
 const output=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 const localRequire=specifier=>specifier.startsWith('@/')?load(path.join(root,specifier.slice(2))):specifier.startsWith('.')?load(path.resolve(path.dirname(name),specifier)):require(specifier)
 new Function('module','exports','require',output)(compiled,compiled.exports,localRequire)
 return compiled.exports
}
const {AppRouterContext}=require('next/dist/shared/lib/app-router-context.shared-runtime')
const Shell=load(path.join(root,'app/components/WorkspaceShell.jsx')).default
const Editor=load(path.join(root,'app/report/[id]/ReportEditor.jsx')).default
const Actions=load(path.join(root,'app/actions/ActionList.jsx')).default
const Settings=load(path.join(root,'app/settings/CompanySettings.jsx')).default
const actor='11111111-1111-4111-8111-111111111111',company={id:'22222222-2222-4222-8222-222222222222',name:'Synthetic Trade Company',revision:1,business:{contact_phone:'555-0100'},legacy_profiles:{}}
const report={id:'33333333-3333-4333-8333-333333333333',company_id:company.id,author_id:actor,lifecycle:'draft',revision:1,template_snapshot:getTemplate('electrical'),business_snapshot:{name:company.name,details:company.business},document:{job:{address:'Synthetic workshop',client:'Layout fixture',date:'2026-09-11'},answers:buildChecklistState('electrical')}}
const members=[{user_id:actor,role:'owner',active:true,display_name:'Synthetic owner'}]
const action={id:'44444444-4444-4444-8444-444444444444',report_id:report.id,company_id:company.id,observation:'Synthetic concern: damaged enclosure',controls:'Area kept clear pending review',responsible_id:actor,target_date:'2026-09-14',state:'open',resolution:'',revision:1}
const css=fs.readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync('.next/static/chunks/'+n,'utf8')).join('\n')
const screens={job:React.createElement(Editor,{report,actor,editable:true}),observations:React.createElement(Editor,{report,actor,editable:true,initialStep:3}),review:React.createElement(Editor,{report,actor,editable:true,initialStep:4}),actions:React.createElement(Actions,{initial:[action],members,events:[],actor,role:'owner',companyId:company.id}),company:React.createElement(Settings,{company,members,invitations:[],role:'owner',actor})}
fs.mkdirSync('test-results/phase2-ui',{recursive:true})
for(const [name,screen]of Object.entries(screens)){
 const html=renderToStaticMarkup(React.createElement(AppRouterContext.Provider,{value:{}},React.createElement(Shell,{company,companies:[company]},screen)))
 fs.writeFileSync('test-results/phase2-ui/'+name+'.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic '+name+' layout</title><style>'+css+'</style></head><body><p style="padding:12px;background:#fff;color:#111;font:16px Arial">STATIC SYNTHETIC LAYOUT — controls are not connected to Supabase.</p>'+html+'</body></html>')
}
console.log('Rendered five actual component layouts with synthetic props. This does not verify auth, persistence or browser interactions.')
