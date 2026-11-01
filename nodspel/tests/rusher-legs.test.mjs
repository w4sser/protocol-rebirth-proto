import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {createEnemyModelLoader} from '../enemy-models.js?v=2.22.0';
import {attachEnemyModel,animateEnemyModel} from '../enemy-animation.js?v=2.22.0';

// Stub mirrors rusher.glb's authored leg layout: each pivot is the hip joint, its one mesh
// child sits at -hip (so the mesh's own geometry carries the hip->foot offset), with a
// cylinder matching the real asset's splayed-leg footprint
// (assets/enemies/rusher.glb: hips at (+-0.25,+-0.18,0.45), feet near (+-0.6,+-0.45,0.06)).
const LEGS=[
  ['leg_front_left_pivot',0.25,0.18],
  ['leg_front_right_pivot',0.25,-0.18],
  ['leg_rear_left_pivot',-0.25,0.18],
  ['leg_rear_right_pivot',-0.25,-0.18],
];
function buildRusherStub(){
  const root=new THREE.Group();
  for(const name of ['core','wedge_head','optic','back_battery'])root.add(Object.assign(new THREE.Group(),{name}));
  for(const [name,hx,hy] of LEGS){
    const pivot=new THREE.Group();pivot.name=name;pivot.position.set(hx,hy,.45);
    const sx=Math.sign(hx),sy=Math.sign(hy);
    const hip=new THREE.Vector3(hx,hy,.45),foot=new THREE.Vector3(sx*.6,sy*.45,.06);
    const direction=foot.clone().sub(hip);
    const geometry=new THREE.CylinderGeometry(.03,.03,direction.length(),8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
    const center=hip.clone().add(foot).multiplyScalar(.5);
    geometry.translate(center.x,center.y,center.z);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
    mesh.position.set(-hx,-hy,-.45);
    pivot.add(mesh);root.add(pivot);
  }
  return root;
}
function visual(enemy){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());group.add(body);return {enemy,group,body};}
async function attachedRusher(enemy){
  const loader=createEnemyModelLoader({load:async()=>buildRusherStub()});
  const v=visual({type:'rusher',health:3,...enemy});
  await attachEnemyModel(v,()=>false,loader);
  return v;
}
// Measure the center of the distal end from actual vertices, independently of the
// loader's bbox calculation. Deduplicate shared face vertices before averaging.
function footFromHip(child,hip){
  child.updateWorldMatrix(true,false);
  const pos=child.geometry.attributes.position,v=new THREE.Vector3();
  const vertices=new Map();let maxDist=0;
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
    maxDist=Math.max(maxDist,v.distanceTo(hip));
    vertices.set(v.toArray().map(n=>n.toFixed(6)).join(','),v.clone());
  }
  const distal=[...vertices.values()].filter(v=>v.distanceTo(hip)>maxDist*.7);
  return distal.reduce((center,v)=>center.add(v),new THREE.Vector3()).multiplyScalar(1/distal.length);
}

function assertGroundedStance(v){
  const {parts,mount}=v.enemyModel;
  v.group.updateMatrixWorld(true);
  for(const [name] of LEGS){
    const pivot=parts[name];
    assert.ok(pivot.userData.restQuaternion instanceof THREE.Quaternion,`${name} missing rest quaternion`);
    const hip=new THREE.Vector3();pivot.getWorldPosition(hip);
    const foot=footFromHip(pivot.children[0],hip);
    const horizontalGap=Math.hypot(foot.x-hip.x,foot.z-hip.z);
    assert.ok(horizontalGap<.15,`${name} foot is ${horizontalGap.toFixed(3)} from hip horizontally`);
    assert.ok(foot.y<hip.y-.4,`${name} foot should hang below its hip`);
    // forwardUpFix maps model +X to game +Z, and model +Y to game +X.
    assert.ok((foot.z-hip.z)*pivot.position.x>0,`${name} fore/aft stance should point away from center`);
    assert.ok((foot.x-hip.x)*pivot.position.y>0,`${name} outward stance should point away from center`);
  }
  const lowest=new THREE.Box3().setFromObject(mount).min.y;
  assert.ok(Math.abs(lowest)<.02,`lowest point y=${lowest}`);
}

test('attach rest-poses rusher legs so each foot hangs under its hip and the model is grounded',async()=>{
  assertGroundedStance(await attachedRusher({attackPhase:'idle'}));
});

test('walking swing composes on top of the rest pose instead of overwriting it',async()=>{
  const v=await attachedRusher({attackPhase:'idle'});
  for(const phase of ['idle','stalk','charge','idle']){
    v.enemy.attackPhase=phase;
    animateEnemyModel(v,100);
    for(const [i,[name]] of LEGS.entries()){
      const pivot=v.enemyModel.parts[name],rest=pivot.userData.restQuaternion;
      if(phase==='idle'){
        assert.ok(pivot.quaternion.equals(rest),'idle pose should equal the rest quaternion exactly');
      }else{
        const swingAngle=Math.sin(100/(phase==='charge'?55:110)+(i===0||i===3?0:Math.PI))*.35;
        const expected=rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),swingAngle));
        assert.ok(pivot.quaternion.angleTo(expected)<1e-6,`${name}: ${phase} should compose rest and lateral swing`);
        assert.ok(!pivot.quaternion.equals(rest),'moving pose should differ from rest');
        const hip=new THREE.Vector3();pivot.getWorldPosition(hip);
        const foot=footFromHip(pivot.children[0],hip);
        assert.ok(Math.hypot(foot.x-hip.x,foot.z-hip.z)<.3,'swing should not fling the foot far from the hip');
      }
    }
  }
  assertGroundedStance(v);
});

test('unchanged rusher GLB rests upright and grounded with independent clone poses',async()=>{
  const bytes=readFileSync(new URL('../../assets/enemies/rusher.glb',import.meta.url));
  const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const loader=createEnemyModelLoader({load:async()=>source});
  const a=visual({type:'rusher',attackPhase:'idle'}),b=visual({type:'rusher',attackPhase:'idle'});
  await attachEnemyModel(a,()=>false,loader);
  await attachEnemyModel(b,()=>false,loader);
  assertGroundedStance(a);assertGroundedStance(b);
  a.enemy.attackPhase='charge';animateEnemyModel(a,100);
  assertGroundedStance(b);
  for(const [name] of LEGS){
    assert.notEqual(a.enemyModel.parts[name].userData.restQuaternion,b.enemyModel.parts[name].userData.restQuaternion);
  }
});
