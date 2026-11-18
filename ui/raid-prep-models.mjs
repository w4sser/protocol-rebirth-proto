/* Protocol Rebirth — close-up-only 3D menu assets.
 * Distinct from the cheap gameplay GLB. Real Three.js geometry, shared PBR cloth
 * materials, weathering, 3D equipment and a true volume for BIT; no billboards.
 * Source of truth for BIT's face is assets/bit-face-master-v3.svg (AD-06).
 */
import * as THREE from '../nodspel/vendor/three.module.js';

const C={
  cloth:0x575957, clothShadow:0x363e3e, cloak:0x514841, armor:0x474a45,
  armorDark:0x282f31, webbing:0x3d3933, leather:0x302c29,
  boot:0x25282b, steel:0x313b3c, gun:0x24292a, gunHighlight:0x485052,
  rust:0x77523b, rustLight:0x957359, bitTrim:0x353b3e,
  bitGlass:0x0b1418, bitFace:0x75cfcc, amber:0xffaa55
};
const mat=(color,metalness=.05,roughness=.92,extra={})=>
  new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});

function mesh(parent,name,geometry,material,x=0,y=0,z=0){
  const n=new THREE.Mesh(geometry,material);n.name=name;n.position.set(x,y,z);
  n.castShadow=true;n.receiveShadow=true;parent.add(n);return n;
}
function sphere(parent,name,pos,size,m,detail=28){
  const n=mesh(parent,name,new THREE.SphereGeometry(1,detail,Math.max(16,Math.round(detail*.68))),m,...pos);
  n.scale.set(...size);return n;
}
function block(parent,name,pos,size,m){
  const n=mesh(parent,name,new THREE.BoxGeometry(...size),m,...pos);
  return n;
}
function tube(parent,name,points,radius,m,segments=32,radial=8){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(parent,name,new THREE.TubeGeometry(curve,segments,radius,radial,false),m);
}
function rod(parent,name,from,to,radius,m,radiusEnd=radius,segments=18){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
  const d=b.clone().sub(a),len=d.length();
  const n=mesh(parent,name,new THREE.CylinderGeometry(radiusEnd,radius,len,segments,2),m,...a.clone().add(b).multiplyScalar(.5).toArray());
  n.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  return n;
}
function cornerBox(width,height,depth,radius=.018){
  const w=width/2,h=height/2,r=Math.min(radius,width/4,height/4);
  const shape=new THREE.Shape();
  shape.moveTo(-w+r,-h);
  shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);
  shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);
  shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);
  shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
  const bevel=Math.min(.009,depth/5);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,depth-2*bevel),steps:1,
    bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:6});
  geo.translate(0,0,-(depth-2*bevel)/2);
  return geo;
}
function plate(parent,name,pos,size,m,radius=.018){
  return mesh(parent,name,cornerBox(...size,radius),m,...pos);
}
function canvasWeave(hex,seed=9){
  if(typeof document==='undefined')return null;
  const cvs=document.createElement('canvas');cvs.width=cvs.height=128;
  const ctx=cvs.getContext?.('2d');if(!ctx)return null;
  let n=seed>>>0;
  const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
  const base=[(hex>>16)&255,(hex>>8)&255,hex&255];
  const im=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const i=(y*128+x)*4;
    const grain=(rand()-.5)*32+(x%4===0?-7:0)+(y%5===0?5:0);
    for(let j=0;j<3;j++)im.data[i+j]=Math.max(1,Math.min(255,base[j]+grain));
    im.data[i+3]=255;
  }
  ctx.putImageData(im,0,0);
  const texture=new THREE.CanvasTexture(cvs);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
  return texture;
}
function cloth(hex,seed){
  const texture=canvasWeave(hex,seed);
  return mat(texture?0xffffff:hex,.02,.97,texture?{map:texture}:{});
}
function drape(parent,name,{yTop,yBottom,xCenter=0,widthTop=.35,widthBottom=.5,zTop=-.19,zBottom=-.23,
  wave=.04,curve=.10,material,front=false}){
  const cols=20,rows=28,v=[],uv=[],ids=[];
  for(let j=0;j<=rows;j++){
    const t=j/rows,y=yTop+(yBottom-yTop)*t;
    for(let i=0;i<=cols;i++){
      const u=i/cols,x=(u-.5)*(widthTop+(widthBottom-widthTop)*t)+xCenter;
      const fold=Math.sin(u*Math.PI*4+1.4*t)*wave*(.2+.8*t);
      const z=zTop+(zBottom-zTop)*t+fold+(front?-.03:curve*(u-.5)*(u-.5));
      v.push(x,y,z);uv.push(u,t);
      if(j<rows&&i<cols){
        const a=j*(cols+1)+i,b=a+cols+1;
        ids.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(ids);geo.computeVertexNormals();
  const m=material.clone();m.side=THREE.DoubleSide;
  return mesh(parent,name,geo,m);
}
function seam(parent,name,points,m,r=.006){return tube(parent,name,points,r,m,18,6);}
function rivet(parent,pos,m,r=.013){return sphere(parent,'steel rivet',pos,[r,r,r*.55],m,12);}
function boot(parent,side,M){
  const x=side*.19;
  const leg=rod(parent,'full cloth shin',[x,.47,.012],[x,.16,.016],.11,M.trouser,.105,24);
  sphere(parent,'ankle cuff',[x,.24,.02],[.127,.11,.13],M.boot,18);
  sphere(parent,'heavy boot',[x,.11,.11],[.145,.12,.27],M.boot,24);
  plate(parent,'toe cap',[x,.09,.31],[.23,.075,.17],M.armorDark,.028);
  for(let i=0;i<4;i++)seam(parent,'boot lace',[
    [x-.067,.16-i*.027,.285-i*.026],[x,.15-i*.027,.29-i*.026],[x+.065,.16-i*.027,.285-i*.026]],M.edge,.0035);
  plate(parent,'boot strap',[x,.21,.145],[.20,.044,.06],M.webbing);
  leg.rotation.z=side*.015;
}
function leg(parent,side,M){
  const x=side*.19;
  const hip=[side*.175,.97,0],knee=[x,.54,.056];
  rod(parent,'thigh',[...hip],[...knee],.165,M.trouser,.129,24);
  sphere(parent,'knee fabric',[x,.56,.07],[.145,.16,.143],M.trouser,22);
  const pad=sphere(parent,'articulated knee pad',[x,.55,.211],[.135,.14,.075],M.armor,26);
  for(const z of [.23])plate(parent,'knee center inset',[x,.545,z],[.16,.08,.026],M.armorDark);
  const cargo=plate(parent,'cargo pocket',[x+side*.109,.81,.08],[.095,.155,.16],M.armor,.012);
  cargo.rotation.y=side*.23;
  plate(parent,'pocket flap',[x+side*.13,.89,.1],[.09,.04,.15],M.webbing);
  for(const y of [.70,.65,.61])seam(parent,'cloth fold',[
    [x-.10,y,.155],[x,y+.018,.185],[x+.10,y-.006,.152]],M.edge,.003);
  boot(parent,side,M);
}
function arm(parent,side,M){
  const shoulder=[side*.325,1.53,0],elbow=[side*.41,1.24,.105];
  const wrist=side<0?[-.20,1.13,.47]:[.28,1.10,.49];
  rod(parent,'upper coat sleeve',shoulder,elbow,.135,M.coat,.114,24);
  rod(parent,'lower coat sleeve',elbow,wrist,.118,M.coat,.091,24);
  sphere(parent,'woven elbow',[...elbow],[.135,.135,.13],M.coat,22);
  sphere(parent,'gloved hand',[...wrist],[.102,.095,.105],M.boot,22);
  sphere(parent,'shoulder armored shell',[...shoulder],[.17,.135,.18],M.armor,26);
  plate(parent,'shoulder plate',[side*.345,1.55,.14],[.23,.12,.065],M.armorDark,.026).rotation.z=-side*.18;
  for(const y of [1.33,1.29]){
    seam(parent,'sleeve reinforcement',[[side*.41-.085,y,.215],[side*.41,y+.008,.24],[side*.41+.085,y,.215]],M.edge,.004);
  }
}
function addGun(parent,weaponId,M){
  const id=String(weaponId||'').toLowerCase();
  const compact=/smg|vector|pistol/.test(id);
  const long=/marksman|sniper|dmr/.test(id);
  const heavy=/shotgun/.test(id);
  const k=compact?.82:long?1.25:heavy?1.06:1;
  const group=new THREE.Group();group.name='menu weapon';group.position.set(.045,1.14,.59);
  group.rotation.z=-.18;parent.add(group);
  plate(group,'receiver',[-.08,0,0],[.36,.142,.102],M.gun,.012);
  plate(group,'handguard',[.19*k,.015,0],[.28*k,.112,.087],M.gunHighlight,.008);
  rod(group,'steel barrel',[.31*k,.02,0],[.67*k,.02,0],.024,M.gunHighlight,.024,18);
  rod(group,'muzzle brake',[.64*k,.02,0],[.77*k,.02,0],.040,M.steel,.038,20);
  plate(group,'buttstock',[-.47,-.005,0],[.25,.12,.095],M.gun,.018);
  plate(group,'stock support',[-.325,-.014,0],[.19,.058,.037],M.steel);
  plate(group,'pistol grip',[-.20,-.138,.025],[.065,.23,.06],M.webbing).rotation.z=-.22;
  plate(group,'magazine',[-.035,-.159,.024],[.082,.225,.068],M.steel,.008).rotation.z=.20;
  tube(group,'top picatinny rail',[[-.24,.086,0],[-.02,.087,0],[.25*k,.078,0]],.013,M.steel,30,6);
  plate(group,'iron sight',[.18*k,.12,0],[.055,.08,.04],M.armorDark);
  plate(group,'rear sight',[-.18,.137,0],[.064,.06,.04],M.armorDark);
  for(let i=0;i<5;i++){
    plate(group,'vent slot',[(.075+i*.047)*k,.071,.049],[.023,.011,.006],M.edge,.002);
  }
  for(let i=0;i<4;i++){
    plate(group,'grip rail',[(.10+i*.045)*k,-.03,.054],[.022,.016,.008],M.edge,.002);
  }
  if(long){
    rod(group,'optic body',[-.09,.17,0],[.19,.17,0],.041,M.steel,.041,20);
    rod(group,'optic glass rim',[.19,.17,0],[.216,.17,0],.054,M.edge,.054,20);
  }else if(compact){
    plate(group,'reflex optic',[-.05,.143,0],[.115,.077,.035],M.armorDark);
  }
  plate(group,'amber weapon status',[-.14,.032,.063],[.027,.009,.006],M.amber,.003);
  return group;
}
function gearStraps(root,M){
  for(const side of [-1,1]){
    const b=plate(root,'woven shoulder strap',[side*.19,1.45,.223],[.067,.53,.043],M.webbing,.015);
    b.rotation.z=-side*.14;
    plate(root,'chest buckle',[side*.19,1.32,.266],[.09,.065,.018],M.steel,.009);
    const pouch=plate(root,'front kit pouch',[side*.16,1.085,.262],[.19,.18,.08],M.armor,.019);
    plate(root,'pouch flap',[side*.16,1.145,.316],[.19,.042,.012],M.edge);
    rivet(root,[side*.16,1.142,.328],M.rivet,.012);
    for(const y of [1.44,1.37])plate(root,'webbing slot',[side*.16,y,.271],[.13,.018,.009],M.webbing);
  }
  plate(root,'chest utility cross strap',[0,1.39,.278],[.48,.046,.028],M.webbing).rotation.z=.13;
  for(const side of [-1,1]){
    plate(root,'waist bag',[side*.225,.985,.17],[.16,.17,.12],M.armor,.018);
    plate(root,'bag clasp',[side*.225,.99,.239],[.025,.06,.017],M.steel);
  }
}
export function createMenuOperator({weaponId='',armorId=''}={}){
  // This mesh is authored exclusively for a character-size portrait. It is
  // built with high-segment surfaces, folds, layered fabric and tactical parts.
  const root=new THREE.Group();root.name='menu-operator-3d';
  const clothMain=cloth(C.cloth,5),coat=cloth(C.cloak,15),trouser=cloth(C.clothShadow,23);
  const M={
    coat, trouser,armor:mat(C.armor,.12,.87),armorDark:mat(C.armorDark,.19,.87),
    webbing:cloth(C.webbing,31),boot:mat(C.boot,.13,.93),edge:mat(0x666964,.35,.72),
    steel:mat(C.steel,.55,.53),gun:mat(C.gun,.63,.61),gunHighlight:mat(C.gunHighlight,.48,.71),
    rivet:mat(0x929088,.67,.50),amber:new THREE.MeshBasicMaterial({color:C.amber}),
    faceVoid:new THREE.MeshBasicMaterial({color:0x040708}),scarf:cloth(C.leather,41)
  };
  const body=new THREE.Group();body.name='menu-operator-body';root.add(body);
  const breathe=new THREE.Group();breathe.name='menu-operator-breathe';body.add(breathe);
  sphere(body,'hip undercoat',[0,1.02,0],[.255,.23,.19],trouser,26);
  for(const side of [-1,1])leg(body,side,M);
  sphere(breathe,'fabric torso',[0,1.35,.012],[.318,.38,.22],clothMain,36);
  sphere(breathe,'chest vest',[0,1.36,.11],[.31,.315,.2],M.armor,32);
  sphere(breathe,'collar scarf',[0,1.59,.02],[.24,.16,.215],M.scarf,28);
  plate(breathe,'backpack shell',[0,1.34,-.303],[.57,.55,.29],M.armorDark,.038);
  plate(breathe,'backpack side pockets',[-.27,1.30,-.32],[.16,.32,.22],M.webbing,.018);
  plate(breathe,'backpack panel',[0,1.27,-.46],[.38,.30,.05],M.armor,.025);
  for(const side of [-1,1])arm(breathe,side,M);
  gearStraps(breathe,M);
  // Open faceless hood: cloth volume, genuinely recessed black void, cloth
  // edge and scarf. The head is not an exposed gameplay mannequin.
  sphere(breathe,'cinematic-hood',[0,1.795,-.012],[.300,.341,.295],coat,48);
  sphere(breathe,'face-void',[0,1.777,.255],[.225,.222,.043],M.faceVoid,40);
  sphere(breathe,'black cloth face wrap',[0,1.682,.285],[.210,.113,.050],M.scarf,36);
  tube(breathe,'hood stitched rim',Array.from({length:22},(_,i)=>{
    const th=Math.PI*2*i/21;return [.229*Math.cos(th),1.780+.252*Math.sin(th),.282+.007*Math.cos(2*th)];
  }),.028,coat,60,12);
  // An overhanging brow creates a real hood silhouette from 3/4 front.
  sphere(breathe,'hood overhang',[0,2.000,.122],[.268,.081,.209],coat,36).rotation.x=-.16;
  for(const side of [-1,1]){
    sphere(breathe,'hood neck fold',[side*.17,1.64,.04],[.12,.14,.26],coat,30);
    seam(breathe,'hood seam',[[side*.1,1.99,.224],[side*.235,1.86,.235],[side*.225,1.68,.22]],M.webbing,.006);
  }
  // Heavy, asymmetric cloth cloak behind the tactical backpack; two front
  // panels split at the legs. These are 3D draped surfaces, not a static sprite.
  drape(breathe,'weathered rear cloak',{yTop:1.60,yBottom:.49,widthTop:.67,widthBottom:1.05,zTop:-.39,zBottom:-.43,wave:.045,material:coat});
  drape(breathe,'left coat tail',{yTop:1.31,yBottom:.57,xCenter:-.23,widthTop:.24,widthBottom:.33,zTop:.23,zBottom:.16,material:coat,front:true,wave:.035});
  drape(breathe,'right coat tail',{yTop:1.31,yBottom:.73,xCenter:.25,widthTop:.21,widthBottom:.28,zTop:.22,zBottom:.14,material:coat,front:true,wave:.035});
  for(const side of [-1,1]){
    seam(breathe,'weathered cloak seam',[
      [side*.25,1.50,-.36],[side*.36,1.19,-.40],[side*.47,.75,-.43]],M.webbing,.005);
  }
  addGun(breathe,weaponId,M);
  // The vest state belongs only to this preview. Gear choices still come from
  // app.js and no permanent player profile is modified.
  if(!armorId){
    for(const n of breathe.children)if(n.name==='chest vest')n.material=clothMain;
  }
  let phase=0;
  return {root,update(dt,reduced=false){
    if(reduced)return;
    phase+=Math.min(.07,dt);
    breathe.position.y=Math.sin(phase*1.7)*.008;
    breathe.rotation.z=Math.sin(phase*.88)*.004;
  }};
}

function createSmileFallback(root,faceColor){
  // Owner master v3 fallback: two vertical ellipses and a deeply curved smile.
  // Replaced by the exact SVG texture as soon as it has loaded.
  const group=new THREE.Group();group.name='bit-face-fallback';root.add(group);
  for(const x of [-.101,.101]){
    const eye=sphere(group,'BIT oval eye',[x,.016,.278],[.017,.037,.004],faceColor,24);
    eye.castShadow=false;
  }
  const arc=[];
  for(let i=0;i<=32;i++){
    const u=i/32;
    arc.push([-.075+u*.150,-.045-.066*Math.sin(Math.PI*u),.279]);
  }
  tube(group,'BIT correct curved smile',arc,.008,faceColor,48,10);
  return group;
}
export function createMenuBit(){
  const root=new THREE.Group();root.name='BIT-real-3d';
  const casing=mat(C.rust,.34,.82),rust=mat(C.rustLight,.22,.90),
    trim=mat(C.bitTrim,.59,.61),steel=mat(C.steel,.59,.63),
    glass=mat(C.bitGlass,.22,.39),dark=mat(0x121719,.10,.93);
  const eyeMaterial=new THREE.MeshBasicMaterial({color:C.bitFace,toneMapped:false});
  const lampMaterial=new THREE.MeshBasicMaterial({color:C.amber,toneMapped:false});
  plate(root,'BIT worn CRT chassis',[0,0,0],[.57,.47,.43],casing,.069);
  plate(root,'BIT top metal plate',[0,.235,-.01],[.51,.055,.42],rust,.026);
  plate(root,'BIT black front bezel',[0,.01,.222],[.483,.374,.055],trim,.038);
  plate(root,'BIT screen glass',[0,.012,.257],[.430,.325,.019],glass,.027);
  const smileFallback=createSmileFallback(root,eyeMaterial);
  // The real owner-approved smile, not an invented neutral mouth. The image
  // is only a screen texture; the robot casing and all other details remain
  // genuine 3D and rotate/respond to scene light normally.
  const screenFace=new THREE.Mesh(new THREE.PlaneGeometry(.404,.320),
    new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,opacity:1}));
  screenFace.name='BIT owner face master v3';screenFace.position.set(0,.012,.272);
  screenFace.visible=false;root.add(screenFace);
  const texture=new THREE.TextureLoader().load(
    new URL('../assets/bit-face-master-v3.svg',import.meta.url).href,
    t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
      screenFace.material.map=t;screenFace.material.needsUpdate=true;
      screenFace.visible=true;smileFallback.visible=false;},
    undefined,()=>{screenFace.visible=false;smileFallback.visible=true;});
  texture.colorSpace=THREE.SRGBColorSpace;
  for(const side of [-1,1]){
    plate(root,'BIT cheek armor',[side*.278,.00,.03],[.053,.355,.41],steel,.020);
    for(const y of [-.151,.167])rivet(root,[side*.264,y,.244],rust,.015);
  }
  plate(root,'BIT amber lamp bracket',[.334,.05,.055],[.124,.148,.151],steel,.025);
  sphere(root,'BIT amber side light',[.401,.056,.064],[.047,.058,.05],lampMaterial,26);
  const lamp=new THREE.PointLight(C.amber,.32,.95,2);
  lamp.position.set(.45,.08,.105);root.add(lamp);
  plate(root,'BIT antenna mount',[-.13,.259,-.055],[.092,.069,.082],steel,.015);
  rod(root,'BIT antenna shaft',[-.13,.285,-.055],[-.154,.575,-.055],.013,trim,.010,10);
  sphere(root,'BIT antenna tip',[-.154,.583,-.055],[.027,.027,.027],rust,16);
  plate(root,'BIT bottom thruster block',[0,-.255,-.039],[.37,.085,.27],steel,.018);
  for(const x of [-.13,.13]){
    rod(root,'BIT inert lift nozzle',[x,-.289,-.07],[x,-.35,-.07],.069,dark,.054,16);
    sphere(root,'BIT lift guard',[x,-.343,-.070],[.069,.027,.069],trim,20);
  }
  // Scratched surfaces and chipped bolts; no teal/cyan thrusters outside face.
  for(const side of [-1,1]){
    seam(root,'BIT casing scratch',[
      [side*.18,.203,.222],[side*.204,.188,.228],[side*.213,.171,.232]],rust,.006);
  }
  return root;
}
