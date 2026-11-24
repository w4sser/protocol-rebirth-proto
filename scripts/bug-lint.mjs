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

import {FTUE_CONTRACTS} from './ftue-one-path-contracts.mjs';
export const RULES=[
  {id:'selective-bloom-occlusion-and-combine',pr:'v2.28.4x graphics pilot (2.28.53)',why:'the WIP layer-only source lost wall occlusion, included fog and doubled sharp cue pixels',
   check(c={}){const s=c.postfxSrc??read('nodspel/postfx.js');return s.includes('bloomMask.render(')&&s.includes('scene.fog=null')&&s.includes('masked(m,false)')&&s.includes('finally{')&&s.includes('scene.background=background;scene.fog=fog;')&&s.includes('tBloom.value=bloom.renderTargetsHorizontal[0].texture')?[]:['bloom needs black occluders, fog-free source, state restoration and a blur-only combine'];}},
  {id:'drum-bloom-reads-with-boost',pr:'v2.28.5x graphics pilot review (2.28.53)',why:'the drum danger material emissive is a dark warning-maroon tuned for direct-view self-illumination; masked verbatim it barely bloomed next to the pad/extraction cues',
   check(c={}){const world=c.worldSrc??read('nodspel/world.js'),post=c.postfxSrc??read('nodspel/postfx.js');const out=[];
     if(!/tagBloom\(band,\{boost:3\}\)/.test(world)||!/tagBloom\(lid,\{boost:3\}\)/.test(world))out.push('nodspel/world.js: drum bands/lid must tag the bloom layer with a boost');
     if(!/boost=1/.test(post)||!/emissiveIntensity\*boost/.test(post))out.push('nodspel/postfx.js: tagBloom/masked must support a bloom-only emission boost');
     return out;}},
  {id:'postfx-pass-disposal-and-size',pr:'v2.28.4x graphics pilot (2.28.53)',why:'composer disposal alone leaked custom passes and initial bloom sizing disagreed with DPR-aware resize',
   check(c={}){const s=c.postfxSrc??read('nodspel/postfx.js');return s.includes('bloomComposer.setSize(bw,bh)')&&s.includes('for(const pass of composer.passes)pass.dispose()')&&s.includes('for(const pass of bloomComposer.passes)pass.dispose()')&&s.includes('bloomMask?.dispose()')&&s.includes('cache.delete(source)')?[]:['size bloom on creation and dispose both composers added passes and mask materials'];}},
  {id:'fabricator-marker-once',pr:'v2.28.55 (fix/fabricator-single-marker)',why:'after the Core restore the base showed the Fabricator twice at left (NEXT plate + "Fabricator L1" goal label); the FTUE goal label must be skipped while the NEXT plate marks that room',
   check(ctx){const src=ctx?.appSrc??read('app.js'),html=ctx?.html??read('index.html');const out=[];
     if(!/function ftueGoalMarkedOnMap\(/.test(src))out.push('app.js: ftueGoalMarkedOnMap() missing');
     if(!/markGoalOnMap\(trackedGoalHtml\(\)\s*\|\|\s*progressionGoalHtml\(\)/.test(src))out.push('app.js: SCREENS.base must pass the goal card through markGoalOnMap()');
     if(!/\.baseviewer\.ftue>\.progress-goal\.on-map-marked\{display:none/.test(html))out.push('index.html: .on-map-marked goal label must be hidden in the FTUE base');
     return out;}},
  {id:'base-bit-card-clears-rooms',pr:'v2.28.4x briefing placement',why:'BIT base cards obscured the Fabricator label and swallowed room hitboxes',
   check(c={}){const app=c.appSrc??read('app.js'),layout=c.layoutSrc??read('scripts/layout-check.mjs'),css=c.cardCssSrc??read('ui/bit-card.css');const out=[];
     if(!app.includes('if(typeof window !== "undefined") window.addEventListener?.("pr:ui-show"'))out.push('base card events must tolerate DOM-free logic/geometry test environments');
     if(!css.includes('.bit-card:not(.ctx-raid){max-width:240px;gap:6px;}'))out.push('narrow base cards must keep a compact footprint so the Vault briefing fits');
     if(!app.includes('function placeBaseBitCard()')||!app.includes('placeBaseBitCard();')||!app.includes('const goalSpot = freeSpots(')||!app.includes('.mapspot,.mapspot .tag,.gen-chip,.basemenu-btn'))out.push('BIT card placement must avoid room hitboxes, labels and the goal chip');
     if(!layout.includes('page.evaluate(baseBitCardRoomOverlaps)')||!layout.includes('await baseBriefingRun(vp)'))out.push('layout must measure both base briefings against rooms at all phone sizes');return out;}},
  {id:'base-briefing-single-cost',pr:'v2.28.4x briefing copy',why:'Briefing prose repeated material costs and the fuel-drum joke',
   check(c={}){const app=c.appSrc??read('app.js'),bit=c.bitSrc??read('data/bit.js'),out=[];
     if(!app.includes('text:beat.line, info:beat.info')||app.includes('text:beat.line +'))out.push('base briefings must render prose and info separately');
     const teasers=[...bit.matchAll(/teaser:\{([\s\S]*?)\n    \}/g)];
     if(teasers.length!==2||teasers.some(m=>!/info:\[\{label:"NEXT",kind:"cost"\}\]/.test(m[1])||/line:"[^"\n]*(?:barely breathing|don.t have legs|Cable|Scrap)/i.test(m[1])))out.push('each briefing needs one cost row and fresh powered-base prose');return out;}},
  {id:'core-restore-lights-base',pr:'v2.28.4x powered base',why:'Core restore still left the bunker at the dim pre-Fabricator lighting tier',
   check(c={}){const app=c.appSrc??read('app.js'),fn=(app.match(/function ruinLevel\([^)]*\)\{([\s\S]*?)\n\}/)||[])[1]||'';
     return fn.includes('return 1')&&fn.includes('core_found')&&!fn.includes('return 2')?[]:['Core restore must immediately use powered lighting, independent of Fabricator'];}},

  {id:'enemy-label-clearance-hold',pr:'v2.28.52 layout label stability',why:'Town enemy labels bypassed the clearance hold when colliding with loot/room labels',
   check(c={}){const src=c.gameSrc??read('nodspel/game.mjs');return /const blocked=[^;]*overlapsAt\(y,size,labelRects\)/.test(src)&&!src.includes('if(overlapsAt(y,size,labelRects)){l.el.hidden=true;continue;}')?[]:['all label collisions must use the existing clearance hold'];}},
  {id:'worldmap-new-label-gap',pr:'v2.28.52 map label fit',why:'the selected Bunker label overlapped the newly unlocked Archipelago label at 844x390',
   check(c={}){const html=c.htmlSrc??read('index.html');return /\.worldmap \.wm-label\.on\[data-label="bunker"\]\{top:calc\(50% \+ 48px\)/.test(html)?[]:['compact Bunker label must leave room above the Archipelago label'];}},
  ...FTUE_CONTRACTS.map(([id,why,key,pattern]) => ({id:'ftue-'+id, pr:'v2.28.52 one clear path', why,
    check(c={}){return pattern.test(c[key] ?? read(key === 'gameSrc' ? 'nodspel/game.mjs' : key === 'audioSrc' ? 'nodspel/audio.js' : 'app.js')) ? [] : [why];}})),
  {id:'raid-waits-for-combat-sfx',pr:'v2.28.4x raid audio readiness',why:'the first fight raced unawaited combat buffer decoding',
   check(c={}){const game=c.gameSrc??read('nodspel/game.mjs'),audio=c.raidAudioSrc??read('nodspel/audio.js'),ready=c.readySrc??read('nodspel/audio-ready.js');const out=[];
     const wait=game.indexOf('await waitForRaidAudio();'),start=game.indexOf("reset(new URLSearchParams(location.search).get('seed'));camera");
     if(wait<0||start<wait||!game.includes('event.stopImmediatePropagation()'))out.push('raid must block input and wait for combat decoding before initial reset');
     if(!audio.includes('prepareCombatAudio(audio)')||!audio.includes('audio.sfxWaitMs=config.raidSfxWaitMs')||!ready.includes('Promise.race([ready,')||!ready.includes('while(!audio.decodedFiles.has(file))'))out.push('combat readiness needs a cap, continuing retries and a bounded pending SFX queue');return out;}},
  {id:'coldopen-bit-hibernates-until-wake',pr:'v2.28.4x BIT hibernation',why:'BIT must sleep while the cold-open waits for its wake gesture',
   check(c={}){const app=c.appSrc??read('app.js'),html=c.htmlSrc??read('index.html');const out=[];
     if(!app.includes('classList.add("bit-hibernating")')||!app.includes('classList.remove("vo-wait-tap", "bit-hibernating")')||!app.includes('await wakeFinished'))out.push('cold-open must hibernate until tapped and await its wake before line 1');
     if(!app.includes('if(reducedMotion || firstLineStarted) greet();'))out.push('an animationstart during the wake must not swallow the greeting VO');if(!app.includes('intro-zzz')||!html.includes('.intro.bit-hibernating .intro-zzz b{animation:introZzz'))out.push('sleeping BIT needs the drifting z indicator');if(!html.includes('.intro.bit-hibernating .intro-bit')||!html.includes('introWakeFade .55s'))out.push('sleep needs a dim cutout and reduced-motion fade');return out;}},
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
     if(!/requestVoice\(['"]youre-back['"]\)/.test(intro)||!/addEventListener\("animationstart", (?:greet|\(\) => \{ firstLineStarted = true; greet\(\);)/.test(intro))out.push('app.js: intro must request youre-back with the first line reveal');
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
     if(!app.includes('queueSystemIntro(BIT_CUTSCENES.quest_intro') || !/(?:queueSystemIntro|queueBaseIntro)\(roomUnlockStages\("fabricator"\)\.teaser/.test(app) || !/(?:queueSystemIntro|queueBaseIntro)\(roomUnlockStages\("storage"\)\.teaser/.test(app))out.push('app.js: system teasers must use the completion-gated intro queue');
     const migrate=(app.match(/function migrateBitCardsSeen\(st\)\{[\s\S]*?\n\}/)||[''])[0];
     if(!migrate)out.push('app.js: migrateBitCardsSeen(st) not found');
     else for(const id of ['raid_briefing','quest_intro','vault_intro'])
       if(!new RegExp('st\\.bitCardsSeen\\.'+id+'\\s*===\\s*undefined').test(migrate))out.push('app.js: migrateBitCardsSeen must back-fill st.bitCardsSeen.'+id+' for saves already past its live trigger');
     return out;}},
  {id:'new-find-highlights-goal',pr:'v2.28.4x new find clarity',why:'New finds need one BIT explanation and a compact current-use priority',
   check(c={}){const app=c.appSrc??read('app.js'),out=[];
     const popup=(app.match(/function maybeShowItemInfo\(\)\{[\s\S]*?\n\}/)||[''])[0];
     for(const token of ['!S.bitCardsSeen.new_find','S.bitCardsSeen.new_find = true','newfind-bit','newFindUsesHtml(id)','PRBitCutscene?.isOpen()']) if(!popup.includes(token))out.push('NEW FIND missing '+token);
     const rank=(app.match(/function newFindUses\(id\)\{[\s\S]*?\n\}/)||[''])[0];
     for(const token of ['progressionGoal()','trackedQuest()','u.module === goal.module','u.level === goal.level','canAfford']) if(!rank.includes(token))out.push('NEW FIND priority missing '+token);
     if(!app.includes('<details><summary>+') || !app.includes('more uses</summary>'))out.push('NEW FIND must collapse other uses');
     if(!app.includes('Object.keys(st.seenItems || {})'))out.push('old finds must migrate the explanation flag');
     return out;}},
  {id:'room-unlock-two-stage',pr:'v2.28.4x room unlock stages',why:'Room teasers must stay dark and builds must show their powered payoff without an intro gate',
   check(c={}){const app=c.appSrc??read('app.js'),data=c.bitSrc??read('data/bit.js'),out=[];
     for(const id of ['fabricator','storage']) if(!data.includes(id+':{') || !app.includes('roomUnlockStages("'+id+'").teaser') || !app.includes('roomUnlockStages("'+id+'").unlock'))out.push(id+': both room stages must use roomUnlockStages');
     for(const id of ['raid_briefing','fabricator_built','vault_intro','vault_unlocked']) if(!data.includes('id:"'+id+'"'))out.push(id+': missing stage data');
     if(!app.includes('to:powered ? def.powered : def.dark'))out.push('teasers must use dark art only');
     const build=(app.match(/  build\(modId\)\{[\s\S]*?\n  sell\(/)||[''])[0];
     if(/if\(modId === "storage" && !S\.bitCardsSeen\.vault_intro\)/.test(build))out.push('Vault build must not be gated by an intro');
     if(!app.includes('st.bitCardsSeen.vault_unlocked = true'))out.push('built saves must migrate both stages');
     return out;}},
  {id:'vest-guarantee-existing-caches',pr:'v2.28.4x vest materials',why:'Missing vest materials must be actionable without exceeding the early-room crate cap or replacing a quest supply',
   check(c={}){const levels=c.levelsSrc??read('nodspel/levels.js'),game=c.gameSrc??read('nodspel/game.mjs'),app=c.appSrc??read('app.js');const out=[];
     const guarantee=(levels.match(/if\(GUARANTEE_LOOT\?\.length&&level\.number===1\)\{[\s\S]*?\n  \}/)||[''])[0];
     if(!guarantee.includes('b.quantity=need.count')||!guarantee.includes('b.contents??=[]')||!guarantee.includes('!b.quest')||!guarantee.includes('claimed.has(b)')||guarantee.includes('lootBoxes.push'))out.push('nodspel/levels.js: vest guarantee must group units in existing non-quest caches');
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
  {id:'fuel-drums-chain-and-cap',pr:'v2.28.48 fuel drums',why:'ordinary Bunker raids place seeded fuel drums (nodspel/levels.js placeFuelDrums) alongside the FTUE\'s single hand-authored one (nodspel/ftue.js); losing the shared per-room cap, the scripted-encounter exclusion, the FTUE player-safe pin, or the shared chain-ignite path would silently overload a room, hurt the player in the FTUE, or stop a blast from chaining into the next drum',
   check(ctx={}){const levels=ctx.levelsSrc??read('nodspel/levels.js'),ftue=ctx.ftueSrc??read('nodspel/ftue.js'),round=ctx.roundSrc??read('nodspel/round.js');const out=[];
     if(!levels.includes('interactives:{maxPerRoom:'))out.push('RULES.interactives.maxPerRoom must stay the shared per-room interactive cap');
     if(!levels.includes('Math.min(1+(rng()<.5?1:0),cap)'))out.push('placeFuelDrums must clamp the drums it places per room to the shared cap');
     if(!levels.includes("e.encounter&&e.encounter!=='patrol'"))out.push('placeFuelDrums must skip any room already running a precision scripted encounter (guard/turret/swarm/shield/door/grenadier)');
     if(!levels.includes("if(area==='bunker')placeFuelDrums("))out.push('fuel drums must stay Bunker-only');
     if(!ftue.includes('playerSafe:true'))out.push('the FTUE drum must be pinned playerSafe so its scripted takedown never hurts the player');
     if(!round.includes('if(!drum.playerSafe&&player)'))out.push('detonateDrum must skip the player-damage branch for a playerSafe (FTUE) drum');
     if(!round.includes('export function igniteDrums(')||!round.includes('igniteDrums(round,drum.x,drum.z,drum.chainRadius,now)'))out.push('a drum detonating must call igniteDrums so a chain can propagate to the next one');
     return out;}},
  {id:'live-pads-junction',pr:'v2.28.49 live power pads',why:'live pads damage enemies, junction shots use the normal weapon path, day-2 pairs reserve both shared room slots and BIT first sight returns through the profile ledger',
   check(ctx={}){const levels=ctx.levelsSrc??read('nodspel/levels.js'),combat=ctx.combatSrc??read('nodspel/combat.js'),round=ctx.roundSrc??read('nodspel/round.js'),weapon=ctx.weaponSrc??read('nodspel/weapon.js'),game=ctx.gameSrc??read('nodspel/game.mjs'),intro=ctx.padIntroSrc??read('nodspel/pad-intro.js');const out=[];
     if(!levels.includes("completedRaids<J.unlockRaids")||!levels.includes("(level.area??'bunker')!=='bunker'")||!levels.includes('if(ftue||'))out.push('power pairs must be day-2 Bunker-only and excluded from FTUE');
     if(!levels.includes('RULES.interactives.maxPerRoom<2')||!levels.includes('cap-occupied')||!levels.includes('level.barrels=(level.barrels??[]).filter'))out.push('power pairs must reserve both shared per-room interactive slots');
     if(!combat.includes('RULES.junction.enemyDps*dt')||!combat.includes('hitEnemy(round,enemy.id,now,dmg,null)'))out.push('live pads must damage enemies through normal hit bookkeeping');
     if(!round.includes('pad.deadUntil=pad.overloadUntil+J.cooldownMs')||!round.includes('J.overloadRadius')||!round.includes('J.overloadDamage'))out.push('junction overload must deal radial damage and then cool down');
     if(!weapon.includes("hit?.kind==='junction'")||!weapon.includes('shootJunction(round,hit.target.id,now)')||!weapon.includes('for(const t of level.junctions??[])'))out.push('normal projectiles must target and activate junctions');
     if(!game.includes("push('power_pad_intro')")||!game.includes('powerPadBitLine(round,position,padIntroSeenAtLaunch,solids,clock)')||!intro.includes("Water plus power. Nature's little I-told-you-so."))out.push('first-sight power-pad BIT card must keep its line and persist through bitSeen');
     return out;}},
  {id:'collapsing-shelf-lane',pr:'v2.28.50 collapsing shelves',why:'shootable shelves retain their fourth-raid gate, safe L2 lanes, delayed impact, movement-only cover and persistent calm BIT intro',
   check(ctx={}){const levels=ctx.levelsSrc??read('nodspel/levels.js'),round=ctx.roundSrc??read('nodspel/round.js'),weapon=ctx.weaponSrc??read('nodspel/weapon.js'),physics=ctx.physicsSrc??read('nodspel/physics.mjs'),game=ctx.gameSrc??read('nodspel/game.mjs'),intro=ctx.shelfIntroSrc??read('nodspel/shelf-intro.js'),data=ctx.shelfDataSrc??read('data/raid-shelf.js');const out=[];
     if(!data.includes('unlockRaids:3')||!levels.includes('completedRaids<S.unlockRaids')||!levels.includes('level.number!==2')||!levels.includes('if(ftue||completedRaids<S.unlockRaids'))out.push('shelves must be fourth-raid L2 Bunker toys, excluded from FTUE');
     if(!levels.includes('occupied>=cap')||!levels.includes('!shelfPathsConnected(level,f)')||!levels.includes('level.shelves.push(shelf)')||!levels.includes('if(!routeClear)continue')||!levels.includes('active:true,aggro:false,windupMs:P.windupMs'))out.push('shelf placement must respect shared slots and prove final-footprint connectivity');
     if(!weapon.includes("hit?.kind==='shelf'")||!weapon.includes('shootShelf(round,hit.target.id,now)')||!weapon.includes('for(const t of level.shelves??[])'))out.push('conventional projectiles must target and tip shelves');
     if(!round.includes('RULES.shelf.telegraphMs+RULES.shelf.fallMs')||!round.includes('RULES.shelf.damage')||!round.includes('RULES.shelf.stunMs')||!round.includes('RULES.shelf.playerDamage'))out.push('collapse must delay impact and use tuned enemy stun/damage and player damage');
     if(!physics.includes('if(box.movementOnly)return Infinity')||!physics.includes('previous>0&&Math.hypot(x-b.x,z-b.z)>Math.hypot(p.x-b.x,p.z-b.z)')||!game.includes('(round.level.shelves??[]).map(s=>s.collider)'))out.push('fallen shelves must block movement but allow shots and LOS');
     if(!game.includes("push('shelf_intro')")||!game.includes('shelfBitLine(round,position,shelfIntroSeenAtLaunch,solids)')||!intro.includes('Gravity: still free, still rude.')||!intro.includes('e.health>0&&e.aggro'))out.push('shelf BIT first sight must stay calm, exact and profile-persisted');
     return out;}},
  {id:'depth-raid-area-clear-choice',pr:'v2.28.58 depth-raid-clear-choice',why:"Carlos's paper / Robert 21 Nov 2026: a Depth Raid area completes when its enemies are cleared (not when the timer hits 0), then a paused EXTRACT vs GO DEEPER choice; GO DEEPER unlocks a door in the same stitched level (no generateLevel/loadLevel teleport, no refuse horde); extract stays closed mid-area; area-clock timeout is a loss; the global 8-minute clock never fails a depth raid",
   check(ctx={}){const round=ctx.roundSrc??read('nodspel/round.js'),depth=ctx.depthRaidSrc??read('nodspel/depth-raid.js'),stakes=ctx.stakesSrc??read('nodspel/stakes.js'),game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     if(!round.includes('if(round.depth)return !!round.depth.extractOpen;'))out.push('nodspel/round.js: exitIsOpen must gate depth-mode extract on extractOpen (the EXTRACT choice), never on the node gate or a timer window');
     if(!round.includes('if(round.remainingMs===0&&!round.depth)'))out.push('nodspel/round.js: tickRound must not let the global 8-minute clock fail a depth raid');
     if(!round.includes('export function extractDepthZone('))out.push('nodspel/round.js: extractDepthZone() (the walk-in+countdown success path) is missing');
     if(!round.includes('export function timeoutRound('))out.push('nodspel/round.js: timeoutRound() (area-clock death) is missing');
     if(!depth.includes('export function areaIsCleared(')||!depth.includes('openChoice('))out.push('nodspel/depth-raid.js: area clear must open the EXTRACT / GO DEEPER choice via areaIsCleared/openChoice');
     if(depth.includes('d.window=true'))out.push('nodspel/depth-raid.js: the 15s timer-window path must stay removed -- a timeout is a loss, not a beam');
     const goDeeperFn=(depth.match(/export function goDeeper\([^)]*\)\{[\s\S]*?\n\}/)||[''])[0];
     if(goDeeperFn.includes('generateLevel')||goDeeperFn.includes('spawnRefuseHorde')||goDeeperFn.includes('loadLevel'))out.push('nodspel/depth-raid.js: goDeeper must unlock a door in the same level -- no generateLevel, loadLevel, or refuse horde');
     if(!goDeeperFn.includes('d.zone>=3')||!goDeeperFn.includes("d.phase!=='choice'"))out.push('nodspel/depth-raid.js: goDeeper must require an open choice and reject it on zone 3');
     if(!stakes.includes('round.ftue || round.depth'))out.push('nodspel/stakes.js: stepStakes must skip the global hunter-wave clock in depth mode');
     if(!/if\(round\.depth\)\{\s*const dres=stepDepthRaid\(round,clock,position\);[\s\S]*?\}else\{\s*const result=enterExit\(round,position,clock\);/.test(game))out.push('nodspel/game.mjs: the node-gated enterExit/checkpoint path must never run for a depth round -- stepDepthRaid and enterExit must stay mutually exclusive on round.depth');
     if(game.includes("const res=goDeeper(round,clock,position,target)")&&game.includes('loadLevel();depthHudRevealed'))out.push('nodspel/game.mjs: GO DEEPER must not rebuild the world with loadLevel()');
     return out;}},
  {id:'depth-choice-touch',pr:'v2.28.59 depth-choice-touch',why:"Robert 21 Nov 2026: EXTRACT / GO DEEPER must work with real phone taps, not just harness/__NR clicks. The paused-input capture gate must allow #depth-choice (and the BIT intro card). The buttons use bindHUDTap so pointerup activates them without a synthesized click. The popup backdrop must not cover the tiles or swallow pointers. The old in-HUD #go-deeper chip must stay gone.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs'),css=ctx.cssSrc??read('nodspel/style.css'),html=ctx.htmlSrc??read('nodspel/index.html');const out=[];
     if(!game.includes("bindHUDTap($('#depth-extract'),onDepthExtract)")||!game.includes("bindHUDTap($('#depth-go-deeper'),onDepthGoDeeper)"))out.push('nodspel/game.mjs: EXTRACT / GO DEEPER must use bindHUDTap so a phone pointerup activates them without a synthesized click');
     if(!game.includes("e.target.closest?.('#depth-choice,.bit-card')"))out.push('nodspel/game.mjs: the paused-input capture gate must treat #depth-choice and .bit-card as owned, otherwise it swallows taps while the choice is paused');
     const covered=(game.match(/const covered=\[\.\.\.document\.querySelectorAll\('([^']*)'\)\]/)||[])[1]??'';
     if(!covered.includes('#depth-choice')||!game.includes(".pop-backdrop,.stick,#depth-choice"))out.push('nodspel/game.mjs: stick routing must treat #depth-choice as covered UI so playfield aims cannot steal the tap');
     if(!css.includes('.depth-choice .pop-backdrop{z-index:0;pointer-events:none}')||!css.includes('.depth-choice-frame{position:relative;z-index:1'))out.push('nodspel/style.css: the depth-choice backdrop must sit behind the card and ignore pointer events so it cannot cover EXTRACT / GO DEEPER');
     if(html.includes('id="go-deeper"'))out.push('nodspel/index.html: the stale v2.28.57 #go-deeper HUD chip must stay removed');
     return out;}},
  {id:'depth-raid-retag-refs',pr:'v2.28.60 raid-start-crash',why:"Robert 21 Nov 2026: a progressed Depth Raid (2+ completed raids) crashed on entry. retagPart prefixed hazard/junction/enemy ids but left padId/junctionId/patrolId/guardId/enemyId pointing at the old ids, so buildWorld read pad.x of undefined and the fatal overlay covered Start.",
   check(ctx={}){const depth=ctx.depthLevelSrc??read('nodspel/depth-level.js'),world=ctx.worldSrc??read('nodspel/world.js');const out=[];
     if(!depth.includes('if(o&&o.padId!=null)o.padId=`${prefix}-${o.padId}`')||!depth.includes('if(o&&o.junctionId!=null)o.junctionId=`${prefix}-${o.junctionId}`')||!depth.includes('if(o&&o.patrolId!=null)o.patrolId=`${prefix}-${o.patrolId}`')||!depth.includes('if(o&&o.guardId!=null)o.guardId=`${prefix}-${o.guardId}`')||!depth.includes('if(o&&o.enemyId!=null)o.enemyId=`${prefix}-${o.enemyId}`'))out.push('nodspel/depth-level.js: retagPart must prefix padId, junctionId, patrolId, guardId and enemyId when it prefixes ids');
     if(!world.includes('const pad=level.hazards.find(h=>h.id===j.padId);if(!pad)return null;')||!world.includes('}).filter(Boolean);'))out.push('nodspel/world.js: buildWorld must skip a junction whose pad is missing so a broken ref cannot kill raid entry');
     return out;}},
  {id:'depth-final-extract-signpost',pr:'v2.28.61 depth-final-area',why:"Robert 21 Nov 2026: could not find the exit in the last Depth Raid area, and the mode was too easy. generateDepthLevel used to set level.exit (and therefore the only 3D hatch/beam) to the area-1 pad, while chooseExtract remapped gameplay to depthExits[zone-1]. Area 3 had no visible hatch. Areas 2 and 3 also needed a modest difficulty ramp.",
   check(ctx={}){const depth=ctx.depthLevelSrc??read('nodspel/depth-level.js'),raid=ctx.depthRaidSrc??read('nodspel/depth-raid.js'),world=ctx.worldSrc??read('nodspel/world.js'),game=ctx.gameSrc??read('nodspel/game.mjs'),data=ctx.raidDepthSrc??read('data/raid-depth.js'),html=ctx.htmlSrc??read('nodspel/index.html');const out=[];
     if(!depth.includes('level.extracts=depthExits.map(')||!depth.includes('applyDepthAreaScale(parts[i],i+1)'))out.push('nodspel/depth-level.js: must publish one extract per area and apply the area 2/3 difficulty ramp');
     if(!raid.includes('const exit=round.level.depthExits?.[zone-1]'))out.push('nodspel/depth-raid.js: chooseExtract must aim the beam at the current area hatch');
     if(!world.includes('depthExtractOpen')||!world.includes('hatchPoints=level.depth&&(level.extracts??[]).length?level.extracts:[exit]'))out.push('nodspel/world.js: Depth Raid must build a hatch at every area extract and open only the current one');
     if(!game.includes('renderDepthExtractGuide')||!game.includes('EXTRACT · CLEAR THE AREA')||!game.includes("depthExit.x,1.8,depthExit.z"))out.push('nodspel/game.mjs: the current-area hatch must stay labelled and a guide arrow must point at the open extract');
     if(!html.includes('id="depth-extract-guide"'))out.push('nodspel/index.html: #depth-extract-guide marker is missing');
     if(!data.includes('extractFinal')||!data.includes('finalArea')||!data.includes('enemyCountAdd: 2')||!data.includes('enemyCountAdd: 3')||!data.includes('healthMul: 1.25')||!data.includes('healthMul: 1.5')||!data.includes('damageMul: 1.15')||!data.includes('damageMul: 1.3'))out.push('data/raid-depth.js: area 2/3 scale numbers and extract BIT lines must stay in the prototype tuning');
     return out;}},
  {id:'depth-extract-pad-trigger',pr:'v2.28.63 depth-extract-trigger',why:"Robert 22 Nov 2026: walked into the lit Depth Raid extract beam and did not extract. The visible pad/fence is 1.45/1.15 m, but the trigger used r=1, and a silent 5s countdown cancelled if you drifted. A gear/equip label over the hatch hid the EXTRACT prompt.",
   check(ctx={}){const data=ctx.raidDepthSrc??read('data/raid-depth.js'),raid=ctx.depthRaidSrc??read('nodspel/depth-raid.js'),depth=ctx.depthLevelSrc??read('nodspel/depth-level.js'),vfx=ctx.beamSrc??read('nodspel/vfx-extract-beam.js'),game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     if(!/extractCountdownMs:\s*0/.test(data)||!data.includes('extractRadius: 1.45'))out.push('data/raid-depth.js: extract must fire on entry (countdown 0) and use extractRadius 1.45, matching the visible pad');
     if(!raid.includes('export function inDepthExtract(')||!raid.includes('DEPTH.extractRadius')||!raid.includes('if((DEPTH.extractCountdownMs??0)>0)return \'extract-started\''))out.push('nodspel/depth-raid.js: inDepthExtract must use extractRadius and extract immediately when the countdown is 0');
     if(!depth.includes('r:DEPTH.extractRadius'))out.push('nodspel/depth-level.js: each depth exit must use DEPTH.extractRadius so the gameplay radius matches the pad');
     if(!vfx.includes('export const EXTRACT_PAD_RADIUS=1.45')||!vfx.includes('RingGeometry(PAD_INNER,EXTRACT_PAD_RADIUS'))out.push('nodspel/vfx-extract-beam.js: the ground pad outer radius must be EXTRACT_PAD_RADIUS 1.45');
     if(!game.includes('hideForExtract')||!game.includes('extractRadiusOf(round)+1.2'))out.push('nodspel/game.mjs: loot/equip labels on an open extract pad must hide so they cannot cover the hatch');
     return out;}},
  {id:'area-notice-no-overlap',pr:'v2.28.63 depth-extract-trigger',why:"On a 667-wide phone the ROOM CLEAR pill sat on top of the EXTRACT OPEN toast and hid the text. Both used the same bottom slot, and the Depth Raid copy wrapped onto two lines. The one-line/nowrap path then made the longer NODE-raid toast overflow into the sticks at 667x375.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs'),css=ctx.cssSrc??read('nodspel/style.css');const out=[];
     if(!game.includes('function layoutBottomNotices(')||!game.includes('layoutBottomNotices()'))out.push('nodspel/game.mjs: bottom toasts must be stacked by layoutBottomNotices so they never overlap');
     if(!game.includes("EXTRACT OPEN · walk into the lit hatch"))out.push('nodspel/game.mjs: the Depth Raid EXTRACT OPEN toast must stay short enough for one line at 667px');
     if(!game.includes('function fitExtractToast(')||!game.includes('scrollWidth>el.clientWidth')||!game.includes("el.classList.remove('one-line')"))out.push('nodspel/game.mjs: one-line nowrap must apply only when the extract toast fits between the sticks');
     if(!game.includes('function extractToastLane(')||!game.includes("getElementById('move-stick')")||!game.includes("getElementById('aim-stick')"))out.push('nodspel/game.mjs: the extract toast lane must be measured from the move and aim sticks');
     if(!/#extract-toast\{[^}]*max-width:calc\(100vw - var\(--sl,0px\) - var\(--sr,0px\) - 280px\)[^}]*white-space:\s*normal/.test(css.replace(/\s+/g,' ')))out.push('nodspel/style.css: a wrapping EXTRACT OPEN toast must use a stick-safe max-width (280px reserved)');
     if(!/#extract-toast\.one-line\{[^}]*white-space:\s*nowrap/.test(css))out.push('nodspel/style.css: one-line EXTRACT OPEN must use nowrap only as a class, not as the default');
     return out;}},
  {id:'depth-push-cover-nav',pr:'v2.28.64 depth-push-cover',why:"Robert 22 Nov 2026: had to kill every enemy to move on, got stuck in a narrow corridor doorway, and met enemies in an empty under-lit area 3 with no cover. He wanted to push forward without a clear, wider corridors, and tactical cover.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs'),raid=ctx.depthRaidSrc??read('nodspel/depth-raid.js'),depth=ctx.depthLevelSrc??read('nodspel/depth-level.js'),data=ctx.raidDepthSrc??read('data/raid-depth.js'),html=ctx.htmlSrc??read('nodspel/index.html'),css=ctx.cssSrc??read('nodspel/style.css'),bunker=ctx.bunkerSrc??read('nodspel/bunker.js'),world=ctx.worldSrc??read('nodspel/world.js');const out=[];
     if(!raid.includes('export function pushDeeper(')||!raid.includes('export function canPushDeeper(')||!raid.includes('forfeitZones'))out.push('nodspel/depth-raid.js: pushing through the next-area door without a clear must be GO DEEPER and forfeit extract in that area');
     if(!data.includes('pushId')||!data.includes('depth_push_intro')||!data.includes('Leaving live hostiles in the rear-view'))out.push('data/raid-depth.js: the first uncleared push needs a unique dry BIT line and a stable pushId');
     if(!depth.includes('DEPTH_CLEAR_WIDTH=2.4')||!depth.includes('function chamferOpening(')||!depth.includes('export function placeDepthCover(')||!depth.includes('export function depthConnectorPaths('))out.push('nodspel/depth-level.js: depth corridors must be 2.4 m clear with chamfered joints, cover in combat rooms, and a connector nav path');
     if(!game.includes('GO DEEPER · skip remaining enemies')||!html.includes('id="depth-push"')||!game.includes('onDepthPushConfirm'))out.push('the first uncleared push must show a small GO DEEPER confirm on the door');
     if(!bunker.includes('if(level.depth)')||!world.includes('if(level.depth)'))out.push('nodspel/bunker.js / world.js: Depth Raid must light every area, not only the first Q.lights anchors');
     return out;}},
  {id:'depth-scale-light-gun-sfx',pr:'v2.28.65 depth lighting and gunpowder SFX',why:"Robert 22 Nov 2026: asked if the Depth Raid character was bigger and if the rim light was too strong, and said shots sounded like lasers instead of gunpowder or air weapons.",
   check(ctx={}){const bunker=ctx.bunkerSrc??read('nodspel/bunker.js'),world=ctx.worldSrc??read('nodspel/world.js'),audio=ctx.audioSrc??read('ui/audio.js'),data=ctx.audioDataSrc??read('data/audio.js'),gen=ctx.genSfxSrc??read('tools/audio/gen-sfx.py');const out=[];
     if(/depth\s*\?\s*9/.test(bunker)||/depth\s*\?\s*8/.test(world)||/depth\s*\?\s*10/.test(world)||/depth\s*\?\s*22/.test(world))out.push('nodspel/bunker.js / world.js: Depth Raid lamps, fills and extract lights must use the same intensity and range as Node Raid so the stitched map is not washed out');
     if(!bunker.includes('for(const area of [1,2,3])'))out.push('nodspel/bunker.js: every depth area must still get a lamp');if(!world.includes('for(const area of [1,2,3])'))out.push('nodspel/world.js: every depth area must still get a fill');
     const body=audio.slice(audio.indexOf('shotBuffer('),audio.indexOf('shotDestination('));
     if(!body||/createOscillator|Math\.sin\s*\(|type:\s*['"]sine['"]|type:\s*['"]square['"]|thumpStartHz|thumpEndHz/.test(body))out.push('ui/audio.js shotBuffer must synthesize gunfire as filtered noise bursts, not sine or square laser oscillators');
     if(!data.includes("kind:'air'")||!data.includes("kind:'powder'")||!data.includes('shoot-air'))out.push('data/audio.js must ship powder weapon profiles plus an air/pneumatic shoot cue');
     const shootStart=gen.indexOf("if name.startswith('shoot')");
     const shootEnd=gen.indexOf('if name.startswith',shootStart+1);
     const shootBody=shootStart<0?'':gen.slice(shootStart,shootEnd<0?shootStart+400:shootEnd);
     if(shootStart<0||!gen.includes('def gunshot(')||/return tone\(|np\.sin\(/.test(shootBody))out.push('tools/audio/gen-sfx.py shoot cues must be noise-burst gunpowder or air reports, not sine tone sweeps');
     return out;}},
  {id:'aim-stick-instant-fire',pr:'v2.28.66 depth-nav-aim',why:"Robert 22 Nov 2026 playtest: the document-level touch router treated floating, pointer-events:none HUD labels (ammo/weapon/health/shield), which track the player's screen position, as covered obstacles, so they could silently swallow a touch meant to start the aim stick in the right zone. v2.28.67 removed this rule's original pointerdown-fire requirement (Robert's follow-up correction: the aim stick must be Brawl Stars, release-only -- see aim-stick-brawl-stars-release-only below) but the generous right-zone floating origin and low deadzone from this same pass must stay.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs'),levels=ctx.levelsSrc??read('nodspel/levels.js');const out=[];
     const covered=(game.match(/const covered=\[\.\.\.document\.querySelectorAll\('([^']*)'\)\]/)||[])[1];
     if(!covered)out.push('nodspel/game.mjs: setupStick must have a covered-controls selector for the document-level touch router');
     else if(/#ammo-hud|#weapon-name|#player-health|#player-shield|#quest-chip|\.round-hud|#level-corner/.test(covered))out.push('nodspel/game.mjs: floating HUD labels must not be treated as covered controls that block an aim-stick touch');
     if(!/deadZonePx:(\d+)/.test(levels)||+(levels.match(/deadZonePx:(\d+)/)||[])[1]>=20)out.push('nodspel/levels.js: RULES.aimControls.deadZonePx must stay below the old 20px so a touch just past center still counts as a drag');
     return out;}},
  {id:'aim-stick-brawl-stars-release-only',pr:'v2.28.67 aim-stick-brawl-stars',why:"Robert 22 Nov 2026 correction: an earlier brief called for twin-stick hold-to-spray; ignore it -- the aim stick must match Brawl Stars exactly, one auto-aimed or aimed shot per touch, fired only on release. v2.28.66 called onShot(true) on pointerdown and, when dragged, a second onShot(false) on release, so every real drag double-fired.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     const stickStart=game.indexOf('function setupStick(');
     if(stickStart<0){out.push('nodspel/game.mjs: setupStick is missing');return out;}
     let i=game.indexOf('{',stickStart),depth=0;
     for(;i<game.length;i++){if(game[i]==='{')depth++;else if(game[i]==='}'){depth--;if(depth===0)break;}}
     const body=game.slice(stickStart,i+1);
     const startFnStart=body.indexOf('function start(');
     const startFnEnd=startFnStart<0?-1:body.indexOf('\n  }',startFnStart);
     const startFn=startFnStart>=0&&startFnEnd>startFnStart?body.slice(startFnStart,startFnEnd):'';
     if(!startFn||/onShot\(/.test(startFn))out.push('nodspel/game.mjs: setupStick.start() must never call onShot -- Brawl Stars fires on release only, not on pointerdown');
     if(!/if\(direction===.tap.\)onShot\(true\);\s*\n\s*else if\(direction\)\{[^}]*onShot\(false\);/.test(body))out.push('nodspel/game.mjs: release() must fire at most one shot per gesture -- a tap xor an aimed drag, never both');
     if(!/const cancelled=e\.type!==.pointerup.;/.test(body))out.push("nodspel/game.mjs: release() must treat any non-pointerup terminal event (pointercancel, and the lostpointercapture fallback once recapture fails) as a cancel, so a drag released back inside the deadzone or interrupted never fires");
     return out;}},
  {id:'depth-jamb-assist-corridors-not-openings',pr:'v2.28.66 depth-nav-aim',why:"Robert 22 Nov 2026 playtest: walking through a Depth Raid doorway/corridor gap felt like tar, an invisible wall slowing the player. depthJambAssist()'s wide/thin-axis math is built for a door plane (one axis is a thin wall thickness); feeding it full corridor floor segments (wide only up to the 2.4 m clear width, but many metres long) made it read the whole corridor as one giant doorway and fight the player's forward movement along its entire length.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     const start=game.indexOf('function depthJambAssist(');
     if(start<0){out.push('nodspel/game.mjs: depthJambAssist() is missing');return out;}
     let i=game.indexOf('{',start),depth=0;
     for(;i<game.length;i++){if(game[i]==='{')depth++;else if(game[i]==='}'){depth--;if(depth===0)break;}}
     const body=game.slice(start,i+1);
     if(/for\(const c of \[\.\.\.\(level\.corridors/.test(body)||/mouths\.push\(c\)/.test(body))out.push('nodspel/game.mjs: depthJambAssist must not add full corridor/deadEnd floor segments to its mouths -- only thin door/doorway planes');
     if(!/Math\.min\(door\.w,door\.d\)<=1/.test(body))out.push('nodspel/game.mjs: depthJambAssist must only centre-pull through genuinely thin openings (reject wide, long corridor rectangles)');
     return out;}},
  {id:'depth-cover-lane-clear',pr:'v2.28.66 depth-nav-aim',why:"Robert 22 Nov 2026 playtest: a combat room's cover crates sat in the middle of the walkway. placeDepthCover() used the entry-to-enemy line as its only reference, so tactical cover could land squarely on the main route between a room's entry and its far door instead of beside it.",
   check(ctx={}){const depth=ctx.depthLevelSrc??read('nodspel/depth-level.js');const out=[];
     if(!depth.includes('function roomExitPoint(')||!depth.includes('function blocksMainRoute(')||!depth.includes('export const DEPTH_COVER_LANE_HALF='))out.push('nodspel/depth-level.js: cover placement needs a room-exit lane and a main-route-blocking guard');
     if(!/if\(blocksMainRoute\(p,entry,exit\)\)return false;/.test(depth))out.push('nodspel/depth-level.js: placeDepthCover candidate spots must reject anything that blocks the entry-exit lane');
     if(!depth.includes('export function combatRoomsWithCover')||!/return \{room,entry,exit,enemies,boxes,between,blockingLane\};/.test(depth))out.push('nodspel/depth-level.js: combatRoomsWithCover must expose which cover (if any) blocks the main-route lane, so tests can prove the lane stays clear');
     return out;}},
  {id:'depth-cover-extract-clear',pr:'v2.28.75 depth-collision-sfx (t451u item 5)',why:"Robert 24 Nov 2026 Depth Raid playtest: a tactical cover crate landed on top of an area's extract pad, blocking the extraction beam. placeDepthCover() runs before level.exit exists (it is only set after the function returns), so the single check meant to keep cover off the pad (coverSpotFree's generic 1.25m keep-list, keyed on level.exit) never fired. Every candidate path (placeDepthCover's own ok()/loose() and topUpRoomCover's clear()) must reject spots near any area's pad, keyed off level.depthExits (set before placeDepthCover runs), not the not-yet-set level.exit.",
   check(ctx={}){const depth=ctx.depthLevelSrc??read('nodspel/depth-level.js');const out=[];
     if(!depth.includes('export const DEPTH_EXTRACT_COVER_CLEAR=')||!/function nearAnyExtract\(level,p\)\{\s*\n\s*return \(level\.depthExits\?\?\[\]\)\.some\(e=>Math\.hypot\(p\.x-e\.x,p\.z-e\.z\)<DEPTH_EXTRACT_COVER_CLEAR\);/.test(depth))out.push('nodspel/depth-level.js: a nearAnyExtract(level,p) helper keyed on level.depthExits and DEPTH_EXTRACT_COVER_CLEAR is missing');
     if(!/coverSpotFree[\s\S]{0,260}if\(nearAnyExtract\(level,p\)\)return false;/.test(depth))out.push('nodspel/depth-level.js: coverSpotFree must reject spots near any area extract pad');
     if(!/function topUpRoomCover[\s\S]{0,1200}if\(nearAnyExtract\(level,p\)\)return false;/.test(depth))out.push('nodspel/depth-level.js: topUpRoomCover\'s clear() must reject spots near any area extract pad too (it does not call coverSpotFree)');
     return out;}},
  {id:'depth-wall-jamb-visual-close',pr:'v2.28.75 depth-collision-sfx (t451u item 2)',why:"Robert 24 Nov 2026 Depth Raid playtest: wall corners at Depth doorways didn't align -- addLinkSegment() trims each corridor side wall short of the room boundary so the player capsule never snags on the jamb (v2.28.66), but that same trim is a real hole in the render-only wall shell (bunker.js shellMesh(wallSolids(level.walls))). A render-only, untrimmed wallDecor copy must close it without adding a collider.",
   check(ctx={}){const depth=ctx.depthLevelSrc??read('nodspel/depth-level.js'),bunker=ctx.bunkerSrc??read('nodspel/bunker.js');const out=[];
     if(!/function addLinkSegment\([^)]*\)\{[\s\S]{0,2000}?\(from\.wallDecor\?\?=\[\]\)\.push/.test(depth))out.push('nodspel/depth-level.js: addLinkSegment must also push an untrimmed render-only wall into wallDecor for every side wall it trims');
     if(!/MERGE_KEYS=\[[^\]]*'wallDecor'/.test(depth))out.push("nodspel/depth-level.js: MERGE_KEYS must carry wallDecor from each area part into the merged Depth level");
     if(!/shellMesh\(wallSolids\(\[\.\.\.level\.walls,\.\.\.\(level\.wallDecor\?\?\[\]\)\]\)/.test(bunker))out.push('nodspel/bunker.js: the wall shell (buildBunker) must render level.walls plus level.wallDecor, not level.walls alone, or the jamb notch reopens');
     if(/playerSolids[\s\S]{0,200}wallDecor/.test(read('nodspel/game.mjs')))out.push('nodspel/game.mjs: wallDecor must stay render-only -- it must never reach the collision list');
     return out;}},
  {id:'depth-link-wall-trim-and-door-width',pr:'v2.28.75 depth-collision-sfx (t451u item 1)',why:"Robert 24 Nov 2026 Depth Raid playtest: a near-wall sweep off the -15.5,-33 bend stalled permanently. addLinkSegment() trimmed its side walls off the +overlap-padded w/d (meant only for floor continuity), not the true segment endpoints, so a wall corner landed only ~0.4m short of a bend instead of the intended LINK_BEND_TRIM (2.0m) -- close enough to pinch a capsule hugging that side of the perpendicular corridor. Widening the trim to the true endpoints then let a player sidestep a locked depth door whose doorZ lands inside that same bend pad, so the door itself must widen to the pad's width to still seal the passage.",
   check(ctx={}){const depth=ctx.depthLevelSrc??read('nodspel/depth-level.js');const out=[];
     if(!/const LINK_BEND_TRIM=LINK_WIDTH\/2\+WALL_T;/.test(depth))out.push('nodspel/depth-level.js: LINK_BEND_TRIM must be defined as a full LINK_WIDTH/2+WALL_T setback');
     if(!/const full=Math\.abs\(x2-x1\),wallW=Math\.max\(\.3,full-2\*LINK_BEND_TRIM\);/.test(depth)||!/const full=Math\.abs\(z2-z1\),wallD=Math\.max\(\.3,full-2\*LINK_BEND_TRIM\);/.test(depth))out.push('nodspel/depth-level.js: addLinkSegment must trim its side walls off the true (unpadded) segment length, not the +overlap floor width/depth');
     if(!/doorW=LINK_WIDTH\+2\*DEPTH_CHAMFER/.test(depth))out.push('nodspel/depth-level.js: linkParts must widen the locked depth door to the DEPTH_CHAMFER bend pad\'s width so it seals the passage even where the (now fully trimmed) side walls stay open for bend clearance');
     return out;}},
  {id:'depth-nodes-no-collider',pr:'v2.28.66 depth-nav-aim',why:"Robert 22 Nov 2026 playtest (CONTROL ROOM screenshot): a leftover Node Raid node pad blocked the player and bullets in a Depth Area. setCollisions() in game.mjs built a 1.4x1.4 collider for every round.level.nodes entry unconditionally, with no depth-aware guard, even though the same obstacle list also gates the player's shots.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     if(!/playerSolids=\[\.\.\.solids,\.\.\.\(round\.level\.depth\?\[\]:round\.level\.nodes\.map\(n=>\(\{x:n\.x,z:n\.z,w:1\.4,d:1\.4\}\)\)\)/.test(game))out.push('nodspel/game.mjs: setCollisions must skip node colliders entirely while round.level.depth is set');
     if(!/fireAimedWeapon\(weapon,round,position,direction,clock,playerSolids,playerMoving,tap\)/.test(game))out.push('nodspel/game.mjs: fire() must still trace shots against the same playerSolids list (one source of truth for movement and bullets)');
     return out;}},
  {id:'depth-extract-no-collider',pr:'v2.28.75 depth-collision-sfx (t451u item 4)',why:"Robert 24 Nov 2026 Depth Raid playtest: setCollisions() still pushed a 2x0.22 solid onto every unopened Depth extract/exit pad -- a walk-blocker. Depth extract points must always be walk-through, open or closed; the beam/extract interaction is a radius check elsewhere (depthExtractOpen in world.js, inDepthExtract), never a physical collider.",
   check(ctx={}){const game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     const start=game.indexOf('function setCollisions(');
     if(start<0){out.push('nodspel/game.mjs: setCollisions() is missing');return out;}
     let i=game.indexOf('{',start),depth=0;
     for(;i<game.length;i++){if(game[i]==='{')depth++;else if(game[i]==='}'){depth--;if(depth===0)break;}}
     const body=game.slice(start,i+1);
     if(/round\.level\.extracts\?\?round\.level\.depthExits/.test(body))out.push('nodspel/game.mjs: setCollisions must not push extract/hatch solids when round.depth is set -- Depth extract pads are always walk-through');
     if(!/if\(!round\.depth&&!exitIsOpen\(round\)\)solids\.push\(\{x:round\.level\.exit\.x,z:round\.level\.exit\.z,w:2,d:\.22\}\);/.test(body))out.push('nodspel/game.mjs: the closed-exit solid must be gated to non-Depth rounds only');
     return out;}},
  {id:'bit-face-flipY',pr:'v2.28.75 depth-collision-sfx (t451u item 3)',why:"Robert 24 Nov 2026 Depth Raid playtest: BIT's face was upside down after the #306 textured BIT. bit_screen UVs follow glTF (V=0 at the top of the mesh); CanvasTexture defaults to flipY=true and mirrored the eyes to the chin. The face texture must set flipY=false.",
   check(ctx={}){const src=ctx.bitModelSrc??read('nodspel/bit-model.js');const out=[];
     if(!/texture\.flipY=false/.test(src))out.push('nodspel/bit-model.js: createBitFace must set texture.flipY=false so the canvas is not mirrored on bit_screen');
     return out;}},
  {id:'powder-and-mortar-boom',pr:'v2.28.75 depth-collision-sfx (t451u item 6)',why:"Robert 24 Nov 2026 Depth Raid playtest: shots still sounded like pea-shooters, and mortar projectiles had no deep muffled explosion. Runtime shotBuffer params must keep a sub-range thump; an explosion cue must be synthesized (not a sine tone) and fired from both mortar/grenade blasts and fuel-drum detonations.",
   check(ctx={}){const data=ctx.audioDataSrc??read('data/audio.js'),audio=ctx.audioSrc??read('ui/audio.js'),gen=ctx.genSfxSrc??read('tools/audio/gen-sfx.py'),combat=ctx.combatSrc??read('nodspel/combat.js'),round=ctx.roundSrc??read('nodspel/round.js');const out=[];
     if(!/add\('explosion'/.test(data))out.push("data/audio.js must register an 'explosion' SFX cue");
     if(!/thumpHz:90/.test(data))out.push('data/audio.js default powder thumpHz must stay in the sub/low range (90 Hz), not a mid-range tick');
     if(!/explosionBuffer\(/.test(audio)||!/name===.explosion./.test(audio))out.push('ui/audio.js must synthesize explosionBuffer and play it for the explosion cue, not wait on a file decode alone');
     const expStart=gen.indexOf('def explosion(');
     const expEnd=expStart<0?-1:gen.indexOf('\ndef ',expStart+1);
     const expBody=expStart<0?'':gen.slice(expStart,expEnd<0?expStart+800:expEnd);
     if(expStart<0||/return tone\(|np\.sin\(/.test(expBody))out.push('tools/audio/gen-sfx.py explosion() must be a low-passed noise boom, not a sine tone');
     if(!/if name==.explosion.:/.test(gen)||!/return explosion\(rng\)/.test(gen))out.push("tools/audio/gen-sfx.py cue() must route 'explosion' to explosion()");
     if(!/audioEvent\('explosion'\)/.test(combat))out.push("nodspel/combat.js stepBlasts must play audioEvent('explosion') when a shell detonates");
     if(!/audioEvent\('explosion'\)/.test(round))out.push("nodspel/round.js detonateDrum must play audioEvent('explosion') when a drum detonates");
     return out;}},
  {id:'depth-opening-diagonal-stall',pr:'v2.28.76 (t452u item 1)',why:"Robert 24 Nov 2026 Depth Raid playtest: \"Fastnade lite har nar jag sprang in mot utrymmet dar\" (snagged running into the opening) -- walk-sweep.test.mjs only ever walked lanes straight along their travel axis, so three separate causes stayed green: (1) movePlayer's axis-separated stepping could find both single-axis updates blocked at an inside corner even though the direct diagonal point was clear; (2) widenDepthPassages never widened level.closet (the Control Room's keycard branch, built the same way as a dead end) to the Depth clear width, leaving its jamb narrower than the room doorway now opening into it; (3) cover-box placement margins did not add a candidate's own footprint, so two flank crates could land with less than a capsule's diameter between them.",
   check(ctx={}){const physics=ctx.physicsSrc??read('nodspel/physics.mjs'),depth=ctx.depthLevelSrc??read('nodspel/depth-level.js'),sweep=ctx.walkSweepSrc??read('nodspel/tests/walk-sweep.test.mjs');const out=[];
     if(!/if \(onFloor\(x,z\) && !blocked\(x, z\)\) \{ p\.x = x; p\.z = z; continue; \}/.test(physics))out.push('nodspel/physics.mjs: movePlayer must try the full diagonal step before falling back to axis-separated sliding, or a capsule cutting an inside corner can find both single-axis updates blocked even though the diagonal point is clear');
     if(!/\.\.\.\(level\.closet\?\[level\.closet\]:\[\]\)/.test(depth))out.push('nodspel/depth-level.js: widenDepthPassages must widen level.closet the same as corridors/deadEnds');
     if(!/const PLAYER_PASS_GAP=2\*RULES\.playerRadius\+0\.08;/.test(depth))out.push('nodspel/depth-level.js: PLAYER_PASS_GAP (a full player-diameter clearance) must gate cover placement, not a flat sub-diameter margin');
     if(!/function coverSpotFree\(level,p,r=0\.7,box\)/.test(depth))out.push('nodspel/depth-level.js: coverSpotFree must accept the candidate\'s own box footprint so box-vs-box clearance accounts for both halves, not just a flat point margin');
     if(!/coverSpotFree\(level,p,PLAYER_PASS_GAP,\{w:along\?1\.25:\.55,d:along\?\.55:1\.25\}\)/.test(depth))out.push('nodspel/depth-level.js: placeDepthCover\'s candidate check must pass PLAYER_PASS_GAP and the candidate\'s footprint to coverSpotFree');
     if(!/function roomCornerLanes\(level,solids\)/.test(sweep))out.push('nodspel/tests/walk-sweep.test.mjs: the walk sweep must cover diagonal/around-the-inner-corner approaches into every room opening (roomCornerLanes), not only straight centerline/near-wall lanes');
     return out;}},
  {id:'enemy-model-no-permanent-reject-cache',pr:'v2.28.76 (t452u item 2)',why:"#306 (v2.28.68) shipped textured enemies; #314 only bumped ?v= and did not revert the loader, yet a live playtest (t452u) showed almost every enemy except mortar back to the old procedural mesh. Root cause: createEnemyModelLoader() cached a rejected (timed-out) promise forever, so the first raid's 3500ms timeout -- racing buildWorld()'s env texture loads for the same frame -- permanently fell back that archetype for the rest of the session once it lost the race, even though a later request for the same model could have succeeded.",
   check(ctx={}){const models=ctx.enemyModelsSrc??read('nodspel/enemy-models.js'),data=ctx.raidEnemiesSrc??read('data/raid-enemies.js'),game=ctx.gameSrc??read('nodspel/game.mjs');const out=[];
     if(!/promise\.catch\(\(\)=>\{if\(cache\.get\(id\)===promise\)cache\.delete\(id\);\}\);/.test(models))out.push('nodspel/enemy-models.js: a rejected load must delete its own cache entry so the next call retries instead of replaying a stale rejection forever');
     if(!/loadEnemyModel\.preload=/.test(models))out.push('nodspel/enemy-models.js: createEnemyModelLoader must expose a preload(ids) so a level can start fetching every archetype before anything on screen needs one');
     const timeout=Number((data.match(/models:\{timeoutMs:(\d+)\}/)||[])[1]);
     if(!(timeout>=10000))out.push('data/raid-enemies.js: models.timeoutMs must give a ~1.3-1.7MB enemy GLB enough time on a phone sharing bandwidth with env textures (at least 10000ms, matching nodspel/town.js loadKit\'s 20000ms convention), not the old 3500ms');
     if(!/loadEnemyModel\.preload\?\.\(\(round\.level\.enemies\?\?\[\]\)\.map\(e=>visualFor\(e\)\?\.archetype\)\.filter\(Boolean\)\);/.test(game))out.push('nodspel/game.mjs: loadLevelInner must preload every archetype round.level.enemies will need before buildWorld() starts competing for bandwidth');
     return out;}},
];



export function runAll(ctx){const res=[];for(const r of RULES){for(const msg of r.check(ctx))res.push({rule:r.id,pr:r.pr,msg});}return res;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const ctx={files:tracked(),gitignore:fs.existsSync(path.join(root,'.gitignore'))?read('.gitignore'):''};
  const res=runAll(ctx);for(const x of res)console.log(`[${x.rule} ${x.pr}] ${x.msg}`);
  console.log(`bug-lint: ${RULES.length} rule(s), ${res.length} violation(s)`);if(res.length)process.exit(1);
}
