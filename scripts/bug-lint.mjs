#!/usr/bin/env node
// Bug-regression lint (v2.24.0). Convention: every bug fix adds a rule here or a test (docs/bug-lint.md).
// Each rule names the PR/bug it guards. Rules are static checks over tracked files: cheap, no browser.
// Run: node scripts/bug-lint.mjs   (part of npm test via test:bug-lint)
import fs from 'node:fs';import path from 'node:path';import {execSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function tracked(){try{return execSync('git ls-files',{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);}catch{return null;}}

import {parse} from 'acorn';
import * as walk from 'acorn-walk';

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
  {id:'playtest-1108-ui',pr:'v2.28.2 (fix/playtest-ui-20261108)',why:'playtest 2026-11-08: Continue raid must be the green primary, a Bunker Level card must pause the raid clock, the phone bag/NEED panel must stay compact',
   check(ctx){const out=[];const html=ctx?.html??read('nodspel/index.html'),css=(ctx?.css??read('nodspel/style.css')).replace(/\s+/g,' '),game=ctx?.game??read('nodspel/game.mjs'),layout=ctx?.layout??read('scripts/layout-check.mjs');
     if(!/id="continue-raid" class="result-continue"/.test(html))out.push('nodspel/index.html: #continue-raid must use class result-continue');
     if(!/\.result-continue\{[^}]*background:var\(--ad-continue\)/.test(css))out.push('nodspel/style.css: .result-continue must use var(--ad-continue)');
     const intro=(game.match(/function showLevelIntro\(\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!/pausePick\(/.test(intro)||!/resumePick\(/.test(intro))out.push('nodspel/game.mjs: showLevelIntro must pausePick and resumePick the raid clock');
     if(!/showLevelIntro\(\);/.test(game))out.push('nodspel/game.mjs: loadLevel must call showLevelIntro()');
     if(!/raidGoalCompactRun\(vp\)/.test(layout))out.push('scripts/layout-check.mjs: the compact bag/NEED panel check must run');
     return out;}},
  {id:'fullscreen-detail',pr:'v2.28.2 (playtest 2026-11-08)',why:'room/quest/weapon detail screens were floating modals under the currency bar with the close badge on the right',
   check(ctx){const out=[];const app=ctx?.app??read('app.js'),html=ctx?.html??read('index.html');
     if(!/qlogov fsdetail/.test(app))out.push('app.js: quest log must open with the fsdetail class');
     if((app.match(/"sheet fsdetail"/g)||[]).length<3)out.push('app.js: room/module detail overlays must use "sheet fsdetail"');
     if(!/'<button type="button" class="wpn-close"[^\n]*?'<div class="wpn-r">'/.test(app))out.push('app.js: weapon close must sit before .wpn-r (top-left), not inside the stats column');
     if(!/#overlay\.fsdetail \.pop-card>\.pop-x\{[^}]*left:8px/.test(html))out.push('index.html: fsdetail close badge must be top-left');
     return out;}},
  {id:'artillery-fx-prewarm',pr:'#196',why:'first artillery shell + landing ring compiled mid-fight and hitching on iPhone',
   check(ctx){const src=ctx?.gameSrc??read('nodspel/game.mjs');const out=[];
     if(!/function makeArtilleryShell\b/.test(src))out.push('nodspel/game.mjs: makeArtilleryShell() missing (pooled shell factory)');
     if(!/function makeToolFxRing\b/.test(src))out.push('nodspel/game.mjs: makeToolFxRing() missing (pooled landing ring factory)');
     if(!/makeArtilleryShell\(\);\s*makeToolFxRing\(\);\s*makeToolFxRing\(\);/.test(src))out.push('nodspel/game.mjs: must pre-create 1 artillery shell + 2 landing rings at init for shader prewarm');
     if(!/function prewarmShaders\b/.test(src)||!/prewarmShaders\(\);/.test(src))out.push('nodspel/game.mjs: prewarmShaders() must still run so hidden artillery FX compile at level load');
     return out;}},
  {id:'dda-extra-on-floor',pr:'v2.28.4 (fix/dda-spawn-floor-20261108)',why:'playtest 2026-11-08 "spawn utanför leveln": DDA extra enemies were placed 1.4-2.8m from a source checking only walls/boxes, landing behind exterior walls, and cloned front-shielded encounter actors',
   check(c={}){const out=[];const src=c.ddaSrc??read('nodspel/difficulty.js');
     if(!/walkMap\(/.test(src))out.push('nodspel/difficulty.js: extras must be reachable (walkMap from the start)');
     if(!/level\.floors\.some\(/.test(src))out.push('nodspel/difficulty.js: extras must check their full footprint against level.floors');
     if(!/filter\(d=>d\.locked\)/.test(src))out.push('nodspel/difficulty.js: locked doors must count as solids for extras');
     if(!/!e\.frontShield/.test(src)||!/!e\.encounter/.test(src))out.push('nodspel/difficulty.js: extras must clone only plain bodies (no frontShield/encounter actors)');
     if(/pool\.length\s*\?\s*pool\s*:/.test(src))out.push('nodspel/difficulty.js: no fallback from the plain pool to any enemy (it cloned shield actors)');
     return out;}},
  {id:'partition-door-clearance',pr:'v2.28.6 (playtest 2026-11-08 corridors)',why:'Bunker L2 partition end jutted into the side doorway mouth; players and enemies snagged in corridors',
   check(c={}){const out=[];const lv=c.levelsSrc??read('nodspel/levels.js');
     if(!/const sideDoor=area!=='archipelago'&&room\.doors\.some\(p=>p\.x!==0\)/.test(lv)||!/-\(door\/2\+t\/2\+\.02\)/.test(lv))out.push('nodspel/levels.js: with a side door the partition must clear the doorway span (z <= -(door/2+t/2))');
     if(!c.levelsSrc&&!read('nodspel/tests/door-clearance.test.mjs').includes('walkable starts on both sides'))out.push('nodspel/tests/door-clearance.test.mjs: keep the both-sides corridor approach sweep');
     return out;}},
  {id:'level-intro-fullscreen',pr:'v2.28.4 (playtest 2026-11-08)',why:'the BUNKER LEVEL N card between segments did not fill the screen: it lived inside the transformed #viewport',
   check(c={}){const out=[];const html=c.htmlSrc??read('nodspel/index.html'),css=c.cssSrc??read('nodspel/style.css'),lc=c.layoutSrc??read('scripts/layout-check.mjs');
     const vp=html.indexOf('id="viewport"'),card=html.indexOf('id="level-intro"'),end=html.lastIndexOf('</script>');
     if(card<0||card<end)out.push('nodspel/index.html: #level-intro must sit after the scripts, directly in <body>, outside #viewport');
     if(!/\.level-intro-card\{position:fixed;inset:0;width:100vw;height:100vh;[^}]*z-index:60/.test(css))out.push('nodspel/style.css: .level-intro-card must be fixed, inset 0, 100vw x full height, z-index 60');
     if(!/level card does not fill the screen/.test(lc))out.push('scripts/layout-check.mjs: the level card step must assert full-screen coverage');
     return out;}},
  {id:'scouted-area-no-chart',pr:'v2.28.5 (playtest t352u)',why:'Archipelago Chart / Town Survey kept dropping after the area was already scouted -- redundant pickup',
   check(c={}){const out=[];const lv=c.levelsSrc??read('nodspel/levels.js'),app=c.appSrc??read('app.js'),game=c.gameSrc??read('nodspel/game.mjs');
     if(!/AR\.scout&&[^{]*!SCOUTED\.has\(/.test(lv))out.push('nodspel/levels.js: the scout crate must be skipped for areas in SCOUTED');
     if(!/&scouted=/.test(app)||!/scouted:\s*scoutedAreas\(\)/.test(app))out.push('app.js: the raid launch must pass the account\'s scouted areas (&scouted=)');
     if(!/setScouted\(launch\.scouted\)/.test(game))out.push('nodspel/game.mjs: must call setScouted(launch.scouted) before any level is generated');
     return out;}},
  {id:'core-loot-hint',pr:'v2.28.5 (playtest 2026-11-08)',why:'Core L2->L3 showed 0/2 Memory Module with no hint where to raid for it',
   check(c={}){const out=[];const app=c.appSrc??read('app.js'),html=c.htmlSrc??read('index.html');
     if(!/lootHintHtml\(p\)/.test(app))out.push('app.js: building cost rows must render lootHintHtml(p) for missing parts');
     if(!/D\.lootSources/.test(app))out.push('app.js: lootHint must read DATA.lootSources (generated), not hand-written areas');
     if(!/src="data\/loot-sources\.js/.test(html))out.push('index.html: must load data/loot-sources.js');
     return out;}},
  // perk-choice-touch-44 (v2.28.0, fix/perk-touch-44) retired: the mid-raid perk picker it guarded
  // (nodspel/perk-ui.js, nodspel/perks.css, game.mjs perkPickDemo/perkForceTimeout) was removed in v2.28.25
  // (PRB-146, Wild Team playtest "remove round upgrades"). See docs/bug-lint.md.
  {id:'raid-tab-open-when-goal-needs-loot',pr:'v2.28.21 (fix/core-found-raid-softlock)',why:'Carlos softlock: fresh start, Core L1 still needed 1 more Scrap Alloy, but RAID was gated only on baseAllows("navigation","prep") (false in core_found) and A.go("prep") used that same check -- the orange RAID FOR SCRAP ALLOY button silently no-opped and the player could never raid for the only thing the goal needed',
   check(c={}){const out=[];const app=c.appSrc??read('app.js');
     if(!/function goalNeedsRaidLoot\(\)/.test(app))out.push('app.js: goalNeedsRaidLoot() is missing');
     const nav=(app.match(/function navAllowed\(id\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!nav)out.push('app.js: navAllowed(id) not found');
     else if(!/id === "prep"[^\n]*goalNeedsRaidLoot\(\)/.test(nav))out.push('app.js: navAllowed("prep") must also allow it when goalNeedsRaidLoot() is true, not only baseAllows("navigation","prep")');
     const go=(app.match(/go\(screen, param\)\{[\s\S]*?\n  \},/)||[''])[0];
     if(!go)out.push('app.js: A.go(screen, param) not found');
     else if(!/screen === "prep"[^\n]*navAllowed\("prep"\)/.test(go))out.push('app.js: A.go must gate "prep" through navAllowed("prep") so raidForModule/raidForRoom actually open Raid Prep, not only baseAllows("navigation", screen)');
     return out;}},
  {id:'ftue-extract-topup-honors-result-ftue',pr:'v2.28.22 (fix/ftue-topup-raidid-mismatch)',why:'Carlos 1/2 Alloy after a fresh FTUE extract: ingest top-up required S.coreLaunch.ftue && raidId match, so a result that carried r.ftue but a nodspel: raidId (seed restart) or a missing/overwritten coreLaunch skipped the Core L1 material guarantee',
   check(c={}){const out=[];const app=c.appSrc??read('app.js');
     const fn=(app.match(/function ingestRaidResult\(r\)\{[\s\S]*?\nfunction /)||[''])[0];
     if(!fn){out.push('app.js: ingestRaidResult() not found');return out;}
     if(!/const ftueLaunch/.test(fn))out.push('app.js: ingestRaidResult must compute ftueLaunch for the D3.10 Core L1 top-up');
     else if(!/r\.ftue/.test(fn))out.push('app.js: ftueLaunch must also honor r.ftue (the result flag from ?ftue=1), not only S.coreLaunch.raidId match');
     else if(!/r\.ftue[^\n]*S\.raids/.test(fn))out.push('app.js: the r.ftue top-up fallback must be limited to a first extract (S.raids === 0) so a later raid never gets it');
     return out;}},
  {id:'death-loss-screen-before-handoff',pr:'v2.28.24 (fix/death-loss-screen)',why:'Wild Team playtest: dying in the bunker threw the player straight back to the base with no in-raid loss screen -- finishRound auto-handed-off (wrote the ledger and navigated) for every terminal base raid, so death/timeout/abandon never rendered #round-over at all',
   check(c={}){const out=[];const game=c.gameSrc??read('nodspel/game.mjs');
     const finish=(game.match(/function finishRound\([^)]*\)\{[\s\S]*?\n\}\n/)||[''])[0];
     if(!finish)out.push('nodspel/game.mjs: finishRound() not found');
     else if(!/round\.over&&\['extract','complete'\]\.includes\(round\.reason\)&&handoffRaidResult\(/.test(finish))out.push("nodspel/game.mjs: finishRound's automatic handoffRaidResult call must be gated to ['extract','complete'].includes(round.reason) -- death/timeout/abandon must fall through to the in-raid presenter instead of auto-handing-off");
     return out;}},

  {id:'no-mid-raid-perk-picker',pr:'v2.28.25 (PRB-146)',why:'Wild Team playtest: Robert decided 2026-11-13 to remove mid-raid round upgrades completely -- the SELECT PERK picker must not return, rooms must clear without queueing an offer, and pickReady/autoPickPerks must stay no-ops',
   check(c={}){const out=[];
     const game=c.gameSrc??read('nodspel/game.mjs');
     if(/createPerkUI|function openPerk|perkPickDemo|perk-ui\.js/.test(game))out.push('nodspel/game.mjs: mid-raid perk picker must stay removed (no createPerkUI, openPerk, perkPickDemo or perk-ui.js import)');
     const html=c.htmlSrc??read('nodspel/index.html');
     if(/perks\.css|perk-overlay|perk-ui/.test(html))out.push('nodspel/index.html: must not include perk-ui, perks.css or a perk-overlay');
     const perks=c.perksSrc??read('nodspel/perks.js');
     const update=(perks.match(/export function updateClears\([^{]*\{[\s\S]*?\n\}\n/)||[''])[0];
     if(!update)out.push('nodspel/perks.js: updateClears() not found');
     else if(/clearPending|queue\.push/.test(update))out.push('nodspel/perks.js: updateClears must resolve a clear immediately and must not queue a perk offer (no clearPending, no queue.push)');
     if(!/export function pickReady[\s\S]*?return null;/.test(perks))out.push('nodspel/perks.js: pickReady must be a no-op that always returns null');
     if(!/export function autoPickPerks[\s\S]*?return \[\];/.test(perks))out.push('nodspel/perks.js: autoPickPerks must be a no-op that always returns []');
     try{read('nodspel/perk-ui.js');out.push('nodspel/perk-ui.js: the mid-raid perk picker file must stay deleted');}catch(_){/* expected */}
     try{read('nodspel/perks.css');out.push('nodspel/perks.css: the mid-raid perk picker stylesheet must stay deleted');}catch(_){/* expected */}
     return out;}},
  {id:'coldopen-vo-after-start-unlock',pr:'v2.28.3x PRB-154 start audio',why:'the first gesture must resume and prime Web Audio before async work, with decoded buffers and a greeting requested at the first visible line',
   check(c={}){const out=[],app=c.appSrc??read('app.js'),audio=c.audioSrc??read('ui/audio.js');
     const activate=(app.match(/const activate = \(e\) => \{[\s\S]*?\n  \};/)||[''])[0].replace(/\/\/[^\n]*/g,'');
     const syncAt=activate.indexOf('unlockSync'),asyncAt=activate.indexOf('unlock?.');
     if(syncAt<0||asyncAt<syncAt||/\bawait\b/.test(activate.slice(0,syncAt)))out.push('app.js: start activation must call unlockSync before awaiting or calling unlock');
     const sync=(audio.match(/    unlockSync\(\)\{[\s\S]*?\n    \}/)||[''])[0];
     if(!/context\.resume\(\)/.test(sync)||!/createBuffer\(1,1,/.test(sync)||!/source\.start\(0\)/.test(sync)||/\bawait\b/.test(sync))out.push('ui/audio.js: unlockSync must resume and start a silent one-sample buffer synchronously');
     if(!/activationAudio = window\.PR_AUDIO\?\.unlock\?\.\(\)/.test(activate)||!/Promise\.resolve\(activationAudio\)\.then/.test(app))out.push('app.js: start confirmation must wait for the gesture unlock promise');
     if(!/preload\.call\(window\.PR_AUDIO\)/.test(app))out.push('app.js: splash must preload audio before exposing the prompt');
     const intro=(app.match(/SCREENS\.intro = function\(\)\{[\s\S]*?\n\};/)||[''])[0];
     if(!/requestVoice\(['"]youre-back['"]\)/.test(intro)||!/addEventListener\("animationstart", greet/.test(intro))out.push('app.js: intro must request youre-back with the first line reveal');
     return out;}},
  {id:'greeting-vo-only-with-bit-visible',pr:'v2.28.30 FTUE VO on summary',why:'BIT\'s youre-back cold-open greeting queued in pendingVoices while iOS audio was locked and replayed on the next unlock gesture (often ENTER THE FACILITY itself), landing on the deferred FTUE homecoming summary after dismissIntro had already navigated away and BIT was no longer on screen; base-audio\'s greet() could also fire a second welcome-back voice there',
   check(c={}){const out=[];
     const app=c.appSrc??read('app.js');
     const dismiss=(app.match(/dismissIntro\(\)\{[\s\S]*?\n  \},/)||[''])[0];
     if(!dismiss)out.push('app.js: A.dismissIntro() not found');
     else{
       const cancelAt=dismiss.search(/cancelVoice\?\.\(\s*['"]youre-back['"]\s*\)/);
       const goAt=dismiss.search(/A\.go\(/), summaryAt=dismiss.search(/showHomecomingSummary\(/);
       if(cancelAt<0)out.push('app.js: A.dismissIntro must cancel the pending youre-back voice (PR_AUDIO.cancelVoice)');
       else if((goAt>=0&&cancelAt>goAt)||(summaryAt>=0&&cancelAt>summaryAt))out.push('app.js: A.dismissIntro must cancel youre-back before navigating away from the intro / opening the deferred summary');
     }
     const base=c.baseAudioSrc??read('ui/base-audio.js');
     if(!/skipVoice/.test(base))out.push("ui/base-audio.js: greet() must thread a skipVoice flag from PR_AUDIO_BASE_RETURN's opts");
     const skipAt=base.search(/if\(skip\)return;/), voiceAt=base.search(/requestVoice\(['"]youre-back['"]\)/);
     if(skipAt<0||voiceAt<0||skipAt>voiceAt)out.push('ui/base-audio.js: greet() must return before requesting/playing any BIT voice once skipVoice is set (the deferred FTUE summary, where BIT already greeted during the intro)');
     return out;}},

  {id:'cable-retro-migration-idempotent',pr:'v2.28.29 PRB-139',why:'the one-time retro Cable credit for pre-PRB-132 saves (Power Trace/bunker B1 done before the Fabricator existed) must run exactly once per save -- a load() path that forgets to call the migration leaves old saves stuck short of the Fabricator cost, and a migration that forgets to check/set cableRetro1 re-grants the Cable on every load',
   check(c={}){const out=[];const app=c.appSrc??read('app.js');
     if(!/function migrateCableRetro\(st\)\{/.test(app))out.push('app.js: migrateCableRetro(st) is missing');
     const fn=(app.match(/function migrateCableRetro\(st\)\{[\s\S]*?\n\}/)||[''])[0];
     if(fn && !/if\s*\(\s*st\.cableRetro1\s*\)\s*return st;/.test(fn))out.push('app.js: migrateCableRetro must return early once st.cableRetro1 is already set (idempotent)');
     if(fn && !/st\.cableRetro1\s*=\s*["']granted["']/.test(fn))out.push('app.js: migrateCableRetro must set st.cableRetro1 = "granted" on an eligible save');
     if(fn && !/st\.cableRetro1\s*=\s*["']n\/a["']/.test(fn))out.push('app.js: migrateCableRetro must set st.cableRetro1 = "n/a" on an ineligible save');
     const load=(app.match(/function load\(\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!load)out.push('app.js: load() not found');
     else if(!/migrateCableRetro\(st\)/.test(load))out.push('app.js: load() must call migrateCableRetro(st) alongside the other additive migrations');
     return out;}},

  {id:'core-restore-no-power-popup',pr:'v2.28.33 PRB-155 (playtest 2026-11-15, item 4)',why:'a popup used to gate the first Core restore behind an ENTER-style tap before the narrator cutscene could play; Robert decided the cutscene must be the single screen -- for a fresh build, an existing save, and after the cutscene has already played -- so the popup and its own copy must stay gone for good, not just unused',
   check(c={}){const out=[];const app=c.appSrc??read('app.js');
     if(/function bootSequence\(/.test(app))out.push('app.js: bootSequence() (the old Core-restore payoff popup) must stay removed');
     if(/POWER RESTORED/.test(app))out.push('app.js: "POWER RESTORED" copy must not exist anywhere -- the cutscene carries the benefit/next text instead');
     const build=(app.match(/\bbuild\(modId\)\{[\s\S]*?\n  \},/)||[''])[0];
     if(!build)out.push('app.js: A.build(modId) not found');
     else{
       const lightsOn=(build.match(/if\(isLightsOn\)\{[\s\S]*?\}\s*else if\(isFabricatorOnline/)||[''])[0];
       if(!lightsOn)out.push('app.js: A.build must still branch on isLightsOn for the Core L1 restore');
       else{
         if(/\boverlay\(/.test(lightsOn))out.push('app.js: the isLightsOn branch must never open a popup -- the narrator cutscene is the single screen');
         if(!/PRBitCutscene\?\.play\(/.test(lightsOn))out.push('app.js: the isLightsOn branch must still play the core_restored cutscene itself (nothing else replaces the removed popup)');
       }
     }
     return out;}},

  {id:'cutscene-story-survives-popup-replacement',pr:'v2.28.3x PRB-160 story close lifecycle',why:'navigation or Profiles replacing a reward/summary must not discard the queued story beat',
   check(c={}){const app=c.appSrc??read('app.js'),out=[];
     if(!/function discardOverlay\(/.test(app)||!/o\._storyClose = opts\.afterDiscard/.test(app)||!/afterDiscard:narrate/.test(app)||!/afterDiscard:\(\) => maybeShowFirstDeathCard/.test(app))out.push('story reward/summary must preserve their story callbacks on popup cancellation');
     const profiles=(app.match(/openProfiles\(\)\{([\s\S]*?)\n  \},/)||[])[1]||'';
     if(!/discardOverlay\(old\)/.test(profiles))out.push('Profiles replacement must preserve the old popup story');
     return out;}},
  {id:'cutscene-no-wait-before-show',pr:'v2.28.3x PRB-160 instant cutscenes',why:'narrator visuals must never wait for voice, loading, or a bunker lighting timer',
   check(c={}){const js=c.cutsceneSrc??read('ui/bit-cutscene.js'),app=c.appSrc??read('app.js'),out=[];
     if(/voiceBusy/.test(js))out.push('cutscenes must not gate on voiceBusy');
     const advance=(js.match(/function advance\(\)\{([\s\S]*?)\n  function later/)||[])[1]||'';
     if(!/present\(/.test(advance)||/\bawait\b|\.then\s*\(/.test(advance))out.push('advance must present synchronously without awaiting preload');
     // Inspect timer callbacks with the parser, including nested arrow callbacks.
     const ast=parse(app,{ecmaVersion:"latest",sourceType:"script"}), calls=[];
     if(ast) walk.simple(ast,{CallExpression(node){if(node.callee.name==='setTimeout'||node.callee.property?.name==='setTimeout')calls.push(app.slice(node.start,node.end));}});
     if(calls.some(call => /PRBitCutscene\??\.play/.test(call)))out.push('app.js must not schedule cutscene play in setTimeout');
     return out;}},
  {id:'fabricator-art-bounded-cache',pr:'v2.28.3x PRB-155 optional art fallback',why:'preload and play must share the optional art probe, and a stalled image must not prevent the Fabricator fallback cutscene',
   check(c={}){const app=c.appSrc??read('app.js'),out=[];
     const probe=(app.match(/function fabricatorCutsceneArtReady\(cb\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!/if\(!fabricatorArtPromise && window\.PRBitCutscene\)/.test(probe))out.push('app.js: cache the Fabricator art warm-up across preload and play');
     // PRB-157 supersedes the optional-art timeout: shipped art must never gate playback.
     const beat=(app.match(/function fabricatorCutsceneBeat\(cb\)\{[\s\S]*?\n\}/)||[''])[0];
     if(/fabricatorCutsceneArtReady\([^)]*=>/.test(beat)||!/cb\(!fabricatorArtFailed/.test(beat))out.push('app.js: select shipped Fabricator art synchronously, without awaiting its warm-up');
     return out;}},
  {id:'cutscene-reduced-motion-instant',pr:'v2.28.3x PRB-155 reduced motion',why:'the bust and continue control must appear instantly along with the speech bubble and info strip under reduced motion',
   check(c={}){const js=c.cutsceneSrc??read('ui/bit-cutscene.js'),css=c.cutsceneCss??read('ui/bit-cutscene.css'),out=[];
     if(!/if\(run\.reduced\) el\.classList\.add\("hint-visible"\)/.test(js))out.push('ui/bit-cutscene.js: reduced motion must reveal the continue hint immediately');
     if(!/reduced \.bit-cutscene-bust,[\s\S]*?\{transition:none;\}/.test(css))out.push('ui/bit-cutscene.css: reduced motion must disable the bust fade');
     return out;}},
  {id:'narrator-hologram-above-copy',pr:'v2.28.3x PRB-155 Fabricator layout',why:'the assembling vest was hidden behind the speech bubble at phone landscape sizes; keep its anchor above the copy and verify actual rectangles in the screenshot harness',
   check(c={}){const css=c.cutsceneCss??read('ui/bit-cutscene.css');
     const rule=(css.match(/\.bit-cutscene-hologram\{([^}]+)\}/)||[])[1]||'';
     const bottom=Number((rule.match(/bottom:([\d.]+)%/)||[])[1]);
     return bottom>=40?[]:['ui/bit-cutscene.css: keep the hologram above the speech bubble (bottom at least 40%); run narrator-cutscene-shots.mjs for geometric checks'];}},
  {id:'extract-loot-3d-vfx',pr:'v2.28.35 PRB-156 (feat/vfx-3d-extract-loot)',why:'Robert playtest 2026-11-15: "the extraction point effect looks damn 2D. Same when you\'ve picked up loot." The flat MeshBasicMaterial exitBeam cylinder + plain exitPad plane, and the generic ring+billboard world.burst() reused for pickups, read as 2D decals from the isometric camera',
   check(c={}){const out=[];
     const beam=c.beamSrc??read('nodspel/vfx-extract-beam.js');
     if(!/export function createExtractBeam\(/.test(beam))out.push('nodspel/vfx-extract-beam.js: createExtractBeam() is missing');
     if(!/THREE\.ShaderMaterial\(/.test(beam))out.push('nodspel/vfx-extract-beam.js: the beam must use a custom ShaderMaterial (fresnel rim + vertical fade + noise bands), not a flat MeshBasicMaterial cylinder');
     const burstMod=c.burstSrc??read('nodspel/vfx-loot-burst.js');
     if(!/export function createLootBurstPool\(/.test(burstMod))out.push('nodspel/vfx-loot-burst.js: createLootBurstPool() is missing');
     const world=c.worldSrc??read('nodspel/world.js');
     if(!/createExtractBeam\(\{color:EXTRACT_COLOR,quality\}\)/.test(world))out.push('nodspel/world.js: buildWorld must build the extract beam via createExtractBeam({color:EXTRACT_COLOR,quality})');
     if(!/createLootBurstPool\(\{quality\}\)/.test(world))out.push('nodspel/world.js: buildWorld must build the loot-burst pool via createLootBurstPool({quality})');
     if(/new THREE\.CylinderGeometry\(\.9,\s*1\.1,\s*1,\s*20,\s*1,\s*true\)/.test(world))out.push('nodspel/world.js: the old flat exitBeam cylinder must stay removed');
     const game=c.gameSrc??read('nodspel/game.mjs');
     if(!/world\.spawnLootBurst\?\.\(v\.loot\.x,\.5,v\.loot\.z,v\.color\)/.test(game))out.push('nodspel/game.mjs: a loot pickup must spawn the pooled 3D burst via world.spawnLootBurst, not the flat world.burst() ring');
     if(!/world\.animate\(elapsed,position,round\)/.test(game))out.push('nodspel/game.mjs: world.animate must be called with the player position so the extract beam/loot burst can read approach progress and the homing target');
     return out;}},

  {id:'vfx-visible-pooled-lifecycle',pr:'v2.28.35 PRB-156 VFX lifecycle',why:'Subpixel Points were invisible with the orthographic camera, old sprites covered replacements, and quality/teardown missed the new pools',
   check(c={}){const out=[];
     const loot=c.lootVfxSrc??read('nodspel/vfx-loot-burst.js'),feedback=c.feedbackVfxSrc??read('nodspel/fx-feedback.js'),game=c.lifecycleGameSrc??read('nodspel/game.mjs');
     if(!/new THREE\.InstancedMesh\(/.test(loot))out.push('loot sparkles must use a fixed instanced pool');
     if(/hold\(record,'respawn'|pixel\.spawn\('collect'/.test(feedback))out.push('legacy extraction/collection sprites must stay removed');
     if(!/world\?\.setVfxQuality\(next\)/.test(game))out.push('live quality must reach world VFX');
     if(!/if\(round\.over\)world\?\.disposeVfx\(\)/.test(game))out.push('raid end must dispose world VFX');
     return out;}},


  {id:'vfx-phone-depth-layers',pr:'v2.28.35 PRB-156 pass 2',why:'Pass 1 still read flat at phone size: the extraction shell lacked a core/fence and pickup arcs disappeared behind the player',
   check(c={}){const out=[];
     const beam=c.phoneBeamSrc??read('nodspel/vfx-extract-beam.js'),loot=c.phoneLootSrc??read('nodspel/vfx-loot-burst.js');
     if(!/group\.add\(core\)/.test(beam)||!/group\.add\(fence\)/.test(beam))out.push('phone extraction must retain the inner core and raised floor fence');
     if(!/r\.pillar=new THREE\.Mesh\(/.test(loot)||!/r\.flash=new THREE\.Mesh\(/.test(loot))out.push('phone pickups must retain pooled origin pillars and arrival flashes');
     return out;}},

  {id:'dedicated-narrator-art-exists',pr:'v2.28.3x PRB-157 dedicated Fabricator art',why:'shipped narrator paths must resolve to tracked assets instead of silently using a placeholder',
   check(c={}){const app=c.appSrc??read('app.js'),files=c.files??tracked(),out=[];
     const available=new Set(files||[]);
     for(const match of app.matchAll(/assets\/production\/bit-narrator\/[^"']+\.webp/g))
       if(!available.has(match[0]))out.push('missing dedicated narrator art: '+match[0]);
     const renderer=c.cutsceneSrc??read('ui/bit-cutscene.js');
     if(!/images\.delete\(src\)/.test(renderer)||!/entry\.img\.decode/.test(renderer))out.push('shared bust warming must decode images and allow retries after errors');
     return [...new Set(out)];}},

  {id:'ios-audio-waits-for-running',pr:'v2.28.3x PRB-158 iOS audio',why:'Robert\'s iPhone playtest of v2.28.36: "the sound is still not fully loaded when I start playing" -- iOS WebKit resolves resume() (and can start decoding) while context.state is still \'suspended\', only flipping to \'running\' asynchronously, sometimes 100ms+ later; play()/voice() must wait (capped) for an in-flight unlock instead of hard-dropping the first sound, and the gesture listener must also catch touchstart/pointerdown (a joystick hold has no touchend for seconds)',
   check(c={}){const src=c.audioSrc??read('ui/audio.js'),out=[];
     const play=(src.match(/async play\(name,\{enemy=false\}=\{\}\)\{[\s\S]*?\n    \}/)||[''])[0];
     if(!play)out.push('ui/audio.js: play(name,{enemy}) not found');
     else if(!/unlockPromise/.test(play))out.push('ui/audio.js: play() must also wait when an unlock is in-flight (this.unlockPromise), not drop just because this.unlocked/this.wasUnlocked are still false');
     const voice=(src.match(/async voice\(name\)\{[\s\S]*?\n    \}/)||[''])[0];
     if(!voice)out.push('ui/audio.js: voice(name) not found');
     else if(!/unlockPromise/.test(voice))out.push('ui/audio.js: voice() must also wait when an unlock is in-flight (this.unlockPromise)');
     const install=(src.match(/installUnlock\(target\)\{[\s\S]*?\n    \}/)||[''])[0];
     if(!install)out.push('ui/audio.js: installUnlock(target) not found');
     else if(!/touchstart/.test(install)||!/pointerdown/.test(install))out.push('ui/audio.js: installUnlock must listen on touchstart and pointerdown (a joystick-hold gesture has no matching touchend for seconds)');
     return out;}},
  {id:'audio-no-background-playback',pr:'v2.28.3x PRB-159 iOS background audio',why:'The playback session kept iPhone music alive after closing the app; suspend on hidden and window pagehide instead',
   check(c={}){const src=(c.audioSrc??read('ui/audio.js')).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,''),out=[];
     if(/audioSession(?:\s*\?\.)?\s*\.?(?:type)?[\s\S]{0,40}?=\s*['"]playback['"]/.test(src))out.push('ui/audio.js: audioSession must never request playback');
     if(!/visibilitychange['"][\s\S]*?visibilityState\s*===?\s*['"]hidden['"][\s\S]*?this\.suspendForHidden\(\)/.test(src))out.push('ui/audio.js: hidden visibilitychange must suspendForHidden');
     if(!/gestures\.addEventListener\(['"]pagehide['"],\s*\(\)\s*=>\s*this\.suspendForHidden\(\)/.test(src))out.push('ui/audio.js: window pagehide must suspendForHidden');
     if(!/unlockSync\(\)\{\s*if\(this\.hidden\(\)/.test(src))out.push('ui/audio.js: synchronous gesture unlock must bail while hidden');
     return out;}},
  {id:'audio-debug-trigger-reachable',pr:'v2.28.3x PRB-159 iPhone diagnostics',why:'The landscape topbar hid the version and disabled pointer events, making triple-tap diagnostics unreachable',
   check(c={}){const css=c.audioDebugCss??read('ui/audio-debug.css');
     return /#topbar #app-version\s*\{[^}]*display:block;[^}]*pointer-events:auto/.test(css)?[]:['ui/audio-debug.css: override landscape version hiding and topbar pointer-events so triple-tap works'];}},
  {id:'audio-format-probe-default',pr:'v2.28.3x PRB-159 iOS audio format',why:'Without the default capability probe every SFX tried Ogg first on WebKit, racing the SFX deadline; prefer playable AAC',
   check(c={}){const src=(c.audioSrc??read('ui/audio.js')).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,''),out=[];
     if(!/document\.createElement\(['"]audio['"]\)/.test(src)||!/root\.PR_AUDIO\s*=\s*new AudioManager\(root\.DATA\.audio,\s*probe\s*\?\s*\{probe\}\s*:\s*\{\}\)/.test(src))out.push('ui/audio.js: default construction must pass a real audio probe');
     if(!/this\.format\s*=\s*aac\s*\?\s*['"]m4a['"]\s*:\s*['"]ogg['"]/.test(src))out.push('ui/audio.js: prefer AAC whenever the AAC probe is truthy');
     return out;}},
  {id:'narrator-holds-until-tap',pr:'v2.28.3x PRB-158 narrator hold',why:'Robert\'s playtest: "the Fabricator box doesn\'t stay long enough. Keep it until I want to continue." Base cutscenes/cards must never auto-advance, and a tap in the first second must be ignored so a settling animation cannot be skipped by accident',
   check(c={}){const cutscene=c.cutsceneSrc??read('ui/bit-cutscene.js'),card=c.cardSrc??read('ui/bit-card.js'),out=[];
     if(/\bDURATION\b/.test(cutscene))out.push('ui/bit-cutscene.js: no auto-end timer (DURATION) may exist -- the cutscene must hold until tapped');
     if(!/run\.locked\s*=\s*true/.test(cutscene)||!/current\s*&&\s*current\.locked/.test(cutscene))out.push('ui/bit-cutscene.js: taps in the first second must be ignored (run.locked, checked before dismissing)');
     if(!/if\(raid\)\{/.test(card))out.push('ui/bit-card.js: present() must branch base vs raid -- the raid card alone keeps a timed auto-dismiss (mid-combat, non-blocking)');
     if(!/locked\s*:\s*true/.test(card)||!/current\s*&&\s*current\.locked/.test(card))out.push('ui/bit-card.js: base cards must ignore a tap in the first second too (current.locked)');
     return out;}},

  {id:'splash-no-autoadvance-before-coldopen',pr:'v2.28.3x PRB-161 splash gesture gate',why:'Robert\'s iPhone, v2.28.39: "I see no version number. But now the VO played after I\'d been clicking on the screen for a while." The splash auto-advanced to the cold open with no tap at all (Low quality/no WebGL2/a failed flight), so unlockSync() never ran and \'youre-back\' only played on whatever later gesture happened to unlock audio -- a first launch (the cold open coming next) must wait on the tap instead',
   check(c={}){const out=[],app=c.appSrc??read('app.js');
     const setup=(app.match(/function setupSplash\([^)]*\)\{[\s\S]*?\n\}\n/)||[''])[0];
     if(!setup){out.push('app.js: function setupSplash(...) not found');return out;}
     if(!/const coldOpenNext\s*=\s*!S\.introSeen\s*&&\s*!ftueDirect;/.test(setup))out.push('app.js: setupSplash must compute coldOpenNext = !S.introSeen && !ftueDirect');
     const readyFn=(setup.match(/const ready = \(\) => \{[\s\S]*?\n  \};/)||[''])[0];
     if(!readyFn)out.push('app.js: setupSplash\'s ready() not found');
     else if(!/else if\(!flightActive\s*&&\s*!coldOpenNext\)\s*autoTimer\s*=\s*setTimeout\(begin,\s*1400\)/.test(readyFn))out.push('app.js: ready() must not arm the gesture-free autoTimer when coldOpenNext is true (no setTimeout(begin...) path when the cold open is next)');
     if(!/flightFailed\(\)\{[\s\S]*?else if\(!coldOpenNext\)\s*autoTimer\s*=\s*setTimeout\(begin,\s*1400\)/.test(setup))out.push('app.js: flightFailed() must not fall back to the gesture-free autoTimer when coldOpenNext is true');
     return out;}},

  {id:'version-label-visible-on-start',pr:'v2.28.3x PRB-161 on-device diagnostics',why:'Robert\'s iPhone, v2.28.39: "I see no version number" -- #app-version (triple-tap opens the hidden audio debug overlay, ui/audio-debug.js) was hidden by CSS during the splash and the cold open, exactly when Robert needed to screenshot it',
   check(c={}){const out=[],html=c.indexHtml??read('index.html');
     const splashRule=(html.match(/body\.splash-active #tabs,body\.splash-active #bitdock[^{]*\{opacity:0;\}/)||[''])[0];
     if(!splashRule)out.push('index.html: the body.splash-active opacity:0 rule for #tabs/#bitdock/.mapspot was not found in its expected form');
     else if(/#app-version/.test(splashRule))out.push('index.html: #app-version must not be in the body.splash-active opacity:0 list (it must stay visible for on-device diagnostics)');
     const topbarChildRule=(html.match(/body\.splash-active #topbar>#navback[^{]*\{opacity:0;visibility:hidden;pointer-events:none;\}/)||[''])[0];
     if(!topbarChildRule)out.push('index.html: #topbar must stay rendered during splash-active -- its OTHER children (navback/.title/#currencies/#menubtn) should be hidden individually instead, since display/opacity on #topbar itself would also hide the nested #app-version');
     if(/body\.splash-active #topbar,body\.splash-active #tabs[^{]*\{opacity:0/.test(html))out.push('index.html: #topbar must not be hidden (opacity:0) during body.splash-active -- that also hides #app-version, which lives inside it');
     if(!/body\[data-screen=intro\] #topbar>#navback,\s*body\[data-screen=intro\] #topbar>\.title,\s*body\[data-screen=intro\] #topbar>#currencies,\s*body\[data-screen=intro\] #topbar>#menubtn,\s*body\[data-screen=intro\] #tabs,\s*body\[data-screen=intro\] #bitdock\{display:none!important;\}/.test(html))
       out.push('index.html: body[data-screen=intro] must hide #topbar\'s OTHER children individually (#navback/.title/#currencies/#menubtn), not #topbar itself -- #topbar must stay rendered or the nested #app-version is hidden too');
     if(/body\[data-screen=intro\] #topbar, body\[data-screen=intro\] #tabs[^{]*\{display:none/.test(html))out.push('index.html: #topbar must not be hidden (display:none) during body[data-screen=intro] -- that also hides #app-version, which lives inside it');
     if(!/body\.splash-active #topbar,body\[data-screen=intro\] #topbar\{z-index:94;\}/.test(html))out.push('index.html: #topbar needs a raised z-index during splash-active/intro, or #app-version (position:static inside #topbar) stays visually covered by #splash/.intro even though it is no longer hidden');
     // PRB-161 CI layout fix: the raised #topbar must not let its hidden siblings (or the label itself) cover splash controls (#splash-profiles-btn/#splash-settings-btn).
     if(!/body\.splash-active #topbar,body\[data-screen=intro\] #topbar\{pointer-events:none;\}/.test(html))out.push('index.html: #topbar must be pointer-events:none during splash-active/intro so its hidden children never cover splash buttons');
     if(!/body\.splash-active #topbar>#app-version,body\[data-screen=intro\] #topbar>#app-version\{position:fixed!important;inset:auto [^}]*\}/.test(html))out.push('index.html: #app-version must be pinned bottom-right (position:fixed) during splash-active/intro so it never covers the splash corner buttons');
     return out;}},

  {id:'debug-sandbox-isolated',pr:'v2.28.42 debug unlocks (ChatGPT patch review)',why:'The Dev Panel\'s Unlock All Worlds / Unlock Everything run in a separate storage namespace (ui/debug-sandbox.js) so a debug session can never write Robert\'s normal save, slots or a pending raid result. That only holds if the sandbox patches Storage before any other script runs on BOTH pages, seeding only ever writes a prefixed key, and devUnlock persists pending normal progress before it stops saving. Its browser smoke first shipped red: it read level.area (unset for bunker levels) and waited for a #return-base click although an extract hands off automatically -- and it must stay wired into required CI (layout/base)',
   check(c={}){const out=[],app=c.appSrc??read('app.js'),sb=c.sandboxSrc??read('ui/debug-sandbox.js'),smoke=c.smokeSrc??read('scripts/debug-unlocks-smoke.mjs'),layout=c.layoutSrc??read('scripts/layout-check.mjs');
     const pages={'index.html':c.indexSrc??read('index.html'),'nodspel/index.html':c.raidHtmlSrc??read('nodspel/index.html')};
     for(const [name,html] of Object.entries(pages)){const first=(html.match(/<script\b[^>]*>/)||[''])[0];if(!/src="(\.\.\/)?ui\/debug-sandbox\.js/.test(first))out.push(name+': ui/debug-sandbox.js must be the FIRST <script> -- anything earlier could read or write storage outside the debug namespace');}
     for(const m of ['getItem','setItem','removeItem','key','clear'])if(!new RegExp('proto\\.'+m+' = function').test(sb))out.push('ui/debug-sandbox.js: Storage.prototype.'+m+' must be namespaced in debug mode');
     const seedFn=(sb.match(/function seed\([\s\S]*?\n  \}/)||[''])[0];
     if(!seedFn)out.push('ui/debug-sandbox.js: seed() not found in its expected form');
     else{const writes=seedFn.match(/native\.setItem\.call\([^;]*\)/g)||[];if(!writes.length||writes.some(w=>!/,\s*prefix \+ /.test(w)))out.push('ui/debug-sandbox.js: seed() may only write prefixed debug keys, never the normal save');}
     const unlockFn=(app.match(/devUnlock\(mode\)\{[\s\S]*?\n  \},/)||[''])[0];
     if(!unlockFn)out.push('app.js: A.devUnlock not found in its expected form');
     else{const si=unlockFn.indexOf('if(!debugMode()) save();'),ri=unlockFn.indexOf('resetting = true;');if(si<0||ri<0||si>ri)out.push('app.js: devUnlock must save() pending normal progress before setting resetting = true');}
     if(/level\.area\)\s*,\s*area\)/.test(smoke)||!smoke.includes("level.area??'bunker'"))out.push("scripts/debug-unlocks-smoke.mjs: compare level.area??'bunker' -- bunker levels carry no area field");
     if(!/Promise\.race\(\[handoff,button\]\)/.test(smoke))out.push('scripts/debug-unlocks-smoke.mjs: an extract returns to base automatically (handoffRaidResult); accept that handoff, with #return-base only as the fallback');
     if(!/group\('base'\)[^\n]*\n[^\n]*debug-unlocks-smoke\.mjs/.test(layout))out.push('scripts/layout-check.mjs: the base group must run scripts/debug-unlocks-smoke.mjs so the smoke stays in required CI');
     return out;}},
  {id:'coldopen-gesture-gate-after-raid-return',pr:'v2.28.3x PRB-161 follow-up (raid-return gesture gate)',why:'setupSplash\'s returningFromRaid branch skips the splash -- and its PR_AUDIO.preload() call -- outright, so a raid return (e.g. after the FTUE raid) renders SCREENS.intro on a brand-new document with no gesture behind it at all; reusing the 1.5s vo-wait cap there would silently start line 1 with no VO on every such return. A tap must also never be mistaken for a cold-open skip, including iOS\'s touchend-then-a-separate-synthesized-click: onGestureTap used to only clear the .vo-wait-tap class, so by the time the later click reached A.introSkip there was nothing left for it to check',
   check(c={}){const out=[],app=c.appSrc??read('app.js');
     const gateFn=(app.match(/const armVoiceGate = \(\) => \{[\s\S]*?\n    \};/)||[''])[0];
     if(!gateFn){out.push('app.js: SCREENS.intro\'s armVoiceGate() was not found in its expected form');return out;}
     if(!/audio\.init\?\.\(\);/.test(gateFn))out.push('app.js: armVoiceGate() must call audio.init?.() before reading audio.context -- a raid return never ran preload(), so context would otherwise still be null');
     if(!/const running = audio\.context\?\.state === "running";/.test(gateFn))out.push('app.js: armVoiceGate() must check whether the AudioContext is already running before gating on a tap');
     if(!/if\(running \|\| audio\.unlockPromise \|\| muted\)\{ waitForVoice\(\); return; \}/.test(gateFn))out.push('app.js: armVoiceGate() must skip the gesture prompt when already running, an unlock is in flight, or audio is muted');
     if(!/intro\.classList\.add\("vo-wait-tap"\);/.test(gateFn))out.push('app.js: armVoiceGate() must show the "TAP TO WAKE BIT" gate (.vo-wait-tap) when none of the above hold');
     if(!/intro\.dataset\.gateTapAt = String\(Date\.now\(\)\);/.test(gateFn))out.push('app.js: onGestureTap must stamp intro.dataset.gateTapAt the instant it fires -- introSkip needs this once the class itself is gone (see below)');
     const skipFn=(app.match(/introSkip\(ev\)\{[\s\S]*?\n  \},/)||[''])[0];
     if(!skipFn){out.push('app.js: window.A.introSkip was not found in its expected form');return out;}
     const hasSkipGuard=skipFn.includes('if(el && (el.classList.contains("vo-wait-tap") || withinGateTapGuard)){ if(ev) ev.stopPropagation(); return; }');
     if(!hasSkipGuard)out.push('app.js: A.introSkip\'s final skip guard must ignore a click while .vo-wait-tap is still present OR within the gateTapAt guard window -- iOS fires touchend then a SEPARATE synthesized click, by which point onGestureTap has already removed .vo-wait-tap, so the class check alone is not enough');
     if(!/const withinGateTapGuard = !!gateTapAt && \(Date\.now\(\) - gateTapAt\) < GATE_TAP_SKIP_GUARD_MS;/.test(skipFn))out.push('app.js: A.introSkip must compute withinGateTapGuard from dataset.gateTapAt against a time window (GATE_TAP_SKIP_GUARD_MS)');
     return out;}},


  {id:'bit-introduces-systems-first',pr:'v2.28.4x bit-introduces-systems-first',why:"Robert's playtest 2026-11-16: the quest chip and the Vault both reached the player unexplained -- the design rule (docs/ftue-design.md, docs/bit-narrator.md) is BIT ALWAYS introduces a new system before it is shown or unlocked, so every gate below must stay wired: the quest chip's render path must check its intro-seen flag, and the Vault cutscene must be registered and actually gate the Vault becoming the goal/being built",
   check(c={}){const out=[];const app=c.appSrc??read('app.js');
     const tracked=(app.match(/function trackedGoalHtml\(\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!tracked)out.push('app.js: trackedGoalHtml() not found');
     else if(!/if\(!S\.bitCardsSeen\.quest_intro\) return "";/.test(tracked))out.push('app.js: trackedGoalHtml() must return "" until S.bitCardsSeen.quest_intro is true -- the tracked-quest chip must never render before BIT\'s quest intro has played');
     for(const id of ['raid_briefing','quest_intro','vault_intro']){
       if(!new RegExp('\\b'+id+'\\s*:\\s*\\{').test(app))out.push('app.js: BIT_CUTSCENES.'+id+' is not registered');
       if(!new RegExp('function maybeShow'+id.replace(/(^|_)([a-z])/g,(_,p,c)=>c.toUpperCase())+'\\(\\)\\{').test(app))out.push('app.js: maybeShow'+id+' trigger function not found in its expected form');
     }
     const vaultFn=(app.match(/function maybeShowVaultIntro\(\)\{[\s\S]*?\n\}/)||[''])[0];
     if(vaultFn && !/if\(S\.bitCardsSeen\.vault_intro\) return;/.test(vaultFn))out.push('app.js: maybeShowVaultIntro must gate on S.bitCardsSeen.vault_intro so it only ever plays once');
     if(vaultFn && !/progressionGoal\(\)/.test(vaultFn))out.push('app.js: maybeShowVaultIntro must check progressionGoal() so it plays the instant the Vault becomes the next goal, not only once already built');
     const queue=(app.match(/function queueSystemIntro\(beat, after\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!queue.includes('onDone:() =>') || !queue.includes('S.bitCardsSeen[beat.id] = false') || !queue.includes('pendingSystemIntros.has(beat.id)'))out.push('app.js: system intros must deduplicate pending scenes and persist completion on dismissal');
     for(const id of ['raid_briefing','quest_intro','vault_intro'])
       if(!app.includes('queueSystemIntro(BIT_CUTSCENES.'+id))out.push('app.js: '+id+' must use the completion-gated intro queue');
     if(!app.includes('if(modId === "storage" && !S.bitCardsSeen.vault_intro)'))out.push('app.js: Vault build must wait for its intro dismissal');
     const migrate=(app.match(/function migrateBitCardsSeen\(st\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!migrate)out.push('app.js: migrateBitCardsSeen(st) not found');
     else for(const id of ['raid_briefing','quest_intro','vault_intro'])
       if(!new RegExp('st\\.bitCardsSeen\\.'+id+'\\s*===\\s*undefined').test(migrate))out.push('app.js: migrateBitCardsSeen must back-fill st.bitCardsSeen.'+id+' for saves already past its live trigger');
     return out;}},
  {id:'vest-guarantee-existing-caches',pr:'v2.28.4x vest materials',why:'Missing vest materials must be actionable without exceeding the early-room crate cap or replacing a quest supply',
   check(c={}){const levels=c.levelsSrc??read('nodspel/levels.js'),game=c.gameSrc??read('nodspel/game.mjs'),app=c.appSrc??read('app.js');const out=[];
     const guarantee=(levels.match(/if\(GUARANTEE_LOOT\?\.length&&level\.number===1\)\{[\s\S]*?\n  \}/)||[''])[0];
     if(!guarantee.includes('b.quantity=need.count')||!guarantee.includes('b.contents??=[]')||!guarantee.includes('!b.quest')||guarantee.includes('lootBoxes.push'))out.push('nodspel/levels.js: vest guarantee must group units in existing non-quest caches');
     const css=c.cssSrc??read('index.html');
     if(!css.includes('.craftconfirm .sp-act{display:grid;grid-template-columns:1fr 1fr;'))out.push('index.html: craft confirmation actions must share a row so source hints fit landscape');
     if(!game.includes('setGuaranteeLoot(launch.vestGuarantee)'))out.push('nodspel/game.mjs: launch must apply or clear the vest guarantee');
     if(!app.includes('craftPartSource({ kind:"cur", id:"scrap" })'))out.push('app.js: missing Scrap needs the salvage cache source in the craft UI');
     if(!app.includes('vestGuarantee:vestGuaranteeNeed()'))out.push('app.js: launch must recompute missing recipe materials');
     return out;}},
  {id:'quest-chip-never-covers-rooms',pr:'v2.28.4x FTUE chip',why:'screen-space quest chips covered map labels and swallowed room taps',
   check(ctx={}){const app=ctx.appSrc??read('app.js'),layout=ctx.layoutSrc??read('scripts/layout-check.mjs');const out=[];
     if(!/function placeBaseGoal\(viewer\)/.test(app)||!app.includes('placeBaseGoal(viewer);')||!app.includes('.mapspot,.mapspot .tag'))out.push('base goal placement must avoid measured room hitboxes and labels after map layout');
     if(!layout.includes('questChipRoomOverlaps')||!layout.includes('chip-fabricator-locked')||!layout.includes('chip-guard-duty'))out.push('base layout must check chip/room intersections in both quest states');return out;}},
  {id:'early-raid-crate-cap',pr:'v2.28.4x FTUE crates',why:'one crate per supply unit and the bag payoff crowded early rooms',
   check(ctx={}){const goal=ctx.goalSrc??read('nodspel/progression-goal.js'),ftue=ctx.ftueSrc??read('nodspel/ftue.js'),data=ctx.dataSrc??read('data/raid-ftue.js');const out=[];
     if(!/maxCratesPerRoom\s*:\s*3/.test(data))out.push('early loot data must cap rooms at three crates');
     if(!goal.includes('quantity')||!goal.includes('level.lootBoxes.length<RULES.earlyLoot.maxCratesPerRoom')||goal.includes('level.lootBoxes.push({id:`payoff-'))out.push('intro and payoff must group supply units instead of adding excess crates');
     if(!ftue.includes('level.lootBoxes=RULES.earlyLoot.supplies.map'))out.push('FTUE must use the guaranteed grouped supply data');return out;}},
  {id:'no-post-pickup-chest-sprite',pr:'v2.28.4x loot feedback',why:'pixel reveal adapter spawned a treasure chest on top of the 3D pickup burst',
   check(ctx={}){const fx=ctx.fxSrc??read('nodspel/fx-feedback.js'),game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     if(/pixel\.spawn\(['"]chest['"]/.test(fx)||/demoNames\s*=.*['"]chest['"]/.test(fx))out.push('loot feedback must never spawn a pixel chest');
     if(!game.includes('world.spawnLootBurst?.(')||!game.includes('pickupToast(round.lastBagPickup.item)'))out.push('keep the 3D burst and textual pickup feedback');return out;}},

];

export function runAll(ctx){const res=[];for(const r of RULES){for(const msg of r.check(ctx))res.push({rule:r.id,pr:r.pr,msg});}return res;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const ctx={files:tracked(),gitignore:fs.existsSync(path.join(root,'.gitignore'))?read('.gitignore'):''};
  const res=runAll(ctx);for(const x of res)console.log(`[${x.rule} ${x.pr}] ${x.msg}`);
  console.log(`bug-lint: ${RULES.length} rule(s), ${res.length} violation(s)`);if(res.length)process.exit(1);
}
