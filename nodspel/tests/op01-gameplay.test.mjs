import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {createOP01GameplayOperator,createOP01FacingLatch,OP01_CHARACTER,OP01_RIM_STRENGTHS} from '../op01-gameplay.js';
import {createOP01DeployGrip} from '../../ui/raid-prep-op01.mjs';

async function parse(name){
  // Node has no image decoder. Preserve the actual GLB geometry, skin and
  // animation bytes while removing only texture bindings in this test fixture.
  // Browser/production GLBs are never modified.
  const bytes=await readFile(new URL('../../assets/operators/'+name,import.meta.url));
  const jsonLength=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  json.materials=(json.materials||[]).map(m=>({
    name:m.name,
    pbrMetallicRoughness:{baseColorFactor:[.5,.5,.5,1],metallicFactor:0,roughnessFactor:1}
  }));
  const encoded=Buffer.from(JSON.stringify(json));
  assert(encoded.length<=jsonLength,'stripping texture bindings must fit the original GLB JSON chunk');
  const prepared=Buffer.from(bytes);
  prepared.fill(0x20,20,20+jsonLength);
  encoded.copy(prepared,20);
  return new GLTFLoader().parseAsync(prepared.buffer.slice(prepared.byteOffset,prepared.byteOffset+prepared.byteLength),'');
}
test('authored OP01 has weapon, 41-bone rig and all gameplay actions',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const operator=createOP01GameplayOperator(gltf,{dashDuration:.55});
  assert.equal(operator.character.id,'op01');
  assert.equal(operator.muzzle.name,'muzzle');
  assert.equal(operator.muzzle.parent,operator.weapon);
  assert.equal(operator.weapon.userData.name||operator.weapon.name,'OP01_Carbine');
  assert.equal(operator.model.getObjectByName('OP01_Rig')?.name,'OP01_Rig');
  assert.equal(operator.currentLOD(),0);
  for(const name of ['idle','run','aim','shoot','hit','dash','death','hero_pose']){
    assert(operator.actions.lower[name],name+' lower animation missing');
    assert(operator.actions.upper[name],name+' upper animation missing');
  }
  assert.equal(operator.update(.05,{moving:true,aiming:true,walkYaw:.3,aimYaw:1}),'run');
  assert(operator.actions.lower.run.isRunning());
  assert(operator.actions.upper.aim.isRunning());
  operator.shoot();
  assert.equal(operator.update(.05,{moving:true,aiming:true,walkYaw:.3,aimYaw:1}),'shoot');
  assert(operator.actions.upper.shoot.isRunning());
  operator.hit();
  assert.equal(operator.update(.05,{moving:true,aiming:true,walkYaw:.3,aimYaw:1}),'hit');
  assert(operator.actions.lower.run.isRunning(),'movement legs must continue during a hit');
  operator.reset();
  assert.equal(operator.update(.05,{dashing:true}),'dash');
  assert(operator.actions.lower.dash.isRunning());
  assert(operator.actions.upper.dash.isRunning());
  assert.equal(operator.update(.1,{dead:true}),'death');
  assert.equal(operator.actions.lower.death.loop,THREE.LoopOnce);
  const muzzle=operator.muzzle.getWorldPosition(new THREE.Vector3());
  assert(muzzle.toArray().every(Number.isFinite),'weapon muzzle position must stay finite');
  operator.reset();
  assert.equal(operator.update(.1,{}),'idle');
});
test('all four OP01 skinned material parts switch together using one skeleton',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const op=createOP01GameplayOperator(gltf);
  const parts=[];op.model.traverse(n=>{if(n.isSkinnedMesh&&n.name!=='OP01-occlusion-outline')parts.push(n);});
  assert.equal(parts.length,4,'skinned character has four GLB material primitives');
  const original=parts.map(n=>n.geometry);
  const loader={loadAsync:async url=>parse(new URL(url).pathname.split('/').at(-1))};
  const ready=await op.preloadLODs(loader);
  assert.deepEqual(ready,[0,1,2]);
  assert(op.setLOD(1),'LOD1 should load on the existing skeleton');
  assert.equal(op.currentLOD(),1);
  assert(parts.every((n,i)=>n.geometry!==original[i]),'all four skinned materials switch');
  assert(op.setLOD(2),'LOD2 should load');
  assert.equal(op.root.userData.lod,2);
  op.update(.05,{moving:true});
  assert(op.actions.lower.run.isRunning(),'LOD switching does not restart animation');
  assert(op.setLOD(0),'LOD0 should be restorable');
  assert(parts.every((n,i)=>n.geometry===original[i]),'source LOD0 geometry is preserved');
  const farCamera=new THREE.PerspectiveCamera(42,844/390,.1,50);
  farCamera.position.set(0,8,14);farCamera.lookAt(0,1,0);
  farCamera.updateMatrixWorld(true);
  op.updateLOD(farCamera,390);
  assert(op.currentLOD()===1||op.currentLOD()===2,'projected small character must choose a cheaper loaded LOD');
});
test('OP01 size experiment scales presentation only and is reversible',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const op=createOP01GameplayOperator(gltf);
  const base=op.root.scale.x;
  assert.equal(base,1.10);
  assert.equal(op.root.userData.operatorScalePercent,100);
  for(const percent of [120,135,150,100]){
    assert.equal(op.setVisualScalePercent(percent),true);
    assert(Math.abs(op.root.scale.x-base*percent/100)<1e-10);
    assert.equal(op.poseDiagnostics().scaleVariantPercent,percent);
    op.update(.05,{moving:true,aiming:true,walkYaw:.2,aimYaw:1});
    assert(op.muzzle.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
  }
  for(const invalid of [0,90,115,200,NaN,Infinity,'invalid']){
    assert.equal(op.setVisualScalePercent(invalid),false);
    assert.equal(op.root.userData.operatorScalePercent,100);
  }
  assert.equal(op.root.scale.x,base,'baseline is restored without loading another skin');
});

