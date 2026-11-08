// Procedural Bungenas / Gotland coastal-fortification silhouettes.
// No imported GLBs, flags, sci-fi consoles, lights, or gameplay collision.
// Meshes live in the existing opt-in Polyfork experimental scene group.
import * as THREE from './vendor/three.module.js';
import {seededRandom} from './polyfork-profiles.mjs?v=profile-v1';

const P={
  concrete:'#77786F',light:'#929186',edge:'#575D59',stain:'#454B43',
  iron:'#353E40',rust:'#765541',granite:'#6F7073',graniteDark:'#595C62',
  moss:'#61704A',lichen:'#88936C',dryGrass:'#87865C',shadow:'#171D21'
};
export function renderMilitaryArchitecture(landmarks,parent,{quality='high',seed=''}={}){
  const group=new THREE.Group();
  group.name='military-remnants-architecture';
  parent.add(group);
  const high=quality==='high';
  const geometries={
    box:new THREE.BoxGeometry(1,1,1),
    rock:new THREE.IcosahedronGeometry(1,0),
    roof:new THREE.CylinderGeometry(1,1,1,10,1),
  };
  const materials=new Map(),batches=new Map(),stats={structures:0,parts:0,meshes:0,rocks:0,drawCalls:0};
  function material(color){
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({
      color,roughness:.95,metalness:color===P.iron?0.15:0,flatShading:true
    }));
    return materials.get(color);
  }
  function instance(kind,color,part){
    const key=kind+':'+color;
    if(!batches.has(key))batches.set(key,{kind,color,parts:[]});
    batches.get(key).parts.push(part);
    stats.parts++;
    if(kind==='rock')stats.rocks++;
  }
  const box=(c,x,y,z,w,h,d,rot=0)=>instance('box',c,{x,y,z,w,h,d,rot});
  const rock=(c,x,y,z,w,h,d,rot=0)=>instance('rock',c,{x,y,z,w,h,d,rot});
  const roof=(c,x,y,z,w,h,d)=>instance('roof',c,{x,y,z,w,h,d,rot:0});
  function weather(r,w,d,top,amount){
    // Faded lichen and damp streaks: placed on CONCRETE, not as glowing decals.
    if(high){
      for(let i=0;i<amount;i++){
        const x=(r()-.5)*w*.78,z=.25+r()*d*.72;
        box(i%3===0?P.lichen:P.moss,x,top+.022,z,.3+r()*.45,.033,.17+r()*.30,r()*.8);
      }
      for(let i=0;i<4;i++){
        box(P.stain,(r()-.5)*w*.83,.32+r()*.55,.045,.045+r()*.09,.35+r()*.25,.021);
      }
    }else{
      box(P.moss,-w*.18,top+.024,.55,.7,.038,.32);
    }
  }
  function rubble(r,w,depth,amount){
    // Stone-embedded seaward footing: the ruin reads as grown into the headland.
    for(let i=0;i<amount;i++){
      const side=i%2?-1:1,near=.15+r()*depth*.9;
      rock(i%3===0?P.graniteDark:P.granite,side*(w*.38+r()*.37),.10+r()*.14,near,
        .35+r()*.32,.25+r()*.24,.32+r()*.35,r()*2.5);
    }
    if(high)for(let i=0;i<6;i++){
      const x=(r()-.5)*w*1.05,z=.18+r()*depth;
      box(i%2?P.dryGrass:P.moss,x,.035,z,.18,.055,.27,r()*2.0);
    }
  }
  function pillbox(r,l){
    const w=l.width,d=l.depth;
    box(P.graniteDark,0,-.21,d*.55,w+.45,.35,d+ .25);
    box(P.concrete,0,.55,d*.69,w*.91,1.1,d*.78);
    // Black horizontal firing slit recessed under the roof, with broken concrete lintel.
    box(P.shadow,0,.95,.082,w*.64,.19,.045);
    box(P.light,0,1.18,.075,w*.83,.18,.16);
    box(P.edge,-w*.40,.80,.12,.20,.77,.23);
    box(P.edge,w*.40,.80,.12,.20,.77,.23);
    roof(P.concrete,0,1.43,d*.61,w*.54,.25,d*.72);
    box(P.light,0,1.48,d*.61,w*.70,.09,d*.69);
    rubble(r,w,d,high?11:6);
    weather(r,w,d,1.54,high?7:2);
  }
  function foundations(r,l){
    const w=l.width,d=l.depth;
    box(P.edge,0,-.18,d*.5,w,.19,d);
    const walls=[
      [-w*.25,.35,.25,w*.46,.66,.19],
      [w*.28,.35,.40,w*.39,.62,.19],
      [-w*.15,.41,.86,w*.55,.74,.16],
      [w*.35,.34,1.11,w*.28,.61,.20],
      [-w*.48,.34,.62,.18,.62,.78],
      [w*.46,.38,.78,.18,.72,.95],
    ];
    for(let i=0;i<(high?walls.length:4);i++){
      const a=walls[i];
      box(i%3===1?P.light:P.concrete,...a);
      if(high)box(P.lichen,a[0],a[1]+a[4]/2+.024,a[2],a[3]*.86,.035,a[5]*.88);
    }
    // A jagged low wall/remnant and vegetation reclaiming the exposed concrete.
    box(P.concrete,-.48,.31,.61,.38,.56,.20,.3);
    box(P.shadow,.82,-.066,.72,.64,.05,.37);
    rubble(r,w,d,high?9:4);
    weather(r,w,d,.0,high?0:0);
  }
  function portal(r,l){
    const w=l.width,d=l.depth;
    box(P.graniteDark,0,-.18,d*.53,w+.2,.27,d+.12);
    // Rock-cut, sealed doorway. Intentionally non-interactive and physically outside
    // the player floor; no promise of a room behind the facade.
    box(P.concrete,-.94,.86,.47,.53,1.71,d*.63);
    box(P.light,.94,.87,.47,.55,1.72,d*.63);
    box(P.concrete,0,1.85,.43,2.5,.34,d*.82);
    box(P.shadow,0,.81,.082,1.39,1.47,.045);
    box(P.iron,0,.81,.050,1.27,1.38,.052);
    box(P.edge,0,.81,.018,.045,1.27,.021);
    box(P.rust,-.46,.38,.009,.052,.45,.022);
    box(P.rust,.43,1.1,.009,.07,.33,.022);
    if(high){
      box(P.edge,0,.39,.001,1.23,.055,.02);
      box(P.edge,0,1.29,.001,1.23,.042,.02);
      box(P.iron,.52,.76,-.004,.075,.17,.031);
    }
    box(P.concrete,0,2.09,.63,w*.91,.22,d*.74);
    rubble(r,w,d,high?16:8);
    weather(r,w,d,2.2,high?5:1);
  }
  let disposed=false;
  const roots=[];
  for(const l of landmarks??[]){
    const r=seededRandom(seed+':bung-geometry-v2:'+l.scene+':'+l.islandIndex);
    const root=new THREE.Group();
    root.name='military-'+l.scene;
    root.userData.visualOnly=true;
    root.position.set(l.center.x,0,l.center.z);
    root.rotation.y=l.ry;
    group.add(root);roots.push(root);stats.structures++;
    // Batches must be per root because each landmark has its own rotation.
    if(l.scene==='coastal-pillbox')pillbox(r,l);
    else if(l.scene==='overgrown-foundations')foundations(r,l);
    else if(l.scene==='sealed-rock-portal')portal(r,l);
    for(const batch of batches.values()){
      const mesh=new THREE.InstancedMesh(geometries[batch.kind],material(batch.color),batch.parts.length);
      const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
      const axis=new THREE.Vector3(0,1,0);
      batch.parts.forEach((p,i)=>{
        pos.set(p.x,p.y,p.z);quat.setFromAxisAngle(axis,p.rot);
        scale.set(p.w,p.h,p.d);
        mesh.setMatrixAt(i,matrix.compose(pos,quat,scale));
      });
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();
      mesh.castShadow=high;mesh.receiveShadow=true;
      mesh.userData.visualOnly=true;mesh.name='military-concrete-'+batch.kind;
      root.add(mesh);stats.meshes++;stats.drawCalls++;
    }
    batches.clear();
  }
  return {group,stats,dispose(){
    if(disposed)return;disposed=true;
    parent.remove(group);group.clear();
    for(const g of Object.values(geometries))g.dispose();
    for(const m of materials.values())m.dispose();
  }};
}
