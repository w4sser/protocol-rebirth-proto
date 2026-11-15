// PRB-156: extraction-point beam/decal/particles + pooled loot-pickup burst.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {buildWorld} from '../world.js';
import {createExtractBeam} from '../vfx-extract-beam.js';
import {createLootBurstPool} from '../vfx-loot-burst.js';
// Same specifier (incl. the ?v= query) the VFX modules themselves use -- Node's ESM loader caches
// by exact specifier string, so importing the unversioned path here would resolve to a *different*
// module instance (and a second DataTexture) than the one vfx-extract-beam.js/vfx-loot-burst.js share.
import {softDotTexture} from '../vfx-textures.js?v=2.28.32';

test('extract beam builds a shaded volumetric cylinder, decal and rising particles; quality scales particle count and drops noise',()=>{
  const high=createExtractBeam({quality:'high'}),low=createExtractBeam({quality:'low'});
  assert.ok(high.beam.material.isShaderMaterial,'beam uses a custom ShaderMaterial, not a flat MeshBasicMaterial');
  assert.equal(high.beamMaterial.uniforms.uNoise.value,1,'high quality keeps the scrolling noise bands');
  assert.equal(low.beamMaterial.uniforms.uNoise.value,0,'low quality drops the shader noise');
  assert.ok(low.particleCount<high.particleCount,'low quality has fewer rising particles');
  assert.ok(high.particleCount>=40&&high.particleCount<=80&&low.particleCount>=40&&low.particleCount<=80);
  assert.equal(high.points.geometry.attributes.position.count,high.particleCount);
  high.dispose();low.dispose();
});

test('extract beam stays hidden while closed and intensifies with approach progress while open',()=>{
  const fx=createExtractBeam({quality:'high'});
  fx.update(0,{open:false,progress:0});
  assert.equal(fx.beam.visible,false);assert.equal(fx.pad.visible,false);assert.equal(fx.contact.visible,false);assert.equal(fx.points.visible,false);
  fx.update(1,{open:true,progress:0});
  assert.equal(fx.beam.visible,true);
  const lowIntensity=fx.beamMaterial.uniforms.uIntensity.value,padLow=fx.pad.material.opacity;
  fx.update(1.001,{open:true,progress:1});
  assert.ok(fx.beamMaterial.uniforms.uIntensity.value>lowIntensity,'beam brightens as extraction progress rises');
  assert.ok(fx.pad.material.opacity>=padLow,'ground pad brightens too');
  for(let i=0;i<fx.particleCount*3;i++)assert.ok(Number.isFinite(fx.points.geometry.attributes.position.array[i]),'no NaN in particle positions');
  fx.dispose();
});

test('extract beam disposes its own geometries and materials exactly once',()=>{
  const fx=createExtractBeam({quality:'high'});
  const geoms=[fx.beam.geometry,fx.pad.geometry,fx.contact.geometry,fx.points.geometry,...fx.pulseRings.map(r=>r.geometry)];
  const mats=[fx.beamMaterial,fx.pad.material,fx.contact.material,fx.points.material,...fx.pulseRings.map(r=>r.material)];
  let disposed=0;for(const o of [...geoms,...mats])o.addEventListener('dispose',()=>disposed++);
  fx.dispose();
  assert.equal(disposed,geoms.length+mats.length);
});

test('extract beam shares the one procedural soft-dot texture across instances (no per-instance texture)',()=>{
  const a=createExtractBeam({quality:'high'}),b=createExtractBeam({quality:'low'});
  assert.equal(a.pad.material.map,softDotTexture());assert.equal(b.pad.material.map,softDotTexture());
  assert.equal(a.pad.material.map,b.pad.material.map);
  a.dispose();b.dispose();
});

test('loot burst pool: quality scales sparkle capacity; spawn fills a fixed slice of the pool, never growing an array',()=>{
  const high=createLootBurstPool({quality:'high'}),low=createLootBurstPool({quality:'low'});
  assert.ok(low.capacity<high.capacity);
  assert.equal(high.points.geometry.attributes.position.count,high.capacity);
  const before=high.points.geometry.attributes.position.array;
  high.spawn(1,.5,2,'#3d8bff');
  assert.equal(high.points.geometry.attributes.position.array,before,'update/spawn reuse the same typed array (pooled, not reallocated)');
  let activeAfterSpawn=0;for(let i=0;i<high.capacity;i++)activeAfterSpawn+=high.alive[i];
  assert.equal(activeAfterSpawn,high.perBurst,'exactly one burst worth of sparkles went active');
  high.dispose();low.dispose();
});

