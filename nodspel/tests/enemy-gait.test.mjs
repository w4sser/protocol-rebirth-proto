import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {createEnemyModelLoader} from '../enemy-models.js?v=2.28.78';
import {attachEnemyModel,animateEnemyModel} from '../enemy-animation.js?v=2.28.78';

// GLTFLoader reads embedded textures via self.URL; browsers have `self`, Node does not.
globalThis.self??=globalThis;

// swarm_bot's eight spider legs walk with the distance-driven gait (enemy-animation.js legGait): every planted
// foot must hold its world position while the body moves, instead of sliding ("moonwalking").
async function swarm(){
  const bytes=readFileSync(new URL('../../assets/enemies/swarm_bot.glb',import.meta.url));
  const src=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  const v={enemy:{type:'rusher',swarm:true,x:0,z:0,facing:0,health:2,speed:3},group};
  await attachEnemyModel(v,()=>false,createEnemyModelLoader({load:async()=>src}));
  return v;
}
function trackLowest(v,pivot){
  const mesh=pivot.children.find(c=>c.isMesh),pos=mesh.geometry.attributes.position,t=new THREE.Vector3();
  v.group.updateMatrixWorld(true);let best=0,low=Infinity;
  for(let k=0;k<pos.count;k++){t.fromBufferAttribute(pos,k).applyMatrix4(mesh.matrixWorld);if(t.y<low){low=t.y;best=k;}}
  return ()=>{v.group.updateMatrixWorld(true);return new THREE.Vector3().fromBufferAttribute(pos,best).applyMatrix4(mesh.matrixWorld);};
}

test('swarm_bot attaches an eight-leg gait in two alternating groups',async()=>{
  const v=await swarm();
  assert.equal(v.enemyModel.archetype,'swarm_bot');
  assert.equal(v.enemyModel.gait.legs.length,8);
  assert.deepEqual([...new Set(v.enemyModel.gait.legs.map(l=>l.offset))].sort(),[0,.5]);
});

test('swarm_bot planted feet hold their world position while the body walks',async()=>{
  const v=await swarm(),g=v.enemyModel.gait;
  animateEnemyModel(v,0);
  for(const leg of g.legs.filter(l=>l.offset===0)){
    const at=trackLowest(v,leg.pivot),start=at(),d=g.cycle*g.stance*.8;
    v.enemy.z=d;v.group.position.z=d;animateEnemyModel(v,16);
    const end=at(),slide=Math.hypot(end.x-start.x,end.z-start.z);
    assert.ok(slide<.03,`${leg.pivot.name} slid ${slide.toFixed(3)} while the body moved ${d.toFixed(3)}`);
    v.enemy.z=0;v.group.position.z=0;animateEnemyModel(v,32);
  }
});
