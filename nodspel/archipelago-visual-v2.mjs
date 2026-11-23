// Opt-in glacial landforms, adapted from archipelago-visual-target.html.
// Raised scenery stays outside the walkable coast; shared resources survive rebuilds.
import * as THREE from './vendor/three.module.js';
import {archipelagoGroundColor} from './coastline.mjs?v=2.28.69-glacial-s42';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(n){let x=(n|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
const overlaps=(a,b,pad=.3)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+pad&&Math.abs(a.z-b.z)<(a.d+b.d)/2+pad;
function coastRadiusAt(profile,x,z,key){
  const t=((Math.atan2(z-profile.floor.z,x-profile.floor.x)+TAU)%TAU)/TAU*profile.points.length,i=Math.floor(t),f=t-i;
  return profile.points[i][key]*(1-f)+profile.points[(i+1)%profile.points.length][key]*f;
}
export function planArchipelagoBedrock(profile,{reservations=[],neighbors=[],neighborProfiles=[]}={}){
  if(profile?.style!=='v2')return {masses:[],shelves:[]};
  const {floor,points,seed}=profile,masses=[],shelves=[],size=Math.min(floor.w,floor.d),phase=hash(seed+417)*TAU;
  function landform(angle,length,depth,height){
    angle=(angle+TAU)%TAU;
    const p=points[Math.round(angle/TAU*points.length)%points.length],c=Math.cos(angle),s=Math.sin(angle);
    let r=p.radial+depth*.52-.43,x,z,clear=false;
    // A long rock can cross a concave shore away from its centerline. Check
    // the entire conservative ellipse, not just one radial sample.
    for(let attempt=0;attempt<7&&!clear;attempt++){
      x=floor.x+c*r;z=floor.z+s*r;clear=true;
      const footprint=[];
      for(let j=0;j<32;j++){
        const a=j/32*TAU;footprint.push({tx:length*.55*Math.cos(a),tz:depth*.55*Math.sin(a)});
      }
      // Include the complete concrete frame, which projects beyond the ellipse.
      if(height>1.2)for(const tx of [-(Math.min(2,length*.42)+.52)/2,0,(Math.min(2,length*.42)+.52)/2])for(const tz of [depth*.50-.45,depth*.50+.25])footprint.push({tx,tz});
      for(const p of footprint){
        const px=x-s*p.tx-c*p.tz,pz=z+c*p.tx-s*p.tz;
        if(Math.hypot(px-floor.x,pz-floor.z)<coastRadiusAt(profile,px,pz,'playableRadial')+.12){clear=false;break;}
        if(neighborProfiles.some(other=>other!==profile&&Math.hypot(px-other.floor.x,pz-other.floor.z)<coastRadiusAt(other,px,pz,'radial')+.6))return null;
      }
      if(!clear)r+=.20;
    }
    if(!clear)return null;
    const bounds={x,z,w:Math.abs(s)*length*1.06+Math.abs(c)*(depth*1.06+.5),d:Math.abs(c)*length*1.06+Math.abs(s)*(depth*1.06+.5)};
    if(reservations.some(q=>overlaps(bounds,q))||neighbors.some(q=>q!==floor&&!q.dir&&overlaps(bounds,q,1.2)))return null;
    if(height>1.2)for(let j=-1;j<=1;j++){
      const q=points[(Math.round(angle/TAU*points.length)+j+points.length)%points.length];
      for(const radius of [q.playableRadial-.08,q.radial+depth*.70]){
        const px=floor.x+Math.cos(q.angle)*radius,pz=floor.z+Math.sin(q.angle)*radius;
        if(neighborProfiles.some(other=>other!==profile&&Math.hypot(px-other.floor.x,pz-other.floor.z)<coastRadiusAt(other,px,pz,'radial')+.6))return null;
      }
    }
    return {x,z,angle,rotation:-angle-Math.PI/2,length,depth,height,bounds};
  }
  const candidates=Array.from({length:24},(_,i)=>({i,score:hash(seed+i*73+11)})).sort((a,b)=>b.score-a.score);
  for(const {i} of candidates){
    const angle=(phase+i/24*TAU)%TAU;
    if(masses.some(m=>Math.abs(Math.atan2(Math.sin(angle-m.angle),Math.cos(angle-m.angle)))<1.1))continue;
    const height=masses.length===0?1.72+hash(seed+i+41)*.42:1.22+hash(seed+i+41)*.28;
    const m=landform(angle,clamp(size*(.33+.09*hash(seed+i)),4.3,6.7),clamp(size*.28,3.2,5.0),height);
    if(m)masses.push(m);if(masses.length===3)break;
  }
  for(const m of masses)for(const direction of [-1,1]){
    const shelf=landform(m.angle+direction*.27,m.length*.73,1.45,.58);if(shelf)shelves.push(shelf);
  }
  return {masses,shelves};
}
function sculptGranite(){
  // One continuous indexed bedrock surface rather than three overlapping
  // tier shells. Ice-worn shoulders use broad asymmetrical faceted planes.
  // The low root rests inside the existing shore without a coplanar apron.
  const steps=34;
  const rings=[
    [0,1.04],[.027,1.12],[.09,1.16],[.15,1.16],
    [.23,1.13],[.31,1.10],[.38,1.075],[.43,1.055],
    [.464,1.018],[.477,.935],[.502,.908],[.56,.89],
    [.625,.851],[.674,.808],[.711,.770],[.729,.682],
    [.765,.665],[.806,.625],[.857,.594],[.897,.551],
    [.923,.544],[.94,.465],[.974,.448],[1,.413]
  ];
  const positions=[],colors=[],indices=[];
  const shadow=new THREE.Color('#60717d'),weathered=new THREE.Color('#a2a3ac');
  const twilight=new THREE.Color('#b0a0ad'),moss=new THREE.Color('#788674');
  for(let k=0;k<rings.length;k++)for(let j=0;j<=steps;j++){
    const a=j/steps*TAU,[h,nominal]=rings[k];
    const cs=Math.cos(a),sn=Math.sin(a);
    const r=nominal*(1+.068*Math.sin(3*a+.38)+.049*Math.cos(2*a+1.18)
      +.019*Math.sin(7*a-.48));
    const x=Math.sign(cs)*Math.pow(Math.abs(cs),.86)*r*.5+h*.068*Math.sin(1.1);
    const z=Math.sign(sn)*Math.pow(Math.abs(sn),.90)*r*.5-h*.083;
    const y=h+.005*Math.sin(5*a+h*8)*Math.sin(h*Math.PI);
    positions.push(x,y,z);
    const strata=.5+.5*Math.sin(9*a+8*h+.5),crack=.5+.5*Math.sin(17*a-7*h);
    const color=shadow.clone().lerp(weathered,.32+.53*Math.sqrt(h)+.048*strata)
      .lerp(twilight,.045+.09*(.5+.5*Math.sin(2*a+1.3)))
      .lerp(moss,(.015+.06*crack)*(1-h*.4));
    colors.push(color.r,color.g,color.b);
    if(k<rings.length-1&&j<steps){
      const n=k*(steps+1)+j,q=n+steps+1;
      indices.push(n,q,n+1,n+1,q,q+1);
    }
  }
  const top=(rings.length-1)*(steps+1),tip=positions.length/3;
  positions.push(.06,1.004,-.075);
  colors.push(weathered.r,weathered.g,weathered.b);
  for(let j=0;j<steps;j++)indices.push(top+j,tip,top+j+1);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  geo.userData.shared=true;geo.userData.continuousGlacialMass=true;
  return geo;
}
const graniteGeo=sculptGranite(),graniteMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,flatShading:true}),groundMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
graniteMat.userData.shared=true;groundMat.userData.shared=true;
const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});grassMat.userData.shared=true;
const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
export function addArchipelagoGraniteV2(profile,group,{high=true,...options}={}){
  if(profile?.style!=='v2')return null;
  const plan=planArchipelagoBedrock(profile,options),parts=[...plan.masses,...plan.shelves],mesh=new THREE.InstancedMesh(graniteGeo,graniteMat,parts.length);
  mesh.name='arch-v2-glacial-shelves';mesh.userData.visualOnly=true;mesh.userData.bedrockPlan=plan;
  for(let i=0;i<parts.length;i++){const m=parts[i];pos.set(m.x,-.44,m.z);rot.setFromAxisAngle(up,m.rotation);// Keep sculpted mid-shoulders safely inside the same conservative clearance
    // used by the planner, including concave shoreline seeds and bridges.
    scale.set(m.length*.94,m.height,m.depth*.94);mesh.setMatrixAt(i,matrix.compose(pos,rot,scale));}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=high;mesh.receiveShadow=true;group.add(mesh);
  // Do not add a planar granite apron: it intersects the sloping coast shell
  // and appears as triangular z-fighting at water and bridge landings on iOS.
  // The existing sculpted masses supply the outcrops beyond the playable edge.
  return mesh;
}
export function addArchipelagoGroundV2(profile,group,{high=true,reservations=[],bedrockPlan=null}={}){
  if(profile?.style!=='v2')return null;
  // Keep the visual-target's winding earth paths readable without any extra
  // coplanar path mesh. Hero terrain has extra radial vertices in HIGH and LOW.
  const {floor,points,seed}=profile,n=points.length,rings=profile.heroCoast?30:18,positions=[],colors=[],indices=[];
  // A single continuous top surface keeps the physical flat actor plane.
  // Geological fingers and sheltered soil are baked into its vertex color,
  // not layered as coplanar rock or fake collision cover.
  const plan=bedrockPlan??planArchipelagoBedrock(profile);
  for(let ring=0;ring<=rings;ring++)for(let i=0;i<n;i++){
    const p=points[i],f=ring/rings,r=Math.max(.05,p.playableRadial-.045)*f;
    const x=floor.x+Math.cos(p.angle)*r,z=floor.z+Math.sin(p.angle)*r;
    positions.push(x,.010,z);
    // The coast renderer samples this *same* geological surface at the
    // final ring, avoiding an artificial uniformly tinted border strip.
    const col=archipelagoGroundColor(profile,x,z,plan);
    colors.push(col[0],col[1],col[2]);
    if(ring<rings){const a=ring*n+i,b=ring*n+(i+1)%n,c=(ring+1)*n+i,d=(ring+1)*n+(i+1)%n;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,groundMat);mesh.name='arch-v2-moss-bedrock-ground';mesh.receiveShadow=true;mesh.userData.visualOnly=true;group.add(mesh);
  // One draw call for deterministic, clustered coastal ecology. The near
  // center stays open; heather lives near mineral patches and lee-side inlets.
  const blades=[],tones=[],grass=new THREE.Color('#6d895c'),heather=new THREE.Color('#89778d');
  const bracken=new THREE.Color('#526f53'),cover=planArchipelagoGroundcover(profile,{high,reservations});
  for(const tuft of cover){
    const {x,z,h,kind}=tuft;
    const color=kind==='heather'?heather:kind==='bracken'?bracken:grass;
    for(let b=0;b<3;b++){
      const a=b*2.1+hash(Math.round(x*31+z*67))*TAU,dx=Math.cos(a)*.072,dz=Math.sin(a)*.072;
      blades.push(x-dx,.014,z-dz,x+dx,.014,z+dz,x+dx*.48,h,z+dz*.48);
      for(let k=0;k<3;k++){const c=color.clone().multiplyScalar(.79+hash(Math.round(x*47+z*23+b*17+k))*.35);tones.push(c.r,c.g,c.b);}
    }
  }
  if(blades.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));g.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));g.computeVertexNormals();const tufts=new THREE.Mesh(g,grassMat);tufts.name='arch-v2-coastal-groundcover';tufts.receiveShadow=true;tufts.userData.visualOnly=true;group.add(tufts);}
  return mesh;
}

