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
import {softDotTexture} from '../vfx-textures.js?v=2.28.39';

test('extract beam builds a shaded volumetric cylinder, decal and rising particles; quality scales particle count and drops noise',()=>{
  const high=createExtractBeam({quality:'high'}),low=createExtractBeam({quality:'low'});
  assert.ok(high.beam.material.isShaderMaterial,'beam uses a custom ShaderMaterial, not a flat MeshBasicMaterial');
  assert.equal(high.beamMaterial.uniforms.uNoise.value,1,'high quality keeps the scrolling noise bands');
  assert.equal(low.beamMaterial.uniforms.uNoise.value,0,'low quality drops the shader noise');
  assert.ok(low.particleCount<high.particleCount,'low quality has fewer rising particles');
  assert.ok(high.particleCount>=40&&high.particleCount<=80&&low.particleCount>=40&&low.particleCount<=80);
  assert.equal(high.points.geometry.drawRange.count,high.particleCount);
  high.dispose();low.dispose();
});

test('extract beam stays hidden while closed and intensifies with approach progress while open',()=>{
  const fx=createExtractBeam({quality:'high'});
  fx.update(0,false,0);
  assert.equal(fx.beam.visible,false);assert.equal(fx.pad.visible,false);assert.equal(fx.contact.visible,false);assert.equal(fx.points.visible,false);
  fx.update(1,true,0);
  assert.equal(fx.beam.visible,true);
  const lowIntensity=fx.beamMaterial.uniforms.uIntensity.value,padLow=fx.pad.material.opacity;
  fx.update(1.001,true,1);
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
  assert.ok(low.perBurst<high.perBurst);
  assert.ok(high.points.isInstancedMesh);
  assert.equal(high.points.count,high.capacity);
  const before=high.positions;
  high.spawn(1,.5,2,'#3d8bff');
  assert.equal(high.positions,before,'update/spawn reuse the same typed array (pooled, not reallocated)');
  let activeAfterSpawn=0;for(let i=0;i<high.capacity;i++)activeAfterSpawn+=high.alive[i];
  assert.equal(activeAfterSpawn,high.perBurst,'exactly one burst worth of sparkles went active');
  high.dispose();low.dispose();
});

