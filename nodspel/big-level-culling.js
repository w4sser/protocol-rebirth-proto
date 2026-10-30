// Render ownership only. Reuse every source geometry, material and instance transform.
import * as THREE from './vendor/three.module.js';
import {graphRoomAt} from './zone-graph.js?v=2.11.3';

export function createRoomVisibility(level,world){
  let initial=true;const temporary=[];
  const wrappers=[],registered=new WeakSet(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  const ownersAt=p=>{
    const room=level.graph.nodes.find(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2);if(room)return [room.id];
    const edge=level.graph.edges.find(e=>Math.abs(p.x-e.corridor.x)<=e.corridor.w/2+1&&Math.abs(p.z-e.corridor.z)<=e.corridor.d/2+1);if(edge)return [edge.a,edge.b];
    return [level.graph.nodes.reduce((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)<Math.hypot(p.x-b.x,p.z-b.z)?a:b).id];
  };
  function wrap(child,owners,entity=null){const wrapper=new THREE.Group();child.parent.add(wrapper);wrapper.add(child);registered.add(wrapper);wrappers.push({wrapper,child,owners,entity,origin:child.position.clone()});}
  function register(){
    world.group.updateMatrixWorld(true);
    for(const child of [...world.group.children]){
      if(registered.has(child))continue;
      // Bunker floors and walls are batched across the entire level. Partition instances
      // by room ownership so a visible batch cannot keep sleeping rooms on screen.
      if(child.isInstancedMesh){
        const batches=new Map();for(let i=0;i<child.count;i++){child.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(child.matrixWorld);const owners=ownersAt(point),key=owners.join(',');if(!batches.has(key))batches.set(key,{owners,indices:[]});batches.get(key).indices.push(i);}
        for(const {owners,indices} of batches.values()){
          const mesh=child.clone();mesh.count=indices.length;
          for(const [i,source] of indices.entries()){child.getMatrixAt(source,matrix);mesh.setMatrixAt(i,matrix);if(child.instanceColor){const color=new THREE.Color();child.getColorAt(source,color);mesh.setColorAt(i,color);}}
          mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();world.group.add(mesh);wrap(mesh,owners);
        }
        child.removeFromParent();child.dispose();continue;
      }
      const entity=world.enemies?.find(v=>v.group===child)?.enemy??world.lootBoxes?.find(v=>v.group===child)?.loot??world.nodes?.find(v=>v.group===child)?.node??world.spawners?.find(v=>v.group===child)?.sp;
      // Transient bursts are removed by world.group.remove(); keep that ownership intact.
      if(!initial&&!entity){registered.add(child);temporary.push(child);continue;}
      const bounds=new THREE.Box3().setFromObject(child);if(bounds.isEmpty())child.getWorldPosition(point);else bounds.getCenter(point);
      wrap(child,ownersAt(point),entity);
    }
  }
  return awake=>{
    register();initial=false;
    for(const record of wrappers){const {wrapper,child,entity,origin}=record;
      if(!entity&&!child.position.equals(origin)){child.getWorldPosition(point);record.owners=ownersAt(point);origin.copy(child.position);}
      wrapper.visible=entity?awake.has(graphRoomAt(level.graph,entity,entity.roomId??0)):record.owners.some(id=>awake.has(id));
    }
    for(let i=temporary.length-1;i>=0;i--){const child=temporary[i];if(!child.parent){temporary.splice(i,1);continue;}child.getWorldPosition(point);child.visible=ownersAt(point).some(id=>awake.has(id));}
  };
}
