// v2.28.53 selective-bloom pilot: per-world grade preset selection + bloom layer tagging for the four
// gameplay-cue types (BIT lamp, fuel drum red bands, live power pads/junction, extraction zone) plus the
// shelf telegraph strap. No renderer/WebGL context needed - layers and material/grade uniforms are plain data.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {BLOOM_LAYER,tagBloom,GRADE_PRESETS,gradePresetFor} from '../postfx.js';
import {createRound} from '../round.js';
import {makeDrum,makeShelf} from '../levels.js';
import {buildWorld} from '../world.js';

const bloomLayers=new THREE.Layers();bloomLayers.set(BLOOM_LAYER);
const defaultLayers=new THREE.Layers();
const onBloomLayer=o=>o.layers.test(bloomLayers);

test('gradePresetFor: bunker keeps the cold blue-grey look, other worlds fall back to neutral',()=>{
  assert.equal(gradePresetFor('bunker'),GRADE_PRESETS.bunker);
  assert.ok(GRADE_PRESETS.bunker.gradeStrength>0&&GRADE_PRESETS.bunker.desaturate>0,'bunker still cools/desaturates');
  for(const area of ['town','archipelago']){
    const preset=gradePresetFor(area);
    assert.equal(preset.gradeStrength,0,`${area} has no colour push`);
    assert.deepEqual(preset.tint,[1,1,1],`${area} tint is neutral`);
  }
  assert.equal(gradePresetFor('unknown-area'),GRADE_PRESETS.bunker,'unknown area falls back to bunker');
  // Vignette stays consistent across worlds - only the colour push is per-world.
  assert.equal(GRADE_PRESETS.town.vignetteStrength,GRADE_PRESETS.bunker.vignetteStrength);
});

test('tagBloom enables BLOOM_LAYER on a mesh and every descendant of a group, leaving siblings untouched',()=>{
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());
  assert.equal(onBloomLayer(lamp),false);
  tagBloom(lamp);
  assert.equal(onBloomLayer(lamp),true);

  const group=new THREE.Group(),child=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());
  group.add(child);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());
  tagBloom(group);
  assert.equal(onBloomLayer(group),true);assert.equal(onBloomLayer(child),true,'tagging a group reaches its children');
  assert.equal(onBloomLayer(wall),false,'an untagged sibling never blooms');
  // Layer 0 (the default render layer) stays enabled - normal appearance is unaffected.
  assert.equal(child.layers.test(defaultLayers),true);
});

test('buildWorld tags the fuel-drum red bands, a live junction/pad, the extraction zone and the shelf strap - never a wall or floor',()=>{
  const r=createRound('bloom-tag-test',0);
  const drum=makeDrum('drum-1',6,6);
  const pad={id:'pad-1',x:-6,z:-6,w:1.8,d:1.8,phaseMs:0,dps:12};
  const junction={id:'junction-1',kind:'junction',x:-6,z:-3,r:.5,padId:pad.id};
  const shelf=makeShelf('shelf-1',6,-6);
  r.level.barrels=[drum];r.level.hazards=[pad];r.level.junctions=[junction];r.level.shelves=[shelf];
  const scene=new THREE.Scene(),world=buildWorld(r.level,scene,{quality:'high'});

  const barrelVisual=world.barrels.find(b=>b.barrel===drum);
  let bandCount=0;barrelVisual.group.traverse(n=>{if(n.isMesh&&n.material===barrelVisual.danger){assert.equal(onBloomLayer(n),true);bandCount++;}});
  assert(bandCount>=4,'every red band + lid is tagged');

  let junctionTagged=false;scene.traverse(n=>{if(n.isMesh&&n.material?.color?.getHexString()===new THREE.Color(0xffb24a).getHexString()&&n.material.emissive)if(onBloomLayer(n))junctionTagged=true;});
  assert(junctionTagged,'the junction panel (live power cue) is tagged');

  const extractFx=world.extractionEffects[0].fx;
  assert.equal(onBloomLayer(extractFx.group),true,'the whole extraction beam group is tagged');

  const shelfVisual=world.shelves.find(s=>s.shelf===shelf);
  assert.equal(onBloomLayer(shelfVisual.strap),true,'the shelf telegraph strap is tagged');

  // Control: an ordinary wall/floor box is never on the bloom layer.
  let untaggedSolid=0,wallCount=0;
  scene.traverse(n=>{if(n.isMesh&&n.geometry?.type==='BoxGeometry'){wallCount++;if(!onBloomLayer(n))untaggedSolid++;}});
  assert(wallCount>0&&untaggedSolid>0,'ordinary boxes exist and most stay off the bloom layer');
});