test('OP01 live rim strength is a shared shader uniform across LODs, not added geometry',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const op=createOP01GameplayOperator(gltf);
  const parts=[];op.model.traverse(n=>{
    if(n.isSkinnedMesh&&n.name!=='OP01-occlusion-outline')parts.push(n);
  });
  assert.deepEqual([...OP01_RIM_STRENGTHS],[.16,.24,.32]);
  assert.equal(op.root.userData.op01RimStrength,.16);
  const initialChildren=op.model.children.length;
  function compileRim(material){
    assert.equal(typeof material.onBeforeCompile,'function');
    const shader={
      uniforms:{},
      vertexShader:'#include <common>\n#include <project_vertex>',
      fragmentShader:'#include <common>\n#include <dithering_fragment>'
    };
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader,/uniform float op01RimStrength;/);
    assert.match(shader.fragmentShader,/op01RimColor\*op01Edge\*op01RimStrength/);
    assert.equal(shader.uniforms.op01RimColor.value.getHexString(),'b6c4ca');
    return shader.uniforms.op01RimStrength;
  }
  const uniforms=parts.map(part=>compileRim(part.material));
  assert(uniforms.every(u=>u===uniforms[0]),'all four body materials share one live uniform');
  for(const strength of [.24,.32,.16]){
    assert.equal(op.setRimStrength(strength),true);
    assert.equal(op.poseDiagnostics().rimStrength,strength);
    assert(uniforms.every(u=>u.value===strength),'compiled shader uniforms update without recompilation');
  }
  for(const invalid of [-1,0,.20,1,NaN,Infinity,'invalid']){
    assert.equal(op.setRimStrength(invalid),false);
    assert.equal(op.root.userData.op01RimStrength,.16);
  }
  assert.equal(op.model.children.length,initialChildren,'rim does not add geometry or render passes');
  const loader={loadAsync:async url=>parse(new URL(url).pathname.split('/').at(-1))};
  await op.preloadLODs(loader);
  op.setRimStrength(.32);
  assert(op.setLOD(1));
  const lod1=parts.map(part=>compileRim(part.material));
  assert(lod1.every(u=>u===uniforms[0]&&u.value===.32),
    'streamed LOD1 materials inherit the active rim uniform');
  assert(op.setLOD(2));
  assert(parts.every(part=>compileRim(part.material)===uniforms[0]),
    'streamed LOD2 materials use the same uniform');
  assert(op.setLOD(0));
  op.setRimStrength(.16);
  assert.equal(uniforms[0].value,.16,'baseline rim restores after LOD switches');
});

