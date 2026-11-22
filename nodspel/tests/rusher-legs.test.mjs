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

test('walking swing rotates each hip about its lateral axis and idle returns to the authored pose',async()=>{
  const v=await attached({attackPhase:'idle'});
  for(const phase of ['stalk','charge','idle']){
    v.enemy.attackPhase=phase;animateEnemyModel(v,100);
    LEGS.forEach((name,i)=>{
      const pivot=v.enemyModel.parts[name];
      const expected=phase==='idle'?0:Math.sin(100/(phase==='charge'?55:110)+(i===0||i===3?0:Math.PI))*.35;
      assert.ok(Math.abs(pivot.rotation.y-expected)<1e-9,`${name}: ${phase}`);
      assert.ok(Math.abs(pivot.rotation.x)<1e-12&&Math.abs(pivot.rotation.z)<1e-12,`${name}: swing stays on the lateral axis`);
    });
  }
});

test('rusher clones keep independent leg poses',async()=>{
  const a=await attached({attackPhase:'idle'}),b=await attached({attackPhase:'idle'});
  a.enemy.attackPhase='charge';animateEnemyModel(a,100);animateEnemyModel(b,100);
  for(const name of LEGS){
    assert.notEqual(a.enemyModel.parts[name],b.enemyModel.parts[name]);
    assert.ok(Math.abs(b.enemyModel.parts[name].rotation.y)<1e-12);
  }
});
