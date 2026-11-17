/*
 * Protocol Rebirth — Operator v3, close-up Deploy portrait.
 *
 * This is a genuine fully rotatable mesh, not the reference painting or an
 * extruded flat card. Designed for the full-height menu camera only.
 *
 * Target: approved faceless hooded Nordic scavenger (AD-06). Anatomical form,
 * angular layered cloth, asymmetrical torn cloak, weathered tactical rig and
 * calm ready pose. No exposed face, no toy-like cylinders or spherical knees.
 *
 * Gameplay's economical GLB is unchanged.
 */
import * as THREE from '../nodspel/vendor/three.module.js';

const PALETTE={
  coat:0x514b45, coatDark:0x343b3b, coatEdge:0x746c60,
  trousers:0x313539, trouserFold:0x464849,
  webbing:0x4a473f, straps:0x33302d, leather:0x2d2928,
  armor:0x484947, armorEdge:0x6e6b61, plate:0x353b3c,
  boot:0x282a2b, sole:0x202426,
  receiver:0x262a2b, steel:0x414748,
  wrap:0x111416, void:0x020405, light:0x75cfcc, amber:0xd99b5b
};
let randomState=4711;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const mk=(color,metalness=.05,roughness=.93,extra={})=>
  new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
function weave(color,seed=1){
  if(typeof document==='undefined')return null;
  const el=document.createElement('canvas');el.width=256;el.height=256;
  const ctx=el.getContext('2d');if(!ctx)return null;
  let n=seed;
  const rr=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const c=[(color>>>16)&255,(color>>>8)&255,color&255];
  const px=ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const idx=(y*256+x)*4;
    const grain=(rr()-.5)*34+((x+y)%5===0?-6:0)+
      ((x%4===0 || y%4===0)?2:0);
    const abrasion=rr()>.996?35:0;
    for(let j=0;j<3;j++)px.data[idx+j]=Math.max(0,Math.min(255,c[j]+grain+abrasion));
    px.data[idx+3]=255;
  }
  ctx.putImageData(px,0,0);
  ctx.globalAlpha=.24;ctx.strokeStyle='rgba(255,250,232,.2)';
  for(let i=0;i<170;i++){
    const x=rr()*256,y=rr()*256;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rr()-.4)*20,y+(rr()-.4)*31);ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(el);tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;
  return tex;
}
const fabric=(hex,seed)=>{const map=weave(hex,seed);return mk(map?0xffffff:hex,.03,.98,map?{map}:{})};
function add(parent,name,geometry,material,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  return mesh;
}
function ebox(parent,name,pos,size,material,radius=.008){
  const [w,h,d]=size,rad=Math.min(radius,w*.28,h*.28);
  const s=new THREE.Shape();s.moveTo(-w/2+rad,-h/2);
  s.lineTo(w/2-rad,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+rad);
  s.lineTo(w/2,h/2-rad);s.quadraticCurveTo(w/2,h/2,w/2-rad,h/2);
  s.lineTo(-w/2+rad,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-rad);
  s.lineTo(-w/2,-h/2+rad);s.quadraticCurveTo(-w/2,-h/2,-w/2+rad,-h/2);
  const thickness=Math.min(.005,d*.20);
  const geometry=new THREE.ExtrudeGeometry(s,{depth:d-thickness*2,steps:1,
    bevelEnabled:true,bevelThickness:thickness,bevelSize:thickness,bevelSegments:2,curveSegments:3});
  geometry.translate(0,0,-(d-thickness*2)/2);
  return add(parent,name,geometry,material,...pos);
}
function ellipsoid(parent,name,center,radii,material,segments=24){
  const o=add(parent,name,new THREE.SphereGeometry(1,segments,Math.max(12,Math.floor(segments*.72))),material,...center);
  o.scale.set(...radii);return o;
}
function pathTube(parent,name,pts,radius,material,segments=24){
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)));
  return add(parent,name,new THREE.TubeGeometry(curve,segments,radius,7,false),material);
}
function between(parent,name,a,b,r0,r1,material,segments=18){
  const v0=V(...a),v1=V(...b),axis=v1.clone().sub(v0);
  const piece=add(parent,name,new THREE.CylinderGeometry(r1,r0,axis.length(),segments,2),material,
    ...v0.clone().add(v1).multiplyScalar(.5).toArray());
  piece.quaternion.setFromUnitVectors(V(0,1,0),axis.normalize());
  return piece;
}
// Non-uniform elliptical rings around a spline. Purposefully avoids the toy
// cylinder anatomy of v2. The ring noise generates dense fabric folds.
function organicLimb(parent,name,points,radii,material,{ellipse=.84,folds=6,seed=0}={}){
  const path=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
  const rings=28,sides=20;
  const positions=[],uv=[],ids=[];
  const tangent=V(0,1,0),right=V(1,0,0),front=V(0,0,1);
  for(let i=0;i<=rings;i++){
    const t=i/rings;
    path.getTangent(t,tangent).normalize();
    right.crossVectors(tangent,V(0,0,1)).normalize();
    if(right.lengthSq()<.1)right.set(1,0,0);
    front.crossVectors(right,tangent).normalize();
    const p=path.getPoint(t);
    const radial=t*(radii.length-1),lo=Math.min(Math.floor(radial),radii.length-2);
    const a=radial-lo;
    const base=radii[lo]*(1-a)+radii[lo+1]*a;
    for(let j=0;j<=sides;j++){
      const ang=j/sides*Math.PI*2;
      const fold=(Math.sin(t*Math.PI*folds*2+ang*2.5+seed)*.017+
        Math.cos(ang*5+seed*1.3)*.006)*(Math.sin(Math.PI*t)*.8+.2);
      const radius=base*(1+fold/base);
      const p2=p.clone().addScaledVector(right,Math.cos(ang)*radius)
        .addScaledVector(front,Math.sin(ang)*radius*ellipse);
      positions.push(p2.x,p2.y,p2.z);uv.push(j/sides,t*2.5);
      if(i<rings&&j<sides){
        const n=i*(sides+1)+j,bot=n+sides+1;
        // Winding faces outward: otherwise FrontSide culling hides cloth from camera.
        ids.push(n,bot,n+1,n+1,bot,bot+1);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(ids);g.computeVertexNormals();
  return add(parent,name,g,material);
}
function panel(parent,name,rows,material,{doubleSided=true}={}){
  // rows: y, xLeft, xRight, frontZ, backZ, irregular edge offsets
  const coords=[],uv=[],ind=[];
  const columns=18;
  rows.forEach(([y,xL,xR,z],i)=>{
    for(let j=0;j<=columns;j++){
      const u=j/columns,x=xL+(xR-xL)*u;
      const wave=(Math.sin(u*Math.PI*6+i*.42)*.026+Math.sin(u*Math.PI*11+i*.18)*.014);
      coords.push(x,y+Math.sin(u*9+i*.5)*.009,z+wave);
      uv.push(u,i/(rows.length-1));
      if(i<rows.length-1&&j<columns){
        const a=i*(columns+1)+j,b=a+columns+1;
        ind.push(a,b,a+1,b,b+1,a+1);
      }
    }
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(ind);geo.computeVertexNormals();
  let materialCloth=material;
  if(doubleSided){materialCloth=material.clone();materialCloth.side=THREE.DoubleSide;}
  return add(parent,name,geo,materialCloth);
}
function polygon(parent,name,outline,depth,material,position=[0,0,0]){
  const shape=new THREE.Shape();shape.moveTo(outline[0][0],outline[0][1]);
  for(const p of outline.slice(1))shape.lineTo(p[0],p[1]);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.008,bevelSize:.009,bevelSegments:2,steps:1});
  return add(parent,name,geo,material,...position);
}
function nubbins(parent,base,material,rows=3){
  for(let j=0;j<rows;j++)for(let i=0;i<4;i++)
    ebox(parent,'MOLLE webbing',[base[0]+i*.082,base[1]-j*.064,base[2]],[.056,.019,.016],material,.003);
}
function seam(parent,name,points,m,r=.0035){return pathTube(parent,name,points,r,m,22);}
function buckle(parent,center,m){
  const [x,y,z]=center;
  ebox(parent,'bronze buckle',center,[.045,.047,.017],m,.006);
  ebox(parent,'recessed buckle',[x,y,z+.012],[.024,.022,.008],m,.002);
}
function boot(parent,side,M){
  const x=side*(.165+ (side>0?.035:0));
  const ankle=organicLimb(parent,'gaiter fabric '+side,
    [[x,.40,-.025],[x,.30,.005],[x,.18,.045]],[.115,.123,.131],M.trousers,{ellipse:.94,seed:side+5});
  // Shoes have broad angular toe boxes, square lugged soles, tread and laces
  // rather than small capsules poking through the character silhouette.
  ellipsoid(parent,'boot upper',[x,.133,.112],[.143,.131,.247],M.boot,24);
  ebox(parent,'lugged sole',[x,.059,.137],[.302,.082,.445],M.sole,.026);
  polygon(parent,'toe reinforced cap',[[-.116,-.045],[.116,-.045],[.135,.03],[.097,.075],[-.097,.075],[-.135,.03]],.011,
    M.armorEdge,[x,.099,.299]);
  for(let i=0;i<4;i++){
    ebox(parent,'lace eyelet',[x,.177-i*.024,.26-i*.022],[.17,.008,.011],M.steel,.003);
    seam(parent,'lace',[ [x-.071,.181-i*.024,.261-i*.022],[x,.17-i*.024,.267-i*.022],[x+.071,.181-i*.024,.261-i*.022] ],M.webbing,.004);
  }
  for(const dz of [-.16,.0,.17])ebox(parent,'boot tread',[x,.019,.145+dz],[.29,.023,.038],M.sole,.003);
  ebox(parent,'leather ankle strap',[x,.274,.114],[.245,.043,.048],M.webbing,.006);
  buckle(parent,[x+.115,.278,.145],M.steel);
  return ankle;
}
function leg(parent,side,M){
  const x=side*(side>0?.19:.17);
  const shifted=side>0?.055:0;
  // Right leg forward, weight on the back left leg: asymmetric silhouette.
  organicLimb(parent,'articulated thigh '+side,[
    [side*.18,1.012,-.016],[x,.86,.015+shifted],[x,.68,.025+shifted],[x,.574,.09+shifted]],
    [.17,.169,.155,.139],M.trousers,{ellipse:.90,folds:7,seed:side*1.8});
  organicLimb(parent,'wrinkled shin '+side,[
    [x,.57,.090+shifted],[x,.45,.083+shifted],[x,.28,.015+shifted]],
    [.137,.115,.118],M.trousers,{ellipse:.92,folds:8,seed:side*3.1});
  // Real polygon knee armor follows the leg, not spherical cartoon buttons.
  const knee=polygon(parent,'angular kneecap '+side,[
    [-.13,.063],[-.093,.114],[.070,.115],[.128,.057],[.101,-.062],[.015,-.101],[-.115,-.064]],
    .039,M.armor,[x,.55,.202+shifted]);
  knee.rotation.x=-.16;
  for(const y of [.62,.48]){
    ebox(parent,'knee strap '+side,[x,y,.149+shifted],[.30,.035,.056],M.webbing,.010);
  }
  ebox(parent,'thigh utility pocket '+side,[x+side*.132,.807,.123+shifted],[.145,.19,.104],M.armor,.019);
  ebox(parent,'utility flap '+side,[x+side*.132,.888,.191+shifted],[.145,.036,.014],M.webbing,.008);
  seam(parent,'trouser folds '+side,[
    [x-.09,.723,.171+shifted],[x-.025,.747,.181+shifted],[x+.081,.706,.172+shifted]],M.edge,.0035);
  // One thigh pouch with signal marker on the left, not mirrored.
  if(side<0){
    ebox(parent,'thigh electronics pouch',[-.30,.67,.19],[.138,.265,.13],M.armor,.025);
    ebox(parent,'pouch display recessed',[-.30,.69,.265],[.026,.149,.012],M.steel,.003);
    ebox(parent,'subtle recovered status strip',[-.30,.69,.274],[.015,.12,.006],M.light,.002);
    ebox(parent,'pouch retention strap',[-.30,.81,.234],[.158,.029,.038],M.webbing,.005);
  }
  boot(parent,side,M);
}
function coatBody(parent,M){
  // Broad shoulders, tailored waist and layered front/back jacket form.
  organicLimb(parent,'tailored torso',[
    [0,1.065,-.015],[0,1.23,-.02],[0,1.45,-.012],[0,1.675,-.035]],
    [.244,.263,.302,.33],M.coat,{ellipse:.74,folds:4,seed:7});
  ellipsoid(parent,'upper vest', [0,1.393,.125],[.291,.308,.158],M.armor,26);
  polygon(parent,'asymmetric chest shield',[
    [-.26,-.25],[.248,-.24],[.27,.19],[.09,.295],[-.19,.27],[-.27,.10]],
    .036,M.plate,[0,1.397,.281]);
  ebox(parent,'waist webbing',[0,1.107,.145],[.53,.083,.21],M.webbing,.016);
  ebox(parent,'belt buckle',[.033,1.117,.28],[.096,.065,.026],M.steel,.013);
  ebox(parent,'upper harness cross strap',[-.12,1.49,.315],[.081,.62,.038],M.webbing,.011).rotation.z=-.29;
  for(const side of [-1,1]){
    const x=side*.18;
    ebox(parent,'braided vest strap',[x,1.48,.29],[.066,.40,.033],M.straps,.007).rotation.z=-side*.13;
    const pouch=ebox(parent,'stitched front ammo pouch',[x,1.255,.36],[.173,.20,.087],M.webbing,.013);
    ebox(parent,'pouch hood flap',[x,1.34,.414],[.174,.055,.020],M.armorEdge,.008);
    ebox(parent,'pouch pull tab',[x,1.288,.427],[.025,.050,.013],M.leather,.006);
    nubbins(parent,[x-.117,1.539,.327],M.webbing,2);
    for(const px of [x-.049,x+.05])ebox(parent,'vest bag zipper',[px,1.345,.422],[.006,.037,.008],M.steel,.002);
  }
  ebox(parent,'asymmetric radio',[.23,1.567,.348],[.118,.160,.095],M.steel,.018);
  ebox(parent,'radio display',[.23,1.586,.402],[.029,.09,.005],M.light,.003);
  seam(parent,'radio aerial',[[.235,1.648,.349],[.235,1.755,.337]],M.steel,.007);
  // Side panels bridge the gap between belt and draped coat
  for(const side of [-1,1]){
    panel(parent,'side coat fold '+side,[
      [1.49,side*.28,side*.37,.008],
      [1.20,side*.28,side*.40,-.025],
      [.85,side*.25,side*.43,-.05],
      [.62,side*.22,side*.47,-.10]],M.coat);
  }
}
function cloak(parent,M){
  // Asymmetric long tactical mantle. Multiple folded sheets, stepped torn hems
  // and a flared leftward leading edge are what define the reference silhouette.
  panel(parent,'rear cloak wide drape',[
    [1.69,-.35,.36,-.26],
    [1.46,-.405,.42,-.31],
    [1.20,-.46,.44,-.37],
    [.98,-.55,.45,-.48],
    [.78,-.64,.41,-.55],
    [.57,-.68,.30,-.57],
    [.45,-.63,.27,-.51]],M.cloak);
  panel(parent,'left hanging mantle',[
    [1.58,-.39,-.10,-.26],
    [1.30,-.48,-.10,-.32],
    [1.07,-.63,-.15,-.38],
    [.83,-.75,-.17,-.42],
    [.61,-.82,-.21,-.45],
    [.46,-.76,-.22,-.46],
    [.28,-.68,-.19,-.43]],M.coat);
  panel(parent,'split weathered right tail',[
    [1.43,.20,.39,-.26],
    [1.09,.20,.46,-.33],
    [.80,.23,.44,-.38],
    [.59,.20,.37,-.34]],M.coat);
  panel(parent,'front scarf tail',[
    [1.71,-.29,-.17,.16],
    [1.46,-.36,-.14,.18],
    [1.19,-.34,-.14,.19],
    [.93,-.29,-.16,.19],
    [.78,-.27,-.17,.16]],M.coat);
  // Stitching and uneven fabric edges. The cloth is deliberately weathered,
  // not a smooth, symmetrical superhero cape.
  seam(parent,'mantle bound seam',[
    [-.35,1.52,-.275],[-.47,1.14,-.365],[-.68,.69,-.44],[-.75,.46,-.45]],M.edge,.008);
  seam(parent,'torn cloak seam',[
    [-.24,1.45,-.31],[-.27,1.16,-.39],[-.24,.84,-.47],[-.19,.47,-.44]],M.edge,.006);
}
function hood(parent,M){
  // Layered fabric hood with asymmetric peak and a vertical *recessed* black
  // face opening. No donut ring: the crown is a sculpted shell that hangs over
  // a fully concealed wearer.
  ellipsoid(parent,'invisible neck base',[0,1.76,-.012],[.18,.18,.17],M.wrap,28);
  // The cap has actual 360-degree volume, not a flat facade: sculpt the
  // cloth dome with offset folds under the front opening/overhang.
  const hoodGeo=new THREE.SphereGeometry(1,40,26);
  const p=hoodGeo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const folds=Math.cos(Math.atan2(z,x)*7+y*4)*.013;
    const squash=y<0 ? (1+y*.06) : 1;
    p.setXYZ(i,x*(.285+folds)*squash,
      y*.302+Math.cos(x*9+z*7)*.009,
      z*(.265+folds)+(x>0?.008:-.016));
  }
  hoodGeo.computeVertexNormals();
  add(parent,'structured fabric hood volume',hoodGeo,M.coat,0,1.919,-.038);
  // Deep dark face cavity; never show skin or eyes.
  ellipsoid(parent,'shadowed face cavity',[0,1.914,.160],[.181,.213,.093],M.void,34);
  // Wrap covers lower face and overlaps the inside edge of the hood.
  panel(parent,'face fabric mask',[
    [1.84,-.18,.18,.256],
    [1.78,-.18,.18,.265],
    [1.72,-.16,.16,.255],
    [1.687,-.13,.13,.233]],M.wrap);
  for(let i=0;i<3;i++){
    seam(parent,'lower scarf fold',[
      [-.16,1.755-i*.022,.265],[0,1.745-i*.022,.275],[.17,1.764-i*.022,.25]],M.wrapEdge,.006);
  }
  // Head cloth shell: sections show y, broad side span and front seam. The
  // actual cavity is left unfilled; side panels and peak hide its hard edge.
  const hoodRows=[
    [2.18,-.095,.105,-.079],
    [2.135,-.228,.232,-.06],
    [2.075,-.284,.28,-.01],
    [1.98,-.298,.282,-.057],
    [1.88,-.287,.282,-.094],
    [1.75,-.256,.265,-.099],
    [1.678,-.221,.234,-.124]
  ];
  panel(parent,'hood rear cloth',hoodRows.map(r=>[...r.slice(0,3),r[3]-.155]),M.coat);
  for(const side of [-1,1]){
    // Heavy cloth folds on each side, asymmetric opening with angled brow.
    panel(parent,'hood side drape '+side,[
      [2.13,side*(side<0?.16:.14),side*(side<0?.24:.23),.038],
      [2.06,side*(side<0?.20:.185),side*.29,.122],
      [1.96,side*.197,side*.315,.186],
      [1.84,side*.185,side*.31,.201],
      [1.73,side*.17,side*.25,.137],
      [1.66,side*.13,side*.24,.058]],M.coat);
    seam(parent,'hood piping '+side,[
      [side*.116,2.126,.172],
      [side*.204,2.061,.226],
      [side*.211,1.936,.231],
      [side*.196,1.811,.234],
      [side*.139,1.713,.229]],M.edge,.010);
    panel(parent,'cloth cowl at neck '+side,[
      [1.78,side*.13,side*.26,.084],
      [1.70,side*.15,side*.30,.157],
      [1.62,side*.15,side*.33,.108]],M.coat);
  }
  // Overhanging broken forehead peak, not circular eye opening.
  panel(parent,'overhanging hood peak',[
    [2.183,-.12,.11,.008],
    [2.143,-.20,.21,.135],
    [2.097,-.236,.225,.258],
    [2.063,-.205,.193,.303]],M.coat);
  seam(parent,'hood overhang thick edge',[
    [-.201,2.064,.300],[-.08,2.056,.312],[.09,2.059,.307],[.191,2.07,.289]],M.edge,.014);
  // Drape a thick scarf around the bottom, with asymmetric tail.
  organicLimb(parent,'scarf folded collar',[
    [-.15,1.682,.23],[.02,1.643,.261],[.14,1.681,.196]],
    [.095,.102,.105],M.coat,{ellipse:.62,folds:3,seed:3});
}
function pack(parent,M){
  ebox(parent,'scavenger field backpack',[0,1.42,-.325],[.50,.67,.28],M.plate,.036);
  ebox(parent,'soft pack outer cover',[0,1.46,-.479],[.46,.53,.068],M.coat,.031);
  ebox(parent,'pack cargo pocket',[0,1.22,-.536],[.35,.20,.077],M.webbing,.015);
  ebox(parent,'roll-up bedding',[0,1.784,-.34],[.50,.14,.25],M.coat,.06);
  for(const x of [-.18,.18]){
    ebox(parent,'pack retaining strap',[x,1.49,-.539],[.058,.62,.020],M.webbing,.008);
    buckle(parent,[x,1.33,-.556],M.armorEdge);
  }
  pathTube(parent,'radio wire',[[-.20,1.47,-.54],[-.37,1.49,-.32],[-.30,1.59,-.07]],.009,M.wrapEdge,26);
}
function arms(parent,M){
  // Rifle-ready pose: strong rear elbow and two hands close to the weapon.
  // The mesh shape is anatomical rather than the cylindrical puppetry of v2.
  const pose=[
    {side:-1,a:[-.34,1.56,-.01],b:[-.44,1.36,.165],c:[-.11,1.37,.423]},
    {side:1,a:[.34,1.55,-.025],b:[.47,1.36,.18],c:[.40,1.19,.440]}
  ];
  for(const {side,a,b,c}of pose){
    organicLimb(parent,'relaxed cloth shoulder '+side,
      [a,[a[0]*1.04,1.49,.04],b],[.145,.145,.128],M.coat,{ellipse:.91,seed:side*4.3});
    organicLimb(parent,'anatomical forearm '+side,
      [b,[(b[0]+c[0])/2,(b[1]+c[1])/2,(b[2]+c[2])/2],c],
      [.128,.114,.09],M.coat,{ellipse:.90,seed:side*7.2});
    // Angular plate armor, not a round/sphere shoulder.
    const shoulder=polygon(parent,'weathered shoulder armor '+side,
      [[-.11,-.075],[-.065,.078],[.04,.117],[.14,.062],[.113,-.095]],
      .066,M.armor,[a[0],a[1]+.02,.145]);
    shoulder.rotation.z=side*.12;
    ebox(parent,'armor fastening strap',[b[0],b[1]+.052,b[2]+.085],[.24,.047,.06],M.webbing,.013);
    for(let j=0;j<3;j++)
      seam(parent,'jacket elbow fold '+side,[
        [b[0]-.075,b[1]-.07+j*.033,b[2]+.119],
        [b[0],b[1]-.05+j*.033,b[2]+.145],
        [b[0]+.085,b[1]-.086+j*.033,b[2]+.115]],M.edge,.003);
    // Fingered leather gloves with knuckles. At full scale the fingers and
    // wrist guard remain visible, unlike the previous simple mitten spheres.
    const glove=ellipsoid(parent,'closed leather glove '+side,c,[.096,.076,.084],M.leather,24);
    ebox(parent,'reinforced glove knuckles',[c[0],c[1]+.027,c[2]+.071],[.14,.042,.024],M.armor,.009);
    for(let i=0;i<4;i++)ebox(parent,'glove finger seam',[c[0]-.063+i*.042,c[1]-.025,c[2]+.082],[.005,.050,.011],M.edge,.002);
  }
}
function rifle(parent,M,weaponId){
  const s=String(weaponId||'').toLowerCase();
  const short=/smg|vector/.test(s),long=/marksman|sniper|dmr/.test(s);
  const k=short?.84:long?1.21:1;
  const gun=new THREE.Group();gun.name='fully modeled 3D raid weapon';parent.add(gun);
  // Weapon lies across the chest, stock high at left and barrel low at right.
  gun.position.set(.02,1.356,.505);
  gun.rotation.z=-.34;
  gun.rotation.y=.10;
  const e=(name,pos,size,m,r=.008)=>ebox(gun,name,pos,size,m,r);
  const cyl=(name,a,b,r,m)=>between(gun,name,a,b,r,r,m,16);
  e('machined receiver',[-.08,0,0],[.32,.150,.132],M.receiver,.008);
  e('upper receiver seam',[-.08,.086,.019],[.332,.025,.133],M.armor,.004);
  e('handguard',[.205*k,.008,-.007],[.30*k,.122,.111],M.steel,.009);
  cyl('barrel',[.305*k,.026,-.007],[.705*k,.026,-.007],.027,M.receiver);
  cyl('flash suppressor',[.688*k,.027,-.007],[.785*k,.027,-.007],.041,M.steel);
  cyl('bore of suppressor',[.784*k,.027,.001],[.803*k,.027,.001],.014,M.leather);
  // Stock with angular void, cheek pad and lower butt.
  polygon(gun,'open tactical stock',[
    [-.54,-.065],[-.39,-.066],[-.35,.016],[-.38,.084],[-.52,.065]],
    .072,M.receiver,[0,0,-.05]);
  e('buttstock rear',[-.555,-.02,-.05],[.058,.18,.087],M.armorEdge,.009);
  e('handstop',[.19*k,-.083,.05],[.060,.114,.070],M.webbing,.008);
  e('pistol grip',[-.14,-.14,.034],[.080,.221,.092],M.leather,.009).rotation.z=-.24;
  e('detachable magazine',[-.020,-.188,.042],[.112,.217,.099],M.steel,.012).rotation.z=.16;
  e('magazine front reinforcement',[.025,-.214,.098],[.020,.12,.012],M.armorEdge,.002);
  e('charging handle',[-.24,.062,.047],[.071,.037,.041],M.steel,.006);
  // Integral high-quality sight and scope.
  e('upper picatinny rail',[.04,.101,-.012],[.42,.018,.075],M.steel,.005);
  if(long){
    cyl('optic housing',[-.07,.174,0],[.20,.174,0],.042,M.receiver);
    cyl('objective shroud',[.20,.173,0],[.24,.173,0],.059,M.steel);
  }else{
    e('red dot optic',[-.035,.166,-.02],[.135,.085,.055],M.receiver,.009);
    e('optic lens',[.028,.167,.014],[.011,.057,.032],M.armorEdge,.003);
  }
  for(let i=0;i<8;i++){
    const x=(.06+i*.043)*k;
    e('fore-end vent port',[x,.051,.057],[.020,.013,.009],M.void,.002);
    e('rail tooth',[x,.103,-.012],[.025,.018,.087],M.receiver,.002);
  }
  e('magazine catch',[.022,-.050,.076],[.033,.017,.018],M.armorEdge,.002);
  e('selector switch',[-.13,.045,.079],[.036,.015,.018],M.armorEdge,.002);
  return gun;
}
export function createOperatorHeroV3({weaponId='',armorId=''}={}){
  const root=new THREE.Group();root.name='protocol-rebirth-operator-hero-v3';
  const operator=new THREE.Group();operator.name='operator full-body pivot';root.add(operator);
  const coat=fabric(PALETTE.coat,7),cloakMat=fabric(PALETTE.coatDark,77),
    trousers=fabric(PALETTE.trousers,29),webbing=fabric(PALETTE.webbing,35);
  const M={
    coat,cloak:cloakMat,trousers,webbing,
    leather:fabric(PALETTE.leather,41),
    straps:mk(PALETTE.straps),wrap:mk(PALETTE.wrap),
    wrapEdge:mk(PALETTE.coatEdge),void:new THREE.MeshBasicMaterial({color:PALETTE.void}),
    armor:mk(PALETTE.armor,.17,.85),armorEdge:mk(PALETTE.armorEdge,.39,.72),
    plate:mk(PALETTE.plate,.24,.79),edge:mk(PALETTE.trouserFold),
    boot:mk(PALETTE.boot,.08,.92),sole:mk(PALETTE.sole,.10,.95),
    receiver:mk(PALETTE.receiver,.49,.69),steel:mk(PALETTE.steel,.52,.67),
    light:new THREE.MeshBasicMaterial({color:PALETTE.light}),
    amber:new THREE.MeshBasicMaterial({color:PALETTE.amber})
  };
  randomState=4711;
  const body=new THREE.Group();body.name='operator subtle stance';operator.add(body);
  // Weight favors left foot, right leg advanced. Dynamic contrapposto
  // stays readable in all yaw positions and makes the rifle a calm hold.
  leg(body,-1,M);leg(body,1,M);
  ellipsoid(body,'anatomical pelvis',[0,1.035,-.025],[.267,.191,.188],trousers,28);
  coatBody(body,M);
  pack(body,M);
  cloak(body,M);
  arms(body,M);
  hood(body,M);
  rifle(body,M,weaponId);
  // A few physical damage marks make the body lived-in rather than plastic.
  for(const x of [-.27,.27]){
    seam(body,'scuffed jacket seam',[
      [x,1.55,.052],[x*1.05,1.38,.090],[x*.86,1.19,.112]],M.wrapEdge,.004);
  }
  if(!armorId){
    // No vest slot equipped: retain the scavenger jacket but remove the most
    // pronounced metallic front chest plate in this *preview only*.
    body.traverse(node=>{if(node.name==='asymmetric chest shield')node.visible=false;});
  }
  // Materials receive real light and every view has depth. The face never
  // becomes visible, even when the player inspects the operator from behind.
  let elapsed=0;
  return {root,update(dt,reduced=false){
    if(reduced)return;
    elapsed+=Math.min(.05,dt);
    body.position.y=Math.sin(elapsed*1.25)*.006;
    body.rotation.z=Math.sin(elapsed*.49)*.002;
  }};
}
