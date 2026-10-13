// Node Raid art dressing: dark isometric sci-fi base look (dark panels, cyan neon trims, glow, light fog).
// Pure visuals: nothing here touches collision or gameplay data. Props are seed-deterministic.
import * as THREE from './vendor/three.module.js';
export const PALETTE={bg:'#050d12',fog:'#071820',floor:'#1b252c',floorAlt:'#182127',seam:'#0c1418',base:'#0b1216',
  wall:'#232e36',wallTop:'#2c3942',box:'#28333b',neon:'#2fe6d2',neonSoft:'#1fa79a',warm:'#ffb24a',plant:'#2f8a5a',pot:'#3a4650'};
// Quality: ?q=low|high, else saved choice, else auto (low on touch/small/weak devices).
export function pickQuality({search='',storage=null,nav={},screen={}}={}){
  const q=new URLSearchParams(search).get('q');if(q==='low'||q==='high')return q;
  try{const s=storage?.getItem('nodeRaid.quality');if(s==='low'||s==='high')return s;}catch{}
  const touch=(nav.maxTouchPoints??0)>0,small=Math.min(screen.width??9999,screen.height??9999)<=500,weak=(nav.hardwareConcurrency??8)<=4;
  return touch||small||weak?'low':'high';
}
export function qualitySettings(q){
  return q==='low'?{pixelRatio:1,shadows:false,shadowMap:512,props:.55,lights:0,antialias:false}
                  :{pixelRatio:1.6,shadows:true,shadowMap:1024,props:1,lights:2,antialias:true};
}
export function rngFrom(seed){let s=2166136261;for(const c of String(seed))s=Math.imul(s^c.charCodeAt(0),16777619);
  return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
// Glow materials: unlit + not tone-mapped so they read as neon without a bloom pass.
const glowCache={};
export function glow(color,opacity=1){const k=color+opacity;return glowCache[k] ||= new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,toneMapped:false,depthWrite:opacity>=1});}
// Free spots for props: inside floors, hugging walls/edges, clear of gameplay objects.
export function propSpots(level,rng,count){
  const blockers=[...level.nodes.map(n=>[n.x,n.z,2.6]),...level.lootBoxes.map(l=>[l.x,l.z,1.6]),...level.enemies.map(e=>[e.x,e.z,1.8]),
    [level.start.x,level.start.z,2.4],[level.exit.x,level.exit.z,2.8],...(level.routeChoices||[]).map(c=>[c.sign.x,c.sign.z,2.2])];
  const solids=[...level.walls,...level.boxes];
  const inSolid=(x,z,pad)=>solids.some(b=>Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad);
  const onFloor=(x,z,pad)=>level.floors.some(f=>Math.abs(x-f.x)<f.w/2-pad&&Math.abs(z-f.z)<f.d/2-pad);
  const spots=[];
  for(let tries=0;tries<count*30&&spots.length<count;tries++){
    const f=level.floors[Math.floor(rng()*level.floors.length)];
    const side=Math.floor(rng()*4),t=rng()-.5,inset=1.05;
    const x=side<2?f.x+t*(f.w-2):f.x+(side===2?-1:1)*(f.w/2-inset);
    const z=side>=2?f.z+t*(f.d-2):f.z+(side===0?-1:1)*(f.d/2-inset);
    if(!onFloor(x,z,.35)||inSolid(x,z,.3))continue;
    if(blockers.some(([bx,bz,r])=>Math.hypot(x-bx,z-bz)<r))continue;
    if(spots.some(s=>Math.hypot(x-s.x,z-s.z)<1.3))continue;
    spots.push({x,z,rot:(side<2?0:Math.PI/2)+(rng()<.5?0:Math.PI)});
  }
  return spots;
}
export const PROP_KINDS=['crate','terminal','pipes','vent','plant','cables'];
export function buildProp(kind,spot,box,rng){
  const g=new THREE.Group();g.position.set(spot.x,0,spot.z);g.rotation.y=spot.rot;
  const cube=new THREE.BoxGeometry(1,1,1),add=(m,x,y,z,w,h,d)=>{const o=new THREE.Mesh(cube,m);o.position.set(x,y,z);o.scale.set(w,h,d);g.add(o);return o;};
  if(kind==='crate'){const n=1+Math.floor(rng()*2);for(let i=0;i<n;i++){box(i*.05,.3+i*.6,0,.75,.6,.6,'#2a343b',g);add(glow(PALETTE.neonSoft),i*.05,.3+i*.6,.305,.6,.04,.01);}}
  else if(kind==='terminal'){box(0,.45,0,.7,.9,.35,'#202a31',g);const s=add(glow(PALETTE.neon,.85),0,.66,.18,.5,.3,.01);s.rotation.x=-.25;add(glow(PALETTE.warm),.24,.25,.18,.06,.06,.01);}
  else if(kind==='pipes'){const m=new THREE.MeshStandardMaterial({color:'#36434b',roughness:.5,metalness:.6});
    for(const dz of [-.12,.14]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.6,10),m);p.rotation.z=Math.PI/2;p.position.set(0,.22+(dz>0?.2:0),dz);g.add(p);}
    add(glow(PALETTE.neonSoft),.55,.42,.14,.05,.2,.2);}
  else if(kind==='vent'){box(0,.04,0,1,.08,.8,'#141c21',g);for(let i=-3;i<=3;i++)add(glow('#0f5d57'),i*.12,.085,0,.04,.01,.6);}
  else if(kind==='plant'){box(0,.22,0,.42,.44,.42,PALETTE.pot,g);add(glow(PALETTE.neonSoft),0,.4,.215,.3,.03,.01);
    const leaf=new THREE.MeshStandardMaterial({color:PALETTE.plant,roughness:.8});
    for(let i=0;i<5;i++){const l=new THREE.Mesh(new THREE.ConeGeometry(.12,.55+rng()*.25,5),leaf);l.position.set((rng()-.5)*.2,.7,(rng()-.5)*.2);l.rotation.set((rng()-.5)*.6,0,(rng()-.5)*.6);g.add(l);}}
  else {const m=new THREE.MeshStandardMaterial({color:'#11181c',roughness:.9});
    for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.TorusGeometry(.35+i*.08,.03,6,20,Math.PI),m);c.rotation.x=-Math.PI/2;c.position.set(0,.03,i*.04);g.add(c);}}
  return g;
}
