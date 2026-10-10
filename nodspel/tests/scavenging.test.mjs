import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeapon} from '../weapon.js';
import {createRound,takeDamage,stepNodeInteraction} from '../round.js';
const api=await import('../scavenging.js').catch(()=>({}));
const cover=[{x:0,z:2,w:3,d:.4}],position={x:0,z:4};
function setup(){const round=createRound('scavenge',0);round.level.enemies=[{id:'enemy',kind:'enemy',x:0,z:0,r:.48,health:2,active:true}];return {round,weapon:createWeapon(0)};}
test('eight seconds in cover restores three rounds without kills or reserve',()=>{
  assert.equal(typeof api.stepScavenging,'function');const {round,weapon}=setup();
  api.stepScavenging(weapon,round,position,0,cover);
  api.stepScavenging(weapon,round,position,4000,cover);assert.equal(weapon.scavenging.progress,.5);assert.equal(weapon.ammo,0);
  assert.equal(api.stepScavenging(weapon,round,position,8000,cover),true);
  assert.equal(weapon.ammo,3);assert.equal(weapon.reserve,0);assert.equal(round.enemiesDefeated,0);assert.equal(round.over,false);
});
test('motion and taking damage each reset all scavenging progress',()=>{
  assert.equal(typeof api.stepScavenging,'function');const {round,weapon}=setup();
  api.stepScavenging(weapon,round,position,0,cover);api.stepScavenging(weapon,round,position,4000,cover);
  api.stepScavenging(weapon,round,{x:.1,z:4},4100,cover);assert.equal(weapon.scavenging,null);
  api.stepScavenging(weapon,round,position,4200,cover);takeDamage(round,20,5000);
  api.stepScavenging(weapon,round,position,5000,cover);assert.equal(weapon.scavenging,null);
  api.stepScavenging(weapon,round,position,5100,cover);assert.equal(weapon.scavenging.progress,0);
  api.stepScavenging(weapon,round,position,7000,cover,{moving:true});assert.equal(weapon.scavenging,null);
});
test('open enemy firing lines prevent recovery even next to cover',()=>{
  assert.equal(typeof api.stepScavenging,'function');const {round,weapon}=setup();
  const sideCover=[{x:1.5,z:4,w:.4,d:2}];
  api.stepScavenging(weapon,round,position,0,sideCover);api.stepScavenging(weapon,round,position,8000,sideCover);
  assert.equal(weapon.ammo,0);assert.equal(weapon.scavenging,null);
  round.level.enemies[0].x=3;
  api.stepScavenging(weapon,round,position,9000,cover);assert.ok(weapon.scavenging);
  round.level.enemies[0].x=5;
  api.stepScavenging(weapon,round,position,10000,cover);assert.equal(weapon.scavenging,null);
});
test('no cover, reserve ammunition, full magazine and ended rounds do not scavenge',()=>{
  assert.equal(typeof api.stepScavenging,'function');const {round,weapon}=setup();
  round.level.enemies=[];api.stepScavenging(weapon,round,position,0,[]);assert.equal(weapon.scavenging,null);
  weapon.reserve=1;api.stepScavenging(weapon,round,position,1,cover);assert.equal(weapon.scavenging,null);
  weapon.reserve=0;weapon.ammo=3;api.stepScavenging(weapon,round,position,2,cover);assert.equal(weapon.scavenging,null);
  weapon.ammo=0;round.over=true;api.stepScavenging(weapon,round,position,3,cover);assert.equal(weapon.scavenging,null);
});
test('node proximity activation still takes two seconds with an empty weapon',()=>{
  const {round,weapon}=setup(),n=round.level.nodes[0],p={x:n.x,z:n.z+1.2};
  stepNodeInteraction(round,weapon,p,0,[]);assert.equal(stepNodeInteraction(round,weapon,p,2000,[]),true);
  assert.equal(weapon.ammo,0);assert.equal(n.active,true);
});
