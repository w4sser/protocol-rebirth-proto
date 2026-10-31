import {holdExit} from './exit-helpers.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {readGoal,goalProgress,applyIntroEncounter} from '../progression-goal.js';
import {generateLevel} from '../levels.js';
import {createRound,collectLoot,takeDamage,extractRound,stepNodeInteraction,enterExit} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {moveWithActors} from '../physics.mjs';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';
const goal={module:'fabricator',level:1,name:'Fabricator',benefit:'Scavenger Vest',parts:[{id:'cable',need:2,secured:1},{id:'scrap_alloy',need:2,secured:1}]};
test('bank and carried requirements remain separate across drop, loss and excess',()=>{
 const g=readGoal(JSON.stringify(goal));assert(g);let p=goalProgress(g,{cable:9,scrap_alloy:1});assert(p.enoughCarried);assert.equal(p.parts[0].remaining,0);assert.equal(p.parts[0].secured,1);
 assert(!goalProgress(g,{cable:0,scrap_alloy:1}).enoughCarried);assert(!readGoal('{"parts":[]}'));
 const r=createRound('opening',0);r.bag.cable=1;takeDamage(r,100,100);assert.equal(goalProgress(g,r.bag).parts[0].carried,0);
 const e=createRound('opening',0);e.bag.cable=1;e.levelsCleared=1;extractRound(e,100);assert.equal(e.extracted.cable,1);assert.equal(g.parts[0].secured,1,'launch snapshot never mutated');
});
test('later goals count item-sourced currency without declaring a build ready too early',()=>{
 const g=readGoal(JSON.stringify({...goal,parts:[{id:'polymer_plate',need:2,secured:1},{kind:'currency',id:'scrap',need:50,secured:18}]}));assert(g,'canonical currencies can be tracked');
 assert(!goalProgress(g,{polymer_plate:1}).enoughCarried);const p=goalProgress(g,{polymer_plate:1,salvage_crate:2});assert(p.enoughCarried);assert.equal(p.parts[1].carried,48);assert.equal(p.parts[1].secured,18);
});
test('alternate angle can collect supplies, hold the node and extract without killing the guard',()=>{
 for(const seed of ['angle-1','angle-2']){
  const r=createRound(seed,0);applyIntroEncounter(r.level,goal);const room=r.level.rooms[0],s=r.level.choiceSide,c=createCombat(r.level,0),w=createWeapon(Infinity),solids=[...r.level.walls,...r.level.boxes,...r.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];let p={...r.level.start},now=0;
  const tick=()=>{now+=20;stepCombat(r,c,p,now,.02,solids);stepNodeInteraction(r,w,p,now,[...r.level.walls,...r.level.boxes]);collectLoot(r,p,now,w);};
  const walk=to=>{for(let i=0;i<500&&Math.hypot(to.x-p.x,to.z-p.z)>.08;i++){const d=Math.hypot(to.x-p.x,to.z-p.z);p=moveWithActors(p,{x:(to.x-p.x)/d*.072,z:(to.z-p.z)/d*.072},r.level.enemies,solids,r.level.floors,.36);tick();}assert(Math.hypot(to.x-p.x,to.z-p.z)<.15,'open-looking route is traversable');};
  walk({x:room.x+s*3.3,z:room.z+3.2});walk({x:room.x+s*3.3,z:room.z+.7});for(let i=0;i<110;i++)tick();assert(r.level.nodes[0].active);
  walk({x:room.x+s*3.3,z:room.z-2.2});walk({x:room.x+s*1.5,z:room.z-2.2});assert(goalProgress(goal,r.bag).enoughCarried);walk(r.level.exit);assert.equal(holdExit(r,p,now),'next');assert(extractRound(r,now));assert(r.extracted.cable>0);assert.equal(r.enemiesDefeated,0);assert(r.health>0);
 }
});
test('bait from cover, then attack during recovery with the starting carbine',()=>{
 const r=createRound('bait-2',0);applyIntroEncounter(r.level,goal);const e=r.level.enemies[0],b=r.level.boxes[0],c=createCombat(r.level,0),w=createWeapon(Infinity),solids=[...r.level.walls,...r.level.boxes];c.graceUntil=0;c.nextFire.set(e.id,0);
 const peek={x:b.x+1.7,z:b.z+2.5};stepCombat(r,c,peek,1,.01,solids);assert.equal(e.attackPhase,'warning');
 const hidden={x:b.x,z:b.z+2.5};for(let now=101;now<=2001;now+=100)stepCombat(r,c,hidden,now,.1,solids);assert.equal(r.health,100,'baited burst misses behind cover');assert.equal(e.attackPhase,'recovery');
 const flank={x:e.x+2,z:e.z+1};for(const now of [2100,2350]){assert(fireAimedWeapon(w,r,flank,{x:e.x-flank.x,z:e.z-flank.z},now,solids));stepWeapon(w,r,now+200,.2,solids);}
 assert.equal(r.enemiesDefeated,1,'recovery permits two useful shots');
});
test('killing the intro guard before its minimum warning prevents its burst',()=>{
 const r=createRound('counter-2',0);applyIntroEncounter(r.level,goal);const e=r.level.enemies[0],c=createCombat(r.level,0),w=createWeapon(Infinity),p={x:e.x+3,z:e.z};c.graceUntil=0;c.moveAt=0;c.nextFire.set(e.id,0);
 stepCombat(r,c,p,1,.01,[]);
 for(let now=20;now<1500;now+=20){if(now===20||now===220)fireAimedWeapon(w,r,p,{x:-1,z:0},now,[]);stepWeapon(w,r,now,.02,[]);stepCombat(r,c,p,now,.02,[]);}
 assert.equal(r.enemiesDefeated,1);assert.equal(r.health,100,'hitting the guard cannot shorten its telegraph');assert(r.health>0,'opening remains forgiving');
});
test('intro guarantees available requirements, optional choice and usable cover for many seeds',()=>{
 for(let i=0;i<40;i++){const l=generateLevel(1,'intro-'+i);applyIntroEncounter(l,goal);assert.equal(l.enemies.length,1);assert(l.boxes.some(b=>b.introCover));assert(l.lootBoxes.some(b=>b.optional));
 for(const id of ['cable','scrap_alloy'])assert(l.lootBoxes.filter(b=>b.item===id&&!b.optional).length>=goal.parts.find(p=>p.id===id).need-goal.parts.find(p=>p.id===id).secured);
 assert(l.lootBoxes.every(b=>['cable','scrap_alloy'].includes(b.item)));
 assert(l.nodes.every(n=>l.boxes.every(b=>Math.abs(n.x-b.x)>b.w/2+.8||Math.abs(n.z-b.z)>b.d/2+.8)),'cover must not overlap a node');}
});
test('guard commits to a position, exposes recovery and cover blocks its burst',()=>{
 const r=createRound('guard',0);applyIntroEncounter(r.level,goal);const enemy=r.level.enemies[0];const p={x:enemy.x,z:enemy.z+4};const c=createCombat(r.level,0);c.graceUntil=0;c.moveAt=0;c.nextFire.set(enemy.id,0);
 stepCombat(r,c,p,1,.01,[]);assert.equal(enemy.attackPhase,'warning');const target={...enemy.attackTarget};p.x+=2;
 stepCombat(r,c,p,1100,.01,[]);assert(c.projectiles.length>0);assert.deepEqual(enemy.attackTarget,target,'warning locks a position, does not track the player');
 stepCombat(r,c,p,1800,.01,[]);assert.equal(enemy.attackPhase,'recovery');
 const cover={x:enemy.x,z:enemy.z+2,w:4,d:.5};r.health=100;c.projectiles=[{x:enemy.x,z:enemy.z+1,dx:0,dz:1,life:2}];p.x=enemy.x;stepCombat(r,c,p,1900,.3,[cover]);assert.equal(r.health,100);assert.equal(c.projectiles.length,0);
});
