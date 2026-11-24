import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,initEquip,takeDamage,tickRound,activateNode,enterExit,collectLoot,detonateDrum} from '../round.js?v=2.28.75';
import {FTUE,ftueAssist,initFtueRound} from '../ftue.js?v=2.28.75';
import {applyIntroEncounter} from '../progression-goal.js?v=2.28.75';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js?v=2.28.75';
import {traceTargets} from '../physics.mjs?v=2.28.75';
const seeds=['ftue','alpha','beta','gamma','delta','one','two','three','four','five'];
const goal={parts:[{id:'scrap_alloy',kind:'item',need:2,secured:0}]};
function setup(seed='ftue',attempts=0,intro=true){
  const r=createRound(seed,0);
  if(intro)applyIntroEncounter(r.level,goal);
  initFtueRound(r,{ftue:true},{getItem:()=>JSON.stringify({attempts})});
  initEquip(r,{weapon:'basic_carbine',gear:[]});
  return r;
}
const solids=r=>[...r.level.walls,...r.level.boxes,...r.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
test('across seeds, the player has a calm approach to a lone enemy and a distant explosive pair',()=>{
  for(const seed of seeds)for(const intro of [false,true]){
    const r=setup(seed,0,intro),p=r.level.start,group=r.level.enemies.slice(1),barrel=r.level.barrels[0];
    assert.equal(r.level.enemies.length,3);
    assert.ok(barrel&&!barrel.active);
    assert.equal(r.level.encounters.length,0);
    assert.equal(r.level.spawners.length,0);
    assert.ok(r.level.enemies.every(e=>e.active&&!e.aggro));
    assert.ok(Math.hypot(r.level.enemies[0].x-p.x,r.level.enemies[0].z-p.z)>5);
    assert.ok(group.every(e=>Math.hypot(e.x-p.x,e.z-p.z)>7));
    assert.ok(group.every(e=>Math.hypot(e.x-barrel.x,e.z-barrel.z)<barrel.blastRadius));
    assert.notEqual(traceTargets(p,r.level.enemies[0],solids(r),[])?.kind,'wall');
  }
});
test('ordinary Basic Carbine shots can kill the first unaware grunt',()=>{
  for(const seed of seeds){
    const r=setup(seed),e=r.level.enemies[0],w=createWeapon(),p=r.level.start;
    assert.ok(fireAimedWeapon(w,r,p,{x:e.x-p.x,z:e.z-p.z},100,solids(r)),seed);
    stepWeapon(w,r,300,.4,solids(r));
    assert.equal(e.health,0,seed);
    assert.equal(r.enemiesDefeated,1);
  }
});
test('the barrel is hittable by a real bullet, killing the grouped enemies',()=>{
  const r=setup('barrel-hit'),w=createWeapon(),barrel=r.level.barrels[0];
  const p={x:r.level.rooms[0].x,z:r.level.rooms[0].z+.8};
  assert.ok(fireAimedWeapon(w,r,p,{x:barrel.x-p.x,z:barrel.z-p.z},100,solids(r)));
  assert.ok(stepWeapon(w,r,350,.4,solids(r)));
  assert.equal(barrel.active,true);
  assert.equal(r.enemiesDefeated,2);
  assert.equal(r.drumExplosion.kills,2);
  assert.equal(r.level.enemies[0].health,1);
});
test('the drum applies radial knockback, with one detonation and two credited kills',()=>{
  const r=setup('knockback'),b=r.level.barrels[0],group=r.level.enemies.slice(1),distance=group.map(e=>Math.hypot(e.x-b.x,e.z-b.z));
  assert.equal(detonateDrum(r,b.id,100,solids(r)),true);
  assert.deepEqual(group.map(e=>e.health),[0,0]);
  assert.ok(group.every((e,i)=>Math.hypot(e.x-b.x,e.z-b.z)>distance[i]),'outward pushback regardless of mirrored room side');
  assert.equal(r.enemiesDefeated,2);
  assert.equal(detonateDrum(r,b.id,200,solids(r)),false);
  assert.equal(r.drumExplosion.serial,1);
  assert.equal(r.enemiesDefeated,2);
});
test('player can ignore the barrel and take real materials to extraction',()=>{
  const r=setup('supplies');
  assert.equal(r.level.lootBoxes[0].item,'scrap_alloy');
  assert.equal(r.level.lootBoxes[0].quantity,2);
  assert.equal(r.level.lootBoxes[1].item,'cable');
  for(const box of r.level.lootBoxes){
    const units=box.quantity??1;
    for(let i=0;i<units;i++)collectLoot(r,{x:box.x,z:box.z},100+i*10);
  }
  assert.ok(r.bag.scrap_alloy>=2);
  activateNode(r,r.level.nodes[0].id,300);
  assert.equal(enterExit(r,r.level.exit,301),'complete');
  assert.ok(r.extracted.scrap_alloy>=2);
});
test('failure assists remain FTUE-only, while ordinary raids are unchanged',()=>{
  for(const attempts of [0,1,2,3,100]){
    const r=setup('retry-'+attempts,attempts),cfg=ftueAssist(attempts);
    assert.equal(r.ftue,cfg);
    assert.equal(r.level.enemies[0].health,Math.max(1,FTUE.opening.soloHealth*cfg.healthMul));
    takeDamage(r,20,10);
    assert.equal(r.health,100-20*cfg.damageMul);
  }
  const protectedRound=setup('protected',2);protectedRound.bag.scrap_alloy=2;
  takeDamage(protectedRound,1e9,protectedRound.deadline+100);
  assert.equal(protectedRound.over,false);
  assert.equal(protectedRound.health,1);
  assert.equal(protectedRound.bag.scrap_alloy,2);
  tickRound(protectedRound,protectedRound.deadline+1000);
  assert.ok(protectedRound.remainingMs>0);
  const regular=createRound('regular',0),before=JSON.stringify(regular);
  initFtueRound(regular,{ftue:false},{getItem(){throw Error('non-FTUE storage read');}});
  assert.equal(JSON.stringify(regular),before);
});
