import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
export async function rootGlobSnapshot(referenceRoot = process.cwd()) {
  referenceRoot = path.resolve(referenceRoot);
  const load = createRequire(path.join(referenceRoot, 'package.json'));
  const {getRootDirs} = load('@next/eslint-plugin-next/dist/utils/get-root-dirs.js');
  const {ESLint} = load('eslint');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'tradesafe-lint-'));
  const forward = value => value.replaceAll('\\', '/');
  const normalize = value => forward(value).replace(forward(fixture), '<fixture>');
  const files = ['one/pages/about.jsx','one/embedded/pages/ghost.jsx','two/app/valid/page.jsx',
    'two/app/layout.jsx','space name/pages/index.jsx','unicode-é/pages/index.jsx',
    '.hidden/pages/index.jsx','number1/pages/index.jsx','number2/pages/index.jsx'];
  for (const file of files) { const target = path.join(fixture,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,'export default function Page(){return null}'); }
  fs.symlinkSync(path.join(fixture,'one'),path.join(fixture,'linked'),process.platform==='win32'?'junction':'dir');
  const relative = forward(path.relative(process.cwd(),fixture));
  const patterns = {
    literal:forward(fixture)+'/one', trailing:forward(fixture)+'/one/', windowsSeparators:forward(fixture).replaceAll('/','\\')+'\\one',
    wildcard:forward(fixture)+'/*', recursive:forward(fixture)+'/**', braces:forward(fixture)+'/{two,one}',
    numeric:forward(fixture)+'/number{1..2}', extglob:forward(fixture)+'/+(one|two)', excluded:forward(fixture)+'/!(two)',
    negative:'!'+forward(fixture)+'/one', missing:forward(fixture)+'/missing', file:forward(fixture)+'/one/pages/about.jsx',
    space:forward(fixture)+'/space name', unicode:forward(fixture)+'/unicode-é', hidden:forward(fixture)+'/.hidden',
    relative:relative+'/one', relativeDot:'./'+relative+'/one', linked:forward(fixture)+'/linked',
    array:[forward(fixture)+'/two', forward(fixture)+'/one']
  };
  const paths={};
  for(const [name,rootDir] of Object.entries(patterns)) {
    const result=getRootDirs({cwd:process.cwd(),settings:{next:{rootDir}}});
    if(!Array.isArray(result)||!result.every(x=>typeof x==='string'))throw Error('Non-string path array');
    paths[name]=result.map(normalize).map(x=>x.replace(relative,'<relative>')).sort();
  }
  const eslint = new ESLint({overrideConfigFile:path.join(referenceRoot,'eslint.config.mjs')});
  const rules={};
  for (const file of ['app/lint-probe.jsx','lib/lint-probe.ts']) {
    const config=await eslint.calculateConfigForFile(path.resolve(file));
    rules[file]=Object.fromEntries(Object.entries(config.rules).filter(([,v])=>v[0]!==0).sort(([a],[b])=>a.localeCompare(b)));
  }
  const probes=[
    ['inline-script','import Script from "next/script"; export default function Probe(){return <Script>{`console.log(1)`}</Script>}'],
    ['hooks','import {useState} from "react"; export default function Probe({ok}){if(ok){useState(0)}return null}'],
    ['typescript','export const value: any = 1;','lib/lint-probe.ts'],
    ['accessibility','export default function Probe(){return <img src="/a.png"/>}'],
    ['relative-location','export function go(){window.location.assign("./test")}'],
    ['valid-component','export default function Probe(){return <button type="button">Continue</button>}']
  ];
  const diagnostics={};
  const summarize=r=>({errors:r.errorCount,warnings:r.warningCount,messages:r.messages.map(({ruleId,severity,message,line,column,endLine,endColumn})=>({ruleId,severity,message,line,column,endLine,endColumn}))});
  for(const[name,code,file='app/lint-probe.jsx']of probes){const[r]=await eslint.lintText(code,{filePath:path.resolve(file)});diagnostics[name]=summarize(r);}
  for(const [name,rootDir] of [['pages',patterns.literal],['app',forward(fixture)+'/two'],['multi',patterns.array],['brace',patterns.braces],['relative',patterns.relative]]) {
    const lint=new ESLint({overrideConfigFile:path.join(referenceRoot,'eslint.config.mjs'),overrideConfig:{settings:{next:{rootDir}}}});
    for(const route of ['/about','/valid','/ghost','/missing','https://example.com/about']) {
      const[r]=await lint.lintText(`export default function Probe(){return <a href="${route}">Open</a>}`,{filePath:path.resolve('app/lint-probe.jsx')});
      diagnostics[name+route]=summarize(r);
    }
  }
  // Task-owned temp tree only; verify root before cleanup (junction removal never traverses target).
  if(path.dirname(fixture)!==os.tmpdir()||!path.basename(fixture).startsWith('tradesafe-lint-'))throw Error('Unsafe fixture root');
  fs.rmSync(fixture,{recursive:true,force:true});
  return {paths,rules,diagnostics};
}
