import * as THREE from './vendor/three.module.js';
import {RULES,hazardState,hazardTiming} from './levels.js?v=1.40.1';
import {rarityOf,lootColor,RARITY_COLORS,RARITY_ORDER} from './rarity.js?v=1.40.1';
import {buildTown} from './town.js?v=1.40.1';
import {PALETTE,glow,propSpots,buildProp,PROP_KINDS,rngFrom,qualitySettings,lootTier,LOOT_COLORS,EXTRACT_COLOR} from './art.js?v=1.40.1';
export function setNodeHold(visual,progress){
  const fill=visual.node.active?0:Math.max(0,Math.min(1,progress));
  visual.holdRing.visible=!visual.node.active&&fill>0;
  visual.holdRing.geometry.setDrawRange(0,Math.floor(fill*64)*6);
}

export function buildWorld(level,scene,{quality='high',town=null}={}) {
  const Q=qualitySettings(quality);
  const group=new THREE.Group();scene.add(group);
  const cube=new THREE.BoxGeometry(1,1,1),materials={};
  const material=color=>materials[color] ||= new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12});
  function box(x,y,z,w,h,d,color='#616973',parent=group){
    const m=new THREE.Mesh(cube,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const isTown=!!(level.town&&town);
  const townInfo=isTown?buildTown(level,group,town,Q):null;
  if(!isTown)for(const f of level.floors){
    box(f.x,-.2,f.z,f.w,.4,f.d,PALETTE.floor);
    box(f.x,-.5,f.z,f.w+.1,.2,f.d+.1,PALETTE.base);
    // panel floor: dark seams every 2 m + faint cyan trim line inset from the edges (theme tints the trim)
    const vertices=[];
    for(let x=-f.w/2+2;x<f.w/2;x+=2)vertices.push(f.x+x,.006,f.z-f.d/2,f.x+x,.006,f.z+f.d/2);
    for(let z=-f.d/2+2;z<f.d/2;z+=2)vertices.push(f.x-f.w/2,.006,f.z+z,f.x+f.w/2,.006,f.z+z);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:PALETTE.seam,transparent:true,opacity:.9})));
    const i=.55,trim=[];const x0=f.x-f.w/2+i,x1=f.x+f.w/2-i,z0=f.z-f.d/2+i,z1=f.z+f.d/2-i;
    trim.push(x0,.008,z0,x1,.008,z0, x1,.008,z0,x1,.008,z1, x1,.008,z1,x0,.008,z1, x0,.008,z1,x0,.008,z0);
    const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(trim,3));
    group.add(new THREE.LineSegments(tg,new THREE.LineBasicMaterial({color:level.theme?.trim&&level.number>1?level.theme.trim:PALETTE.neon,transparent:true,opacity:.28,toneMapped:false})));
  }
  if(!isTown)for(const b of [...level.walls,...level.boxes]){
    const isBox=level.boxes.includes(b);
    box(b.x,b.h/2,b.z,b.w,b.h,b.d,isBox?PALETTE.box:PALETTE.wall);
    box(b.x,b.h+.025,b.z,b.w,.05,b.d,PALETTE.wallTop);
    // neon edge trim on top of walls / cover
    const t=new THREE.Mesh(cube,glow(isBox?PALETTE.neonSoft:PALETTE.neon,isBox?.8:.9));t.position.set(b.x,b.h+.06,b.z);t.scale.set(Math.max(.06,b.w-.08),.03,Math.max(.06,b.d-.08));
    if(b.w>b.d)t.scale.z=.07;else t.scale.x=.07;group.add(t);
  }
  const nodes=level.nodes.map(node=>{
    const g=new THREE.Group();g.position.set(node.x,0,node.z);group.add(g);
    box(0,.1,0,1.9,.2,1.9,'#1c262d',g);
    box(0,.65,0,1.4,1,1.4,'#34444c',g);
    box(0,1.23,0,1.6,.16,1.6,'#56666d',g);
    const coreMaterial=new THREE.MeshStandardMaterial({color:'#8a9b9b',emissive:'#75cfcc',emissiveIntensity:0,roughness:.4});
    const front=new THREE.Mesh(cube,coreMaterial);front.scale.set(.95,.7,.03);front.position.set(0,.69,.711);g.add(front);
    const top=new THREE.Mesh(cube,coreMaterial);top.scale.set(1,.025,1);top.position.y=1.323;g.add(top);
    const light=new THREE.PointLight('#15d6be',0,8,1.6);light.position.y=1.9;g.add(light);
    const halo=new THREE.Mesh(new THREE.RingGeometry(RULES.resources.nodeReach-.1,RULES.resources.nodeReach,64),new THREE.MeshBasicMaterial({color:'#75cfcc',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
    halo.rotation.x=-Math.PI/2;halo.position.y=.018;g.add(halo);
    const holdRing=new THREE.Mesh(new THREE.RingGeometry(RULES.resources.nodeReach-.16,RULES.resources.nodeReach+.03,64,1,-Math.PI/2),new THREE.MeshBasicMaterial({color:'#15d6be',side:THREE.DoubleSide,depthWrite:false}));
    holdRing.rotation.x=-Math.PI/2;holdRing.position.y=.026;holdRing.visible=false;holdRing.geometry.setDrawRange(0,0);g.add(holdRing);
    return {node,group:g,coreMaterial,light,halo,holdRing};
  });
  const exit=level.exit;
  const beamGeo=new THREE.CylinderGeometry(.12,.22,1,12,1,true),ringGeo=new THREE.RingGeometry(.62,.78,40);
  function lootVisual(loot){
    const g=new THREE.Group();g.position.set(loot.x,0,loot.z);group.add(g);
    const tier=rarityOf(loot.item),color=lootColor(loot);
    const crate=new THREE.Group();g.add(crate);
    box(0,.32,0,.9,.64,.9,'#3a4247',crate);box(0,.68,0,1,.08,1,'#5d676c',crate);
    const band=new THREE.Mesh(cube,glow(color));band.scale.set(.92,.06,.92);band.position.y=.5;crate.add(band);
    const pulse=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));pulse.rotation.x=-Math.PI/2;pulse.position.y=.03;g.add(pulse);
    let beam=null;if(Q.beams){beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));beam.scale.y=2;beam.position.y=1;g.add(beam);}
    if(loot.marked){
      const halo=new THREE.Mesh(new THREE.RingGeometry(.7,.82,40),new THREE.MeshBasicMaterial({color:'#75cfcc',side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.04;g.add(halo);
      const beacon=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#75cfcc'}));beacon.scale.set(.18,.18,.18);beacon.position.y=1.15;beacon.rotation.z=Math.PI/4;g.add(beacon);
    }
    const v={loot,group:g,crate,band,pulse,beam,color,tier,phase:(loot.x*7+loot.z*3)%6.28};
    if(loot.revealed)applyReveal(v,false);
    return v;
  }
  // Switch an unidentified pickup to its rarity color (+ optional reveal burst).
  function applyReveal(v,fx=true){const c=RARITY_COLORS[v.tier],hi=RARITY_ORDER.indexOf(v.tier);v.color=c;
    v.band.material=glow(c);v.pulse.material.color.set(c);
    if(v.beam){v.beam.material.color.set(c);v.beam.scale.y=3+hi*.6;v.beam.position.y=v.beam.scale.y/2;}
    if(fx)burst(v.loot.x,v.loot.z,c);}
  const lootBoxes=level.lootBoxes.map(lootVisual);
  function addLoot(loot){const visual=lootVisual(loot);lootBoxes.push(visual);return visual;}
  const routes=[];
  for(const choice of level.routeChoices){
    const color=choice.kind==='loot'?'#75cfcc':'#75cfcc';
    const markers=[];for(let i=0;i<5;i++)markers.push(box(choice.sign.x+choice.dir.x*i*.5,.03,choice.sign.z-i*.3,.28,.035,.28,color));routes.push({choice,markers,level});
  }
  const enemies=level.enemies.map(enemy=>{
    const g=new THREE.Group();g.position.set(enemy.x,0,enemy.z);group.add(g);
    box(0,.1,0,1,.2,1,'#30353c',g);box(0,.52,0,.72,.72,.72,'#6e6266',g);
    box(0,.96,0,.55,.18,.55,RULES.enemyTypes[enemy.type]?.color??'#a67072',g);box(0,.64,.5,.18,.18,.65,'#4d2a30',g);
    const danger=new THREE.Mesh(new THREE.RingGeometry(.62,.72,32),glow('#ff5a4f',.55));danger.rotation.x=-Math.PI/2;danger.position.y=.02;g.add(danger);
    const eye=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#ff8d84',toneMapped:false}));eye.scale.set(.37,.09,.03);eye.position.set(0,.77,.365);g.add(eye);
    return {enemy,group:g};
  });
  const exitMaterial=new THREE.MeshStandardMaterial({color:'#4d6a58',emissive:EXTRACT_COLOR,emissiveIntensity:0,roughness:.5});
  const exitRings=[0,1].map(i=>{const m=new THREE.Mesh(new THREE.RingGeometry(1.25,1.42,48),new THREE.MeshBasicMaterial({color:EXTRACT_COLOR,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(exit.x,.035,exit.z);group.add(m);return m;});
  const exitBeam=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.1,1,20,1,true),new THREE.MeshBasicMaterial({color:EXTRACT_COLOR,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  exitBeam.scale.y=Q.beams?6:3;exitBeam.position.set(exit.x,exitBeam.scale.y/2,exit.z);exitBeam.visible=false;group.add(exitBeam);
  let exitOpen=false;
  const gate=new THREE.Mesh(cube,exitMaterial);gate.scale.set(2,.85,.22);gate.position.set(exit.x,.55,exit.z);group.add(gate);
  for(const sign of [-1,1])box(exit.x+sign*1.1,.7,exit.z,.15,1.4,.3,'#88969b');
  const exitPad=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.8),new THREE.MeshBasicMaterial({color:'#b49b64',transparent:true,opacity:.16,side:THREE.DoubleSide}));
  exitPad.rotation.x=-Math.PI/2;exitPad.position.set(exit.x,.022,exit.z);group.add(exitPad);
  function setExit(open){exitOpen=open;gate.visible=!open;exitMaterial.color.set(open?EXTRACT_COLOR:'#4d6a58');exitMaterial.emissiveIntensity=open?1:0;exitPad.material.color.set(open?EXTRACT_COLOR:'#3c5a48');exitPad.material.opacity=open?.4:.18;exitBeam.visible=open;}
  // pickup burst: expanding ring + short flash (pooled per call; cheap)
  const bursts=[];
  function burst(x,z,color='#ffd04a'){const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);group.add(m);bursts.push({m,t:0});}
  let lastTime=null;
  function animate(time){const dt=lastTime==null?0:Math.min(.1,time-lastTime);lastTime=time;
    for(const v of lootBoxes){if(!v.group.visible)continue;const p=time*2.6+v.phase;
      v.crate.position.y=.06+Math.sin(p)*.06;v.crate.rotation.y=time*.6+v.phase;
      const k=(time*.8+v.phase)%1;v.pulse.scale.setScalar(.8+k*.7);v.pulse.material.opacity=.6*(1-k);
      if(v.beam)v.beam.material.opacity=(v.loot.revealed?.16+RARITY_ORDER.indexOf(v.tier)*.04:.1)+Math.sin(p)*.05;}
    if(exitOpen){for(let i=0;i<2;i++){const k=(time*.7+i*.5)%1;exitRings[i].scale.setScalar(.7+k*.9);exitRings[i].material.opacity=.85*(1-k);}
      exitBeam.material.opacity=.2+Math.sin(time*3)*.06;exitPad.material.opacity=.32+Math.sin(time*3)*.1;}
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.t+=dt;b.m.scale.setScalar(1+b.t*5);b.m.material.opacity=Math.max(0,.9-b.t*1.8);if(b.t>.5){group.remove(b.m);b.m.material.dispose();bursts.splice(i,1);}}
for(const v of nodes){if(v.node.active){v.coreMaterial.color.set('#75cfcc');v.coreMaterial.emissiveIntensity=2.5;v.light.intensity=12+Math.sin(time*2.5)*1.5;v.halo.material.opacity=.7;v.halo.scale.setScalar(1+Math.sin(time*2.5)*.035);}}}
  function dispose(){
    const geometries=new Set(),mats=new Set();
    group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});
    for(const g of geometries)if(!g.userData?.shared)g.dispose();for(const m of mats)if(!m.userData?.shared)m.dispose();group.clear();scene.remove(group);bursts.length=0;
  }
  const hazards=(level.hazards??[]).map(h=>{
    const mat=new THREE.MeshBasicMaterial({color:'#e0c040',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(h.w,h.d),mat);pad.rotation.x=-Math.PI/2;pad.position.set(h.x,.03,h.z);group.add(pad);
    const rr=Math.min(h.w,h.d)*.46,ring=(inner,mat)=>{const m=new THREE.Mesh(new THREE.RingGeometry(inner,rr,64,1,-Math.PI/2),mat);m.rotation.x=-Math.PI/2;m.position.set(h.x,.045,h.z);m.renderOrder=3;group.add(m);return m;};
    const track=ring(rr-.24,new THREE.MeshBasicMaterial({color:'#3a2f12',transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
    const fill=ring(rr-.24,new THREE.MeshBasicMaterial({color:'#ffd23a',transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false,depthTest:false,toneMapped:false}));fill.position.y=.05;fill.renderOrder=4;
    return {hazard:h,mat,fill,track};
  });
  // Telegraph: warn = strong yellow/white pulse that speeds up as it nears 'on'; on = solid red.
  function animateHazards(now){for(const v of hazards){const t=hazardTiming(v.hazard,now);
    // recharge ring fills clockwise while the pad charges back up; hidden while live
    const prog=t.state==='on'?0:1-t.msToOn/RULES.hazard.offMs;v.fill.visible=v.track.visible=t.state!=='on';v.fill.geometry.setDrawRange(0,Math.floor(Math.max(0,Math.min(1,prog))*64)*6);
    v.fill.material.color.set(t.state==='warn'?'#fff27a':'#ffb820');
    if(t.state==='on'){v.mat.color.set('#ff3b1f');v.mat.opacity=.75;}
    else if(t.state==='warn'){const pulse=.5+.5*Math.sin(now/(40+t.msToOn/12));v.mat.color.set(pulse>.5?'#fff27a':'#ff9a1f');v.mat.opacity=.45+.4*pulse;}
    else{v.mat.color.set('#e0c040');v.mat.opacity=.18;}}}
  // seed-deterministic props (visual only, never in collision data; kept off paths/objectives)
  const prng=rngFrom(`${level.seed}:props`),spots=isTown?[]:propSpots(level,prng,Math.round(level.floors.reduce((a,f)=>a+f.w*f.d,0)/24*Q.props));
  const props=spots.map(spot=>{const p=buildProp(PROP_KINDS[Math.floor(prng()*PROP_KINDS.length)],spot,box,prng);group.add(p);return p;});
  for(let k=0;k<Math.min(Q.lights,spots.length);k++){const l=new THREE.PointLight(PALETTE.neon,4,6,1.8);l.position.set(spots[k].x,1.4,spots[k].z);group.add(l);}
  for(const v of nodes)if(v.node.shielded)box(0,1.6,0,.5,.08,.5,'#7c6fa8',v.group??group);
  return {house:townInfo?.house??null,group,nodes,enemies,lootBoxes,addLoot,applyReveal,routes,setExit,animate,animateHazards,dispose,props,propSpots:spots,burst};
}