test('OP01 presentation does not modify core movement, collision or weapon rules',()=>{
  const keys=['radius','speed','damage','hitbox','dashCooldownMs','fireRate'];
  for(const key of keys)assert(!Object.hasOwn(OP01_CHARACTER,key),
    'character art should not introduce a game mechanic '+key);
  assert.equal(OP01_CHARACTER.height,1.78,'authored asset remains 1.78m');
  assert.equal(OP01_CHARACTER.scale,1.10,'gameplay silhouette is ten percent larger');
  assert.equal(OP01_CHARACTER.weapon.muzzle,'muzzle');
});

test('diagnostic: locate the authored hero-posed wrists and weapon forward axis',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const scene=gltf.scene,mixer=new THREE.AnimationMixer(scene);
  const named=name=>{
    let value=null;
    scene.traverse(n=>{if(!value&&(n.name===name||n.userData?.name===name))value=n;});
    return value;
  };
  const getPosition=name=>named(name)?.getWorldPosition(new THREE.Vector3()).toArray().map(n=>+n.toFixed(3));
  const weapon=named('OP01_Carbine');
  for(const state of ['hero_pose','aim','idle']){
    mixer.stopAllAction();
    const clip=gltf.animations.find(c=>c.name===state);
    const action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.play();mixer.update(clip.duration+(state==='hero_pose'?.0001:0));
    scene.updateMatrixWorld(true);
    const forward=new THREE.Vector3(0,0,-1).transformDirection(weapon.matrixWorld);
    console.log('OP01_RIG_DIAG '+JSON.stringify({
      state,clipDuration:+clip.duration.toFixed(3),
      rightHand:getPosition('mixamorig:RightHand'),
      leftHand:getPosition('mixamorig:LeftHand'),
      leftArm:getPosition('mixamorig:LeftArm'),
      leftForeArm:getPosition('mixamorig:LeftForeArm'),
      weapon:weapon.getWorldPosition(new THREE.Vector3()).toArray().map(n=>+n.toFixed(3)),
      forward:forward.toArray().map(n=>+n.toFixed(3))
    }));
  }
  assert(weapon,'weapon exists');
});

test('Deploy uses anchored lower body with a fixed upper-body rifle grip',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const pose=createOP01DeployGrip(gltf);
  assert(pose.upperTracks>=10,'both animated shoulders and hands use the aim clip');
  assert(pose.lowerTracks>=2,'standing legs retain the hero pose');
  assert(pose.grip.paused && pose.stand.paused,'Deploy pose must not drift when idle');
  const byName=name=>{
    let found=null;
    gltf.scene.traverse(n=>{if(!found&&(n.name===name||n.userData?.name===name))found=n;});
    return found;
  };
  gltf.scene.updateMatrixWorld(true);
  const gun=byName('OP01_Carbine'),left=byName('mixamorig:LeftHand'),right=byName('mixamorig:RightHand');
  assert(gun && left && right);
  const origin=gun.getWorldPosition(new THREE.Vector3());
  const leftWorld=left.getWorldPosition(new THREE.Vector3());
  const rightWorld=right.getWorldPosition(new THREE.Vector3());
  const aimDir=new THREE.Vector3(0,0,-1).transformDirection(gun.matrixWorld);
  const reach=[0,-.15,-.3,-.45,-.6].map(z=>leftWorld.distanceTo(gun.localToWorld(new THREE.Vector3(0,0,z))));
  // Inspect the ACTUAL gun geometry: the GLB local -Z is an assumed shot
  // axis and cannot prove that the visible rifle is held horizontally.
  const physicalBounds=new THREE.Box3().setFromObject(gun).getSize(new THREE.Vector3());
  let surfaceGap=Infinity;
  const p=new THREE.Vector3();
  gun.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);
      surfaceGap=Math.min(surfaceGap,p.distanceTo(leftWorld));
    }
  });
  console.log('OP01_DEPLOY_GRIP '+JSON.stringify({
    barrelVerticality:+Math.abs(aimDir.y).toFixed(3),
    leftGripGap:+Math.min(...reach).toFixed(3),
    rightSocketGap:+rightWorld.distanceTo(origin).toFixed(3),
    leftHandToGunSurface:+surfaceGap.toFixed(3),
    physicalGunExtent:physicalBounds.toArray().map(n=>+n.toFixed(3)),
    upperTracks:pose.upperTracks,lowerTracks:pose.lowerTracks
  }));
  assert(Math.abs(aimDir.y)<.45,'Deploy rifle must be near horizontal, not held vertically');
  assert(Math.max(physicalBounds.x,physicalBounds.z)>physicalBounds.y*1.1,
    'visible carbine mesh must be more horizontal than vertical in Deploy');
  assert(surfaceGap<.16,'support hand must reach the actual rifle geometry, not just an assumed local axis');
  assert(Math.min(...reach)<.14,'off-hand must rest on the rifle foregrip, not float in front of the chest');
  assert(rightWorld.distanceTo(origin)<.15,'trigger hand must remain at the rifle socket');
});