// Deterministic coastal clusters. LOW is a true subset of HIGH for the same
// seed; clusters avoid authored lanes/objectives and never alter collision.
export function planArchipelagoGroundcover(profile,{high=true,reservations=[]}={}){
  if(profile?.style!=='v2')return [];
  const {floor,points,seed}=profile,limit=high?12:6,result=[];
  for(let cluster=0;cluster<12;cluster++){
    const a=TAU*hash(seed+701+cluster*83),idx=a/TAU*points.length,j=Math.floor(idx),t=idx-j;
    const edge=points[j].playableRadial*(1-t)+points[(j+1)%points.length].playableRadial*t;
    const f=.52+.34*hash(seed+cluster*167+71);
    const x0=floor.x+Math.cos(a)*edge*f,z0=floor.z+Math.sin(a)*edge*f;
    // Natural patches, not regularly spaced individual grass blades.
    for(let i=0;i<limit;i++){
      const seedK=seed+cluster*1009+i*71,theta=hash(seedK+13)*TAU;
      const radius=Math.sqrt(hash(seedK+41))*(.43+.56*hash(seedK+73));
      const x=x0+Math.cos(theta)*radius,z=z0+Math.sin(theta)*radius;
      const rr=Math.hypot(x-floor.x,z-floor.z);
      if(rr>coastRadiusAt(profile,x,z,'playableRadial')-.45)continue;
      if(reservations.some(q=>overlaps({x,z,w:.40,d:.40},q,.15)))continue;
      const kind=cluster%4===0?'heather':cluster%3===0?'bracken':'grass';
      result.push({x,z,h:(kind==='bracken'?.25:.14)+hash(seedK+97)*(kind==='heather'?.19:.15),kind});
    }
  }
  return result;
}
// The four silhouette families are deliberately different at raid-camera scale:
// low shoreline scrub, leaning wind-shaped pine, tall sparse sentinel and
// crooked mid-height pine. Trees remain visual-only; gameplay stays planar.
const PINE_SHAPES=[
  {name:'shore-dwarf',h:2.0,lean:.13,crowns:[
    [-.48,.76,.06,1.05,.25,.70],[.30,.84,-.12,.93,.25,.69],[.03,1.0,.12,.70,.19,.49]]},
  {name:'windswept',h:3.3,lean:.22,crowns:[
    [-.56,.76,-.04,1.17,.25,.72],[.44,.89,.12,1.12,.28,.67],[.94,.79,-.15,.68,.21,.46],[-.10,1.01,.03,.76,.22,.58]]},
  {name:'sentinel',h:5.5,lean:.06,crowns:[
    [-.52,.75,-.04,1.03,.27,.68],[.43,.83,.20,1.18,.26,.74],[-.27,.93,.18,.93,.25,.60],[.48,.99,-.16,.75,.20,.55],[.03,1.08,.02,.60,.19,.48]]},
  {name:'crooked',h:4.0,lean:.30,crowns:[
    [-.43,.69,.05,.89,.24,.63],[.50,.79,-.12,1.06,.25,.72],[.81,.94,.17,.75,.23,.53],[-.07,1.02,.03,.79,.22,.58]]}
];
export function planArchipelagoPines(level,spots){
  const result=[],floors=level.floors.filter(f=>!f.dir);
  for(let floorIndex=0;floorIndex<floors.length;floorIndex++){
    const floor=floors[floorIndex];
    const candidates=spots.filter(p=>Math.abs(p.x-floor.x)<floor.w/2&&Math.abs(p.z-floor.z)<floor.d/2)
      .filter(p=>Math.hypot((p.x-floor.x)/(floor.w/2),(p.z-floor.z)/(floor.d/2))>.52)
      .sort((a,b)=>hash(Math.round(a.x*61+a.z*97))-hash(Math.round(b.x*61+b.z*97)));
    const chosen=[],limit=clamp(Math.round(floor.w*floor.d/85),2,5);
    const first=Math.floor(hash(Math.round(floor.x*13+floor.z*23+floorIndex*37))*PINE_SHAPES.length);
    for(const p of candidates){
      if(chosen.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>3.2)){
        const seed=Math.round(p.x*211+p.z*163+floorIndex*41);
        chosen.push({...p,pineVariant:(first+chosen.length)%PINE_SHAPES.length,pineSeed:seed,
          pineScale:.85+hash(seed+29)*.30});
      }
      if(chosen.length>=limit)break;
    }
    result.push(...chosen);
  }
  return result;
}
const barkMat=new THREE.MeshStandardMaterial({color:'#504c41',roughness:1,flatShading:true});
const pineMats=['#234a42','#31594c','#436857'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
const trunkGeo=new THREE.CylinderGeometry(.082,.16,1,6);
const twigGeo=new THREE.CylinderGeometry(.040,.077,1,5);
const crownGeo=new THREE.IcosahedronGeometry(1,0);
const UP=new THREE.Vector3(0,1,0);
for(const r of [barkMat,...pineMats,trunkGeo,twigGeo,crownGeo])r.userData.shared=true;
function pinePart(group,mesh){
  mesh.pineOpaqueMaterial=mesh.material;
  mesh.castShadow=true;
  group.pineMeshes.push(mesh);
  group.add(mesh);
}
function pineBranch(group,ax,ay,az,bx,by,bz,thickness){
  const from=new THREE.Vector3(ax,ay,az),to=new THREE.Vector3(bx,by,bz),delta=to.clone().sub(from),length=delta.length();
  const mesh=new THREE.Mesh(twigGeo,barkMat);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(UP,delta.multiplyScalar(1/length));
  mesh.scale.set(thickness,length,thickness);
  pinePart(group,mesh);
}
export function archipelagoCoastalPine(spot,{low=false}={}){
  const seed=spot.pineSeed??Math.round(spot.x*111+spot.z*37);
  const variant=((spot.pineVariant??Math.floor(hash(seed+17)*4))%4+4)%4;
  const shape=PINE_SHAPES[variant],scale=spot.pineScale??(.85+hash(seed+29)*.3);
  const height=shape.h*scale,lean=shape.lean*(.72+hash(seed+13)*.56);
  const g=new THREE.Group();
  g.position.set(spot.x,-.025,spot.z);
  g.rotation.y=hash(seed+113)*TAU;
  g.name='arch-v2-coastal-pine';
  g.userData.visualOnly=true;
  g.userData.pineVariant=shape.name;
  g.userData.pineHeight=height;
  g.pineMeshes=[];
  g.pineFadeMaterials=new Map();
  g.userData.pineOpacity=1;
  // Segmented, slightly bent trunk; pine crowns sit high enough to expose
  // recognisable bark. No spruce/conical Christmas-tree silhouette.
  const lower=new THREE.Mesh(trunkGeo,barkMat);
  lower.position.set(lean*height*.09,height*.27,0);
  lower.scale.set(scale,height*.55,scale);
  lower.rotation.z=-lean*.34;
  pinePart(g,lower);
  const upper=new THREE.Mesh(trunkGeo,barkMat);
  upper.position.set(lean*height*.29,height*.75,0);
  upper.scale.set(scale*.68,height*.51,scale*.68);
  upper.rotation.z=-lean*.76;
  pinePart(g,upper);
  const total=low?Math.min(3,shape.crowns.length):shape.crowns.length;
  for(let i=0;i<total;i++){
    const [x,y,z,sx,sy,sz]=shape.crowns[i],j=hash(seed+i*79+31)-.5;
    const crown=new THREE.Mesh(crownGeo,pineMats[(i+variant)%pineMats.length]);
    crown.position.set(x*scale+lean*height*.46+j*.14,y*height+j*.10,z*scale+j*.12);
    crown.scale.set(sx*scale*(.91+hash(seed+i*17)*.19),sy*scale,sz*scale);
    crown.rotation.y=hash(seed+i*37+107)*TAU;
    crown.rotation.z=j*.14;
    pinePart(g,crown);
    // Visible sparse branches communicate Swedish Scots pine rather than
    // disconnected floating canopy pads. LOW retains the silhouette only.
    if(!low&&i<2)pineBranch(g,lean*height*.23,height*(.59+i*.11),0,
      crown.position.x*.80,crown.position.y-.08,crown.position.z*.8,.65*scale);
  }
  return g;
}
// Each tree has its own fade material, so a pine in the foreground can become
// translucent without fading every pine sharing its normal opaque material.
export function setArchipelagoPineOpacity(tree,opacity){
  if(!tree?.pineMeshes)return;
  const a=clamp(opacity,.20,1),fading=a<.995;
  if(Math.abs(a-tree.userData.pineOpacity)<.003)return;
  for(const mesh of tree.pineMeshes){
    if(fading){
      const original=mesh.pineOpaqueMaterial;
      let faded=tree.pineFadeMaterials.get(original);
      if(!faded){
        faded=original.clone();
        faded.transparent=true;
        faded.depthWrite=false;
        faded.userData.shared=false;
        tree.pineFadeMaterials.set(original,faded);
      }
      faded.opacity=a;
      mesh.material=faded;
    }else mesh.material=mesh.pineOpaqueMaterial;
    mesh.castShadow=!fading;
  }
  tree.userData.pineOpacity=a;
}
const portalMaterials=['#747a79','#27343b','#8e8e88'].map(color=>{const m=new THREE.MeshStandardMaterial({color,roughness:1});m.userData.shared=true;return m;}),cubeGeo=new THREE.BoxGeometry(1,1,1);cubeGeo.userData.shared=true;
function block(parent,x,y,z,w,h,d,m){const o=new THREE.Mesh(cubeGeo,portalMaterials[m]);o.position.set(x,y,z);o.scale.set(w,h,d);o.name='arch-v2-portal-concrete';o.receiveShadow=true;parent.add(o);return o;}
export function addArchipelagoTargetPortal(profile,group,options={}){
  if(profile?.style!=='v2')return null;
  const hero=profile.heroCoast,head=hero?profile.heroHeadlands?.[0]:null;
  const mass=hero?null:planArchipelagoBedrock(profile,options).masses[0];
  if(!mass&&!head)return null;
  const g=new THREE.Group();g.name='arch-v2-rock-cut-portal';g.userData.visualOnly=true;
  if(hero){
    const index=Math.round(head.angle/TAU*profile.points.length)%profile.points.length;
    const p=profile.points[index],radius=p.playableRadial+(p.radial-p.playableRadial)*.63;
    g.position.set(profile.floor.x+Math.cos(head.angle)*radius,
      .25+(p.heroRelief??0)*1.67,
      profile.floor.z+Math.sin(head.angle)*radius);
    g.rotation.y=-head.angle-Math.PI/2;
    g.userData.integratedHero=true;
  }else{
    g.position.set(mass.x,-.18,mass.z);g.rotation.y=mass.rotation;
  }
  const front=hero?.28:mass.depth*.50;
  const h=hero?1.10:Math.min(1.28,mass.height*.66);
  const w=hero?1.75:Math.min(2,mass.length*.42);
  // Face the inner approach: the dark door projects ahead of the frame,
  // rather than disappearing behind the solid glacial mesh at the coast.
  block(g,0,h*.5,front+.15,w*.86,h,.14,1);
  block(g,-w*.5-.12,h*.51,front-.10,.24,h+.12,.65,0);
  block(g,w*.5+.12,h*.51,front-.10,.24,h+.12,.65,0);
  block(g,0,h+.08,front-.10,w+.52,.20,.70,2);
  block(g,0,h*.5,front+.235,.045,h*.94,.018,0);
  const lamp=new THREE.Mesh(cubeGeo,new THREE.MeshBasicMaterial({color:'#ffc692'}));
  lamp.scale.set(.28,.07,.12);lamp.position.set(0,h+.055,front+.22);lamp.userData.visualOnly=true;g.add(lamp);
  group.add(g);return g;
}

const shedMaterials=['#675349','#414b4e','#77766f','#ad947b'].map(color=>{const m=new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0});m.userData.shared=true;return m;});
export function addArchipelagoTargetShed(profile,group,options={}){
  if(profile?.style!=='v2')return null;
  const hero=profile.heroCoast,head=hero?profile.heroHeadlands?.[1]:null;
  const mass=hero?null:planArchipelagoBedrock(profile,options).masses[1];
  if(!head&&!mass)return null;
  // In the hero island, the utility shed sits on the same coastal landform
  // as the cliffs instead of floating atop an unrelated stone instance.
  const g=new THREE.Group();g.name='arch-v2-coastal-shed';g.userData.visualOnly=true;
  if(hero){
    const index=Math.round(head.angle/TAU*profile.points.length)%profile.points.length;
    const p=profile.points[index],radius=p.playableRadial+(p.radial-p.playableRadial)*.73;
    g.position.set(profile.floor.x+Math.cos(head.angle)*radius,
      .25+(p.heroRelief??0)*1.64,
      profile.floor.z+Math.sin(head.angle)*radius);
    g.rotation.y=-head.angle-Math.PI/2;
    g.userData.integratedHero=true;
  }else{
    g.position.set(mass.x,mass.height*.66-.44,mass.z);g.rotation.y=mass.rotation;
  }
  function slab(x,y,z,w,h,d,index){
    const mesh=new THREE.Mesh(cubeGeo,shedMaterials[index]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  const w=1.65,d=1.25,h=1.25;
  slab(0,.055,0,w,.11,d,2);
  slab(-w*.5,.64,0,.10,h,d,0);slab(w*.5,.64,0,.10,h,d,0);
  slab(0,.64,-d*.5,w,h,.10,0);slab(-.50,.64,d*.5,.53,h,.09,0);slab(.52,.64,d*.5,.54,h,.09,0);
  slab(.03,1.33,0,w+.24,.14,d+.25,1);slab(.03,1.34,0,w+.20,.025,d+.16,2);
  slab(-.09,.69,d*.5+.065,.58,1.06,.035,1);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.08),new THREE.MeshBasicMaterial({color:'#ffc996'}));
  lamp.position.set(.52,1.04,d*.5+.10);lamp.userData.visualOnly=true;g.add(lamp);
  group.add(g);return g;
}

export function addArchipelagoHorizonIslets(floors,group,seed,{high=true}={}){
  const islands=floors.filter(f=>!f.dir);if(!islands.length)return [];
  const b=islands.reduce((b,f)=>({x0:Math.min(b.x0,f.x-f.w/2),x1:Math.max(b.x1,f.x+f.w/2),z0:Math.min(b.z0,f.z-f.d/2),z1:Math.max(b.z1,f.z+f.d/2)}),{x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity});
  const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,spread=Math.max(b.x1-b.x0,b.z1-b.z0)/2,objects=[];
  for(let i=0;i<(high?5:3);i++){const a=TAU*(i*.21+.08+hash(seed+i)*.08),dist=spread+15+hash(i+seed)*17,rock=new THREE.Mesh(graniteGeo,graniteMat);rock.position.set(x+Math.cos(a)*dist,-.44,z+Math.sin(a)*dist);rock.rotation.y=a;rock.scale.set(5+hash(seed+i+11)*4,.7,3+hash(seed+i+27)*2);rock.name='arch-v2-distant-skerry';rock.userData.visualOnly=true;group.add(rock);objects.push(rock);}return objects;
}