test('loot burst: sparkles launch upward with gravity, then home toward the target, finishing around the target within ~0.5s',()=>{
  const fx=createLootBurstPool({quality:'high'});
  fx.spawn(0,0,0,'#ffd04a');
  fx.update(.05,5,1,0); // early: still in the gravity pop-up phase
  const earlyY=fx.points.geometry.attributes.position.array[1];
  assert.ok(earlyY>0,'sparkle rises off the ground during the gravity phase');
  for(let i=0;i<9;i++)fx.update(.05,5,1,0); // t=0.5s: still inside the ~0.5s homing window
  const o=0,px=fx.points.geometry.attributes.position.array[o],py=fx.points.geometry.attributes.position.array[o+1],pz=fx.points.geometry.attributes.position.array[o+2];
  assert.ok(Math.abs(px-5)<.1&&Math.abs(py-1)<.1&&Math.abs(pz-0)<.1,`sparkle should have homed to the target, got ${px},${py},${pz}`);
  assert.equal(fx.alive[0],1,'still alive right at the end of its homing window');
  fx.update(.1,5,1,0); // push past the lifetime
  assert.equal(fx.alive[0],0,'sparkle deactivates once its lifetime is over');
  fx.dispose();
});

test('loot burst: a ground flash ring appears at the pickup and fades out, pooled across repeated pickups',()=>{
  const fx=createLootBurstPool({quality:'low'});
  for(let n=0;n<fx.rings.length+2;n++)fx.spawn(n,0,0,'#3ddc6a'); // more bursts than ring slots: must reuse, not throw
  assert.ok(fx.rings.some(r=>r.active));
  for(let i=0;i<30;i++)fx.update(.05,0,0,0);
  assert.ok(fx.rings.every(r=>!r.active),'every flash ring fades out and deactivates');
  fx.dispose();
});

test('loot burst pool disposes its geometries/materials exactly once',()=>{
  const fx=createLootBurstPool({quality:'high'});
  const geoms=[fx.points.geometry,fx.rings[0].mesh.geometry];
  const mats=[fx.points.material,...fx.rings.map(r=>r.mesh.material)];
  let disposed=0;for(const o of [...geoms,...mats])o.addEventListener('dispose',()=>disposed++);
  fx.dispose();
  assert.equal(disposed,geoms.length+mats.length);
});

test('buildWorld wires both VFX modules in: exposes spawnLootBurst, animate(time,playerPos) drives extraction approach and loot homing without throwing, and dispose is clean',()=>{
  const level=generateLevel(1,'vfx3d'),scene=new THREE.Scene(),w=buildWorld(level,scene,{quality:'high'});
  try{
    assert.ok(w.extractBeamFx&&w.lootBurstFx&&typeof w.spawnLootBurst==='function');
    w.animate(0); // no playerPos: back-compat with existing animate(time) call sites/tests
    w.setExit(true);
    w.animate(1,{x:level.exit.x,z:level.exit.z}); // standing in the zone: progress should be high
    assert.ok(w.extractBeamFx.beamMaterial.uniforms.uIntensity.value>.5);
    w.animate(2,{x:level.exit.x+50,z:level.exit.z+50}); // far away: progress decays back down
    assert.ok(w.extractBeamFx.beamMaterial.uniforms.uIntensity.value<.9);
    w.spawnLootBurst(level.exit.x,.5,level.exit.z,'#ffc12e');
    let active=0;for(const a of w.lootBurstFx.alive)active+=a;
    assert.ok(active>0,'spawnLootBurst actually activates pool sparkles');
    w.animate(2.05,{x:level.exit.x,z:level.exit.z});
  }finally{w.dispose();}
});

test('the extraction beam replaces the old flat exitBeam/exitPad cylinder+plane (no regression back to the 2D-reading version)',async()=>{
  const src=await readFile(new URL('../world.js',import.meta.url),'utf8');
  assert.match(src,/createExtractBeam\(/);
  assert.match(src,/createLootBurstPool\(/);
  assert.doesNotMatch(src,/new THREE\.CylinderGeometry\(\.9,\s*1\.1,\s*1,\s*20,\s*1,\s*true\)/,'the old flat exitBeam cylinder must stay removed');
});
