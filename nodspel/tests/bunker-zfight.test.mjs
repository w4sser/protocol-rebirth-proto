import test from 'node:test';import assert from 'node:assert/strict';
import {generateLevel,setArea} from '../levels.js';import {propSpots,rngFrom} from '../art.js';
import {planKitProps,footprint,LAYER} from '../bunker.js';
const ov=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2;
test('bunker kit props never intersect walls, cover or each other (no coplanar z-fighting)',()=>{setArea('bunker');
  for(const seed of ['834f4b0a-meta','art','a','b','c','d'])for(const n of [1,2,3]){const L=generateLevel(n,seed),prng=rngFrom(`${L.seed}:props`);
    const spots=propSpots(L,prng,Math.round(L.floors.reduce((a,f)=>a+f.w*f.d,0)/24)),P=planKitProps(L,spots,prng);
    for(const p of P){for(const b of [...L.walls,...L.boxes])assert.ok(!ov(p.f,b),`${seed} L${n} ${p.kind} vs solid`);
      for(const q of P)if(q!==p)assert.ok(!ov(p.f,q.f),`${seed} L${n} ${p.kind} vs ${q.kind}`);
      assert.deepEqual(p.f,footprint(p.kind,p.x,p.z,p.ry));}}});
test('bunker layers are strictly separated',()=>{assert.ok(-.1<0&&0<LAYER.decal&&LAYER.decal<LAYER.padTop&&LAYER.padTop<.03&&LAYER.floorStep>=.003);});
import {planWalls,TALL_PROP,BUNKER_DIMS} from '../bunker.js';
const lv=()=>{const o=[];for(const seed of ['834f4b0a-meta','art','a','b','c','d','e','f'])for(const n of [1,2,3])o.push([seed,n,generateLevel(n,seed)]);return o;};
test('every kit wall segment lies inside its collision wall and the segments cover it (no phantom walls)',()=>{setArea('bunker');
  for(const [seed,n,L] of lv()){const segs=planWalls(L);
    for(const s of segs){const w=L.walls[s.wall];assert.ok(Math.abs(s.rect.x-w.x)<=w.w/2-s.rect.w/2+1e-6&&Math.abs(s.rect.z-w.z)<=w.d/2-s.rect.d/2+1e-6,`${seed} L${n} segment outside wall ${s.wall}`);
      assert.ok(Math.abs(s.rect.h-w.h)<.1);
      for(const f of L.floors.filter(f=>Math.min(f.w,f.d)<4.5)){/* corridor walls only on the corridor edge, never across it */
        const across=Math.abs(s.rect.x-f.x)<f.w/2-.5&&Math.abs(s.rect.z-f.z)<f.d/2-.5;assert.ok(!across,`${seed} L${n} wall inside corridor`);}}
    L.walls.forEach((w,i)=>{const a=segs.filter(s=>s.wall===i).reduce((t,s)=>t+s.rect.w*s.rect.d,0);assert.ok(a>=w.w*w.d*.97,`${seed} L${n} wall ${i} not covered`);});}});
test('tall props (read as walls) always stand flush against a wall, never free in a room or corridor',()=>{
  for(const [seed,n,L] of lv()){const prng=rngFrom(`${L.seed}:props`),spots=propSpots(L,prng,Math.round(L.floors.reduce((a,f)=>a+f.w*f.d,0)/24));
    for(const p of planKitProps(L,spots,prng)){if(BUNKER_DIMS[p.kind][1]<=TALL_PROP)continue;
      assert.ok(L.walls.some(w=>ov({...p.f,w:p.f.w+.2,d:p.f.d+.2},w)),`${seed} L${n} ${p.kind} free-standing`);}}});
