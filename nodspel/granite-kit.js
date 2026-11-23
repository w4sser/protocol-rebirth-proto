// Textured XL granite kit (v2.28.69): rock_granite_xl_a (boulder), rock_cliff_xl_a (long cliff block) and
// rock_slab_xl_a (flat walkable shelf) from assets/env/nature/rocks (see its README). Presentation only:
// the archipelago builds its procedural rocks and exact colliders first, then this module swaps in the GLB
// visuals once they load. Colliders, reservations and placement never change, so gameplay is identical and
// the procedural rocks stay as the fallback if a GLB fails (or in Node tests, where nothing is fetched).
import * as THREE from './vendor/three.module.js';

const BASE='../assets/env/nature/rocks/';
export const GRANITE_KIT=Object.freeze({
  boulder:{high:'rock_granite_xl_a',low:'rock_granite_xl_a_lod1'},
  cliff:{high:'rock_cliff_xl_a',low:'rock_cliff_xl_a_lod1'},
  slab:{high:'rock_slab_xl_a',low:'rock_slab_xl_a_lod1'},
});
// A wall rock whose footprint is at least this much longer along the wall than across reads as a cliff block.
export const CLIFF_ASPECT=1.35;
// Flat shelves per island: one per this many m² of island floor, capped.
export const SLAB_RULES=Object.freeze({areaPer:70,maxPerIsland:2,minIsland:36,scale:[.55,.8],height:.11,pad:.6});

const kitCache=new Map();
function loadPiece(file,load){
  if(!kitCache.has(file))kitCache.set(file,load(`${BASE}${file}.glb?v=2.28.69`).then(scene=>{
    let mesh=null;scene.traverse(n=>{if(!mesh&&n.isMesh)mesh=n;});
    if(!mesh)throw new Error(`${file} has no mesh`);
    mesh.geometry.computeBoundingBox();
    const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3()),center=mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    // Centre the footprint on the origin so a piece can be fitted to any AABB; base stays at y=0.
    const geometry=mesh.geometry.clone();geometry.translate(-center.x,-mesh.geometry.boundingBox.min.y,-center.z);
    geometry.userData.shared=true;mesh.material.userData.shared=true;
    return {geometry,material:mesh.material,size};
  }));
  return kitCache.get(file);
}
async function defaultLoad(url){
  const {GLTFLoader}=await import('./vendor/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(url)).scene;
}
export function loadGraniteKit({high=true,load=defaultLoad}={}){
  const pick=k=>loadPiece(high?GRANITE_KIT[k].high:GRANITE_KIT[k].low,load);
  return Promise.all([pick('boulder'),pick('cliff'),pick('slab')]).then(([boulder,cliff,slab])=>({boulder,cliff,slab}));
}

// Which kit piece replaces a procedural rock with this world AABB, and its yaw so the piece's long (X) axis
// runs along the footprint's long side.
export function graniteFit(box){
  const w=box.max.x-box.min.x,d=box.max.z-box.min.z,long=Math.max(w,d),short=Math.max(1e-3,Math.min(w,d));
  return {kind:long/short>=CLIFF_ASPECT?'cliff':'boulder',yaw:w>=d?0:Math.PI/2,
    x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,along:long,across:short,height:box.max.y};
}
function fitted(piece,fit,seed){
  const m=new THREE.Mesh(piece.geometry,piece.material);
  const flip=seed%2?Math.PI:0; // mirror variety without changing the footprint
  m.position.set(fit.x,0,fit.z);m.rotation.y=fit.yaw+flip;
  m.scale.set(fit.along/piece.size.x,Math.max(.2,fit.height)/piece.size.y,fit.across/piece.size.z);
  m.castShadow=m.receiveShadow=true;
  return m;
}

// Deterministic flat granite shelves on island interiors: pure data, no THREE. Avoids every reservation the
// props kit already respects (bridges, passages, nodes, loot, start/exit, enemies) plus walls and cover.
export function planGraniteSlabs(level,blocked,rng){
  const out=[],solids=[...(level.walls??[]),...(level.boxes??[])];
  const hit=(x,z,r)=>solids.some(s=>Math.abs(x-s.x)<s.w/2+r&&Math.abs(z-s.z)<s.d/2+r);
  for(const f of (level.floors??[]).filter(f=>!f.dir)){
    const area=f.w*f.d;if(area<SLAB_RULES.minIsland)continue;
    const want=Math.min(SLAB_RULES.maxPerIsland,Math.floor(area/SLAB_RULES.areaPer)+(rng()<.5?1:0));
    let placed=0;
    for(let tries=0;tries<12&&placed<want;tries++){
      const s=SLAB_RULES.scale[0]+rng()*(SLAB_RULES.scale[1]-SLAB_RULES.scale[0]),r=1.7*s;
      const x=f.x+(rng()-.5)*Math.max(0,f.w-2*r-.6),z=f.z+(rng()-.5)*Math.max(0,f.d-2*r-.6),ry=rng()*Math.PI*2;
      if(blocked(x,z,r+SLAB_RULES.pad)||hit(x,z,r+.3)||out.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+r+1))continue;
      out.push({x,z,ry,s,r});placed++;
    }
  }
  return out;
}

