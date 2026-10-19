import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {controlCablePath} from '../control-cables.js';
import {buildWorld} from '../world.js';

test('every bunker gate control reaches the hatch over floor without crossing cover or walls',()=>{
  for(const n of [1,2,3])for(let seed=0;seed<20;seed++){
    const level=generateLevel(n,`wire-${seed}`);
    for(const node of level.nodes){
      const path=controlCablePath(level,node);
      assert(path.length>=2,`L${n} seed ${seed} node ${node.id}`);
      assert.deepEqual(path[0],{x:node.x,z:node.z});assert.deepEqual(path.at(-1),{x:level.exit.x,z:level.exit.z});
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.05);
        for(let j=0;j<=steps;j++){
          const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps;
          assert(level.floors.some(f=>Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7),'on floor');
          assert(![...level.walls,...level.boxes].some(o=>Math.abs(x-o.x)<o.w/2&&Math.abs(z-o.z)<o.d/2),'outside solids');
        }
      }
    }
  }
});

test('only the activated control sends a pulse; hatch tracks partial progress; low quality keeps wiring',()=>{
  const level=generateLevel(2,'wiring-fx'),scene=new THREE.Scene(),w=buildWorld(level,scene,{quality:'low'});
  w.animate(0);assert(w.controlCables.every(c=>c.path.length&& !c.pulse.visible));
  level.nodes[0].active=true;w.animate(1);w.animate(2);
  assert(w.controlCables[0].pulse.visible);assert(!w.controlCables[1].pulse.visible);
  assert.equal(w.gateProgress[0].mesh.material.opacity,1);assert.equal(w.gateProgress[1].mesh.material.opacity,.16);
  const pulse=w.controlCables[0].pulse.position.clone();w.animate(2.5);assert(!w.controlCables[0].pulse.position.equals(pulse));
  w.animate(4);assert(!w.controlCables[0].pulse.visible,'one-shot transition completes');
  assert.equal(w.controlCables[0].liveMaterial.opacity,.8,'powered cable stays lit');
  w.dispose();assert.equal(scene.children.length,0);
});
