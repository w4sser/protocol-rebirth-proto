// @hot updateVfx
import {attachEnemyModel} from './enemy-animation.js?v=2.28.66';
import {isShieldTurret,ENEMY_COLORS} from './enemies.js?v=2.28.66';
import * as THREE from './vendor/three.module.js';
import {RULES,hazardState,hazardTiming} from './levels.js?v=2.28.66';
import {rarityOf,lootColor,RARITY_COLORS,RARITY_ORDER} from './rarity.js?v=2.28.66';
import {buildTown} from './town.js?v=2.28.66';
import {buildBunker,kitGroup,planKitProps,BUNKER_DIMS,LAYER} from './bunker.js?v=2.28.66';
import {buildArchipelago,pineTree,propInPassage} from './archipelago.js?v=2.28.66-glacial-merge1';
import {planArchipelagoPines,archipelagoCoastalPine,setArchipelagoPineOpacity} from './archipelago-visual-v2.mjs?v=2.28.66-glacial-merge1';
import {PALETTE,glow,propSpots,buildProp,PROP_KINDS,rngFrom,qualitySettings,lootTier,LOOT_COLORS,EXTRACT_COLOR} from './art.js?v=2.28.66';
import {controlCablePath} from './control-cables.js?v=2.28.66';
import {extractAvailable} from './big-level.js?v=2.28.66';
import {createExtractBeam} from './vfx-extract-beam.js?v=2.28.66';
import {createLootBurstPool} from './vfx-loot-burst.js?v=2.28.66';
import {tagBloom,BLOOM_LAYER} from './postfx.js?v=2.28.66';
const KEY_AMBER='#FF9D4D'; // AD palette: amber = loot (the keycard crate), coral = danger, cyan = system
export function setNodeHold(visual,progress){
  const fill=visual.node.active?0:Math.max(0,Math.min(1,progress));
  visual.holdRing.visible=!visual.node.active&&fill>0;
  visual.holdRing.geometry.setDrawRange(0,Math.floor(fill*64)*6);
}

