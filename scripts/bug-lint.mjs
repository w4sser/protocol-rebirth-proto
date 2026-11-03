#!/usr/bin/env node
// Bug-regression lint (v2.24.0). Convention: every bug fix adds a rule here or a test (docs/bug-lint.md).
// Each rule names the PR/bug it guards. Rules are static checks over tracked files: cheap, no browser.
// Run: node scripts/bug-lint.mjs   (part of npm test via test:bug-lint)
import fs from 'node:fs';import path from 'node:path';import {execSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function tracked(){try{return execSync('git ls-files',{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);}catch{return null;}}

export const RULES=[
  {id:'no-tracked-node-modules',pr:'#129',why:'a committed node_modules symlink broke the Pages deploy',
   check({files,gitignore}){const out=[];
     if(files&&files.some(f=>f==='node_modules'||f.startsWith('node_modules/')))out.push('node_modules is tracked by git');
     if(!/^node_modules$/m.test(gitignore))out.push('.gitignore must ignore `node_modules` WITHOUT trailing slash (a slash does not match the symlink)');
     return out;}},
  {id:'audio-ogg-m4a-pairs',pr:'#162 (v2.14.1 iOS audio hotfix)',why:'iOS Safari cannot play ogg; every clip needs an m4a fallback (and ogg for others)',
   check({files}){const out=[];const a=(files||[]).filter(f=>/^assets\/audio\/.+\.(ogg|m4a)$/.test(f));const s=new Set(a);
     for(const f of a){const other=f.endsWith('.ogg')?f.replace(/\.ogg$/,'.m4a'):f.replace(/\.m4a$/,'.ogg');if(!s.has(other))out.push(`${f} has no ${path.extname(other)} sibling`);}
     return out;}},
  {id:'cache-bust-local-imports',pr:'#154 (v2.11.1 "cache-bust imports added by #151")',why:'an import without ?v= serves stale modules after deploy',
   check({files}){const out=[];const mods=(files||[]).filter(f=>/^(nodspel|data|ui)\/[^/]+\.(m?js)$/.test(f));
     const re=/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g;
     for(const f of mods){const src=read(f);let m;while((m=re.exec(src))){const spec=m[1];if(spec.includes('/vendor/')||spec.includes('?v='))continue;out.push(`${f}: import '${spec}' lacks ?v=<version>`);}}
     return out;}},
  {id:'ci-scripts-stub-ftue-direct',pr:'#173 (v2.22.0)',why:'fresh profiles auto-launch the FTUE raid; layout/viewport checks lost #phone until they stubbed A.startFtueDirect',
   check(){const out=[];for(const f of ['scripts/layout-check.mjs','scripts/viewport-check.mjs']){if(!fs.existsSync(path.join(root,f)))continue;if(!/A\.startFtueDirect\s*=\s*\(\)\s*=>\s*\{\s*\}/.test(read(f)))out.push(`${f} must stub A.startFtueDirect before clicking the splash`);}return out;}},
  {id:'transparent-doubleside-single-pass',pr:'#178 (v2.22.4)',why:'transparent DoubleSide flat meshes rebuilt shader programs every frame unless forceSinglePass',
   check(){const src=read('nodspel/game.mjs');const out=[];
     if(!/function singlePassFlat\b[^\n]*forceSinglePass\s*=\s*true/.test(src))out.push('nodspel/game.mjs: singlePassFlat() (sets forceSinglePass on transparent DoubleSide flats) is missing');
     if(!/scene\.traverse\(\s*singlePassFlat\s*\)/.test(src))out.push('nodspel/game.mjs: singlePassFlat is no longer applied via scene.traverse');
     return out;}},
  {id:'single-app-version-const',pr:'#69 (fix/version-1651)',why:'version label drifted from the cache tags; app.js must keep one APP_VERSION literal',
   check(){const m=read('app.js').match(/const APP_VERSION\s*=\s*"([\d.]+)"/g)||[];return m.length===1?[]:[`app.js: expected exactly one APP_VERSION const, found ${m.length}`];}},
];

export function runAll(ctx){const res=[];for(const r of RULES){for(const msg of r.check(ctx))res.push({rule:r.id,pr:r.pr,msg});}return res;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const ctx={files:tracked(),gitignore:fs.existsSync(path.join(root,'.gitignore'))?read('.gitignore'):''};
  const res=runAll(ctx);for(const x of res)console.log(`[${x.rule} ${x.pr}] ${x.msg}`);
  console.log(`bug-lint: ${RULES.length} rule(s), ${res.length} violation(s)`);if(res.length)process.exit(1);
}
