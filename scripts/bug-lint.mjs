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
  {id:'medkit-independent-of-heal-budget',pr:'v2.25.1 (fix/healthpack-bit-heal)',why:'medkits were refused once BIT/regen heal budget was spent; kits must not gate on or spend the shared budget',
   check(ctx){const src=ctx?.roundSrc??read('nodspel/round.js');const out=[];
     for(const fn of ['healthKitBlock','useHealthKit']){const m=src.match(new RegExp('export function '+fn+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
       if(!m){out.push(`nodspel/round.js: ${fn}() not found`);continue;}
       if(/healRemaining|healBudget/.test(m[0]))out.push(`nodspel/round.js: ${fn}() must not gate on the shared heal budget`);
       if(fn==='useHealthKit'&&!/budget\s*:\s*false/.test(m[0]))out.push('nodspel/round.js: useHealthKit() must heal with {budget:false}');}
     return out;}},
  {id:'raid-spawn-validated',pr:'v2.25.1 (fix/healthpack-bit-heal, spawn outside level)',why:'player spawned outside the level; the raid spawn must go through safeSpawn (walkable floor, not in a wall)',
   check(ctx){const src=ctx?.gameSrc??read('nodspel/game.mjs');const out=[];
     if(/position\s*=\s*\{\s*\.\.\.round\.level\.start\s*\}/.test(src))out.push('nodspel/game.mjs: spawn uses raw round.level.start; use safeSpawn(round.level)');
     if(!/position\s*=\s*safeSpawn\(round\.level\)/.test(src))out.push('nodspel/game.mjs: loadLevel must place the player with safeSpawn(round.level)');
     return out;}},
  {id:'shield-guard-rear-clearance',pr:'v2.28.1 (fix/shield-guard-rear-clearance)',why:'playtest: a front-shielded guard stood with its back against the generator/node and could not be killed; placement must revalidate the flank after ALL encounters are placed',
   check(ctx){const src=ctx?.encSrc??read('nodspel/encounters.js');const out=[];
     const body=(src.match(/export function applyEncounters\([\s\S]*?\n}\n/)||[''])[0];
     if(!/ensureRearClearance\(level,rng(?:,\{omit:false\})?\);\s*return level\.encounters;/.test(body))out.push('nodspel/encounters.js: applyEncounters must call ensureRearClearance(level,rng) last, right before returning');
     if(!/function hasClearRear\b/.test(src))out.push('nodspel/encounters.js: hasClearRear() missing');
     if(!/export function walkMap\b/.test(src)||!/walkMap\(level,enemy\.id\)/.test(src))out.push('nodspel/encounters.js: flank must be proven walkable from the start (walkMap)');
     const ens=(src.match(/export function ensureRearClearance\([\s\S]*?\n}\n/)||[''])[0];
     if(/frontShield\s*=\s*0/.test(ens))out.push('nodspel/encounters.js: ensureRearClearance must not strip the front shield; omit the impossible encounter instead');
     const lv=ctx?.levelsSrc??read('nodspel/levels.js');
     if(!/applyAreaRules\(level,AR\);\s*\/\/[^\n]*\n\s*ensureRearClearance\(/.test(lv))out.push('nodspel/levels.js: generateLevel must re-run ensureRearClearance after applyAreaRules (extra bodies)');
     return out;}},
  {id:'artillery-fx-prewarm',pr:'#196',why:'first artillery shell + landing ring compiled mid-fight and hitching on iPhone',
   check(ctx){const src=ctx?.gameSrc??read('nodspel/game.mjs');const out=[];
     if(!/function makeArtilleryShell\b/.test(src))out.push('nodspel/game.mjs: makeArtilleryShell() missing (pooled shell factory)');
     if(!/function makeToolFxRing\b/.test(src))out.push('nodspel/game.mjs: makeToolFxRing() missing (pooled landing ring factory)');
     if(!/makeArtilleryShell\(\);\s*makeToolFxRing\(\);\s*makeToolFxRing\(\);/.test(src))out.push('nodspel/game.mjs: must pre-create 1 artillery shell + 2 landing rings at init for shader prewarm');
     if(!/function prewarmShaders\b/.test(src)||!/prewarmShaders\(\);/.test(src))out.push('nodspel/game.mjs: prewarmShaders() must still run so hidden artillery FX compile at level load');
     return out;}},
  {id:'perk-choice-touch-44',pr:'v2.28.0 (fix/perk-touch-44)',why:'layout CI flaked "perk touch target smaller than 44px" when the 4s auto-pick closed the overlay before measure (0x0); cards must keep a 44px floor and the debug demo must not auto-close mid-check',
   check(){const out=[];const css=read('nodspel/perks.css');const game=read('nodspel/game.mjs');const ui=read('nodspel/perk-ui.js');const layout=read('scripts/layout-check.mjs');
     if(!/\.perk-grid\{[^}]*minmax\(\s*44px\s*,/.test(css.replace(/\s+/g,' ')))out.push('nodspel/perks.css: .perk-grid columns must use minmax(44px,...) so cards cannot collapse below the touch target');
     if(!/\.perk-choice\{[^}]*min-width:\s*44px/.test(css.replace(/\s+/g,' ')))out.push('nodspel/perks.css: .perk-choice must set min-width:44px');
     if(/\.perk-choice:active\{[^}]*scale\(/.test(css.replace(/\s+/g,' ')))out.push('nodspel/perks.css: .perk-choice:active must not scale (scale shrinks getBoundingClientRect below the 44px floor)');
     if(!/open\(round,\s*key\s*,\s*opts/.test(ui)&&!/opts\.timeoutMs/.test(ui))out.push('nodspel/perk-ui.js: open() must accept opts.timeoutMs');
     if(!/perkPickDemo\(\)\{[\s\S]*?openPerk\(key,\{timeoutMs:\s*0\}\)/.test(game))out.push('nodspel/game.mjs: perkPickDemo must open with {timeoutMs:0} so layout can measure before auto-pick');
     if(!/perkForceTimeout\(\)\{act\('timeout'\);\}/.test(game))out.push('nodspel/game.mjs: perkForceTimeout() must call act(\'timeout\') for layout after measure');
     if(!/perkForceTimeout\(\)/.test(layout))out.push('scripts/layout-check.mjs: perkPopupRun must call __NR.perkForceTimeout() after the 44px assert');
     return out;}},

];

export function runAll(ctx){const res=[];for(const r of RULES){for(const msg of r.check(ctx))res.push({rule:r.id,pr:r.pr,msg});}return res;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const ctx={files:tracked(),gitignore:fs.existsSync(path.join(root,'.gitignore'))?read('.gitignore'):''};
  const res=runAll(ctx);for(const x of res)console.log(`[${x.rule} ${x.pr}] ${x.msg}`);
  console.log(`bug-lint: ${RULES.length} rule(s), ${res.length} violation(s)`);if(res.length)process.exit(1);
}