export function buildWorld(level,scene,{quality='high',town=null,pine=null,bunker=null,militaryStyle=false}={}) {
  let disposed=false;
  const Q=qualitySettings(quality);
  const group=new THREE.Group();scene.add(group);
  const cube=new THREE.BoxGeometry(1,1,1),materials={},shieldGeometries=new Map();
  const shieldGeometry=(angle,radius,height)=>{const key=`${angle}:${radius}:${height}`;if(!shieldGeometries.has(key))shieldGeometries.set(key,new THREE.CylinderGeometry(radius,radius,height,20,1,true,-angle*Math.PI/180,2*angle*Math.PI/180));return shieldGeometries.get(key);};
  const material=color=>materials[color] ||= new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12});
  function box(x,y,z,w,h,d,color='#616973',parent=group){
    const m=new THREE.Mesh(cube,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  // Mood pass: enemies, loot and supply nodes are gameplay-critical and must stay readable even where the
  // environment fades into fog. `color`'s material is cached per-call-site above, so this only ever flips
  // fog off for the mesh's own (gameplay-only) colour, never for shared environment materials like PALETTE.base.
  function noFog(obj){obj.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])m.fog=false;});return obj;}
  const isTown=!!(level.town&&town);
  const townInfo=isTown?buildTown(level,group,town,Q):null;
  const isArch=!!level.archipelago&&!isTown;
  const archInfo=isArch?buildArchipelago(level,group,box,{pine,quality:Q,militaryStyle}):null;
  // Bunker kit (v1.54): GLB floors/walls/cover/dressing; procedural boxes stay as the fallback
  const K=!isTown&&!isArch&&bunker?bunker:null;
  const bunkerInfo=K?buildBunker(level,group,K,Q):null;
  if(!isTown&&!isArch&&!K)for(const f of level.floors){
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
  if(!isTown&&!isArch&&!K)for(const b of [...level.walls,...level.boxes]){
    const isBox=level.boxes.includes(b);
    box(b.x,b.h/2,b.z,b.w,b.h,b.d,isBox?PALETTE.box:PALETTE.wall);
    box(b.x,b.h+.025,b.z,b.w,.05,b.d,PALETTE.wallTop);
    // neon edge trim on top of walls / cover
    const t=new THREE.Mesh(cube,glow(isBox?PALETTE.neonSoft:PALETTE.neon,isBox?.8:.9));t.position.set(b.x,b.h+.06,b.z);t.scale.set(Math.max(.06,b.w-.08),.03,Math.max(.06,b.d-.08));
    if(b.w>b.d)t.scale.z=.07;else t.scale.x=.07;group.add(t);
  }
  const nodes=level.nodes.map(node=>{
    const g=new THREE.Group();g.position.set(node.x,0,node.z);group.add(g);
    // Mood pass: a supply node is a primary gameplay target, so its body/glow stay readable through fog.
    const coreMaterial=new THREE.MeshStandardMaterial({color:'#8a9b9b',emissive:'#75cfcc',emissiveIntensity:0,roughness:.4,fog:false});
    let kit=null;
    if(K){const s=level.nodeSize??1.4;kit={};for(const st of ['idle','shielded','active']){kit[st]=kitGroup(K['node_terminal_'+st],{sx:s/1.2,sy:1,sz:s/1.2});noFog(kit[st]);g.add(kit[st]);}
      const top=new THREE.Mesh(cube,coreMaterial);top.scale.set(.5,.02,.5);top.position.y=1.42;g.add(top);}
    else{
    noFog(box(0,.1,0,1.9,.2,1.9,'#1c262d',g));
    noFog(box(0,.65,0,1.4,1,1.4,'#34444c',g));
    noFog(box(0,1.23,0,1.6,.16,1.6,'#56666d',g));
    const front=new THREE.Mesh(cube,coreMaterial);front.scale.set(.95,.7,.03);front.position.set(0,.69,.711);g.add(front);
    const top=new THREE.Mesh(cube,coreMaterial);top.scale.set(1,.025,1);top.position.y=1.323;g.add(top);}
    const panel=box(0,1.46,.1,.72,.09,.48,PALETTE.base,g);panel.rotation.x=.24;
    const display=new THREE.Mesh(cube,coreMaterial);display.scale.set(.48,.025,.25);display.position.set(0,1.52,.1);display.rotation.x=.24;g.add(display);
    for(const x of [-.48,.48])box(x,.3,.55,.14,.2,.14,PALETTE.base,g);
    const light=new THREE.PointLight('#3FE0D0',0,8,1.6);light.position.y=1.9;g.add(light);
    const halo=new THREE.Mesh(new THREE.RingGeometry(RULES.resources.nodeReach-.1,RULES.resources.nodeReach,64),new THREE.MeshBasicMaterial({color:'#75cfcc',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false,fog:false}));
    halo.rotation.x=-Math.PI/2;halo.position.y=.018;g.add(halo);
    const holdRing=new THREE.Mesh(new THREE.RingGeometry(RULES.resources.nodeReach-.16,RULES.resources.nodeReach+.03,64,1,-Math.PI/2),new THREE.MeshBasicMaterial({color:'#3FE0D0',side:THREE.DoubleSide,depthWrite:false,fog:false}));
    holdRing.rotation.x=-Math.PI/2;holdRing.position.y=.026;holdRing.visible=false;holdRing.geometry.setDrawRange(0,0);g.add(holdRing);
    const v={node,group:g,coreMaterial,light,halo,holdRing,kit};nodeKit(v);return v;
  });
  function nodeKit(v){if(!v.kit)return;const st=v.node.active?'active':v.node.shielded?'shielded':'idle';for(const k in v.kit)v.kit[k].visible=k===st;}
  const exit=level.exit;
  // Physical floor channels connect every gate control to its destination.
  const controlCables=nodes.map(v=>{
    const path=controlCablePath(level,v.node),segments=[],lengths=[];
    const liveMaterial=new THREE.MeshBasicMaterial({color:EXTRACT_COLOR,transparent:true,opacity:.18,toneMapped:false,depthWrite:false});
    let length=0;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],d=Math.hypot(b.x-a.x,b.z-a.z);if(d<.001)continue;
      const tray=box((a.x+b.x)/2,.065,(a.z+b.z)/2,.2,.07,d+.1,PALETTE.base);
      tray.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
      const strip=new THREE.Mesh(cube,liveMaterial);strip.position.set(tray.position.x,.105,tray.position.z);strip.scale.set(.055,.018,d);strip.rotation.y=tray.rotation.y;group.add(strip);
      segments.push({a,b,d});lengths.push(length);length+=d;
    }
    const pulse=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:EXTRACT_COLOR,toneMapped:false}));pulse.scale.set(.14,.04,.24);pulse.visible=false;group.add(pulse);
    // A small junction box makes the terminal's cable outlet physically legible.
    box(v.node.x,.14,v.node.z,.35,.28,.35,PALETTE.base);
    return {node:v.node,path,segments,lengths,length,liveMaterial,pulse,wasActive:false,activatedAt:null};
  });
  const beamGeo=new THREE.CylinderGeometry(.12,.22,1,12,1,true),ringGeo=new THREE.RingGeometry(.62,.78,40);
  function lootVisual(loot){
    const g=new THREE.Group();g.position.set(loot.x,0,loot.z);group.add(g);
    const tier=rarityOf(loot.item),color=loot.item==='keycard'?KEY_AMBER:lootColor(loot);
    const crate=new THREE.Group();g.add(crate);
    let kitCrates=null;
    // Mood pass: loot crates are a primary objective, so they (and their marker/beam/halo) stay crisp in fog.
    if(K){kitCrates={};for(const t of RARITY_ORDER){const k=K['loot_crate_'+t];if(!k)continue;kitCrates[t]=kitGroup(k,{sx:1.15,sy:1.15,sz:1.15});kitCrates[t].visible=t==='common';noFog(kitCrates[t]);crate.add(kitCrates[t]);}}
    else{
      noFog(box(0,.3,0,1.02,.6,.78,'#1B2740',crate));noFog(box(0,.67,0,1.1,.2,.86,KEY_AMBER,crate));
      for(const x of [-.31,.31]){noFog(box(x,.79,0,.095,.04,.8,'#E7BF7A',crate));noFog(box(x,.39,.4,.095,.72,.045,'#E7BF7A',crate));}
      noFog(box(0,.4,.42,.19,.2,.05,'#E7BF7A',crate));
    }
    const band=new THREE.Mesh(cube,glow(color));band.scale.set(.46,.035,.025);band.position.set(0,K?.52:.71,K?.35:.437);crate.add(band);
    const pulse=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:KEY_AMBER,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,fog:false}));pulse.rotation.x=-Math.PI/2;pulse.position.y=.03;g.add(pulse);
    let beam=null;if(Q.beams){beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:KEY_AMBER,transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,fog:false}));beam.scale.y=2;beam.position.y=1;g.add(beam);}
    if(loot.marked){
      const halo=new THREE.Mesh(new THREE.RingGeometry(.7,.82,40),new THREE.MeshBasicMaterial({color:KEY_AMBER,side:THREE.DoubleSide,depthWrite:false,fog:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.04;g.add(halo);
      const beacon=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:KEY_AMBER,toneMapped:false,fog:false}));beacon.scale.set(.18,.18,.18);beacon.position.y=1.15;beacon.rotation.z=Math.PI/4;g.add(beacon);
    }
    const v={loot,group:g,crate,band,pulse,beam,color,tier,kitCrates,phase:(loot.x*7+loot.z*3)%6.28};
    if(loot.revealed)applyReveal(v,false);
    return v;
  }
  // Switch an unidentified pickup to its rarity color (+ optional reveal burst).
  function applyReveal(v,fx=true){const c=v.loot.item==='keycard'?KEY_AMBER:RARITY_COLORS[v.tier],hi=RARITY_ORDER.indexOf(v.tier);v.color=c;
    v.band.material=glow(c);if(v.kitCrates)v.band.position.y=BUNKER_DIMS['loot_crate_'+v.tier][1]*.755*1.15;if(v.kitCrates)for(const t in v.kitCrates)v.kitCrates[t].visible=t===(v.kitCrates[v.tier]?v.tier:'common');v.pulse.material.color.set(KEY_AMBER);
    if(v.beam){v.beam.material.color.set(KEY_AMBER);v.beam.scale.y=3+hi*.6;v.beam.position.y=v.beam.scale.y/2;}
    if(fx)burst(v.loot.x,v.loot.z,c);}
  // Grounded fuel drum: its exposed bands suggest a shot without text.
  // Stateful existing kit shelf. Amber ties distinguish it from inert dressing.
  // All geometry/materials are allocated once at level load; animation reuses them.
  const shelves=(level.shelves??[]).map(shelf=>{
    const base=new THREE.Group(),pivot=new THREE.Group();base.position.set(shelf.x,0,shelf.z);base.rotation.y=shelf.ry;base.add(pivot);group.add(base);
    if(K)pivot.add(kitGroup(K.shelf_supply_full));
    else{
      for(const x of [-.85,.85])box(x,1,0,.1,2,.5,PALETTE.box,pivot);
      for(const y of [.12,.7,1.3,1.9])box(0,y,0,1.8,.1,.5,PALETTE.box,pivot);
      for(const x of [-.5,.3])box(x,.95,0,.5,.4,.4,PALETTE.wall,pivot);
    }
    const strap=box(0,1,.28,1.7,.09,.035,PALETTE.warm,pivot);strap.material=glow(PALETTE.warm,.8);tagBloom(strap);
    // Fall telegraph: a near-black footprint reads against any floor tone, and a bright pulsing coral
    // outline (drawn with no depth test, above the patrol sight-cone fill) keeps it unmistakable even
    // when a guard's cone overlaps the same tile.
    const fw=shelf.footprint.w,fd=shelf.footprint.d;
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(fw,fd),new THREE.MeshBasicMaterial({color:'#1a0806',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,depthTest:false,fog:false,toneMapped:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(shelf.footprint.x,.04,shelf.footprint.z);shadow.renderOrder=5;shadow.visible=false;group.add(shadow);
    const hx=fw/2,hz=fd/2,corners=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz],[-hx,-hz]].map(([x,z])=>new THREE.Vector3(x,0,z));
    const edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:ENEMY_COLORS.damage,transparent:true,opacity:1,depthTest:false,toneMapped:false}));
    edge.position.set(shelf.footprint.x,.05,shelf.footprint.z);edge.renderOrder=6;edge.visible=false;group.add(edge);
    return {shelf,base,pivot,strap,shadow,edge};
  });
  const barrels=(level.barrels??[]).map(barrel=>{
    const g=new THREE.Group();g.position.set(barrel.x,0,barrel.z);group.add(g);
    const metal=new THREE.MeshStandardMaterial({color:'#5b4e44',metalness:.58,roughness:.48});
    const danger=new THREE.MeshStandardMaterial({color:'#bf624e',metalness:.18,roughness:.64,emissive:'#53251e',emissiveIntensity:.5});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.95,14),metal);
    body.position.y=.54;g.add(body);
    // danger's emissive is a dark warning-maroon (a subtle under-light for the direct-view material, not a
    // bloom source on its own); boost just the bloom contribution so the bands read next to the brighter
    // pad/extraction cues, without changing how the drum looks on Low or outside the bloom pass.
    for(const y of [.21,.67,1.01]){
      const band=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.10,14),danger);
      band.position.y=y;g.add(band);tagBloom(band,{boost:3});
    }
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.07,14),danger);
    lid.position.y=1.065;g.add(lid);tagBloom(lid,{boost:3});
    const ring=new THREE.Mesh(new THREE.RingGeometry(.64,.70,32),
      new THREE.MeshBasicMaterial({color:'#cf745b',transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.02;g.add(ring);
    return {barrel,group:g,ring,danger};
  });
  const lootBoxes=level.lootBoxes.map(lootVisual);
  function addLoot(loot){const visual=lootVisual(loot);lootBoxes.push(visual);return visual;}
  const routes=[];
  for(const choice of level.routeChoices){
    const color=choice.kind==='loot'?'#75cfcc':'#75cfcc';
    const markers=[];for(let i=0;i<5;i++)markers.push(box(choice.sign.x+choice.dir.x*i*.5,.03,choice.sign.z-i*.3,.28,.035,.28,color));routes.push({choice,markers,level});
  }
  function enemyVisual(enemy){
    const g=new THREE.Group();g.position.set(enemy.x,0,enemy.z);group.add(g);
    // Mood pass: enemies are threats the player must read at a glance, so their bodies stay fog-free.
    if(enemy.type==='generator'){
      // Encounter 6: a cyan (system) generator; a beam to its node shows the shield is still up.
      noFog(box(0,.12,0,1,.24,1,'#243238',g));noFog(box(0,.62,0,.7,.8,.7,'#34505a',g));
      const core=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#3FE0D0',toneMapped:false,fog:false}));core.scale.set(.32,.5,.32);core.position.y=.66;g.add(core);
      const node=level.nodes.find(n=>n.id===enemy.node),line=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.9,0),new THREE.Vector3((node?.x??enemy.x)-enemy.x,1.1,(node?.z??enemy.z)-enemy.z)]);
      const beam=new THREE.Line(line,new THREE.LineBasicMaterial({color:'#3FE0D0',transparent:true,opacity:.9,toneMapped:false,fog:false}));beam.frustumCulled=false;g.add(beam);
      return {enemy,group:g,beam};
    }
    noFog(box(0,.1,0,1,.2,1,'#30353c',g));noFog(box(0,.52,0,.72,.72,.72,'#6e6266',g));
    noFog(box(0,.96,0,.55,.18,.55,RULES.enemyTypes[enemy.type]?.color??'#a67072',g));noFog(box(0,.64,.5,.18,.18,.65,'#4d2a30',g));
    const danger=new THREE.Mesh(new THREE.RingGeometry(.62,.72,32),glow('#E4705F',.55));danger.rotation.x=-Math.PI/2;danger.position.y=.02;g.add(danger);
    const eye=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#E4705F',toneMapped:false,fog:false}));eye.scale.set(.37,.09,.03);eye.position.set(0,.77,.365);g.add(eye);
    // Kill readability (docs/design-combat-feel-oct28.md §2.1.3): a white flash on the mesh itself, not just the
    // DOM hit label. Its own material (not the shared body material cache) so one enemy flashing never affects others.
    const meshFlash=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
    meshFlash.position.y=.52;meshFlash.scale.set(.76,.76,.76);g.add(meshFlash);
    const out={enemy,group:g,eye,meshFlash};
    // Encounter 1: the front shield is a cyan plate that turns with the guard; shots from inside its arc are blocked.
    if(enemy.frontShield&&!enemy.introGuard){
      const arc=new THREE.Mesh(shieldGeometry(enemy.frontShield,.95,.9),new THREE.MeshBasicMaterial({color:isShieldTurret(enemy)?ENEMY_COLORS.shield:'#3FE0D0',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
      arc.position.y=.62;g.add(arc);out.shield=arc;
      // v1.65 readability: bright cyan rims top + bottom make the arc read as a solid plate from the iso camera.
      for(const y of [.18,1.06]){const rim=new THREE.Mesh(shieldGeometry(enemy.frontShield,.97,.07),new THREE.MeshBasicMaterial({color:isShieldTurret(enemy)?ENEMY_COLORS.shield:'#3FE0D0',side:THREE.DoubleSide,toneMapped:false}));rim.position.y=y;arc.add(rim);rim.position.y-=arc.position.y;}
    }
    // Encounter 4: the patrol's sight cone lies on the floor (coral = danger); game.mjs scales it to the current range.
    if(enemy.patrol){
      const half=RULES.encounters.patrol.coneHalfAngleDeg*Math.PI/180,pts=[0,0];
      for(let i=0;i<=16;i++){const a=-half+2*half*i/16;pts.push(Math.sin(a),Math.cos(a));}
      const fill=[],edge=[];for(let i=0;i<16;i++){const a=pts[2+i*2],b=pts[3+i*2],c=pts[4+i*2],d=pts[5+i*2];fill.push(0,0,0,a,0,b,c,0,d);}
      for(let i=0;i<=16;i++)edge.push(pts[2+i*2],0,pts[3+i*2]);
      const cone=new THREE.Group(),fillGeo=new THREE.BufferGeometry();fillGeo.setAttribute('position',new THREE.Float32BufferAttribute(fill,3));
      const fm=new THREE.Mesh(fillGeo,new THREE.MeshBasicMaterial({color:'#E4705F',transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));fm.renderOrder=2;cone.add(fm);
      const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,...edge,0,0,0],3));
      const em=new THREE.Line(eg,new THREE.LineBasicMaterial({color:'#E4705F',transparent:true,opacity:.85,toneMapped:false}));em.renderOrder=3;cone.add(em);
      cone.position.y=.045;cone.scale.set(RULES.encounters.patrol.coneRange,1,RULES.encounters.patrol.coneRange);g.add(cone);out.cone=cone;out.coneFill=fm;
    }
    attachEnemyModel(out,()=>disposed);
    return out;
  }
  const enemies=level.enemies.map(enemyVisual);
  // v2.7.0 hunter waves (nodspel/stakes.js): new enemies can appear mid-raid, out of sight, well after the
  // level's own list was built above - give them the same mesh/visual the initial roster gets.
  function addEnemy(enemy){const v=enemyVisual(enemy);enemies.push(v);return v;}
  // Encounter 3: locked doors are dark panels with a coral light; once opened only a cyan floor strip stays.
  const doors=(level.doors??[]).map(door=>{
    const g=new THREE.Group();g.position.set(door.x,0,door.z);group.add(g);
    const panel=box(0,door.h/2,0,door.w,door.h,door.d,'#2b3339',g);
    const strip=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#E4705F',toneMapped:false}));strip.scale.set(door.w>door.d?door.w:.1,.05,door.w>door.d?.1:door.d);strip.position.y=door.h+.03;g.add(strip);
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(door.w>door.d?door.w:.5,door.w>door.d?.5:door.d),new THREE.MeshBasicMaterial({color:'#3FE0D0',transparent:true,opacity:.0,depthWrite:false,toneMapped:false}));mark.rotation.x=-Math.PI/2;mark.position.y=.03;g.add(mark);
    return {door,group:g,panel,strip,mark};
  });
  // Encounter 5: a spawn point is a coral ring on the floor (pulses faster once armed -> warning); gone after the burst.
  const spawners=(level.spawners??[]).map(sp=>{
    const g=new THREE.Group();g.position.set(sp.x,0,sp.z);group.add(g);
    const ring=new THREE.Mesh(new THREE.RingGeometry(RULES.encounters.swarm.ring+.25,RULES.encounters.swarm.ring+.4,40),new THREE.MeshBasicMaterial({color:'#E4705F',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);
    const pad=new THREE.Mesh(new THREE.CircleGeometry(RULES.encounters.swarm.ring+.2,32),new THREE.MeshBasicMaterial({color:'#3a1416',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));pad.rotation.x=-Math.PI/2;pad.position.y=.03;g.add(pad);
    return {sp,group:g,ring,pad};
  });
  const exitMaterial=new THREE.MeshStandardMaterial({color:PALETTE.base,emissive:EXTRACT_COLOR,emissiveIntensity:0,roughness:.5});
  // PRB-156: the in-world 3D extraction beam/decal/particles (vfx-extract-beam.js) replace the old flat
  // ring+cylinder pair -- same exit position, same EXTRACT_COLOR, gameplay radius/logic untouched.
  const sameExtract=(a,b)=>!!(a&&b&&Math.hypot(a.x-b.x,a.z-b.z)<.35);
  const depthExtractOpen=(point,round)=>!!(level.depth&&round?.depth?.extractOpen&&sameExtract(point,round.level?.exit));
  const extractionEffects=(level.extracts??[exit]).map(point=>{
    const fx=createExtractBeam({color:EXTRACT_COLOR,quality});
    fx.group.position.set(point.x,0,point.z);group.add(fx.group);
    for(const cue of [fx.pad,fx.rim,fx.fence,fx.beam,fx.core,fx.points,...fx.pulseRings])tagBloom(cue);
    return {point,fx};
  });
  const extractBeamFx=extractionEffects[0].fx;
  const gateProgress=nodes.map((v,i)=>{
    const perSide=nodes.length,span=2.2/perSide;
    const m=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:EXTRACT_COLOR,transparent:true,opacity:.16,toneMapped:false}));
    m.position.set(exit.x-1.1+span*(i+.5),.13,exit.z+1.08);m.scale.set(span*.85,.05,.1);group.add(m);return {node:v.node,mesh:m};
  });
  let exitOpen=false;
  // Depth Raid: one hatch + light per area extract so area 3 has a real pad in the last wing
  // (v2.28.61). Node Raid still builds a single hatch at `exit`.
  const hatchPoints=level.depth&&(level.extracts??[]).length?level.extracts:[exit];
  const extractHatches=hatchPoints.map((point,i)=>{
    const material=i===0?exitMaterial:new THREE.MeshStandardMaterial({color:PALETTE.base,emissive:EXTRACT_COLOR,emissiveIntensity:0,roughness:.5});
    const gate=new THREE.Mesh(cube,material);gate.scale.set(2,.85,.22);gate.position.set(point.x,.55,point.z);group.add(gate);
    let kit=null;
    if(K){gate.scale.set(1.6,.04,.04);gate.position.y=.02;kit={};
      for(const k of ['extract_hatch_locked','extract_hatch_open']){kit[k]=kitGroup(K[k],{sx:.9,sy:.7,sz:.9});kit[k].position.set(point.x,0,point.z);kit[k].visible=k.endsWith('locked');group.add(kit[k]);}}
    else for(const sign of [-1,1])box(point.x+sign*1.1,.7,point.z,.15,1.4,.3,'#88969b');
    const light=Q.lights>0?new THREE.PointLight(EXTRACT_COLOR,0,7,2):null;
    if(light){light.position.set(point.x,1.6,point.z);group.add(light);}
    return {point,gate,kit,light,material};
  });
  const gate=extractHatches[0].gate,exitKit=extractHatches[0].kit,exitLight=extractHatches[0].light;
  let vfxDisposed=false;
  function setExit(open){
    const justOpened=open&&!exitOpen;exitOpen=open;
    const current=level.depth?level.exit:exit;
    for(const h of extractHatches){
      const thisOpen=open&&sameExtract(h.point,current);
      h.gate.visible=!thisOpen;if(h.kit){h.kit.extract_hatch_locked.visible=!thisOpen;h.kit.extract_hatch_open.visible=thisOpen;}
      h.material.color.set(thisOpen?EXTRACT_COLOR:PALETTE.base);h.material.emissiveIntensity=thisOpen?1:0;
      if(h.light)h.light.intensity=thisOpen?14:0;
    }
    // Activation stays on the existing audio edge; the beam supplies the world cue.
    return justOpened;
  }
  // pickup burst: expanding ring + short flash (pooled per call; cheap)
  const bursts=[];
  const lootBurstFx=createLootBurstPool({quality});lootBurstFx.group.name='world-loot-vfx';group.add(lootBurstFx.group);
  function burst(x,z,color='#ffd04a',withParticles=false,scale=1){
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    const m=new THREE.Mesh(ringGeo,material);m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);group.add(m);
    const particles=[];
    if(withParticles){const B=RULES.feedback.burst;for(let i=0;i<B.particles;i++){
      const p=new THREE.Mesh(cube,material),angle=i/B.particles*Math.PI*2;p.scale.setScalar(B.size);p.position.set(x,.5,z);group.add(p);particles.push({mesh:p,dx:Math.cos(angle),dz:Math.sin(angle)});
    }}
    bursts.push({m,t:0,x,z,particles,scale});
  }
  let lastTime=null;
  const LOOT_BURST_HOME_Y=1.05; // approx bag/chest height sparkles home toward
  function setVfxQuality(next){
    if(vfxDisposed)return;
    for(const record of extractionEffects)record.fx.setQuality(next);
    lootBurstFx.setQuality(next);
  }
  function disposeVfx(){
    if(vfxDisposed)return;vfxDisposed=true;
    for(const record of extractionEffects)record.fx.dispose();
    lootBurstFx.dispose();
  }
  function updateVfx(time,dt,playerPos,round){
    if(vfxDisposed)return;
    for(const record of extractionEffects){
      const point=record.point,open=level.big&&round?extractAvailable(point,round):level.depth&&round?depthExtractOpen(point,round):exitOpen;
      const distance=playerPos?Math.hypot(playerPos.x-point.x,playerPos.z-point.z):Infinity;
      const progress=open?Math.max(0,Math.min(1,1-distance/(point.r+3))):0;
      record.fx.update(time,open,progress);
    }
    lootBurstFx.update(dt,playerPos?playerPos.x:0,LOOT_BURST_HOME_Y,playerPos?playerPos.z:0);
  }
  function animate(time,playerPos,round){const dt=lastTime==null?0:Math.min(.1,time-lastTime);lastTime=time;
    for(const c of controlCables){
      const active=!!c.node.active;
      if(active&&!c.wasActive)c.activatedAt=time;
      c.wasActive=active;c.liveMaterial.opacity=active?.8:.18;
      c.pulse.visible=active&&c.length>0&&time-c.activatedAt<2.4;
      if(c.pulse.visible){
        const distance=Math.min(c.length,(time-c.activatedAt)/2*c.length),i=c.segments.findIndex((s,i)=>distance<=c.lengths[i]+s.d),seg=c.segments[i<0?c.segments.length-1:i],start=c.lengths[i<0?c.segments.length-1:i],t=Math.min(1,(distance-start)/seg.d);
        c.pulse.position.set(seg.a.x+(seg.b.x-seg.a.x)*t,.14,seg.a.z+(seg.b.z-seg.a.z)*t);c.pulse.rotation.y=Math.atan2(seg.b.x-seg.a.x,seg.b.z-seg.a.z);
      }
    }
    for(const p of gateProgress)p.mesh.material.opacity=p.node.active?1:.16;
    for(const v of shelves){
      const s=v.shelf,ms=round.gameNow??0,warning=s.tipAt!=null&&!s.active;
      const fall=s.active?1:warning?Math.max(0,Math.min(1,(ms-s.tipAt-RULES.shelf.telegraphMs)/RULES.shelf.fallMs)):0;
      v.pivot.rotation.x=fall*Math.PI/2+(s.shotAt!=null&&ms-s.shotAt<160&&!warning?Math.sin((ms-s.shotAt)*.06)*.025:0);
      v.pivot.position.y=fall*RULES.shelf.depth/2;
      v.shadow.visible=v.edge.visible=warning;
      v.shadow.material.opacity=.55+.15*Math.sin(time*20);
      v.edge.material.opacity=.75+.25*Math.sin(time*20+Math.PI/2);
      v.edge.scale.setScalar(1+.05*Math.max(0,Math.sin(time*20)));
      v.strap.material.emissiveIntensity=warning?1.4:.8;
    }
    for(const v of barrels){v.group.visible=!v.barrel.active;if(!v.group.visible)continue;
      // Chain telegraph (RULES.drum.chainDelayMs): the same bands flash fast red/bright instead of a new mesh.
      const cooking=v.barrel.cookingAt!=null;
      v.ring.material.opacity=cooking?.55+.4*Math.sin(time*22):.4+.14*Math.sin(time*3);
      v.danger.emissiveIntensity=cooking?.9+.6*Math.max(0,Math.sin(time*22)):.5;}
    for(const v of lootBoxes){if(!v.group.visible)continue;const p=time*2.6+v.phase;
      v.crate.position.y=.03;v.crate.rotation.y=0;
      const k=(time*.8+v.phase)%1;v.pulse.scale.setScalar(.8+k*.7);v.pulse.material.opacity=.6*(1-k);
      if(v.beam)v.beam.material.opacity=(v.loot.revealed?.16+RARITY_ORDER.indexOf(v.tier)*.04:.1)+Math.sin(p)*.05;}
    updateVfx(time,dt,playerPos,round);
    for(let i=bursts.length-1;i>=0;i--){
      const b=bursts[i];b.t+=dt;b.m.scale.setScalar(b.scale*(1+b.t*5));b.m.material.opacity=Math.max(0,.9-b.t*1.8);
      const B=RULES.feedback.burst;
      for(const p of b.particles)p.mesh.position.set(b.x+p.dx*b.t*B.speed*b.scale,Math.max(.03,.5+B.lift*b.t-B.gravity*b.t*b.t),b.z+p.dz*b.t*B.speed*b.scale);
      if(b.t>B.lifeSeconds){group.remove(b.m,...b.particles.map(p=>p.mesh));b.m.material.dispose();bursts.splice(i,1);}
    }
for(const d of doors){const open=!d.door.locked;d.panel.visible=!open;d.strip.visible=!open;d.mark.material.opacity=open?.35+Math.sin(time*3)*.08:0;}
    for(const s of spawners){const st=s.sp.state;s.group.visible=st!=='spawned';
      s.ring.material.opacity=st==='warning'?.55+.45*Math.sin(time*18):.28+.12*Math.sin(time*2.4);s.ring.scale.setScalar(st==='warning'?1+.08*Math.sin(time*18):1);}
for(const v of nodes){nodeKit(v);if(v.node.active){v.coreMaterial.color.set('#75cfcc');v.coreMaterial.emissiveIntensity=2.5;v.light.intensity=12+Math.sin(time*2.5)*1.5;v.halo.material.opacity=.7;v.halo.scale.setScalar(1+Math.sin(time*2.5)*.035);}}}
  function dispose(){
    if(disposed)return;disposed=true;
    disposeVfx();
    const geometries=new Set(),mats=new Set();
    group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);if(o.pineFadeMaterials)for(const m of o.pineFadeMaterials.values())mats.add(m);});
    for(const g of geometries)if(!g.userData?.shared)g.dispose();for(const m of mats)if(!m.userData?.shared)m.dispose();group.clear();scene.remove(group);bursts.length=0;
  }
  // Reuse the kit's box geometry/material vocabulary; no new models or textures.
  const junctions=(level.junctions??[]).map(j=>{
    const pad=level.hazards.find(h=>h.id===j.padId);if(!pad)return null;const g=new THREE.Group();g.position.set(j.x,0,j.z);group.add(g);
    box(0,.6,0,1.15,1.2,.65,PALETTE.base,g);
    const face=new THREE.MeshStandardMaterial({color:PALETTE.warm,emissive:PALETTE.warm,emissiveIntensity:.7,metalness:.5,roughness:.45,fog:false});
    const panel=new THREE.Mesh(cube,face);panel.scale.set(1.05,.85,.72);panel.position.y=.7;g.add(panel);tagBloom(panel);
    for(const x of [-.34,0,.34])box(x,.7,.38,.08,.5,.04,PALETTE.base,g);
    const cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(j.x,.08,j.z),new THREE.Vector3(pad.x,.08,pad.z)]),new THREE.LineBasicMaterial({color:KEY_AMBER,transparent:true,opacity:.65,toneMapped:false,fog:false}));group.add(cable);
    const burst=new THREE.Mesh(new THREE.RingGeometry(.9,1,48),new THREE.MeshBasicMaterial({color:PALETTE.neon,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,fog:false}));burst.rotation.x=-Math.PI/2;burst.position.set(pad.x,.08,pad.z);group.add(burst);
    return {junction:j,pad,face,cable,burst};
  }).filter(Boolean);
  const hazards=(level.hazards??[]).map(h=>{
    const mat=new THREE.MeshBasicMaterial({color:'#e0c040',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(h.w,h.d),mat);pad.rotation.x=-Math.PI/2;pad.position.set(h.x,.03,h.z);group.add(pad);
    const rr=Math.min(h.w,h.d)*.46,ring=(inner,mat)=>{const m=new THREE.Mesh(new THREE.RingGeometry(inner,rr,64,1,-Math.PI/2),mat);m.rotation.x=-Math.PI/2;m.position.set(h.x,.045,h.z);m.renderOrder=3;group.add(m);return m;};
    const track=ring(rr-.24,new THREE.MeshBasicMaterial({color:'#3a2f12',transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
    const fill=ring(rr-.24,new THREE.MeshBasicMaterial({color:'#ffd23a',transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false,depthTest:false,toneMapped:false}));fill.position.y=.05;fill.renderOrder=4;tagBloom(fill);
    let kit=null;if(K){kit={};for(const st of ['off','warn','on']){kit[st]=kitGroup(K['shock_pad_'+st],{sx:h.w/2,sy:1,sz:h.d/2});kit[st].position.set(h.x,LAYER.padTop-.06,h.z);kit[st].visible=st==='off';group.add(kit[st]);if(st==='on')tagBloom(kit[st]);}mat.opacity=.1;}
    return {hazard:h,pad,mat,fill,track,kit};
  });
  // Telegraph: warn = strong yellow/white pulse that speeds up as it nears 'on'; on = solid red.
  const hazardClock={};
  function animateHazards(now){
    for(const v of junctions){
      const state=hazardState(v.pad,now),live=state==='on',over=state==='overload',dead=state==='dead';
      v.face.emissiveIntensity=dead?.05:over?2+Math.sin(now*.08):live?1.5:.6+.2*Math.sin(now*.004);
      v.cable.material.opacity=dead?.12:over?1:live?.9:.4;
      v.burst.visible=over;
      if(over){const t=1-(v.pad.overloadUntil-now)/RULES.junction.overloadMs;v.burst.scale.setScalar(RULES.junction.overloadRadius*(.95+.05*t));v.burst.material.opacity=1-t*.7;}
    }
    for(const v of hazards){const t=hazardTiming(v.hazard,now,hazardClock),live=t.state==='on'||t.state==='overload',dead=t.state==='dead';
      // Only the energized surface emits bloom; charge/dead states keep their existing appearance.
      if(live)v.pad.layers.enable(BLOOM_LAYER);else v.pad.layers.disable(BLOOM_LAYER);
      // recharge ring fills clockwise while the pad charges back up; hidden while live
      const prog=live||dead?0:1-t.msToOn/RULES.hazard.offMs;v.fill.visible=v.track.visible=!live&&!dead;v.fill.geometry.setDrawRange(0,Math.floor(Math.max(0,Math.min(1,prog))*64)*6);
      if(v.kit)for(const st in v.kit)v.kit[st].visible=st===(live?'on':dead?'off':t.state);
      v.fill.material.color.set(KEY_AMBER);
      if(live){v.mat.color.set(t.state==='overload'?PALETTE.neon:KEY_AMBER);v.mat.opacity=t.state==='overload'?.8:.6;}
      else if(t.state==='warn'){v.mat.color.set(KEY_AMBER);v.mat.opacity=.45+.4*(.5+.5*Math.sin(now/(40+t.msToOn/12)));}
      else{v.mat.color.set(KEY_AMBER);v.mat.opacity=dead?.04:.18;}
    }
  }
  // seed-deterministic props (visual only, never in collision data; kept off paths/objectives)
  const prng=rngFrom(`${level.seed}:props`),spots=isTown?[]:propSpots(level,prng,Math.round(level.floors.reduce((a,f)=>a+f.w*f.d,0)/24*Q.props));
  if(archInfo?.visualV2)spots.splice(0,spots.length,...planArchipelagoPines(level,spots));
  const props=K?planKitProps(level,spots,prng).map(t=>{const p=kitGroup(K[t.kind]);p.position.set(t.x,0,t.z);p.rotation.y=t.ry;group.add(p);return p;}):spots.map(spot=>{if(isArch){const p=archInfo.visualV2?archipelagoCoastalPine(spot,{low:Q.props<1}):pineTree(spot,box,prng,pine);if(propInPassage(p,archInfo.passages)||propInPassage(p,archInfo.bridgeClearances))return null;group.add(p);return p;}const p=buildProp(PROP_KINDS[Math.floor(prng()*PROP_KINDS.length)],spot,box,prng);group.add(p);return p;}).filter(Boolean);
  // Opt-in v2 pines are cosmetic, but their crowns can block the isometric
  // camera. Check just their meshes at 10 Hz with orthographic-parallel rays,
  // then smoothly fade only the trees hiding nearby gameplay-critical targets.
  const pineProps=archInfo?.visualV2?props.filter(p=>p?.name==='arch-v2-coastal-pine'):[];
  const pineMeshes=pineProps.flatMap(p=>p.pineMeshes);
  const pineRay=new THREE.Raycaster(),pineOrigin=new THREE.Vector3(),pineDirection=new THREE.Vector3();
  const pineOccluded=new Set();
  let pineCheckIn=0;
  if(pineMeshes.length)group.updateMatrixWorld(true);
  function updatePineOcclusion(camera,player,dt=0){
    if(!pineMeshes.length||!player||!camera)return;
    pineCheckIn-=Math.max(0,dt);
    if(pineCheckIn<=0){
      pineCheckIn=.10;
      pineOccluded.clear();
      // In an orthographic camera every screen ray is parallel. A perspective
      // camera-to-player ray misses tall foreground pines at the screen edges.
      camera.getWorldDirection(pineDirection).negate();
      pineRay.near=.08;
      const trace=(x,y,z)=>{
        pineOrigin.set(x,y,z);
        pineRay.far=camera.position.distanceTo(pineOrigin)+.5;
        pineRay.set(pineOrigin,pineDirection);
        for(const hit of pineRay.intersectObjects(pineMeshes,false)){
          const tree=hit.object.parent?.pineMeshes?hit.object.parent:null;
          if(tree)pineOccluded.add(tree);
        }
      };
      trace(player.x,.86,player.z);
      const nearby=(items,y,radius,max,skipActive=false)=>{
        let count=0;
        for(const o of items??[]){
          if((o.health!=null&&o.health<=0)||o.collected||o.taken||(skipActive&&o.active))continue;
          if(Math.hypot(o.x-player.x,o.z-player.z)>radius)continue;
          trace(o.x,y,o.z);
          if(++count>=max)break;
        }
      };
      nearby(level.enemies,.85,10,4);
      nearby(level.nodes,.8,9,3,true);
      nearby(level.lootBoxes,.45,8,3);
      if(level.exit&&Math.hypot(level.exit.x-player.x,level.exit.z-player.z)<9)
        trace(level.exit.x,.60,level.exit.z);
    }
    for(const tree of pineProps){
      const opacity=tree.userData.pineOpacity;
      const wanted=pineOccluded.has(tree)?.22:1;
      const t=1-Math.exp(-Math.min(Math.max(dt,0),.10)*(wanted<opacity?13:7));
      const next=opacity+(wanted-opacity)*t;
      setArchipelagoPineOpacity(tree,wanted===1&&next>.992?1:next);
    }
  }
  if(isArch)spots.splice(0,spots.length,...props.map(p=>({x:p.position.x,z:p.position.z})));
  if(!isArch){
    const pool=spots.slice();
    const chosen=[];
    if(level.depth){
      for(const area of [1,2,3]){
        const rooms=(level.rooms??[]).filter(r=>r.depthArea===area);
        const inArea=s=>rooms.some(r=>Math.abs(s.x-r.x)<=r.w/2&&Math.abs(s.z-r.z)<=r.d/2);
        const list=pool.filter(inArea);
        if(list.length)chosen.push(list[0]);
        else if(rooms[0])chosen.push({x:rooms[0].x,z:rooms[0].z});
      }
    }else{
      chosen.push(...pool.slice(0,Q.lights));
    }
    for(const s of chosen){const l=new THREE.PointLight(PALETTE.neon,4,6,1.8);l.position.set(s.x,1.4,s.z);group.add(l);}
  }
  for(const v of nodes)if(v.node.shielded&&!K)box(0,1.6,0,.5,.08,.5,'#7c6fa8',v.group??group);
  // v2.22.3 perf: every MeshStandardMaterial shader is built for an exact number of visible lights. Lights used to
  // sit inside groups that get hidden at runtime (nodes out of line of sight, sleeping rooms on big levels), so the
  // visible light count changed while playing and every lit material switched or recompiled its shader: a hitch.
  // Re-home them (same world position) in a rig that is never hidden, so the count stays fixed per level.
  // The rig stays a direct child of `group` (one scene child per world); big-level-culling.js leaves it unwrapped.
  const lightRig=new THREE.Group();lightRig.name='world-light-rig';
  {group.updateMatrixWorld(true);const ls=[];group.traverse(o=>{if(o.isLight&&o.parent)ls.push(o);});group.add(lightRig);for(const l of ls)lightRig.attach(l);}
  return {bunker:bunkerInfo,arch:archInfo,house:townInfo?.house??null,group,nodes,controlCables,gateProgress,enemies,shelves,barrels,doors,spawners,lootBoxes,addLoot,addEnemy,applyReveal,routes,setExit,animate,animateHazards,dispose,props,propSpots:spots,updatePineOcclusion,burst,
    extractionEffects,extractBeamFx,lootBurstFx,spawnLootBurst:lootBurstFx.spawn,setVfxQuality,disposeVfx};
}
