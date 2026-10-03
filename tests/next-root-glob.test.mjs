import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {rootGlobSnapshot} from './fixtures/next-root-glob.mjs';
const require=createRequire(import.meta.url);
const pluginRoot=path.dirname(require.resolve('@next/eslint-plugin-next/package.json'));
const fromPlugin=createRequire(path.join(pluginRoot,'package.json'));
const adapter=fromPlugin('fast-glob');

test('Next root adapter preserves reference discovered paths, enabled rules and exact diagnostics',async()=>{
  const expected=JSON.parse(fs.readFileSync('tests/fixtures/next-root-glob-reference.json','utf8'));
  const actual=await rootGlobSnapshot();
  assert.deepEqual(actual.paths,expected.paths,'directory path multiset differs from fast-glob3.3.1');
  assert.deepEqual(actual.rules,expected.rules,'enabled rule settings changed');
  assert.deepEqual(actual.diagnostics,expected.diagnostics,'passing/failing lint diagnostics changed');
  assert.equal(actual.diagnostics['pages/ghost'].errors,0,'embedded non-route must not be discovered');
  assert.equal(actual.diagnostics['pages/about'].errors,1,'real Pages route must be detected');
  // App-router diagnostics are compared to upstream exactly; do not invent stronger rules.
  assert.equal(actual.diagnostics['valid-component'].errors,0);
});

test('installed archive is the transparent scoped adapter and matches checked-in source',()=>{
  const installed=fromPlugin('fast-glob/package.json');
  assert.equal(installed.name,'@tradesafe/next-root-glob');
  assert.deepEqual(installed,JSON.parse(fs.readFileSync('tooling/next-root-glob/package.json','utf8')));
  assert.equal(fs.readFileSync(fromPlugin.resolve('fast-glob'),'utf8'),fs.readFileSync('tooling/next-root-glob/index.mjs','utf8'));
  const packages=JSON.parse(fs.readFileSync('package-lock.json')).packages;
  for(const [name,value] of Object.entries(packages)) {
    assert.ok(!/(?:^|\/)node_modules\/(braces|micromatch)$/.test(name),'affected package remains installed');
    if(name.endsWith('/fast-glob'))assert.equal(value.name,'@tradesafe/next-root-glob');
  }
  assert.deepEqual(Object.keys(adapter),['globSync']);
  assert.throws(()=>adapter.globSync('*',{}),TypeError);
  assert.throws(()=>adapter.globSync('*',{onlyDirectories:true,ignore:['x']}),TypeError);
  assert.throws(()=>adapter.globSync(['x'],{onlyDirectories:true}),TypeError);
});

test('upstream call surface is pinned; changed Next usage requires adapter review',()=>{
  const helper=fs.readFileSync(path.join(pluginRoot,'dist/utils/get-root-dirs.js'),'utf8').replaceAll('\r\n','\n');
  const expected=fs.readFileSync('tooling/next-root-glob/upstream-helper.sha256','utf8').trim();
  assert.equal(createHash('sha256').update(helper).digest('hex'),expected);
  const callers=[];
  const scan=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else if(file.endsWith('.js')&&/require\(["']fast-glob["']\)/.test(fs.readFileSync(file,'utf8')))callers.push(path.relative(pluginRoot,file).replaceAll('\\','/'));}};
  scan(path.join(pluginRoot,'dist'));
  assert.deepEqual(callers,['dist/utils/get-root-dirs.js']);
});
