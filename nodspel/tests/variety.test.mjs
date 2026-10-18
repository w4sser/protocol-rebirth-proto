import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,RULES,hazardState} from '../levels.js';
import {createRound} from '../round.js';
import {stepHazards} from '../combat.js';
import {createWeapon,fireWeapon,stepWeapon} from '../weapon.js';
const seeds=Array.from({length:40},(_,i)=>`variety-${i}`);
test('variety is seeded and deterministic',()=>{
  for(const n of [1,2,3]){const a=generateLevel(n,'det'),b=generateLevel(n,'det');
    assert.deepEqual(a.enemies.map(e=>e.type),b.enemies.map(e=>e.type));assert.deepEqual(a.hazards,b.hazards);assert.deepEqual(a.theme,b.theme);}
});
test('level one stays gentle: grunts only, no hazards, no shielded nodes',()=>{
  for(const s of seeds){const l=generateLevel(1,s);
    assert.ok(l.enemies.every(e=>e.type==='grunt'));assert.equal(l.hazards.length,0);assert.ok(l.nodes.every(n=>!n.shielded));}
});
test('levels differ in enemy mix, hazards, node mechanics and theme',()=>{
  const types=[new Set(),new Set(),new Set()];
  for(const s of seeds)for(const n of [1,2,3])for(const e of generateLevel(n,s).enemies)types[n-1].add(e.type);
  assert.deepEqual([...types[0]],['grunt']);
  assert.ok(types[1].has('sentry')&&!types[1].has('rusher'));
  assert.ok(types[2].has('rusher')&&types[2].has('sentry'));
  for(const s of seeds){
    const l2=generateLevel(2,s),l3=generateLevel(3,s);
    assert.equal(l2.hazards.length,1);assert.equal(l3.hazards.length,2);
    assert.equal(l3.nodes.filter(n=>n.shielded).length,1);
    assert.equal(l2.enemies[0].type,'grunt');assert.equal(l3.enemies[0].type,'grunt');
  }
  assert.equal(new Set([1,2,3].map(n=>generateLevel(n,'theme').theme.floor)).size,3);
});
test('hazards avoid solids, objectives, loot, start and exit',()=>{
  for(const s of seeds)for(const n of [2,3]){const l=generateLevel(n,s);
    for(const h of l.hazards){
      for(const o of [...l.walls,...l.boxes])assert.ok(!(Math.abs(h.x-o.x)<o.w/2+h.w/2&&Math.abs(h.z-o.z)<o.d/2+h.d/2),'hazard overlaps a solid');
      for(const o of [l.start,l.exit,...l.nodes,...l.lootBoxes])assert.ok(Math.hypot(h.x-o.x,h.z-o.z)>=RULES.hazard.clearance);
    }}
});
test('hazard pulses off → warn → on and only damages while on and stood on',()=>{
  const h={x:0,z:0,w:1.8,d:1.8,phaseMs:0},H=RULES.hazard;
  assert.equal(hazardState(h,0),'off');assert.equal(hazardState(h,H.offMs-H.warnMs),'warn');assert.equal(hazardState(h,H.offMs),'on');
  const r=createRound('hz',0);r.level.hazards=[h];
  assert.equal(stepHazards(r,{x:0,z:0},100,1),false,'off does nothing');
  assert.ok(stepHazards(r,{x:0,z:0},H.offMs+10,1));assert.equal(r.health,100-H.damagePerSecond);
  assert.equal(stepHazards(r,{x:5,z:5},H.offMs+20,1),false,'outside the pad is safe');
});
test('shielded nodes absorb shots',()=>{
  const r=createRound('shield',0),w=createWeapon(),node=r.level.nodes[0];r.level.enemies=[];node.shielded=true;
  const p={x:node.x,z:node.z+3};fireWeapon(w,p,{x:0,z:-1},1);stepWeapon(w,r,500,.5,[]);
  assert.equal(node.active,false);
});
test('enemy types change range, speed and fire rate',()=>{
  const T=RULES.enemyTypes;assert.equal(T.sentry.speedMul,0);assert.ok(T.sentry.rangeMul>1&&T.rusher.speedMul>1&&T.rusher.rangeMul<1);
  for(const s of seeds)for(const e of generateLevel(3,s).enemies)if(e.type==='sentry')assert.equal(e.speed,0);
});
import {hazardTiming} from '../levels.js';
import {readFileSync} from 'node:fs';
test('level two shock pads are gentler and a full on-phase cannot nearly kill you',()=>{
  for(const s of seeds){const l2=generateLevel(2,s),l3=generateLevel(3,s);
    for(const h of l2.hazards)assert.equal(h.dps,8);for(const h of l3.hazards)assert.equal(h.dps,12);}
  const r=createRound('hz2',0),H=RULES.hazard,h={x:0,z:0,w:1.8,d:1.8,phaseMs:0,dps:8};r.level.hazards=[h];
  for(let t=0;t<2000;t+=16)stepHazards(r,{x:0,z:0},H.offMs+t,.016);
  assert.ok(100-r.health<=Math.ceil(8*H.onMs/1000)+1,`took ${100-r.health} damage standing on a level-two pad for 2 s`);
});
test('hazard telegraph gives a long, counted-down warning',()=>{
  const H=RULES.hazard,h={phaseMs:0};
  assert.ok(H.warnMs>=1000,'at least one second of warning');
  const t=hazardTiming(h,H.offMs-500);assert.equal(t.state,'warn');assert.equal(t.msToOn,500);
  assert.equal(hazardTiming(h,H.offMs+100).state,'on');
  const js=readFileSync(new URL('../game.mjs',import.meta.url),'utf8'),world=readFileSync(new URL('../world.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/SHOCK PAD'|⚡ CHARGING/,'shock pads carry no text label');assert.match(js,/setIconText\(l\.caption,'hazard',''\)/,'lightning icon only');
  assert.match(world,/recharge ring fills/,'pad shows a recharge fill ring');
});
test('node hints match the real mechanic (stand close, no key) on desktop and touch',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),js=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(html,/desktop-help[^]*stand close to a node/);assert.doesNotMatch(html,/touch-help/); // v1.66.1: touch sticks are labelled (MOVE / AIM), no duplicate hint strip
  assert.match(js,/'STAND CLOSE'/);assert.doesNotMatch(js.replace("if(e.code==='KeyE'&&!e.repeat){e.preventDefault();toolTap();}",''),/KeyE/,'E is the tool key only, never a node key');
});
