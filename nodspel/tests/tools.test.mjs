import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRound} from '../round.js';
import {RULES} from '../levels.js';
import {createCombat,stepCombat} from '../combat.js';
import {readTool,readLaunch,buildRaidResult} from '../raid-result.js';
import {initTool,toolCharges,canUseTool,nearestTarget,landingPoint,autoThrowPoint,previewThrow,throwTool,stepTools,isStunned,shieldIsDown} from '../tools.js';

const baseline=r=>Object.assign(r.level,{enemyDamage:undefined,enemyWindupMs:0,firstGraceMs:undefined,enemyCooldownMs:undefined});
const foe=(id,x,z,extra={})=>({id,kind:'enemy',x,z,r:.48,health:3,active:true,speed:0,type:'grunt',...extra});
const setup=(tool,enemies,seed='tools')=>{const r=createRound(seed,0);baseline(r);r.level.enemies=enemies;r.level.walls=[];initTool(r,tool);return r;};
const origin={x:0,z:4};

test('RULES.tools matches the tool items in data/items.js (ids, charges)',()=>{
  const src=fs.readFileSync(new URL('../../data/items.js',import.meta.url),'utf8'),w={};new Function('window',src)(w);
  const items=(w.DATA||Object.values(w).find(v=>v&&v.items)).items.filter(i=>i.slot==='tool');
  assert.deepEqual(items.map(i=>i.id).sort(),Object.keys(RULES.tools.defs).sort());
  for(const it of items)assert.equal(it.tool.charges,RULES.tools.defs[it.id].charges,it.id);
});

test('?tool= is clamped to the tool def and rejects unknown ids',()=>{
  assert.deepEqual(readTool('tool_grenade:2'),{id:'tool_grenade',n:2});
  assert.deepEqual(readTool('tool_grenade:9'),{id:'tool_grenade',n:2},'clamped to 2 charges');
  assert.deepEqual(readTool('tool_emp:3'),{id:'tool_emp',n:1});
  for(const bad of ['tool_nuke:1','tool_grenade:0','tool_grenade:x','tool_grenade','constructor:1','',null,undefined])assert.equal(readTool(bad),null,String(bad));
  assert.deepEqual(readLaunch('?tool=tool_decoy:2').tool,{id:'tool_decoy',n:2});
  assert.equal(readLaunch('').tool,null);
});

test('toolLeft is reported in the raid result and only when a tool was brought',()=>{
  const r=createRound('tl',0);initTool(r,{id:'tool_grenade',n:2});
  throwTool(r,origin,{x:0,z:0},0);r.over=true;r.reason='death';
  assert.deepEqual(buildRaidResult(r).toolLeft,{id:'tool_grenade',n:1});
  const none=createRound('tl2',0);initTool(none,null);none.over=true;none.reason='death';
  assert.equal('toolLeft' in buildRaidResult(none),false);
});

test('auto-aim picks the nearest living enemy within 6 m, else throws 4 m forward',()=>{
  const r=setup({id:'tool_grenade',n:2},[foe('far',0,-3),foe('near',2,1),foe('dead',0,3.5,{health:0})]);
  assert.equal(nearestTarget(origin,r.level.enemies).id,'near');
  const t=autoThrowPoint(r,origin,{x:0,z:-1});
  assert.equal(t.target.id,'near');assert.ok(Math.hypot(t.x-2,t.z-1)<1e-6);
  r.level.enemies=[foe('out',0,-10)];
  const f=autoThrowPoint(r,origin,{x:0,z:-1});
  assert.equal(f.target,null);assert.ok(Math.hypot(f.x-0,f.z-0)<1e-6,'4 m forward of z=4');
});

test('throws are clamped to throw range and stopped by walls',()=>{
  const far=landingPoint(origin,{x:0,z:-20});assert.ok(Math.abs(Math.hypot(far.x-origin.x,far.z-origin.z)-RULES.tools.throwRange)<1e-6);
  const blocked=landingPoint(origin,{x:0,z:-4},[{x:0,z:1,w:4,d:.4}]);
  assert.ok(blocked.z>1.2,'lands in front of the wall face (z='+blocked.z+')');
  const pv=previewThrow(setup({id:'tool_emp',n:1},[]),origin,{x:0,z:0});
  assert.equal(pv.kind,'emp');assert.equal(pv.radius,3);
});

test('grenade: 1 s fuse, then 3 damage to every living enemy within 2 m, none outside, charges count down',()=>{
  const r=setup({id:'tool_grenade',n:2},[foe('a',0,0),foe('b',1.5,0),foe('c',3,0)]);
  const e=throwTool(r,origin,{x:0,z:0},1000);
  assert.equal(e.kind,'grenade');assert.equal(toolCharges(r),1);
  assert.deepEqual(stepTools(r,1999),[],'still fusing');assert.equal(r.level.enemies[0].health,3);
  const blasts=stepTools(r,2000);assert.equal(blasts.length,1);
  assert.deepEqual(r.level.enemies.map(x=>x.health),[0,0,3]);
  assert.equal(r.enemiesDefeated,2);
  assert.equal(r.health,100,'no friendly fire');
  throwTool(r,origin,{x:0,z:0},3000);assert.equal(toolCharges(r),0);assert.equal(canUseTool(r),false);
  assert.equal(throwTool(r,origin,{x:0,z:0},3100),null,'no charges left');
});

