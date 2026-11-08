import test from 'node:test';import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';import {applyDifficulty} from '../difficulty.js';
test('v2.28.4: DDA extra enemies stand fully on floor and never clone a front shield',()=>{
  for(let n=1;n<=3;n++)for(let s=0;s<40;s++){const L=generateLevel(n,`dda-${s}`,'bunker');applyDifficulty(L,{count:2});
    const on=(x,z)=>L.floors.some(f=>Math.abs(x-f.x)<=f.w/2+.02&&Math.abs(z-f.z)<=f.d/2+.02);
    for(const e of L.enemies.filter(e=>e.extra&&!e.encounter&&e.id.startsWith('enemy-'))){if(!e.health)continue;
      for(const [dx,dz] of [[0,0],[.48,.48],[-.48,.48],[.48,-.48],[-.48,-.48]])assert.ok(on(e.x+dx,e.z+dz),`${n}/${s} ${e.id}`);}
    assert.ok(!L.enemies.some(e=>e.extra&&e.frontShield&&e.encounter===undefined&&e.cloned));}
});
