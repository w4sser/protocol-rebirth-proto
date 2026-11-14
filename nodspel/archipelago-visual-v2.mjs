// Opt-in glacial landforms, adapted from archipelago-visual-target.html.
// Raised scenery stays outside the walkable coast; shared resources survive rebuilds.
import * as THREE from './vendor/three.module.js';
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
    const m=landform(angle,clamp(size*(.38+.10*hash(seed+i)),4.5,8),clamp(size*.23,2.8,4.5),1.55+hash(seed+i+41)*.75);
    if(m)masses.push(m);if(masses.length===3)break;
  }
  for(const m of masses)for(const direction of [-1,1]){
    const shelf=landform(m.angle+direction*.27,m.length*.73,1.45,.58);if(shelf)shelves.push(shelf);
  }
  return {masses,shelves};
}
function sculptGranite(){
  const steps=24,levels=[0,.07,.18,.33,.53,.72,.87,.95,1],radii=[.93,1,1.03,1.02,.98,.87,.71,.48,.13],positions=[],colors=[],indices=[];
  const base=new THREE.Color('#909898'),dark=new THREE.Color('#596a72'),warm=new THREE.Color('#aca5a0');
  for(let k=0;k<levels.length;k++)for(let j=0;j<=steps;j++){
    const a=j/steps*TAU,r=radii[k]*(1+.035*Math.sin(3*a+.6)+.025*Math.sin(7*a+1.2));
    positions.push(Math.cos(a)*.5*r,levels[k],Math.sin(a)*.5*r);
    const c=dark.clone().lerp(base,.24+.76*Math.sqrt(levels[k])).lerp(warm,.10+.08*Math.sin(a*2));colors.push(c.r,c.g,c.b);
    if(k<levels.length-1&&j<steps){const n=k*(steps+1)+j,b=n+steps+1;indices.push(n,b,n+1,n+1,b,b+1);}
  }
  // Seal the summit; an open final ring appears as a black pinhole in gameplay.
  const tip=positions.length/3,top=(levels.length-1)*(steps+1);positions.push(0,1.01,0);colors.push(base.r,base.g,base.b);
  for(let j=0;j<steps;j++)indices.push(top+j,tip,top+j+1);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.userData.shared=true;return geo;
}
const graniteGeo=sculptGranite(),graniteMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0}),groundMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
graniteMat.userData.shared=true;groundMat.userData.shared=true;
const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});grassMat.userData.shared=true;
const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
export function addArchipelagoGraniteV2(profile,group,{high=true,...options}={}){
  if(profile?.style!=='v2')return null;
  const plan=planArchipelagoBedrock(profile,options),parts=[...plan.masses,...plan.shelves],mesh=new THREE.InstancedMesh(graniteGeo,graniteMat,parts.length);
  mesh.name='arch-v2-glacial-shelves';mesh.userData.visualOnly=true;mesh.userData.bedrockPlan=plan;
  for(let i=0;i<parts.length;i++){const m=parts[i];pos.set(m.x,-.44,m.z);rot.setFromAxisAngle(up,m.rotation);scale.set(m.length,m.height,m.depth);mesh.setMatrixAt(i,matrix.compose(pos,rot,scale));}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=high;mesh.receiveShadow=true;group.add(mesh);
  // Do not add a planar granite apron: it intersects the sloping coast shell
  // and appears as triangular z-fighting at water and bridge landings on iOS.
  // The existing sculpted masses supply the outcrops beyond the playable edge.
  return mesh;
}
export function addArchipelagoGroundV2(profile,group,{high=true,reservations=[]}={}){
  if(profile?.style!=='v2')return null;
  const {floor,points,seed}=profile,n=points.length,rings=14,positions=[],colors=[],indices=[];
  // End the playable ground at the real organic walk boundary, not the
  // original rectangular room boundary. Match coastRingData's v2 first
  // ring exactly; the cliff begins there with no overlapping surface.
  // Gameplay remains flat (Y=.010); actors and authored cover are unchanged.
  const moss=new THREE.Color('#657b49'),olive=new THREE.Color('#7a8755'),shade=new THREE.Color('#4c6549'),rock=new THREE.Color('#99959f');
  for(let ring=0;ring<=rings;ring++)for(let i=0;i<n;i++){
    const p=points[i],f=ring/rings,r=Math.max(.05,p.playableRadial-.045)*f,x=floor.x+Math.cos(p.angle)*r,z=floor.z+Math.sin(p.angle)*r;positions.push(x,.010,z);
    const patches=.5+.25*Math.sin(x*.28+seed%13)+.25*Math.sin(z*.34+x*.14);
    const col=moss.clone().lerp(olive,clamp(patches,0,1)).lerp(shade,.12+.12*Math.sin(x*.53-z*.31));
    // Two broad, low-contrast bedrock traces within the flat gameplay plane;
    // they create geological continuity without any false cover/collision.
    const glacialA=Math.exp(-Math.pow((x-floor.x-floor.w*.30)/(floor.w*.23),2)-Math.pow((z-floor.z+floor.d*.28)/(floor.d*.24),2));
    const glacialB=Math.exp(-Math.pow((x-floor.x+floor.w*.32)/(floor.w*.21),2)-Math.pow((z-floor.z-floor.d*.29)/(floor.d*.22),2));
    const rockyTint=clamp(glacialA*.43+glacialB*.30+clamp((f-.87)/.13,0,1)*.15*(1-p.beach*.5),0,.52);
    col.lerp(rock,rockyTint);colors.push(col.r,col.g,col.b);
    if(ring<rings){const a=ring*n+i,b=ring*n+(i+1)%n,c=(ring+1)*n+i,d=(ring+1)*n+(i+1)%n;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,groundMat);mesh.name='arch-v2-moss-bedrock-ground';mesh.receiveShadow=true;mesh.userData.visualOnly=true;group.add(mesh);
  const blades=[],tones=[],grass=new THREE.Color('#63794b'),limit=high?80:32;
  for(let j=0,count=0;j<240&&count<limit;j++){
    const x=floor.x+(hash(seed+j*13)-.5)*floor.w*.94,z=floor.z+(hash(seed+j*17+881)-.5)*floor.d*.94;
    const radius=Math.hypot((x-floor.x)/(floor.w*.5),(z-floor.z)/(floor.d*.5));
    if(radius<.40||Math.sin(x*.71)*Math.cos(z*.56)<.05||reservations.some(r=>overlaps({x,z,w:.3,d:.3},r,.2)))continue;
    const h=.10+hash(seed+j*31)*.13;
    for(let b=0;b<3;b++){
      const a=b*2.1+hash(seed+j)*TAU,dx=Math.cos(a)*.07,dz=Math.sin(a)*.07;
      blades.push(x-dx,.014,z-dz,x+dx,.014,z+dz,x+dx*.5,h,z+dz*.5);
      for(let k=0;k<3;k++){const c=grass.clone().multiplyScalar(.8+hash(j+b+k)*.3);tones.push(c.r,c.g,c.b);}
    }
    count++;
  }
  if(blades.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));g.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));g.computeVertexNormals();const tufts=new THREE.Mesh(g,grassMat);tufts.name='arch-v2-sparse-grass';tufts.receiveShadow=true;tufts.userData.visualOnly=true;group.add(tufts);}
  return mesh;
}
export function planArchipelagoPines(level,spots){
  const result=[];
  for(const floor of level.floors.filter(f=>!f.dir)){
    const candidates=spots.filter(p=>Math.abs(p.x-floor.x)<floor.w/2&&Math.abs(p.z-floor.z)<floor.d/2)
      .filter(p=>Math.hypot((p.x-floor.x)/(floor.w/2),(p.z-floor.z)/(floor.d/2))>.48)
      .sort((a,b)=>hash(Math.round(a.x*61+a.z*97))-hash(Math.round(b.x*61+b.z*97)));
    const chosen=[],limit=clamp(Math.round(floor.w*floor.d/85),2,5);
    for(const p of candidates){if(chosen.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>3))chosen.push(p);if(chosen.length>=limit)break;}result.push(...chosen);
  }
  return result;
}
const barkMat=new THREE.MeshStandardMaterial({color:'#504c41',roughness:1}),pineMat=new THREE.MeshStandardMaterial({color:'#3b6558',roughness:1,flatShading:true}),trunkGeo=new THREE.CylinderGeometry(.09,.15,1,6),crownGeo=new THREE.IcosahedronGeometry(1,0);
for(const r of [barkMat,pineMat,trunkGeo,crownGeo])r.userData.shared=true;
export function archipelagoCoastalPine(spot){
  const g=new THREE.Group(),r=hash(Math.round(spot.x*111+spot.z*37)),h=2.6+r*.8;g.position.set(spot.x,0,spot.z);g.rotation.y=r*TAU;g.name='arch-v2-coastal-pine';g.userData.visualOnly=true;
  const trunk=new THREE.Mesh(trunkGeo,barkMat);trunk.scale.set(1,h,1);trunk.position.set(.12,h*.5,0);trunk.rotation.z=-.07;g.add(trunk);
  // Wind-shaped, horizontally spreading Scandinavian pine crowns; avoid three rounded balls.
  const branches=[[-.40,h-.30,-.14,1.08,.24,.62],[.25,h-.06,.13,.92,.27,.69],[.64,h-.47,-.19,.67,.20,.46],[-.12,h+.21,.04,.60,.20,.48]];
  for(let i=0;i<branches.length;i++){const [x,y,z,sx,sy,sz]=branches[i],crown=new THREE.Mesh(crownGeo,pineMat);crown.position.set(x,y,z);crown.scale.set(sx,sy,sz);crown.rotation.y=i*.79;g.add(crown);}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}