test('emp: stuns sentries and shielded nodes within 3 m for 4 s, leaves grunts alone',()=>{
  const r=setup({id:'tool_emp',n:1},[foe('s',1,0,{type:'sentry'}),foe('far',5,0,{type:'sentry'}),foe('g',0,1,{type:'grunt'})]);
  r.level.nodes=[{id:'n1',x:-1,z:0,shielded:true,active:false},{id:'n2',x:-1,z:2,shielded:false,active:false}];
  const e=throwTool(r,origin,{x:0,z:0},1000);
  assert.equal(e.stunned,1);assert.equal(e.shields,1);
  const [s,far,g]=r.level.enemies;
  assert.equal(isStunned(s,1000),true);assert.equal(isStunned(s,4999),true);assert.equal(isStunned(s,5000),false);
  assert.equal(isStunned(far,1000),false);assert.equal(isStunned(g,1000),false);
  assert.equal(shieldIsDown(r.level.nodes[0],4999),true);assert.equal(shieldIsDown(r.level.nodes[0],5000),false);
  assert.equal(shieldIsDown(r.level.nodes[1],1000),false,'unshielded node untouched');
});

test('stunned enemies neither move nor fire; they resume when the stun ends',()=>{
  const r=setup({id:'tool_emp',n:1},[foe('s',0,0,{type:'sentry',aggro:true})]);
  const c=createCombat(r.level,0),p={x:0,z:4};
  throwTool(r,p,{x:0,z:0},3000);
  stepCombat(r,c,p,3500,.04,[]);stepCombat(r,c,p,5000,.5,[]);stepCombat(r,c,p,6900,.5,[]);
  assert.equal(c.projectiles.length,0,'no shots while stunned');assert.equal(r.health,100);
  stepCombat(r,c,p,7100,.04,[]);assert.equal(c.projectiles.length,0,'fresh warning after stun');
  stepCombat(r,c,p,8300,.04,[]);assert.equal(c.projectiles.length,1,'fires after fresh sentry warning');
});

test('decoy: enemies within 6 m walk to the lure for 5 s instead of the player and hold fire',()=>{
  const r=setup({id:'tool_decoy',n:2},[foe('g',-4,0,{speed:2,aggro:true}),foe('away',20,20,{speed:2,aggro:true})],'lure');
  const c=createCombat(r.level,0),p={x:0,z:6};
  const lure={x:-4,z:-4};
  throwTool(r,{x:-4,z:2},lure,3000);
  const [g,away]=r.level.enemies;
  assert.deepEqual(g.lureTarget,lure);assert.equal(away.lureTarget,undefined,'out of range');
  for(let t=3100;t<6000;t+=100){stepTools(r,t);stepCombat(r,c,p,t,.1,[]);}
  assert.ok(Math.hypot(g.x-lure.x,g.z-lure.z)<=RULES.tools.lureStopDistance+.1,'reached the lure, now at '+g.x+','+g.z);
  assert.equal(c.projectiles.length,0,'lured enemy does not shoot');
  stepTools(r,8001);assert.equal(g.lureTarget,undefined,'lure ends after 5 s');
  stepCombat(r,c,p,8100,.1,[]);assert.ok(g.z>-3.9||g.x!==-4,'back to chasing the player');
});

test('effects clear when the level changes and nothing works after the round is over',()=>{
  const r=setup({id:'tool_grenade',n:2},[foe('a',0,0)]);
  throwTool(r,origin,{x:0,z:0},0);
  r.level={...r.level,enemies:[foe('b',0,0)],nodes:[]};
  assert.deepEqual(stepTools(r,5000),[]);assert.equal(r.level.enemies[0].health,3);assert.equal(r.toolFx.fuses.length,0);
  r.over=true;assert.equal(canUseTool(r),false);assert.equal(throwTool(r,origin,{x:0,z:0},6000),null);
});

test('mobile control: one tool button above DASH, E key, tap vs drag, safe area, no emoji',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8'),js=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  assert.equal((html.match(/id="tool-btn"/g)||[]).length,1);
  assert.ok(html.indexOf('id="tool-btn"')<html.indexOf('id="dash"'));
  assert.match(css,/#tool-btn\{position:absolute;right:[^}]*bottom:104px/,'above the 68px DASH (bottom 26px)');
  assert.match(js,/code==='KeyE'/);assert.match(js,/pointermove/);assert.match(js,/previewThrow/);
  assert.match(js,/TOOL_CORAL='#E4705F'/);assert.match(js,/TOOL_CYAN='#3FE0D0'/);
  assert.match(html,/viewport-fit=cover/);
  assert.match(fs.readFileSync(new URL('../ui-icons.svg',import.meta.url),'utf8'),/id="tool-grenade"[^]*id="tool-emp"[^]*id="tool-decoy"/);
});
test('codex review: a throw right after a level change still lands',async()=>{
  const {createRound}=await import('../round.js');const T=await import('../tools.js');
  const r=createRound('cx',0);T.initTool(r,{id:'tool_grenade',n:2});T.throwTool(r,{x:0,z:0},{x:0,z:1},0);
  r.level={...r.level,enemies:[{id:'e',x:0,z:4,health:3,active:true}]};T.throwTool(r,{x:0,z:4},{x:0,z:4},2000);
  T.stepTools(r,3100);assert.ok(r.level.enemies[0].health<3,'grenade thrown after level change detonates');});