test('OP01 real rifle follows world aim at all strafing angles with a two-hand grip',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const op=createOP01GameplayOperator(gltf);
  const holder=new THREE.Group();holder.add(op.root);
  const hand=(()=>{let h=null;op.root.traverse(n=>{if(!h&&(n.name==='mixamorig:LeftHand'||n.userData?.name==='mixamorig:LeftHand'))h=n;});return h;})();
  assert(hand,'animated left hand exists');
  const muzzle=new THREE.Vector3(),gunOrigin=new THREE.Vector3(),left=new THREE.Vector3();
  for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]){
    op.reset();holder.rotation.y=yaw;
    for(let i=0;i<20;i++)op.update(1/60,{moving:true,aiming:true,walkYaw:0,aimYaw:yaw});
    op.root.updateMatrixWorld(true);
    op.muzzle.getWorldPosition(muzzle);op.weapon.getWorldPosition(gunOrigin);hand.getWorldPosition(left);
    const shotVector=muzzle.clone().sub(gunOrigin).setY(0).normalize();
    const desired=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    assert(shotVector.dot(desired)>.96,`OP01 barrel must face aim yaw ${yaw.toFixed(2)} while strafing`);
    const localLeft=op.weapon.worldToLocal(left.clone());
    assert(localLeft.z<-.05&&localLeft.z>-.62,'off-hand should be forward on the gun');
    assert(Math.abs(localLeft.x)<.16&&Math.abs(localLeft.y)<.25,'off-hand cannot float away from the rifle');
  }
});

test('OP01 backward locomotion reverses the leg animation without rewinding the upper body',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const op=createOP01GameplayOperator(gltf,{dashDuration:.55});
  const holder=new THREE.Group();holder.add(op.root);holder.rotation.y=Math.PI;
  for(let i=0;i<12;i++)op.update(1/60,{moving:true,aiming:true,walkYaw:0,aimYaw:Math.PI});
  assert(op.actions.lower.back.isRunning(),'backpedaling uses the authored run clip in reverse');
  assert(op.actions.lower.back.getEffectiveTimeScale()<0,'leg animation reverses while retreating');
  assert(op.actions.upper.aim.isRunning(),'upper-body aim continues during retreat');
  op.shoot();op.update(.04,{moving:true,aiming:true,walkYaw:0,aimYaw:Math.PI});
  assert(op.actions.upper.shoot.isRunning(),'shooting while retreating keeps weapon animation');
  assert(op.actions.lower.back.isRunning(),'shooting does not steal the backward-running legs');
  op.update(.04,{dashing:true});
  assert(op.actions.lower.dash.isRunning()&&op.actions.upper.dash.isRunning());
  const authoredDashSeconds=gltf.animations.find(c=>c.name==='dash').duration;
  assert(Math.abs(op.actions.lower.dash.getEffectiveTimeScale()-authoredDashSeconds/.55)<.01,
    'dash animation speed must follow actual gameplay dash duration');
  op.update(.04,{dead:true});
  assert(op.actions.lower.death.isRunning()&&op.actions.upper.death.isRunning());
});

test('OP01 repeated hits restart both affected animation layers',async()=>{
  const op=createOP01GameplayOperator(await parse('OP01_Game_LOD0.glb'));
  op.hit();op.update(.06,{});
  assert(op.actions.lower.hit.isRunning()&&op.actions.upper.hit.isRunning());
  const before=op.actions.upper.hit.time;assert(before>0);
  op.hit();
  assert(op.actions.upper.hit.time===0&&op.actions.lower.hit.time===0,
    'second impact must replay the upper and lower hit animation from the start');
});