test('loot burst: sparkles launch upward with gravity, then home toward the target, finishing around the target within ~0.7s',()=>{
  const fx=createLootBurstPool({quality:'high'});
  fx.spawn(0,0,0,'#ffd04a');
  fx.update(.05,5,1,0); // early: still in the gravity pop-up phase
  const earlyY=fx.positions[1];
  assert.ok(earlyY>0,'sparkle rises off the ground during the gravity phase');
  for(let i=0;i<12;i++)fx.update(.05,5,1,0);
  fx.update(.03,5,1,0); // t=0.68s: approaching the chest
  const o=0,px=fx.positions[o],py=fx.positions[o+1],pz=fx.positions[o+2];
  assert.ok(Math.abs(px-5)<.12&&Math.abs(py-1)<.2&&Math.abs(pz-0)<.12,`sparkle should have homed to the target, got ${px},${py},${pz}`);
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

import {lintSource} from '../../scripts/hot-alloc-lint.mjs';
import {generateBigLevel,extractAvailable} from '../big-level.js';
import {createRoomVisibility} from '../big-level-culling.js';

test('VFX update, spawn and world integration are allocation guarded',async()=>{
  for(const file of ['vfx-extract-beam.js','vfx-loot-burst.js','world.js']){
    const src=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.deepEqual(lintSource(src,file),[]);
  }
});

test('quality changes reuse buffers, lower counts and remove noise immediately',()=>{
  const fx=createExtractBeam(),loot=createLootBurstPool();
  const buffer=fx.points.geometry.attributes.position.array,matrix=loot.points.instanceMatrix.array;
  loot.spawn(0,.5,0);loot.update(.1,1,1,0);
  fx.setQuality('low');loot.setQuality('low');
  assert.equal(fx.particleCount,40);assert.equal(fx.beamMaterial.uniforms.uNoise.value,0);
  assert.equal(loot.perBurst,12);assert.equal(loot.alive.reduce((a,b)=>a+b,0),0);
  assert.equal(fx.points.geometry.attributes.position.array,buffer);assert.equal(loot.points.instanceMatrix.array,matrix);
  assert.ok(fx.points.material.size>=2,'orthographic point sizes use visible pixel units');
  loot.spawn(3,.5,4);assert.equal(loot.rings[0].mesh.position.y,.045,'flash is on the floor');
  assert.equal(loot.alive.reduce((a,b)=>a+b,0),12);
  for(let i=0;i<20;i++)loot.spawn(0,.5,0);
  assert.equal(loot.alive.reduce((a,b)=>a+b,0),36,'low caps overlapping bursts as well as per-pickup count');
  fx.setQuality('high');loot.setQuality('high');assert.equal(fx.particleCount,72);assert.equal(loot.perBurst,22);
  fx.group.traverse(o=>{if(o.material?.transparent&&o.material.side===THREE.DoubleSide)assert.equal(o.material.forceSinglePass,true);});
  fx.dispose();loot.dispose();
});

test('raid-end VFX disposal is idempotent, detaches effects and does not double-dispose at world teardown',()=>{
  const scene=new THREE.Scene(),w=buildWorld(generateLevel(1,'vfx-end'),scene);
  let events=0;w.lootBurstFx.points.material.addEventListener('dispose',()=>events++);
  w.spawnLootBurst(0,.5,0);w.disposeVfx();w.disposeVfx();
  assert.equal(w.lootBurstFx.group.parent,null);assert.equal(w.extractBeamFx.group.parent,null);
  w.animate(3,{x:0,z:0});w.dispose();w.dispose();assert.equal(events,1);assert.equal(scene.children.length,0);
});

test('all big-level exits follow their own availability, and culling preserves the mobile burst pool',()=>{
  const level=generateBigLevel('vfx-multiple'),scene=new THREE.Scene(),w=buildWorld(level,scene);
  const round={level,over:false,remainingMs:100000,durationMs:300000,keys:[]};
  assert.equal(w.extractionEffects.length,level.extracts.length);
  const cull=createRoomVisibility(level,w);cull(new Set([0]));
  assert.equal(w.lootBurstFx.group.parent,w.group,'pool is never partitioned by its empty origin');
  w.animate(1,level.start,round);
  for(const record of w.extractionEffects)assert.equal(record.fx.isOpen(),extractAvailable(record.point,round));
  w.setVfxQuality('low');for(const record of w.extractionEffects)assert.equal(record.fx.particleCount,40);
  w.dispose();
});


test('extraction layers add height, taper, a core and a repeating floor pulse without reallocating',()=>{
  const fx=createExtractBeam();
  assert.ok(fx.beam.geometry.parameters.radiusBottom>fx.beam.geometry.parameters.radiusTop);
  assert.ok(fx.core.geometry.parameters.radiusBottom<fx.beam.geometry.parameters.radiusTop);
  assert.equal(fx.fence.geometry.parameters.height,.25);
  assert.equal(fx.points.material.depthTest,true);
  assert.ok(fx.points.material.size>=5);
  fx.update(.3,true);const scale=fx.pulseRings[0].scale.x;
  fx.update(1.5,true);assert.ok(Math.abs(fx.pulseRings[0].scale.x-scale)<1e-6);
  const height=fx.core.scale.y;fx.setQuality('low');assert.ok(fx.core.scale.y<height);
  let disposed=0;
  for(const mesh of [fx.core,fx.fence,fx.rim])for(const resource of [mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposed++);
  fx.dispose();fx.dispose();assert.equal(disposed,6);
});


test('pickup fountain clears the loot, retains its origin, and finishes with a pooled chest flash',()=>{
  const fx=createLootBurstPool();fx.spawn(3,.5,4);
  const slot=fx.rings[0];assert.equal(slot.pillar.visible,true);
  assert.equal(slot.pillar.position.x,3);assert.equal(slot.pillar.position.z,4);
  fx.update(.25,3,1,4);
  assert.ok(fx.positions[1]>=1.4,'fountain rises about 1.2m above the pickup');
  let spread=0;for(let i=0;i<fx.perBurst;i++)spread=Math.max(spread,Math.hypot(fx.positions[i*3]-3,fx.positions[i*3+2]-4));
  assert.ok(spread>.8,'arc spreads clear of the player silhouette');
  fx.update(.2,3,1,4);assert.equal(slot.pillar.visible,false);
  assert.ok(slot.mesh.scale.x>2,'shockwave expands at the loot spot');
  fx.update(.2,6,1.3,7);assert.equal(slot.flash.visible,true);
  assert.deepEqual(slot.flash.position.toArray(),[6,1.3,7]);
  fx.update(.15,6,1.3,7);assert.equal(slot.flash.visible,false);assert.equal(slot.active,false);
  fx.spawn(0,.5,0);fx.setQuality('low');assert.ok(fx.rings.every(r=>!r.pillar.visible&&!r.flash.visible));
  let disposed=0;for(const resource of [slot.pillar.geometry,slot.pillar.material,slot.flash.geometry,slot.flash.material])resource.addEventListener('dispose',()=>disposed++);
  fx.dispose();fx.dispose();assert.equal(disposed,4);
});