const portalMaterials=['#747a79','#27343b','#8e8e88'].map(color=>{const m=new THREE.MeshStandardMaterial({color,roughness:1});m.userData.shared=true;return m;}),cubeGeo=new THREE.BoxGeometry(1,1,1);cubeGeo.userData.shared=true;
function block(parent,x,y,z,w,h,d,m){const o=new THREE.Mesh(cubeGeo,portalMaterials[m]);o.position.set(x,y,z);o.scale.set(w,h,d);o.name='arch-v2-portal-concrete';o.receiveShadow=true;parent.add(o);return o;}
export function addArchipelagoTargetPortal(profile,group,options={}){
  if(profile?.style!=='v2')return null;const mass=planArchipelagoBedrock(profile,options).masses[0];if(!mass)return null;
  const g=new THREE.Group();g.name='arch-v2-rock-cut-portal';g.userData.visualOnly=true;g.position.set(mass.x,-.18,mass.z);g.rotation.y=mass.rotation;
  const front=mass.depth*.50,h=Math.min(1.28,mass.height*.66),w=Math.min(2,mass.length*.42);
  block(g,0,h*.5,front,w,h,.22,1);block(g,-w*.5-.12,h*.51,front-.10,.24,h+.12,.65,0);block(g,w*.5+.12,h*.51,front-.10,.24,h+.12,.65,0);block(g,0,h+.08,front-.10,w+.52,.20,.70,2);block(g,0,h*.5,front+.12,.045,h*.94,.02,0);group.add(g);return g;
}
export function addArchipelagoHorizonIslets(floors,group,seed,{high=true}={}){
  const islands=floors.filter(f=>!f.dir);if(!islands.length)return [];
  const b=islands.reduce((b,f)=>({x0:Math.min(b.x0,f.x-f.w/2),x1:Math.max(b.x1,f.x+f.w/2),z0:Math.min(b.z0,f.z-f.d/2),z1:Math.max(b.z1,f.z+f.d/2)}),{x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity});
  const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,spread=Math.max(b.x1-b.x0,b.z1-b.z0)/2,objects=[];
  for(let i=0;i<(high?5:3);i++){const a=TAU*(i*.21+.08+hash(seed+i)*.08),dist=spread+15+hash(i+seed)*17,rock=new THREE.Mesh(graniteGeo,graniteMat);rock.position.set(x+Math.cos(a)*dist,-.44,z+Math.sin(a)*dist);rock.rotation.y=a;rock.scale.set(5+hash(seed+i+11)*4,.7,3+hash(seed+i+27)*2);rock.name='arch-v2-distant-skerry';rock.userData.visualOnly=true;group.add(rock);objects.push(rock);}return objects;
}