test('OP01 occlusion silhouette includes every skinned body primitive through all LODs',async()=>{
  const op=createOP01GameplayOperator(await parse('OP01_Game_LOD0.glb'));
  const body=[],outline=[];
  op.model.traverse(n=>{
    if(n.name==='OP01-occlusion-outline')outline.push(n);
    else if(n.isSkinnedMesh)body.push(n);
  });
  assert.equal(body.length,4);assert.equal(outline.length,4,'coat, backpack, equipment and body are all outlined');
  op.setOccluded(true);
  for(let i=0;i<4;i++){
    assert(outline[i].visible,'all four outlines must render behind foreground blockers');
    assert.equal(outline[i].geometry,body[i].geometry,'the outline uses the visible LOD geometry');
  }
  const loader={loadAsync:async url=>parse(new URL(url).pathname.split('/').at(-1))};
  await op.preloadLODs(loader);
  for(const lod of [1,2,0]){
    assert(op.setLOD(lod));
    for(let i=0;i<4;i++)assert.equal(outline[i].geometry,body[i].geometry,
      'LOD switch cannot leave an outdated silhouette mesh');
  }
  op.setOccluded(false);
  assert(outline.every(x=>!x.visible));
});


test('OP01 gameplay grows uniformly while world physics and weapon alignment remain unchanged',async()=>{
  const op=createOP01GameplayOperator(await parse('OP01_Game_LOD0.glb'));
  assert.equal(op.root.scale.x,OP01_CHARACTER.scale);
  assert.equal(op.root.scale.y,OP01_CHARACTER.scale);
  assert.equal(op.root.scale.z,OP01_CHARACTER.scale);
  // Compute bounds twice on the same posed GLB: the visual expansion must
  // be uniform. Neither the character's model, skeleton nor parent moves.
  const parent=new THREE.Group();
  parent.add(op.root);
  const pose=op.update(.016,{aiming:true,aimYaw:.7});
  assert.equal(pose,'idle');
  op.root.updateMatrixWorld(true);
  const larger=new THREE.Box3().setFromObject(op.root).getSize(new THREE.Vector3());
  const vfxBefore=op.muzzle.getWorldPosition(new THREE.Vector3()).clone();
  op.root.scale.setScalar(1);
  op.root.updateMatrixWorld(true);
  const source=new THREE.Box3().setFromObject(op.root).getSize(new THREE.Vector3());
  for(const axis of ['x','y','z']){
    assert(Math.abs(larger[axis]/source[axis]-1.10)<.01,'uniform visual scale on '+axis);
  }
  op.root.scale.setScalar(OP01_CHARACTER.scale);
  op.root.updateMatrixWorld(true);
  assert(op.muzzle.getWorldPosition(new THREE.Vector3()).distanceTo(vfxBefore)<.00001,
    'muzzle still follows the scaled weapon/hand attachment');
  assert.equal(parent.scale.x,1,'gameplay player remains unscaled');
  assert.equal(op.character.height,1.78,'authoring and physics contract is unchanged');
  const diag=op.poseDiagnostics();
  assert.equal(diag.visualScale,1.10);
  assert(Math.abs(diag.visualHeight-1.958)<.001);
});

test('OP01 aims immediately, then eases toward movement without snapping',async()=>{
  const facing=createOP01FacingLatch();
  const north={x:0,z:1},south={x:0,z:-1},east={x:1,z:0};
  const dot=(a,b)=>a.x*b.x+a.z*b.z;
  const copy=()=>({...facing.direction});
  assert(dot(facing.resolve(false,north,null,1/60,true),north)>.999,
    'initial walking direction must be used immediately');
  assert(dot(facing.resolve(true,north,east,1/60,true),east)>.999,
    'live aim must override running immediately');
  assert(!facing.locked,'aim preview should not record a successful shot');
  facing.record(0,-1);
  assert(facing.locked);
  const fired=copy();
  facing.resolve(false,north,null,.04,true);
  assert(dot(facing.direction,fired)>.999,'no immediate post-shot rotation');
  for(let i=0;i<6;i++)facing.resolve(false,north,null,1/60,true);
  assert(dot(facing.direction,fired)>.999,'brief shot hold prevents snap-back');
  for(let i=0;i<8;i++)facing.resolve(false,north,null,1/60,true);
  const turning=copy();
  assert(dot(turning,fired)>.65,'do not snap 180 degrees to walking direction');
  assert(dot(turning,north)>dot(fired,north),'start rotating toward walking heading');
  assert(facing.steering,'use rifle-ready torso while turning');
  for(let i=0;i<130;i++)facing.resolve(false,north,null,1/60,true);
  assert(dot(facing.direction,north)>.999,'face walking after return completes');
  assert(!facing.steering,'return to ordinary run animation when aligned');
  assert(dot(facing.resolve(true,north,east,.016,true),east)>.999,
    'aim always overrides the movement direction');
  const stopped=copy();
  for(let i=0;i<60;i++)facing.resolve(false,south,null,.016,false);
  assert(dot(facing.direction,stopped)>.999,'stationary operator keeps its final facing');
  facing.reset();
  assert(!facing.locked);
  assert(dot(facing.resolve(false,north,null,.016,true),north)>.999,
    'reset clears retained orientation');
});

