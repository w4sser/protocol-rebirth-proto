// v2.28.53 selective-bloom pilot: per-world grade preset selection + bloom layer tagging for the four
// gameplay-cue types (BIT lamp, fuel drum red bands, live power pads/junction, extraction zone) plus the
// shelf telegraph strap. No renderer/WebGL context needed - layers and material/grade uniforms are plain data.
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {BLOOM_LAYER,tagBloom,GRADE_PRESETS,gradePresetFor,createBloomMask,createPostFX} from '../postfx.js';
import {EffectComposer} from '../vendor/postprocessing/EffectComposer.js';
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
  for(const cue of [extractFx.pad,extractFx.rim,extractFx.fence,extractFx.beam,extractFx.core,extractFx.points,...extractFx.pulseRings])assert.equal(onBloomLayer(cue),true);
  assert.equal(onBloomLayer(extractFx.contact),false,'dark contact decal is not emission');
  const padFill=[];scene.traverse(n=>{if(n.isMesh&&n.geometry?.type==='RingGeometry'&&n.position.x===pad.x&&n.position.z===pad.z&&n.renderOrder===4)padFill.push(n);});
  assert.equal(padFill.length,1);assert.equal(onBloomLayer(padFill[0]),true,'live pad indicator is tagged');

  const shelfVisual=world.shelves.find(s=>s.shelf===shelf);
  assert.equal(onBloomLayer(shelfVisual.strap),true,'the shelf telegraph strap is tagged');

  const padSurface=[];scene.traverse(n=>{if(n.isMesh&&n.geometry?.type==='PlaneGeometry'&&n.position.x===pad.x&&n.position.z===pad.z&&n.position.y===.03)padSurface.push(n);});
  assert.equal(padSurface.length,1);pad.forcedUntil=1000;world.animateHazards(1);
  assert.equal(onBloomLayer(padSurface[0]),true,'energized surface blooms');
  pad.forcedUntil=0;pad.deadUntil=2000;world.animateHazards(1);
  assert.equal(onBloomLayer(padSurface[0]),false,'dead surface stops blooming');

  // Control: an ordinary wall/floor box is never on the bloom layer.
  let untaggedSolid=0,wallCount=0;
  scene.traverse(n=>{if(n.isMesh&&n.geometry?.type==='BoxGeometry'){wallCount++;if(!onBloomLayer(n))untaggedSolid++;}});
  assert(wallCount>0&&untaggedSolid>0,'ordinary boxes exist and most stay off the bloom layer');
});

// WIP regressions: removing walls from the source lost occlusion, fog lit the black background,
// and directly combining the source doubled sharp cue pixels. Exercise the real mask without WebGL.
test('bloom mask keeps walls as black occluders, takes only emission and restores scene on error',()=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color('white');scene.fog=new THREE.Fog('white',1,50);
  const background=scene.background,fog=scene.fog;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'white'}));
  const cue=tagBloom(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'white',emissive:'red',emissiveIntensity:.4})));
  const dust=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial());scene.add(wall,cue,dust);
  const lamp=tagBloom(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'cyan'})),{unlit:true});scene.add(lamp);
  const originals=[wall.material,cue.material],mask=createBloomMask(scene);
  assert.throws(()=>mask.render(()=>{
    assert.equal(wall.visible,true,'wall still writes depth');assert.equal(wall.material.color.getHex(),0);
    assert.equal(wall.material.fog,false);assert.equal(scene.fog,null);assert.equal(scene.background.getHex(),0);
    assert.equal(lamp.material.isMeshBasicMaterial,true);assert.equal(lamp.material.color.g,1,'lamp emits without scene lights');
    assert.equal(cue.material.color.r,.4);assert.equal(cue.material.color.g,0,'white diffuse is excluded');
    assert.equal(dust.visible,false,'ambient particles never bloom');throw Error('render failed');
  }),/render failed/);
  assert.equal(wall.material,originals[0]);assert.equal(cue.material,originals[1]);assert.equal(dust.visible,true);
  assert.equal(scene.background,background);assert.equal(scene.fog,fog);mask.dispose();
});

test('BIT lamp alone is wired as an unlit bloom cue, and combine uses blurred light only',()=>{
  const game=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(game,/tagBloom\(box\(0,\.18,0,\.09,\.09,\.09,'#75cfcc',bitAntenna\),\{unlit:true\}\)/);
  const post=readFileSync(new URL('../postfx.js',import.meta.url),'utf8');
  assert.match(post,/tBloom.value=bloom.renderTargetsHorizontal\[0\].texture/);
  assert.doesNotMatch(post,/tBloom.value=bloomComposer.readBuffer.texture/);
});

test('Medium bloom sizes match DPR-aware resize, and quality replacement frees every added pass',()=>{
  const passes=[],composers=new Set(),add=EffectComposer.prototype.addPass;
  EffectComposer.prototype.addPass=function(pass){passes.push(pass);composers.add(this);return add.call(this,pass);};
  let fx;
  try{fx=createPostFX({renderer:{getPixelRatio:()=>2,getSize:v=>v.set(844,390)},scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),width:844,height:390,bloomTier:'cheap',gradeOn:false});}
  finally{EffectComposer.prototype.addPass=add;}
  const bloom=[...composers].find(c=>!c.renderToScreen);
  assert.equal(bloom.renderTarget1.width,844);assert.equal(bloom.renderTarget1.height,390);
  fx.setSize(667,375);assert.equal(bloom.renderTarget1.width,668);assert.equal(bloom.renderTarget1.height,376);
  let disposed=0;for(const pass of passes){const dispose=pass.dispose.bind(pass);pass.dispose=()=>{disposed++;dispose();};}
  fx.dispose();assert.equal(disposed,passes.length,'composer targets alone do not free pass resources');
});

test('bloom masks retire materials when a level leaves the scene',()=>{
  const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(wall);
  const mask=createBloomMask(scene);let retired=0;
  mask.render(()=>wall.material.addEventListener('dispose',()=>retired++));
  scene.remove(wall);mask.render(()=>{});assert.equal(retired,1,'old level mask freed without a quality switch');
  mask.dispose();assert.equal(retired,1,'retired material is not freed twice');
});
