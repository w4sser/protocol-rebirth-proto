import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {generateLevel,RULES} from '../levels.js';
import {buildArchipelago} from '../archipelago.js';
import {movePlayer,describeMoveBlock} from '../physics.mjs';
import {planBridgeDeck} from '../bridge-deck.mjs';

function render(level){
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  buildArchipelago(level,group,box,{quality:{props:0}});
  return group;
}

test('reported L2 seed has no tiny shoreline obstruction at bridge mouth',()=>{
  // Actual phone capture: seed f735c403-1:2, shore #63 at
  // x=6.58,z=-1.02,w=.30,d=.40, player from (6.17,-1.48) to (6.21,-1.46).
  const level=generateLevel(2,'f735c403-1','archipelago');
  const target={x:6.58,z:-1.02};
  const isCaptured=w=>Math.abs(w.x-target.x)<.08&&Math.abs(w.z-target.z)<.08
    &&Math.abs(w.w-.3)<.09&&Math.abs(w.d-.4)<.09;
  const authored=level.walls.filter(isCaptured);
  assert.ok(authored.length>0,'capture seed must reproduce the recorded authored wall');
  // This particular obstacle is NOT tagged as a bridgeMouthStub: it came
  // from another wall-generation path. This is why checking only tagged
  // doorway remnants missed the bug in previous passes.
  assert.ok(authored.some(w=>w.w<=.65&&w.d<=.65),
    'captured obstruction must be a tiny untagged shore fragment');
  const group=render(level);
  try{
    assert.ok(!level.walls.some(w=>w.shore&&isCaptured(w)),
      'do not generate a physical shoreline collider inside the bridge entrance');
    const from={x:6.17,z:-1.48},to={x:6.21,z:-1.46};
    const end=movePlayer(from,{x:to.x-from.x,z:to.z-from.z},
      [...level.walls,...level.boxes],level.floors,RULES.playerRadius);
    const remaining=Math.hypot(end.x-to.x,end.z-to.z);
    assert.ok(remaining<.045,'captured entry step should pass: '+JSON.stringify({end,to,remaining,
      blocked:describeMoveBlock(from,to,level.walls,level.floors,RULES.playerRadius)}));
    assert.ok(level.walls.filter(w=>w.shore).length>8,
      'normal shoreline collision remains elsewhere');
  }finally{group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}
});

test('original deck width restored, water remains outside floor support',()=>{
  const level=generateLevel(2,'f735c403-1','archipelago');
  const bridge=level.floors.find(f=>f.dir);
  assert.ok(bridge);
  for(const quality of ['high','low']){
    const plan=planBridgeDeck(bridge,level.seed,{quality});
    assert.ok(plan.planks.filter(p=>!p.landing).every(p=>p.width<plan.width),
      'main deck may never widen near land');
    assert.ok(plan.planks.filter(p=>p.landing).every(p=>p.width<=plan.width+.81),
      'original landing plank widths preserved');
  }
  const axis=bridge.dir.x?'z':'x',p={x:bridge.x,z:bridge.z},step={x:0,z:0};
  step[axis]=8;
  const after=movePlayer(p,step,[],level.floors,RULES.playerRadius);
  assert.ok(Math.abs(after[axis]-p[axis])<(bridge.dir.x?bridge.d:bridge.w)/2,
    'cannot run into the open water from the middle of the bridge');
});
