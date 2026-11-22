import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {ENEMIES} from '../enemies.js?v=2.28.67';
import {createEnemyModelLoader} from '../enemy-models.js?v=2.28.67';
import {attachEnemyModel,animateEnemyModel} from '../enemy-animation.js?v=2.28.67';

// GLTFLoader reads embedded textures via self.URL; browsers have `self`, Node does not.
globalThis.self??=globalThis;

// The textured rusher.glb (v2.28.67) authors its four legs already crouched on the ground, so the spec has
// no legRest and attach must not re-pose them; the walk cycle swings each hip pivot about its lateral axis.
const LEGS=['leg_front_left_pivot','leg_front_right_pivot','leg_rear_left_pivot','leg_rear_right_pivot'];
function visual(enemy){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());group.add(body);return {enemy,group,body};}
let source;
async function rusherSource(){
  if(source)return source;
  const bytes=readFileSync(new URL('../../assets/enemies/rusher.glb',import.meta.url));
  source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  return source;
}
async function attached(enemy){
  const src=await rusherSource(),loader=createEnemyModelLoader({load:async()=>src});
  const v=visual({type:'rusher',health:3,...enemy});
  await attachEnemyModel(v,()=>false,loader);
  return v;
}
function lowestBelowHip(pivot){
  pivot.updateWorldMatrix(true,true);
  const hip=new THREE.Vector3();pivot.getWorldPosition(hip);
  return hip.y-new THREE.Box3().setFromObject(pivot).min.y;
}

test('rusher spec has no legRest: its legs are authored in their resting crouch',()=>{
  assert.equal(ENEMIES.rusher.legRest,undefined);
});

test('textured rusher GLB attaches grounded, feet below each hip, without a rest re-pose',async()=>{
  const v=await attached({attackPhase:'idle'});
  const {parts,mount}=v.enemyModel;
  v.group.updateMatrixWorld(true);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(mount).min.y)<.02,'lowest point sits on the ground');
  for(const name of LEGS){
    assert.equal(parts[name].userData.restQuaternion,undefined,`${name} must not be re-posed`);
    assert.ok(lowestBelowHip(parts[name])>.25,`${name} foot should reach well below its hip`);
  }
});

function footVertex(pivot){ // lowest vertex of the leg at its current pose: track that one vertex in world space
  const mesh=pivot.children.find(c=>c.isMesh);mesh.updateWorldMatrix(true,false);
  const pos=mesh.geometry.attributes.position,v=new THREE.Vector3();let best=0,low=Infinity;
  for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(mesh.matrixWorld);if(v.y<low){low=v.y;best=k;}}
  return k=>{mesh.updateWorldMatrix(true,false);return new THREE.Vector3().fromBufferAttribute(pos,best).applyMatrix4(mesh.matrixWorld);};
}
function place(v){v.group.position.set(v.enemy.x,0,v.enemy.z);v.group.rotation.y=v.enemy.facing;v.group.updateMatrixWorld(true);}

test('rusher feet stay planted while the body walks forward (no moonwalk)',async()=>{
  const v=await attached({attackPhase:'stalk',x:0,z:0,facing:0});
  place(v);animateEnemyModel(v,0);v.group.updateMatrixWorld(true);
  // front-left and rear-right share phase offset 0: both start their stance at distance 0.
  for(const name of ['leg_front_left_pivot','leg_rear_right_pivot']){
    const pivot=v.enemyModel.parts[name],at=footVertex(pivot),start=at();
    const stance=v.enemyModel.gait.cycle*v.enemyModel.gait.stance;
    v.enemy.z=stance*.8;place(v);animateEnemyModel(v,16);v.group.updateMatrixWorld(true);
    const end=at(),slide=Math.hypot(end.x-start.x,end.z-start.z);
    assert.ok(slide<.03,`${name} foot slid ${slide.toFixed(3)} while the body moved ${(stance*.8).toFixed(3)}`);
    v.enemy.z=0;place(v);animateEnemyModel(v,32);
  }
});

test('legs only move when the body moves, and settle back to planted when it stops',async()=>{
  const v=await attached({attackPhase:'stalk',x:0,z:0,facing:0});
  animateEnemyModel(v,0);
  const pose=LEGS.map(n=>v.enemyModel.parts[n].quaternion.clone());
  animateEnemyModel(v,500);animateEnemyModel(v,900); // time passes, no movement
  LEGS.forEach((n,i)=>assert.ok(v.enemyModel.parts[n].quaternion.angleTo(pose[i])<1e-9,`${n} moved without the body moving`));
  v.enemy.z=v.enemyModel.gait.cycle*.3;animateEnemyModel(v,950);
  assert.ok(LEGS.some((n,i)=>v.enemyModel.parts[n].quaternion.angleTo(pose[i])>1e-3),'walking moves the legs');
});

test('rusher clones keep independent leg poses',async()=>{
  const a=await attached({attackPhase:'idle',x:0,z:0,facing:0}),b=await attached({attackPhase:'idle',x:0,z:0,facing:0});
  animateEnemyModel(b,0);const pose=LEGS.map(n=>b.enemyModel.parts[n].quaternion.clone());
  a.enemy.z=.2;animateEnemyModel(a,100);animateEnemyModel(b,100);
  LEGS.forEach((n,i)=>{
    assert.notEqual(a.enemyModel.parts[n],b.enemyModel.parts[n]);
    assert.ok(b.enemyModel.parts[n].quaternion.angleTo(pose[i])<1e-9);
  });
});
