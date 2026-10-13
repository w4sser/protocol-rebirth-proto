import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';
import {generateLevel,RULES} from '../levels.js';import {buildWorld} from '../world.js';import {glow} from '../art.js';
import {createRound,collectLoot,swapLoot,enterExit,exitIsOpen} from '../round.js';
test('building and disposing worlds over many levels leaves the scene clean and keeps shared materials alive',()=>{
  const scene=new THREE.Scene(),shared=glow('#ffffff');let disposedShared=0;shared.addEventListener('dispose',()=>disposedShared++);
  const base=scene.children.length;let owned=0;
  for(let raid=0;raid<3;raid++)for(const n of [1,2,3]){const w=buildWorld(generateLevel(n,'stab'+raid),scene,{quality:'high'});
    assert.equal(scene.children.length,base+1);const mats=new Set();w.group.traverse(o=>{if(o.material&&!o.material.userData.shared)mats.add(o.material);});
    let d=0;for(const m of mats)m.addEventListener('dispose',()=>d++);w.burst?.(0,0);w.dispose();owned+=mats.size;assert.equal(d,mats.size,'every owned material disposed');assert.equal(scene.children.length,base);}
  assert.equal(disposedShared,0);assert.ok(owned>0);
});
test('full bag signals once per approach and swap drops a revealed item on the ground',()=>{
  const r=createRound('bagfull',0);for(const id of ['cable','fuse','servo','fuse'])r.bag[id]++;
  const box=r.level.lootBoxes.find(b=>b.item!=='ammo_pack');assert.ok(box);
  assert.equal(collectLoot(r,{x:box.x,z:box.z},1,null),true);assert.equal(r.bagFull.boxId,box.id);assert.equal(box.collected,false);
  r.bagFull=null;collectLoot(r,{x:box.x,z:box.z},2,null);assert.equal(r.bagFull,null,'no repeat while standing');
  collectLoot(r,{x:box.x+20,z:box.z+20},3,null);collectLoot(r,{x:box.x,z:box.z},4,null);assert.equal(r.bagFull?.boxId,box.id,'re-arms after leaving');
  const drop=['cable','fuse','servo'].find(i=>i!==box.item),before=r.bag[drop],n=r.level.lootBoxes.length,d=swapLoot(r,box.id,drop,5);
  assert.ok(d);assert.equal(d.item,drop);assert.equal(d.revealed,true);assert.equal(d.blockedUntilLeft,true);assert.equal(r.level.lootBoxes.length,n+1);
  assert.equal(box.collected,true);assert.equal(r.bag[drop],before-1);assert.equal(Object.values(r.bag).reduce((a,b)=>a+b,0),RULES.loot.capacity);
  assert.equal(swapLoot(r,box.id,'fuse',6),null,'cannot swap twice');
});