test('OP01 chooses shortest turn across 180 degrees and resumes normal running',async()=>{
  const facing=createOP01FacingLatch();
  const nearA={x:.02,z:-1},nearB={x:-.02,z:-1};
  facing.resolve(true,nearA,nearA,.016,true);
  const start=Math.atan2(facing.direction.x,facing.direction.z);
  facing.resolve(false,nearB,null,.016,true);
  const actual=Math.atan2(facing.direction.x,facing.direction.z);
  const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  assert(Math.abs(angle(actual,start))<.06,'shortest yaw turn across +/- PI');
  const op=createOP01GameplayOperator(await parse('OP01_Game_LOD0.glb'));
  const holder=new THREE.Group();holder.add(op.root);
  facing.record(0,1);
  let heading=0;
  for(let i=0;i<145;i++){
    facing.resolve(false,{x:0,z:-1},null,1/60,true);
    heading=Math.atan2(facing.direction.x,facing.direction.z);
    holder.rotation.y=heading;
    op.update(1/60,{
      moving:true,aiming:false,keepFacing:facing.steering,
      walkYaw:Math.PI,aimYaw:heading
    });
    if(i===15)assert(op.actions.upper.aim.isRunning(),
      'upper body remains rifle-ready during gradual turn');
  }
  assert(Math.abs(angle(heading,Math.PI))<.07,'return to walking direction completes');
  assert(op.actions.lower.run.isRunning(),'legs run normally after turning');
});

test('OP01 health anchor follows the skinned head through aim and movement',async()=>{
  const op=createOP01GameplayOperator(await parse('OP01_Game_LOD0.glb'));
  const parent=new THREE.Group();parent.add(op.root);
  const anchor=new THREE.Vector3(),before=new THREE.Vector3();
  op.update(.10,{aiming:true,aimYaw:.6});
  op.healthAnchor(before);
  parent.position.set(3,0,4);
  parent.updateMatrixWorld(true);
  op.healthAnchor(anchor);
  assert(Math.abs(anchor.x-before.x-3)<.001);
  assert(Math.abs(anchor.z-before.z-4)<.001);
  let head=null;op.model.traverse(n=>{if(!head&&(n.name==='mixamorig:Head'||n.userData?.name==='mixamorig:Head'))head=n;});
  const actual=head.getWorldPosition(new THREE.Vector3());
  assert(Math.abs(anchor.x-actual.x)<.0001,'bar anchored to animated head horizontally');
  assert(Math.abs(anchor.z-actual.z)<.0001);
  assert(anchor.y>actual.y+.2,'bar clears the hood');
});

test('OP01 visual turn uses real elapsed time while keeping a maximum frame step',()=>{
  const north={x:0,z:1},south={x:0,z:-1};
  const standard=createOP01FacingLatch(),slowDevice=createOP01FacingLatch();
  for(const f of [standard,slowDevice]){
    f.resolve(true,north,south,.016,true);
  }
  // The previous 40ms gameplay-step cap made returning very slow when
  // screenshots or a weak GPU produced fewer rAF callbacks.
  for(let i=0;i<4;i++){
    standard.resolve(false,north,null,.04,true);
    slowDevice.resolve(false,north,null,.2,true);
  }
  const gap=f=>Math.abs(Math.atan2(Math.sin(Math.atan2(f.direction.x,f.direction.z)),
    Math.cos(Math.atan2(f.direction.x,f.direction.z))));
  assert(gap(slowDevice)<gap(standard),'real visual delta turns farther under slow frame rates');
  assert(gap(slowDevice)>.1,'visual heading still transitions instead of snapping');
});
