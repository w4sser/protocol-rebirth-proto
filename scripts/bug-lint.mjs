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

  {id:'extract-loot-3d-vfx',pr:'v2.28.33 PRB-156 (feat/vfx-3d-extract-loot)',why:'Robert playtest 2026-11-15: "the extraction point effect looks damn 2D. Same when you\'ve picked up loot." The flat MeshBasicMaterial exitBeam cylinder + plain exitPad plane, and the generic ring+billboard world.burst() reused for pickups, read as 2D decals from the isometric camera',
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

  {id:'vfx-visible-pooled-lifecycle',pr:'v2.28.3x PRB-156 VFX lifecycle',why:'Subpixel Points were invisible with the orthographic camera, old sprites covered replacements, and quality/teardown missed the new pools',
   check(c={}){const out=[];
     const loot=c.lootVfxSrc??read('nodspel/vfx-loot-burst.js'),feedback=c.feedbackVfxSrc??read('nodspel/fx-feedback.js'),game=c.lifecycleGameSrc??read('nodspel/game.mjs');
     if(!/new THREE\.InstancedMesh\(/.test(loot))out.push('loot sparkles must use a fixed instanced pool');
     if(/hold\(record,'respawn'|pixel\.spawn\('collect'/.test(feedback))out.push('legacy extraction/collection sprites must stay removed');
     if(!/world\?\.setVfxQuality\(next\)/.test(game))out.push('live quality must reach world VFX');
     if(!/if\(round\.over\)world\?\.disposeVfx\(\)/.test(game))out.push('raid end must dispose world VFX');
     return out;}},


  {id:'vfx-phone-depth-layers',pr:'v2.28.3x PRB-156 pass 2',why:'Pass 1 still read flat at phone size: the extraction shell lacked a core/fence and pickup arcs disappeared behind the player',
   check(c={}){const out=[];
     const beam=c.phoneBeamSrc??read('nodspel/vfx-extract-beam.js'),loot=c.phoneLootSrc??read('nodspel/vfx-loot-burst.js');
     if(!/group\.add\(core\)/.test(beam)||!/group\.add\(fence\)/.test(beam))out.push('phone extraction must retain the inner core and raised floor fence');
     if(!/r\.pillar=new THREE\.Mesh\(/.test(loot)||!/r\.flash=new THREE\.Mesh\(/.test(loot))out.push('phone pickups must retain pooled origin pillars and arrival flashes');
     return out;}},

];

export function runAll(ctx){const res=[];for(const r of RULES){for(const msg of r.check(ctx))res.push({rule:r.id,pr:r.pr,msg});}return res;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const ctx={files:tracked(),gitignore:fs.existsSync(path.join(root,'.gitignore'))?read('.gitignore'):''};
  const res=runAll(ctx);for(const x of res)console.log(`[${x.rule} ${x.pr}] ${x.msg}`);
  console.log(`bug-lint: ${RULES.length} rule(s), ${res.length} violation(s)`);if(res.length)process.exit(1);
}