// Swap the archipelago's procedural rocks for the kit once it loads. Rocks are found by name; their own
// userData.collider (wall rocks) or world AABB (decor) sets the fitted size. Returns a promise of counts.
export function dressGraniteKit(group,{high=true,slabs=[],load}={}){
  if(typeof document==='undefined'&&!load)return Promise.resolve(null); // headless tests keep the fallback
  return loadGraniteKit({high,load}).then(kit=>{
    const counts={boulder:0,cliff:0,slab:0},walls=new Map(),decor=[];
    group.traverse(n=>{
      if(!n.isMesh)return;
      if(n.name==='archipelago-rock'&&n.userData.collider&&n.userData.graniteWall!=null){
        if(!walls.has(n.userData.graniteWall))walls.set(n.userData.graniteWall,[]);walls.get(n.userData.graniteWall).push(n);
      }else if(n.name==='archipelago-rock'||n.name==='archipelago-coast-rock')decor.push(n);
    });
    const colliderBox=c=>({min:{x:c.x-c.w/2,z:c.z-c.d/2},max:{x:c.x+c.w/2,z:c.z+c.d/2,y:c.h}});
    const place=(rocks,box,seed)=>{
      const fit=graniteFit(box),piece=fitted(kit[fit.kind],fit,seed);
      piece.name=`granite-xl-${fit.kind}`;rocks[0].parent.add(piece);
      for(const r of rocks)r.visible=false;counts[fit.kind]++;
      return piece;
    };
    // Wall rocks: neighbours along one authored wall pair up into a single cliff block (their union AABB),
    // every third rock stays a lone boulder so a long wall does not read as one repeated tile. Each rock keeps
    // its own collider; the pieces only overlap, so nothing visible hides a walkable gap.
    for(const [wall,rocks] of walls){
      rocks.sort((a,b)=>a.userData.graniteOrder-b.userData.graniteOrder);
      for(let i=0;i<rocks.length;){
        const a=rocks[i],b=rocks[i+1],pair=b&&(i+wall)%3!==2;
        if(pair){
          const ba=colliderBox(a.userData.collider),bb=colliderBox(b.userData.collider);
          place([a,b],{min:{x:Math.min(ba.min.x,bb.min.x),z:Math.min(ba.min.z,bb.min.z)},
            max:{x:Math.max(ba.max.x,bb.max.x),z:Math.max(ba.max.z,bb.max.z),y:Math.max(ba.max.y,bb.max.y)}},i+wall);
          i+=2;
        }else{place([a],colliderBox(a.userData.collider),i+wall);i++;}
      }
    }
    decor.forEach((rock,i)=>{
      rock.updateWorldMatrix(true,false);
      const c=rock.userData.collider,box=c?colliderBox(c):new THREE.Box3().setFromObject(rock);
      const piece=place([rock],box,i);
      // Decor rocks along the waterline sit partly under water: keep their authored base height.
      if(!c){const k=piece.name.slice(11);piece.position.y=Math.min(0,box.min.y);piece.scale.y=Math.max(.2,box.max.y-piece.position.y)/kit[k].size.y;}
    });
    for(const s of slabs){
      const m=new THREE.Mesh(kit.slab.geometry,kit.slab.material);
      m.position.set(s.x,-.02,s.z);m.rotation.y=s.ry;
      m.scale.set(s.s,SLAB_RULES.height/kit.slab.size.y,s.s); // walkable shelf: low enough that feet read on top
      m.receiveShadow=true;m.name='granite-xl-slab';m.userData.visualOnly=true;
      group.add(m);counts.slab++;
    }
    return counts;
  }).catch(e=>{console.warn('Granite kit skipped',e);return null;});
}
