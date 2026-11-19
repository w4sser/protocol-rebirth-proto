import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,makeShelf,placeSupplyShelves,shelfPathsConnected,RULES} from '../levels.js';
import {createRound,shootShelf,stepShelves,enterExit} from '../round.js';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';
import {movePlayer,traceTargets,aimEndpoint} from '../physics.mjs';
const end=RULES.shelf.telegraphMs+RULES.shelf.fallMs;
function setup(){const r=createRound('shelf-test',0);r.level.shelves=[makeShelf('s',0,0)];r.level.enemies=[];return r;}
test('N conventional projectile hits tip a shelf, then telegraph and fall before impact',()=>{
 const r=setup(),s=r.level.shelves[0];r.level.nodes=[];r.level.barrels=[];r.level.junctions=[];
 const w=createWeapon();
 for(let i=0;i<RULES.shelf.hitsToTip;i++){
  const t=100+i*1000;assert.ok(fireAimedWeapon(w,r,{x:0,z:-3},{x:0,z:1},t,[],false,false));
  for(let now=t+16;now<=t+300;now+=16)stepWeapon(w,r,now,.016,[]);
  assert.equal(s.hits,i+1);assert.equal(s.tipAt!=null,i===RULES.shelf.hitsToTip-1);
 }
 stepShelves(r,null,s.tipAt+end-1);assert.equal(s.active,false);
 stepShelves(r,null,s.tipAt+end);assert.equal(s.active,true);
 assert.deepEqual({...s.collider,movementOnly:undefined},{...s.footprint,movementOnly:undefined});
 assert.equal(shootShelf(r,'s',3000),false);
});
test('collapse damages and stuns only enemies inside footprint, lightly hurts player once',()=>{
 const r=setup(),s=r.level.shelves[0];r.level.enemies=[
  {id:'in',x:0,z:1,health:20,active:true,kind:'enemy'},
  {id:'out',x:3,z:1,health:20,active:true,kind:'enemy'}];
 for(let i=0;i<RULES.shelf.hitsToTip;i++)shootShelf(r,'s',100);
 stepShelves(r,{x:0,z:1},100+end);
 assert.equal(r.level.enemies[0].health,20-RULES.shelf.damage);
 assert.equal(r.level.enemies[0].stunnedUntil,100+end+RULES.shelf.stunMs);
 assert.equal(r.level.enemies[1].health,20);assert.equal(r.level.enemies[1].stunnedUntil,undefined);
 assert.equal(r.health,r.maxHealth-RULES.shelf.playerDamage);
 stepShelves(r,{x:0,z:1},200+end);assert.equal(r.health,r.maxHealth-RULES.shelf.playerDamage);
});
test('pause and terminal rounds freeze shelves and reject shots; outside player is safe',()=>{
 const r=setup();r.pauseAt=1;assert.equal(shootShelf(r,'s',100),false);r.pauseAt=null;
 for(let i=0;i<RULES.shelf.hitsToTip;i++)shootShelf(r,'s',100);
 r.pauseAt=200;stepShelves(r,null,100+end);assert.equal(r.level.shelves[0].active,false);
 r.pauseAt=null;stepShelves(r,{x:9,z:9},100+end);assert.equal(r.health,r.maxHealth);
 r.over=true;assert.equal(shootShelf(r,'s',2000),false);
});
test('fallen low cover blocks movement of both sides, allows shots/LOS over it and lets trapped actors escape',()=>{
 const r=setup(),s=r.level.shelves[0];for(let i=0;i<RULES.shelf.hitsToTip;i++)shootShelf(r,'s',100);
 stepShelves(r,null,100+end);const obstacles=[s.collider],a={x:-3,z:1},b={x:3,z:1};
 assert.ok(movePlayer(a,{x:6,z:0},obstacles,20,.36).x<-.9);
 assert.ok(movePlayer(a,{x:6,z:0},obstacles,20,.48).x<-.9);
 assert.equal(traceTargets(a,b,obstacles,[]),null);
 assert.deepEqual(aimEndpoint(a,{x:1,z:0},6,obstacles),b);
 assert.ok(movePlayer({x:0,z:1},{x:3,z:0},obstacles,20,.36).x>2.9);
});
test('L2 shelves deterministic, near guards, gated, clear, capped, and all objectives remain connected',()=>{
 for(let i=0;i<150;i++){
  const seed='shelf-'+i,a=generateLevel(2,seed),b=generateLevel(2,seed);
  assert.ok(placeSupplyShelves(a,3),seed);assert.ok(placeSupplyShelves(b,3),seed);
  assert.deepEqual(a.shelves,b.shelves);const s=a.shelves[0],f=s.footprint;
  assert.ok(shelfPathsConnected(a,f),seed);
  assert.ok(Math.hypot(a.enemies.find(e=>e.id===s.guardId).x-f.x,a.enemies.find(e=>e.id===s.guardId).z-f.z)<=RULES.shelf.guardRange);
  for(const o of [...a.walls,...a.boxes,...a.doors??[]])assert.ok(Math.abs(f.x-o.x)>=(f.w+o.w)/2+RULES.shelf.clearance-.001||Math.abs(f.z-o.z)>=(f.d+o.d)/2+RULES.shelf.clearance-.001,seed);
  for(const o of [a.start,a.exit,...a.nodes,...a.lootBoxes])assert.ok(Math.abs(f.x-o.x)>=f.w/2+RULES.shelf.objectiveClearance||Math.abs(f.z-o.z)>=f.d/2+RULES.shelf.objectiveClearance,seed);
  for(const room of a.rooms)assert.ok([...a.barrels,...a.hazards,...a.junctions??[],...a.shelves].filter(o=>Math.abs(o.x-room.x)<=room.w/2&&Math.abs(o.z-room.z)<=room.d/2).length<=RULES.interactives.maxPerRoom);
 }
 for(const n of [1,3])assert.equal(placeSupplyShelves(generateLevel(n,'gate'),3),false);
 for(const raids of [0,1,2])assert.equal(placeSupplyShelves(generateLevel(2,'gate'),raids),false);
 assert.equal(placeSupplyShelves(generateLevel(2,'gate'),3,true),false);
 for(const area of ['town','archipelago'])assert.equal(placeSupplyShelves(generateLevel(2,'gate',area),3),false);
});
test('actual L1 exit carries launch progression into L2 placement, FTUE stays excluded',()=>{
 for(const raids of [2,3]){
  const r=createRound('shelf-1',0,undefined,{completedRaids:raids});
  for(const n of r.level.nodes)n.active=true;
  r.level.enemies=[];assert.equal(enterExit(r,r.level.exit,100),'next');
  assert.equal(r.level.shelves.length,raids===3?1:0);
 }
});
test('connectivity proof rejects a footprint sealing the only passage',()=>{
 const l={floors:[{x:0,z:0,w:12,d:2}],walls:[],boxes:[],nodes:[],enemies:[],start:{x:-4,z:0},exit:{x:4,z:0}};
 assert.equal(shelfPathsConnected(l,{x:0,z:0,w:1,d:2}),false);
});
