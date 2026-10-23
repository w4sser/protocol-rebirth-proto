import * as THREE from './vendor/three.module.js';
import {loadTownAssets,townLoad,loadKit} from './town.js?v=1.81.0';
import {loadBunkerAssets} from './bunker.js?v=1.81.0';
import {setArea} from './levels.js?v=1.81.0';
import {nextPickupHint,hintText} from './item-hints.js?v=1.81.0';
// Item purpose lines (DATA.itemInfo) are derived from the real module costs + recipes.
import '../data/modules.js?v=1.81.0';import '../data/recipes.js?v=1.81.0';import '../data/vendors.js?v=1.81.0';
import {svgIcon,setIconText} from './svg-icons.js?v=1.81.0';
import {houseSolids,stepHouse,doorAssist,HOUSE} from './house.js?v=1.81.0';
import {moveWithActors,traceTargets,aimConePoints,aimEndpoint} from './physics.mjs?v=1.81.0';
import {rarityOf,updateReveal,RARITY_COLORS} from './rarity.js?v=1.81.0';
import {extractRound,abandonRound,createRound,tickRound,enterExit,exitIsOpen,roundSummary,collectLoot,dropItem,swapLoot,useHealthKit,stepNodeInteraction,bagCapacityOf,lootAction,initEquip,swapGear,gearItem,doorSolids,stepDoors} from './round.js?v=1.81.0';
import {encountersOf,hintFor,deathTip} from './encounters.js?v=1.81.0';
import {createCombat,stepCombat,stepHazards} from './combat.js?v=1.81.0';
import {initTool,toolCharges,canUseTool,autoThrowPoint,previewThrow,throwTool,stepTools,toolDef} from './tools.js?v=1.81.0';
import {buildWorld,setNodeHold} from './world.js?v=1.81.0';
import {RULES,totalNodes,hazardTiming,extractScrapBonus} from './levels.js?v=1.81.0';
import {createWeapon,fireAimedWeapon,stepWeapon,assistAim} from './weapon.js?v=1.81.0';
import {beginAim,dragAim,stepAim,releaseAim,facingDirection} from './controls.js?v=1.81.0';
// import {readOrder,raidResult,resultJSON} from './raid.js?v=1.81.0';
import {bagText,bagItems,ITEM_NAMES} from './raid.js?v=1.81.0';
// import {stepScavenging} from './scavenging.js?v=1.81.0';
import {buildRaidResult,writeRaidResult,readLaunch,readWeapon} from './raid-result.js?v=1.81.0';
import {tutorialNeeded,completeTutorial} from './tutorial.js?v=1.81.0';
import {routeComplete} from './objectives.js?v=1.81.0';
import {createDash,startDash,stepDash,dashCharge} from './dash.js?v=1.81.0';
import {createBIT,stepBIT} from './bit.js?v=1.81.0';
import {createHealthSegments,renderHealthSegments,displayLevel,renderRoundClock,questChip,roomProgress,bagTiles} from './hud.js?v=1.81.0';
import {pushPickup,liveToasts,TOAST_MS} from './pickup-toast.js?v=1.81.0';
import {isGameKey,isTypingTarget,releaseButtonFocus} from './input.js?v=1.81.0';
import {PALETTE,pickQuality,qualitySettings} from './art.js?v=1.81.0';
import {MATERIALS,goalProgress,applyIntroEncounter,applyFirstPayoff} from './progression-goal.js?v=1.81.0';
import {planLabels,labelOpacity,overHUD,resolveLabels,labelPriority} from './labels.js?v=1.81.0';
import {resultView,renderResult,toggleResultDetails} from './result-screen.js?v=1.81.0';
import {swapItemStatus,suggestSwap} from './swap-guidance.js?v=1.81.0';
const keys=new Set(),sticks=[];let mouseDown=false;

// File integration is paused; no order fetch or result export runs.
/*
const orderResponse=await fetch('./order.json?v=1.81.0');
if(!orderResponse.ok)throw new Error('The raid order could not be loaded.');
const raidOrder=readOrder(await orderResponse.json());
let latestResult=null,resultURL=null;
*/
let resultPending=false;
const TOTAL_NODES=totalNodes();

const $=s=>document.querySelector(s),viewport=$('#viewport');
const playerHealthSegments=createHealthSegments($('#player-health'),100,10);
let tutorialStorage;try{tutorialStorage=sessionStorage;}catch{tutorialStorage=null;}
const earlyStart=document.documentElement.dataset.startRequested==='true';
if(earlyStart)completeTutorial(tutorialStorage);
let tutorialOpen=!earlyStart&&tutorialNeeded(tutorialStorage);
$('#tutorial').hidden=!tutorialOpen;
let gameReady=false,queuedStart=null;
$('#tutorial-start').onclick=()=>{const go=()=>{completeTutorial(tutorialStorage);tutorialOpen=false;$('#tutorial').hidden=true;clearInput();reset(new URLSearchParams(location.search).get('seed'));};if(gameReady)go();else queuedStart=go;};
const stage=$('#game');let viewWidth=stage.clientWidth,viewHeight=stage.clientHeight;
const QUALITY=pickQuality({search:location.search,storage:localStorage,nav:navigator,screen}),QS=qualitySettings(QUALITY);document.documentElement.dataset.quality=QUALITY;
const scene=new THREE.Scene();scene.background=new THREE.Color(PALETTE.bg);scene.fog=new THREE.Fog(PALETTE.fog,34,64);
const renderer=new THREE.WebGLRenderer({antialias:QS.antialias,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,QS.pixelRatio));renderer.shadowMap.enabled=QS.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
$('#game').appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-20,20,6,-6,.1,100);
const target=new THREE.Vector3(),cameraOffset=new THREE.Vector3(17,23,17);
const hemi=new THREE.HemisphereLight('#a9d4e6','#0d1a20',1.7);scene.add(hemi);
const sun=new THREE.DirectionalLight('#dff3ff',2.3);sun.castShadow=QS.shadows;sun.shadow.mapSize.set(QS.shadowMap,QS.shadowMap);
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:50});sun.shadow.normalBias=.045;scene.add(sun,sun.target);
// Area: ?area=town|bunker (remembered in localStorage 'nr_area'); bunker is the default.
const AREA_PARAM=new URLSearchParams(location.search).get('area');
let AREA_SEL=AREA_PARAM||(()=>{try{return localStorage.getItem('nr_area');}catch{return null;}})()||'bunker';
if(AREA_PARAM){try{localStorage.setItem('nr_area',AREA_PARAM);}catch{}}
let TOWN=null,PINE=null;
const DEBUG=new URLSearchParams(location.search).has('debug');
// Seed label is a dev-only overlay: needs ?debug=1&seed-label=1, never plain ?debug=1.
const SEED_LABEL=DEBUG&&new URLSearchParams(location.search).get('seed-label')==='1';
function areaNotice(text,ms=6000){setTimeout(()=>{const n=document.createElement('div');n.className='area-notice';n.setAttribute('role','status');n.textContent=text;document.body.append(n);setTimeout(()=>n.remove(),ms);},0);}
if(AREA_SEL==='town'){try{TOWN=await loadTownAssets(new URL('../assets/env/town/',import.meta.url));
    if(townLoad.failed.length){try{localStorage.setItem('nr_town_load',JSON.stringify({v:'1.81.0',at:Date.now(),...townLoad}));}catch{}if(DEBUG)areaNotice(`Town: stand-ins for ${townLoad.failed.map(f=>f.key).join(', ')} · ${townLoad.failed[0].error}`,12000);}}
  catch(e){console.warn('[town] assets failed, falling back to bunker',e);AREA_SEL='bunker';try{localStorage.setItem('nr_town_load',JSON.stringify({v:'1.81.0',at:Date.now(),fatal:String(e?.message??e),...townLoad}));}catch{}
    areaNotice(DEBUG?`Town failed: ${String(e?.message??e).slice(0,160)}`:'Town failed to load – playing Bunker',DEBUG?15000:6000);}}
let BUNKER=null;
if(AREA_SEL==='bunker'){try{BUNKER=await loadBunkerAssets(new URL('../assets/env/bunker/',import.meta.url));}catch(e){console.warn('[bunker] kit failed, procedural fallback',e);BUNKER=null;}}
if(AREA_SEL==='archipelago'){try{PINE=(await loadKit(new URL('../assets/env/town/',import.meta.url),[{key:'pine_tree',url:'pine_tree.glb?v=1.81.0',dims:[1.4,3,1.4]}],{report:{failed:[],retried:0,ms:0}})).pine_tree;if(PINE?.[0]?.standIn)PINE=null;}catch(e){PINE=null;}}
setArea(AREA_SEL);document.documentElement.dataset.area=AREA_SEL;
if(AREA_SEL==='town'){scene.background.set('#1b3039');scene.fog.color.set('#1b3039');scene.fog.near=36;scene.fog.far=72;
  // Readable late-summer dusk. Lift the sky and fill so the red/yellow houses stay distinct from the bunker palette.
  const lowQ=QUALITY==='low';hemi.color.set('#b9d3df');hemi.groundColor.set('#344236');hemi.intensity=lowQ?1.65:1.35;sun.color.set('#ecd2a6');sun.intensity=lowQ?1.35:1.2;renderer.toneMappingExposure=lowQ?1.35:1.3;}
// Archipelago: cool dusk over open water, longer view distance (more open area)
if(AREA_SEL==='archipelago'){scene.background.set('#0a1c26');scene.fog.color.set('#0a1c26');scene.fog.near=34;scene.fog.far=75;hemi.color.set('#cfe3ef');hemi.groundColor.set('#1d3340');hemi.intensity=QUALITY==='low'?1.4:1.1;sun.color.set('#ffe2c0');sun.intensity=1.2;}

const cube=new THREE.BoxGeometry(1,1,1),materials={};
function box(x,y,z,w,h,d,color,parent){
  const m=new THREE.Mesh(cube,materials[color] ||= new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12}));
  m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
const player=new THREE.Group();scene.add(player);
box(0,.5,0,.62,.7,.62,'#bac4c7',player);box(0,.98,0,.48,.29,.46,'#e0e7e5',player);
box(0,.97,.24,.32,.075,.025,'#2c4a54',player);box(0,.65,.58,.16,.16,.67,'#242d34',player);
box(0,.67,.88,.18,.18,.12,'#75cfcc',player);box(-.23,.14,0,.19,.26,.42,'#27343d',player);box(.23,.14,0,.19,.26,.42,'#27343d',player);
// A faint silhouette remains readable through foreground cover. Geometry and collisions stay unchanged.
const playerOutline=new THREE.Group(),outlineMaterial=new THREE.LineBasicMaterial({color:'#75cfcc',transparent:true,opacity:.7,depthTest:false,depthWrite:false,toneMapped:false});
for(const part of [...player.children])if(part.isMesh){
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(part.geometry),outlineMaterial);
  edge.position.copy(part.position);edge.rotation.copy(part.rotation);edge.scale.copy(part.scale);edge.renderOrder=7;playerOutline.add(edge);
}
player.add(playerOutline);
const visibilityRay=new THREE.Raycaster(),visibilityPoint=new THREE.Vector3();let visibilityCheckAt=0;
playerOutline.visible=false;
const playerRing=new THREE.Mesh(new THREE.RingGeometry(.48,.53,48),new THREE.MeshBasicMaterial({color:'#b4d8d0',transparent:true,opacity:.55,side:THREE.DoubleSide}));
playerRing.rotation.x=-Math.PI/2;scene.add(playerRing);
const bitModel=new THREE.Group();scene.add(bitModel);bitModel.rotation.y=Math.PI/4;
box(0,.7,0,.78,.62,.48,'#0d1a20',bitModel);box(0,.4,0,.42,.12,.32,'#596771',bitModel);
const bitScreen=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#75cfcc'}));bitScreen.scale.set(.62,.44,.02);bitScreen.position.set(0,.72,.25);bitModel.add(bitScreen);
box(-.14,.76,.268,.047,.09,.02,'#0d1a20',bitModel);box(.14,.76,.268,.047,.09,.02,'#0d1a20',bitModel);
const smilePoints=[];for(let i=0;i<=16;i++){const t=i/16;smilePoints.push(new THREE.Vector3(-.14+.28*t,.65-.065*Math.sin(t*Math.PI),.278));}
bitModel.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(smilePoints),new THREE.LineBasicMaterial({color:'#0d1a20'})));
box(0,1.1,0,.035,.18,.035,'#596771',bitModel);box(0,1.2,0,.09,.09,.09,'#75cfcc',bitModel);
const healBeamGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
const healBeam=new THREE.Line(healBeamGeometry,new THREE.LineBasicMaterial({color:'#3FE0D0',transparent:true,opacity:.65,depthTest:false}));healBeam.visible=false;healBeam.frustumCulled=false;healBeam.renderOrder=4;scene.add(healBeam);
const healHalo=new THREE.Mesh(new THREE.RingGeometry(.55,.64,48),new THREE.MeshBasicMaterial({color:'#3FE0D0',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));healHalo.rotation.x=-Math.PI/2;healHalo.visible=false;scene.add(healHalo);
const healCrosses=Array.from({length:6},(_,i)=>{
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:'#3FE0D0',transparent:true,depthTest:false,depthWrite:false});
  for(const [w,h] of [[.25,.055],[.055,.25]]){const m=new THREE.Mesh(cube,material);m.scale.set(w,h,.025);m.renderOrder=6;group.add(m);}
  group.visible=false;scene.add(group);return {group,material,phase:i/6};
});
const coneGeometry=new THREE.BufferGeometry(),coneVertices=new Float32Array(4096*9);
coneGeometry.setAttribute('position',new THREE.BufferAttribute(coneVertices,3));coneGeometry.setDrawRange(0,0);
const aimCone=new THREE.Mesh(coneGeometry,new THREE.MeshBasicMaterial({color:'#75cfcc',transparent:true,opacity:.24,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));aimCone.renderOrder=3;aimCone.frustumCulled=false;aimCone.visible=false;scene.add(aimCone);
const rangeRing=new THREE.Mesh(new THREE.RingGeometry(RULES.weapon.range-.04,RULES.weapon.range,96),new THREE.MeshBasicMaterial({color:'#75cfcc',transparent:true,opacity:.35,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
rangeRing.renderOrder=2;rangeRing.rotation.x=-Math.PI/2;rangeRing.visible=false;scene.add(rangeRing);
const lockMarker=new THREE.Mesh(new THREE.RingGeometry(.64,.73,32),new THREE.MeshBasicMaterial({color:'#3FE0D0',transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));lockMarker.rotation.x=-Math.PI/2;lockMarker.renderOrder=4;lockMarker.visible=false;scene.add(lockMarker);
const bulletGeometry=new THREE.BoxGeometry(RULES.weapon.shotRadius*2,.12,.38),bulletMaterial=new THREE.MeshBasicMaterial({color:'#75cfcc'});
const bullets=[],movement={x:0,y:0},shooting={x:0,y:0};
const enemyBulletMaterial=new THREE.MeshBasicMaterial({color:'#E4705F'}),enemyMeshes=new Map();
const launch=readLaunch(location.search);
let hazardLabels=[];
let round,world,combat,weapon,position,solids=[],playerSolids=[],aim={x:0,z:-1},elapsed=0,resetCount=0,hitUntil=0;
let dash=createDash(),walkDirection={x:0,z:-1};
let bit,bitLabel;
function requestDash(){
  if(!round||round.over||resultPending||tutorialOpen||!$('#inventory').hidden)return;
  let sx=movement.x+Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  let sy=movement.y+Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  const direction=Math.hypot(sx,sy)>.12?screenToWorld(sx,sy):walkDirection;
  if(startDash(dash,direction,Date.now(),round.stats.dashCooldownMs))round.telemetry.dashes++;
}
$('#dash').addEventListener('pointerdown',e=>{e.preventDefault();requestDash();});
$('#dash').addEventListener('click',e=>{if(e.detail===0)requestDash();});

// Independent pointer capture lets both thumbs work at the same time.
function setupStick(selector,value,onShot){
  const el=$(selector),thumb=el.querySelector('.thumb'),state={pointer:null,gesture:null};sticks.push({el,state,value,thumb});
  function update(e){
    const r=el.getBoundingClientRect(),limit=r.width*.32;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
    const length=Math.hypot(x,y);if(length>limit){x*=limit/length;y*=limit/length;}
    value.x=x/limit;value.y=y/limit;thumb.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;
    if(onShot&&state.gesture){dragAim(state.gesture,e.clientX,e.clientY);el.classList.toggle('aiming',!!state.gesture.direction);}
  }
  el.addEventListener('pointerdown',e=>{if(state.pointer!==null || round?.over || tutorialOpen || !$('#inventory').hidden)return;e.preventDefault();state.pointer=e.pointerId;state.gesture=onShot?beginAim(e.clientX,e.clientY):null;el.setPointerCapture(e.pointerId);el.classList.add('active');if(!onShot)update(e);});
  el.addEventListener('pointermove',e=>{if(e.pointerId===state.pointer){e.preventDefault();update(e);}});
  function release(e){if(e.pointerId===state.pointer){if(onShot&&state.gesture){const direction=releaseAim(state.gesture,e.type!=='pointerup');if(direction){aim=screenToWorld(direction.x,direction.y);onShot();}}state.pointer=null;state.gesture=null;value.x=value.y=0;thumb.style.transform='translate(-50%,-50%)';el.classList.remove('active','aiming');}}
  el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
}
setupStick('#move-stick',movement);setupStick('#aim-stick',shooting,fire);
// ---- Toolkit (nodspel/tools.js): round button above DASH. Tap = auto-throw at the nearest enemy in range (else forward);
// hold + drag = arc preview with landing ring, release throws; cancel = pointercancel. Desktop: E. Cyan = system, coral = danger.
const toolBtn=$('#tool-btn'),TOOL_CORAL='#E4705F',TOOL_CYAN='#3FE0D0',toolDrag={pointer:null,x:0,y:0,active:false,dir:null,dist:0};
const toolColor=kind=>kind==='grenade'?TOOL_CORAL:TOOL_CYAN;
const toolRingGeometry=new THREE.RingGeometry(.94,1,64),toolFxPool=[];let toolFxUsed=0;
const toolArcPoints=Array.from({length:25},()=>new THREE.Vector3());
const toolArc=new THREE.Line(new THREE.BufferGeometry().setFromPoints(toolArcPoints),new THREE.LineBasicMaterial({color:TOOL_CYAN,transparent:true,opacity:.85,depthTest:false}));toolArc.renderOrder=4;toolArc.frustumCulled=false;toolArc.visible=false;scene.add(toolArc);
function toolFxRing(x,z,radius,color,opacity){
  let m=toolFxPool[toolFxUsed];
  if(!m){m=new THREE.Mesh(toolRingGeometry,new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));m.rotation.x=-Math.PI/2;m.renderOrder=4;scene.add(m);toolFxPool.push(m);}
  toolFxUsed++;m.visible=true;m.position.set(x,.07,z);m.scale.setScalar(Math.max(.01,radius));m.material.color.set(color);m.material.opacity=opacity;
}
function clearToolFx(){for(const m of toolFxPool)m.visible=false;toolArc.visible=false;}
function toolBlocked(){return !round||round.over||resultPending||tutorialOpen||!$('#inventory').hidden||!canUseTool(round);}
// One-time explanations (persisted): shown through the shared notice, never as a popup.
const FIRST_HINT_KEY='nodspel.firstHints.v1';
function firstHint(id,text){let seen=[];try{seen=JSON.parse(localStorage.getItem(FIRST_HINT_KEY)||'[]');}catch{}if(seen.includes(id))return;try{localStorage.setItem(FIRST_HINT_KEY,JSON.stringify([...seen,id]));}catch{}notice(text,6000);}
function throwToolAt(point){const t=round.tool;if(throwTool(round,position,point,Date.now(),playerSolids)){renderToolHUD();if(t&&t.kind==='decoy')firstHint('decoy',`Decoy: enemies near it walk to the beacon and stop shooting for ${Math.round(toolDef(t.id).lureMs/1000)} s. Slip past or flank them.`);}}
function toolTap(){
  if(toolBlocked())return;
  throwToolAt(autoThrowPoint(round,position,mouseKnown?aim:walkDirection,playerSolids));
}
function toolDragPoint(){return {x:position.x+toolDrag.dir.x*toolDrag.dist,z:position.z+toolDrag.dir.z*toolDrag.dist};}
function cancelToolDrag(){if(toolDrag.pointer!==null&&toolBtn.hasPointerCapture?.(toolDrag.pointer))toolBtn.releasePointerCapture(toolDrag.pointer);toolDrag.pointer=null;toolDrag.active=false;toolBtn.classList.remove('dragging');}
toolBtn.addEventListener('pointerdown',e=>{if(toolBlocked()||toolDrag.pointer!==null)return;e.preventDefault();Object.assign(toolDrag,{pointer:e.pointerId,x:e.clientX,y:e.clientY,active:false,dir:null,dist:0});(()=>{try{toolBtn.setPointerCapture(e.pointerId)}catch{}})();});
toolBtn.addEventListener('pointermove',e=>{
  if(e.pointerId!==toolDrag.pointer)return;e.preventDefault();
  const dx=e.clientX-toolDrag.x,dy=e.clientY-toolDrag.y,length=Math.hypot(dx,dy);
  if(length<RULES.aimControls.deadZonePx)return;
  const d=screenToWorld(dx/length,dy/length);
  toolDrag.active=true;toolDrag.dir=d;toolDrag.dist=Math.max(1,Math.min(1,length/RULES.tools.dragPx)*RULES.tools.throwRange);toolBtn.classList.add('dragging');
});
function releaseTool(e){
  if(e.pointerId!==toolDrag.pointer)return;
  const drag=toolDrag.active&&e.type==='pointerup',tap=!toolDrag.active&&e.type==='pointerup';
  const point=drag?toolDragPoint():null;cancelToolDrag();
  if(point&&!toolBlocked())throwToolAt(point);else if(tap)toolTap();
}
toolBtn.addEventListener('pointerup',releaseTool);toolBtn.addEventListener('pointercancel',releaseTool);
toolBtn.addEventListener('click',e=>{if(e.detail===0)toolTap();});
function renderToolHUD(){
  const t=round.tool;toolBtn.hidden=!t;if(!t)return;
  const key=`${t.kind}|${t.charges}`;
  if(toolBtn.dataset.key!==key){
    toolBtn.dataset.key=key;toolBtn.dataset.kind=t.kind;
    const count=document.createElement('b'),hint=document.createElement('small');count.textContent=t.charges;hint.textContent='E';
    toolBtn.replaceChildren(svgIcon(`tool-${t.kind}`),count,hint);
  }
  toolBtn.disabled=toolBlocked();
  toolBtn.setAttribute('aria-label',`${toolDef(t.id).label} (E) · ${t.charges} left`);
}
// Decoy beacon: a small cyan pillar with a blinking cap, so the thrown decoy reads as an object in the world.
const beaconPool=[];let beaconUsed=0;
function placeDecoyBeacon(d,clock){let b=beaconPool[beaconUsed];
  if(!b){b=new THREE.Group();const m=new THREE.MeshBasicMaterial({color:TOOL_CYAN,toneMapped:false});const post=new THREE.Mesh(new THREE.BoxGeometry(.16,1.3,.16),m);post.position.y=.65;const cap=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.3),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}));cap.position.y=1.36;b.add(post,cap);b.userData.cap=cap;scene.add(b);beaconPool.push(b);}
  beaconUsed++;b.visible=true;b.position.set(d.x,0,d.z);b.userData.cap.visible=Math.floor(clock/250)%2===0;}
function renderToolFx(clock){
  toolFxUsed=0;beaconUsed=0;
  const fx=round.toolFx;
  if(fx&&!round.over){
    for(const g of fx.fuses){const p=Math.min(1,(clock-g.at)/(g.detonateAt-g.at));toolFxRing(g.x,g.z,g.radius,TOOL_CORAL,.3+.2*Math.sin(clock/60));toolFxRing(g.x,g.z,g.radius*p,TOOL_CORAL,.7);}
    for(const d of fx.decoys){const k=((clock%900)/900);toolFxRing(d.x,d.z,d.radius,TOOL_CYAN,.18);toolFxRing(d.x,d.z,.5+.15*Math.sin(clock/120),TOOL_CYAN,.9);toolFxRing(d.x,d.z,.4+d.radius*k,TOOL_CYAN,.7*(1-k));placeDecoyBeacon(d,clock);}
    for(const p of fx.pulses){const k=Math.min(1,(clock-p.at)/(p.until-p.at));toolFxRing(p.x,p.z,p.radius*(.3+.7*k),toolColor(p.kind),.8*(1-k));}
  }
  for(let i=toolFxUsed;i<toolFxPool.length;i++)toolFxPool[i].visible=false;
  for(let i=beaconUsed;i<beaconPool.length;i++)beaconPool[i].visible=false;
  // drag preview: arc from the thrower to the landing ring
  const pv=toolDrag.active&&!toolBlocked()?previewThrow(round,position,toolDragPoint(),playerSolids):null;
  toolArc.visible=!!pv;
  if(pv){
    const color=toolColor(pv.kind),pos=toolArc.geometry.attributes.position;
    for(let i=0;i<toolArcPoints.length;i++){const t=i/(toolArcPoints.length-1);pos.setXYZ(i,position.x+(pv.x-position.x)*t,.5+Math.sin(t*Math.PI)*1.6,position.z+(pv.z-position.z)*t);}
    pos.needsUpdate=true;toolArc.material.color.set(color);
    toolFxRing(pv.x,pv.z,pv.radius,color,.9);
  }
}
const raycaster=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.65),intersection=new THREE.Vector3(),mouse=new THREE.Vector2();
mouseDown=false;let mouseKnown=false;
function updateMouse(e){const r=stage.getBoundingClientRect();mouse.set((e.clientX-r.left)/viewWidth*2-1,1-(e.clientY-r.top)/viewHeight*2);mouseKnown=true;}
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')updateMouse(e);});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){updateMouse(e);mouseDown=true;renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener('pointerup',e=>{if(mouseDown&&e.pointerType==='mouse'){updateMouse(e);updateMouseAim();fire();}mouseDown=false;});renderer.domElement.addEventListener('pointercancel',()=>{mouseDown=false;});
window.addEventListener('keydown',e=>{if(isTypingTarget(e.target))return;if(isGameKey(e.code)&&e.target?.closest?.('button')&&!e.target.closest('#inventory,#round-over,#tutorial'))e.preventDefault();if(tutorialOpen||!$('#inventory').hidden)return;if(e.code==='KeyQ'&&!e.repeat){e.preventDefault();useKit();}if(e.code==='KeyE'&&!e.repeat){e.preventDefault();toolTap();}if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();if(!e.repeat)requestDash();}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}},{capture:true});
window.addEventListener('keyup',e=>{if(isGameKey(e.code)&&keys.has(e.code))e.preventDefault();if(e.code==='Space'&&keys.has('Space'))fire();keys.delete(e.code);},{capture:true});
document.addEventListener('click',e=>releaseButtonFocus(e,document),{capture:false});
function clearInput(){keys.clear();mouseDown=false;for(const {el,state,value,thumb} of sticks){if(state.pointer!==null&&el.hasPointerCapture(state.pointer))el.releasePointerCapture(state.pointer);state.pointer=null;state.gesture=null;value.x=value.y=0;thumb.style.transform='translate(-50%,-50%)';el.classList.remove('active','aiming');}}
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();if(round&&!tutorialOpen){tickRound(round,Date.now());if(round.over)finishRound();}});

function clearBullets(){for(const b of bullets)scene.remove(b.mesh);bullets.length=0;if(weapon)weapon.projectiles.length=0;for(const m of enemyMeshes.values())scene.remove(m);enemyMeshes.clear();}
let labels=[],routeLabels=[],encounterLabels=[];
const enemyName=e=>(e.type==='generator'?RULES.encounters.names.generator:!e.introGuard&&RULES.encounters.names[e.encounter])||(!e.type||e.type==='grunt'?'ENEMY':e.type.toUpperCase());
// Encounter state (guard / turret / patrol): the label says what is about to happen, in the same words as the hint.
const encounterState=e=>{const t=Date.now();
  if(e.alertAt!=null)return '! SPOTTED';
  if(e.encounter==='guard'||e.encounter==='turret')return e.attackPhase==='warning'?'AIMING · MOVE':e.attackPhase==='burst'?'FIRING · KEEP MOVING':e.attackPhase==='recovery'?'RECOVERING · GO':(e.blockedAt!=null&&t-e.blockedAt<700?'SHIELD BLOCKED':null);
  return null;};
const enemyStateText=e=>Date.now()<(e.stunnedUntil??0)?`STUNNED · ${e.health}`:e.lureTarget&&Date.now()<(e.lureUntil??0)?`DISTRACTED · ${e.health}`:!e.introGuard&&encounterState(e)?`${enemyName(e)} · ${encounterState(e)} · ${e.health}`:`${e.introGuard?(e.windupAt!=null?'CHARGING · HIT TRIGGERS BURST':e.attackPhase==='burst'?'BURST · MOVE':e.attackPhase==='recovery'?'RECOVERING · MOVE / FIRE':'CACHE GUARD'):enemyName(e)} · ${e.health}`;
function makeLabel(text,point,kind,range=null,short=''){
  const el=document.createElement('div');el.className=`node-label ${kind}`;
  const marker=document.createElement('span');marker.className='node-marker';el.append(marker);
  const caption=document.createElement('span');caption.className='full-text';caption.textContent=text;el.append(caption);
  const shortEl=document.createElement('span');shortEl.className='short-text';shortEl.textContent=short;el.append(shortEl);
  if(range==='loot'){const useEl=document.createElement('span');useEl.className='use-text';el.append(useEl);el._useEl=useEl;}
  $('#world-labels').append(el);
  const label={el,caption,shortEl,point,range,id:labels.length};labels.push(label);return label;
}
function setCollisions(){
  solids=[...round.level.walls,...round.level.boxes,...houseSolids(round.level),...doorSolids(round.level)];
  if(!exitIsOpen(round))solids.push({x:round.level.exit.x,z:round.level.exit.z,w:2,d:.22});
  playerSolids=[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
}
// A node with a live generator cannot be charged: the label says what breaks the shield.
const nodeCaption=(node,clock)=>node.active?'ACTIVE':node.shielded?(clock<(node.shieldDownUntil??0)?'SHIELD DOWN · STAND CLOSE':node.generatorId?'SHIELDED · BREAK THE GENERATOR':'SHIELDED · STAND CLOSE'):'STAND CLOSE';
// medkit button sits right of the bag panel, top-aligned: the panel grows with the NEED list, and below it the move stick needs the room
function placeKitButton(){const bp=$('.bag-panel'),k=$('#use-kit');if(bp&&k&&bp.offsetHeight){const r=bp.getBoundingClientRect(),v=(k.offsetParent||document.body).getBoundingClientRect();k.style.top=`${Math.round(r.top-v.top)}px`;k.style.left=`${Math.round(r.right-v.left+8)}px`;}}
function renderQuestChip(){
  const el=$('#quest-chip'),c=questChip(launch.quest,round);if(!el)return;
  el.hidden=!c;if(!c)return;
  const key=`${c.item||c.type}:${c.prog}/${c.n}`;if(el.dataset.key===key)return;el.dataset.key=key;
  setIconText(el,c.item?MATERIALS[c.item]?.icon??'pickup':c.type==='kill'?'skull':'route',`${c.prog}/${c.n}`);el.classList.toggle('done',c.done);
}
// Top-right room box: three level pips + the gate-control count as an icon tile. The seed only shows with ?debug.
function renderRoomBox(level){
  const p=roomProgress(level),box=$('#level-corner'),pips=$('#room-pips'),obj=$('#room-obj');if(!box||!pips||!obj)return;
  pips.replaceChildren(...p.pips.map(c=>{const i=document.createElement('i');i.className=c;return i;}));
  const key=`${p.lit}/${p.total}`;if(obj.dataset.key!==key){obj.dataset.key=key;setIconText(obj,'gate-node',p.text);}
  obj.classList.toggle('done',p.done);box.setAttribute('aria-label',p.label);box.title=p.label;
}
// Pickup toasts: icon + name in rarity colour under the bag panel; stack of at most 3, each fades after TOAST_MS.
let pickupToasts=[];
function placePickupToasts(){const bp=$('.bag-panel'),c=$('#pickup-toasts');if(bp&&c&&bp.offsetHeight){c.style.top=`${bp.offsetTop+bp.offsetHeight+6}px`;c.style.left=`${bp.offsetLeft}px`;}}
function renderPickupToasts(){
  let c=$('#pickup-toasts');if(!c){c=document.createElement('div');c.id='pickup-toasts';c.setAttribute('role','status');c.setAttribute('aria-live','polite');viewport.append(c);}
  const now=Date.now();pickupToasts=liveToasts(pickupToasts,now);
  const keep=new Set(pickupToasts.map(t=>String(t.id)));
  for(const el of [...c.children])if(!keep.has(el.dataset.id))el.remove();
  for(const t of pickupToasts){
    let el=c.querySelector(`[data-id="${t.id}"]`);
    if(!el){el=document.createElement('div');el.className='pickup-toast';el.dataset.id=t.id;el.dataset.item=t.item;el.style.setProperty('--rc',RARITY_COLORS[rarityOf(t.item)]);el.append(svgIcon(MATERIALS[t.item]?.icon??'pickup'),document.createElement('span'));c.append(el);}
    else{el.style.animation='none';void el.offsetWidth;el.style.animation='';}
    el.lastChild.textContent=`${ITEM_NAMES[t.item]??t.item}${t.n>1?` x${t.n}`:''}`;
  }
  placePickupToasts();
  clearTimeout(renderPickupToasts.timer);renderPickupToasts.timer=setTimeout(()=>{if(pickupToasts.some(t=>Date.now()-t.at>=TOAST_MS)||c.children.length)renderPickupToasts();},TOAST_MS+40);
}
function pickupToast(item){pickupToasts=pushPickup(pickupToasts,item,Date.now());renderPickupToasts();}
function updateHUD(){
  placeKitButton();placePickupToasts();renderQuestChip();
  renderGoalTracker();
  renderBagContents($('#bag-items'),round.bag);
  {const n=bagItems(round.bag).length,cap=bagCapacityOf(round),full=n>=cap;$('#bag-count').textContent=`${n}/${cap}`;$('#open-bag').classList.toggle('full',full);$('#open-bag').setAttribute('aria-label',`Open bag, ${n} of ${cap}, at risk until extract${round.levelsCleared?', carried':''}`);}
  renderInventory();
  const level=displayLevel(round,resultPending||round.reason==='extract'),lit=level.nodes.filter(n=>n.active).length,open=!round.over&&level.nodes.every(n=>n.active);
  $('#health-value').textContent=round.health;{const s=$('#shield-hud');if(s){s.hidden=!(round.maxShield>0);$('#shield-value').textContent=round.shield;s.classList.toggle('broken',round.shield<=0);}}$('.health').classList.toggle('urgent',round.health<=25);
  renderRoomBox(level);
  for(const v of world.nodes){v.label.el.classList.toggle('done',v.node.active);v.label.caption.textContent=nodeCaption(v.node,Date.now());}
  world.exitLabel.el.classList.toggle('done',open);world.exitLabel.caption.textContent=round.cleared?'ALL LEVELS CLEARED':open?(level.number===3?'EXTRACT · WALK IN':'EXIT · OPEN'):'EXIT · LOCKED';
  if(open&&level.number===3&&!level.extractToastShown){level.extractToastShown=true;showExtractToast();}
  world.setExit(open);if(!resultPending)setCollisions();
}
// Bag and NEED rows are icon tiles: item icon + count (bag) or have/need (goal). Names live in the tile title.
function itemTile(id,text,cls=''){const t=document.createElement('span');t.className=`item-tile ${cls}`.trim();t.title=ITEM_NAMES[id]??MATERIALS[id]?.name??id;t.dataset.item=id;
  const r=rarityOf(id);t.style.setProperty('--rc',RARITY_COLORS[r]);t.append(svgIcon(MATERIALS[id]?.icon??'pickup'));const b=document.createElement('b');b.textContent=text;t.append(b);return t;}
function renderBagContents(el,bag){
  const tiles=bagTiles(bag),key=JSON.stringify(tiles);if(el.dataset.tiles===key)return;el.dataset.tiles=key;
  el.replaceChildren();
  if(!tiles.length)return;
  for(const {id,n} of tiles)el.append(itemTile(id,n>1?`${n}`:'',n>1?'counted':''));
}
function renderGoalTracker(){
  if(!launch.goal)return;
  // v1.59: lives inside the bag panel (it used to cover the bag panel and its Open bag button).
  let el=$('#raid-goal');if(!el){el=document.createElement('div');el.id='raid-goal';el.setAttribute('aria-label','Upgrade materials');($('.bag-panel')??viewport).append(el);}
  const extracted=round.over&&['extract','complete'].includes(round.reason);
  const p=goalProgress(launch.goal,extracted?round.extracted:round.bag),key=JSON.stringify([p,round.over,extracted]);
  if(el.dataset.state===key)return;el.dataset.state=key;el.replaceChildren();refreshNeededLabels();
  const title=document.createElement('b');title.textContent=`NEED · ${launch.goal.name} L${launch.goal.level}`;el.append(title);
  
  const row=document.createElement('div');row.className='need-tiles';
  for(const part of p.parts){const line=itemTile(part.id,`${Math.min(part.need,part.secured+part.carried)}/${part.need}`,part.remaining===0?'done':'');line.title=`${part.name}: home ${part.secured} + ${extracted?'secured':'bag'} ${part.carried}`;row.append(line);}
  el.append(row);
  const state=document.createElement('small');state.textContent=round.over?(extracted?(p.enoughCarried?'SECURED · ACTIVATE IN BASE':'Secured · keep collecting next raid'):'BAG LOST · HOME SUPPLIES KEPT'):p.secured?'Already secured at home':p.enoughCarried?'ENOUGH CARRIED · EXTRACT TO SECURE':'Collect supplies · bag is at risk';if(round.over||p.enoughCarried||p.secured)el.append(state);el.classList.toggle('enough',p.enoughCarried);
  placeKitButton();
  if(round.lastPickup&&Date.now()-round.lastPickup.at<3000){
    const part=p.parts.find(p=>p.id===round.lastPickup.item);if(part){let toast=$('#goal-pickup');if(!toast){toast=document.createElement('div');toast.id='goal-pickup';toast.setAttribute('role','status');viewport.append(toast);}setIconText(toast,part.icon,`${part.name} ${Math.min(part.need,part.secured+part.carried)}/${part.need}${p.enoughCarried?' · enough carried — extract':` · for ${launch.goal.name}`}`);toast.hidden=false;clearTimeout(toast.hideTimer);toast.hideTimer=setTimeout(()=>toast.hidden=true,2200);}
  }
}
// v1.59: loot the tracked upgrade still needs is marked on its label (owner: show what you actually need in raid).
function neededItem(item){if(!launch.goal||!round)return false;const p=goalProgress(launch.goal,round.bag);return p.parts.some(part=>part.remaining>0&&(part.id===item||(part.kind==='currency'&&globalThis.DATA.items.find(i=>i.id===item)?.grantsCurrency?.[part.id])));}
function refreshNeededLabels(){for(const v of world?.lootBoxes??[])if(v.label&&v.loot.revealed&&!v.loot.collected)setLootText(v);}
const lootIcon=item=>MATERIALS[item]?.icon??(item==='keycard'?'unlock':'pickup');
function labelLoot(v){v.label=makeLabel('?',new THREE.Vector3(v.loot.x,.7,v.loot.z),`${v.loot.marked?'loot-label marked-loot':'loot-label'}${v.loot.item==='keycard'?' keycard-loot':''}`,'loot','?');setLootText(v);}
function setLootText(v){const l=v.label,r=rarityOf(v.loot.item);l.el.dataset.rarity=v.loot.revealed?r:'unknown';
  if(l.el._useEl){const info=v.loot.revealed?globalThis.DATA?.itemInfo?.(v.loot.item):null;l.el._useEl.textContent=info?.line??'';l.size=null;}
  if(!v.loot.revealed){l.caption.textContent='SUPPLY CACHE · APPROACH TO IDENTIFY';l.shortEl.textContent='SUPPLY CACHE';return;}
  const n=ITEM_NAMES[v.loot.item]??(v.loot.item==='keycard'?'Keycard':'Ammo'),a=lootAction(round,v.loot.item),need=neededItem(v.loot.item);l.el.classList.toggle('needed-loot',need);setIconText(l.caption,lootIcon(v.loot.item),`${need?'NEEDED · ':''}${n} · ${a.text}${v.loot.optional?' · OPTIONAL':''}`);setIconText(l.shortEl,lootIcon(v.loot.item),`${need?'NEEDED · ':''}${n}`);l.el.classList.toggle('slot-full',a.full);if(v.loot.source)l.el.title=v.loot.source;}
// kit count changed: refresh health kit labels (COLLECT / SLOT FULL)
function refreshKitLabels(){for(const v of world?.lootBoxes??[])if(v.label&&v.loot.item==='medkit'&&!v.loot.collected)setLootText(v);}
function renderInventory(){
  const items=bagItems(round.bag),list=$('#inventory-slots');list.replaceChildren();
  $('#inventory-count').textContent=`${items.length} / ${bagCapacityOf(round)} slots`;
  for(let i=0;i<bagCapacityOf(round);i++){
    const row=document.createElement('div'),name=document.createElement('span'),item=items[i];row.className='inventory-slot';setIconText(name,item?MATERIALS[item]?.icon??'pickup':'',`${i+1} · ${item?ITEM_NAMES[item]:'Empty'}`);row.append(name);
    if(item){const rr=rarityOf(item);row.dataset.rarity=rr;row.style.setProperty('--rc',RARITY_COLORS[rr]);
      if(item==='medkit'){const use=document.createElement('button');use.textContent=`Use +${RULES.rewards.medkitHealth} HP`;use.disabled=round.health>=100;use.onclick=()=>{useHealthKit(round,Date.now());updateHUD();};row.append(use);}
      const drop=document.createElement('button');drop.textContent='Drop';drop.onclick=()=>{const box=dropItem(round,item,position,Date.now());if(box){box.revealed=true;labelLoot(world.addLoot(box));};updateHUD();};row.append(drop);
    }
    list.append(row);
  }
}
$('#use-kit').onclick=()=>useKit();
$('#open-bag').onclick=()=>{if(round.over||resultPending)return;if(round.bagFull&&nearBlocked()){showSwap();return;}clearInput();renderInventory();$('#inventory').hidden=false;};
$('#close-bag').onclick=()=>{$('#inventory').hidden=true;clearInput();};
// shared popup: tap on the backdrop closes the bag too
$('#inventory').addEventListener('click',e=>{if(e.target===$('#inventory'))$('#close-bag').onclick();});
function renderEnemyFeedback(clock){
  for(const v of world.enemies){
    const alive=v.enemy.health>0&&v.enemy.active!==false;
    v.group.visible=alive;v.group.position.set(v.enemy.x,0,v.enemy.z);v.group.rotation.y=v.enemy.facing??Math.atan2(position.x-v.enemy.x,position.z-v.enemy.z);
    if(v.beam)v.beam.visible=alive&&v.enemy.health>0&&!!round.level.nodes.find(n=>n.id===v.enemy.node)?.shielded&&clock>=(round.level.nodes.find(n=>n.id===v.enemy.node)?.shieldDownUntil??0);
    if(v.shield)v.shield.visible=alive&&!v.enemy.introGuard;
    // distracted by a decoy: the visor turns cyan (system colour of the decoy) so the state reads without the label
    if(v.eye){const lured=!!v.enemy.lureTarget&&Date.now()<(v.enemy.lureUntil??0);v.eye.material.color.set(lured?TOOL_CYAN:'#E4705F');}
    // blocked shot: the plate flashes bright (spark) for a moment; first block explains the counter once
    if(v.shield){const ba=clock-(v.enemy.blockedAt??-Infinity);v.shield.material.opacity=ba<220?.95:.5;if(ba<220)firstHint('shield','Front shield blocks shots from the front. Flank to the side or back.');}
    if(v.cone){const e=v.enemy,s=e.sight||RULES.encounters.patrol.coneRange;v.cone.visible=alive&&!e.aggro;v.cone.scale.set(s,1,s);v.coneFill.material.opacity=e.alertAt!=null?.5:.2;}
    v.label.point.set(v.enemy.x,1.7,v.enemy.z);const winding=alive&&(v.enemy.windupAt!=null||v.enemy.alertAt!=null);v.label.el.classList.toggle('winding',winding);v.label.caption.textContent=enemyStateText(v.enemy);v.label.defeated=!alive;v.label.el.hidden=!alive;
    if(v.enemy.introGuard||v.enemy.encounter==='guard'||v.enemy.encounter==='turret'){
      if(!v.intent){v.intent=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#E4705F',transparent:true,opacity:.85}));v.intent.renderOrder=4;v.intent.frustumCulled=false;v.group.add(v.intent);}
      const t=v.enemy.attackTarget;v.intent.visible=alive&&!!t&&['warning','burst'].includes(v.enemy.attackPhase);
      if(t){const end=aimEndpoint(v.enemy,{x:t.x-v.enemy.x,z:t.z-v.enemy.z},RULES.combat.range,solids);const pos=v.intent.geometry.attributes.position;pos.setXYZ(0,0,.12,0);pos.setXYZ(1,end.x-v.enemy.x,.12,end.z-v.enemy.z);pos.needsUpdate=true;v.intent.rotation.y=-v.group.rotation.y;}
    }
    v.healthBar.setAttribute('aria-valuenow',v.enemy.health);renderHealthSegments(v.healthSegments,v.enemy.health,v.maxHealth);
    const age=clock-(v.enemy.lastHitAt??-Infinity);v.flash.defeated=age>=RULES.feedback.hitFlashMs||v.enemy.active===false;
    v.flash.point.set(v.enemy.x,.65,v.enemy.z);v.flash.el.style.opacity=`${Math.max(0,1-age/RULES.feedback.hitFlashMs)}`;
    v.flash.el.classList.toggle('flashing',!v.flash.defeated);
    // a shot stopped by the guard's front shield reads BLOCKED instead of a damage number
    const blocked=(v.enemy.blockedAt??-Infinity)>(v.enemy.lastHitAt??-Infinity),dage=blocked?clock-v.enemy.blockedAt:age;
    v.damage.defeated=dage>=RULES.feedback.damageNumberMs||v.enemy.active===false;
    v.damage.caption.textContent=blocked?'BLOCKED':`−${v.enemy.lastDamage??0}`;
    v.damage.point.set(v.enemy.x,1+Math.min(1,dage/RULES.feedback.damageNumberMs)*.7,v.enemy.z);
    v.damage.el.style.opacity=`${Math.max(0,1-dage/RULES.feedback.damageNumberMs)}`;
  }
}
// Encounter labels: the locked door says what it needs; the spawn point warns ("!") for 1 s before the swarm bursts out.
function renderEncounterLabels(clock){
  for(const e of encounterLabels){const l=e.label;
    if(e.door){const d=e.door,icon=d.locked?'lock':'unlock';
      setIconText(l.caption,icon,!d.locked?'DOOR · OPEN':round.keys?.includes(d.key)?'LOCKED · WALK UP TO USE THE KEYCARD':'LOCKED · KEYCARD NEEDED');
      setIconText(l.shortEl,icon,d.locked?'DOOR':'');l.el.classList.toggle('done',!d.locked);l.defeated=!d.locked&&!!d.openedAt&&clock-d.openedAt>2500;}
    else{const warn=e.sp.state==='warning';
      setIconText(l.caption,warn?'warning':'threat',warn?'! SWARM INCOMING':'SPAWN POINT');setIconText(l.shortEl,'threat','');
      l.el.classList.toggle('winding',warn);l.defeated=e.sp.state==='spawned';}
  }
}
// ---- Encounter hints: one short notice per encounter type, ever (remembered in localStorage) ----
const ENC_HINT_KEY='nodspel.encounter-hints.v1';let seenHints=null,noticeUntil=0;
function loadSeenHints(){if(seenHints)return seenHints;seenHints={};try{Object.assign(seenHints,JSON.parse(localStorage.getItem(ENC_HINT_KEY)||'{}'));}catch{}return seenHints;}
function markHintSeen(type){const s=loadSeenHints();s[type]=1;try{localStorage.setItem(ENC_HINT_KEY,JSON.stringify(s));}catch{}}
function notice(text,ms=4200){let el=$('#encounter-hint');if(!el){el=document.createElement('div');el.id='encounter-hint';el.className='encounter-hint';el.setAttribute('role','status');$('#viewport').append(el);}
  // restart the fade (the element is reused; a finished `forwards` animation would leave it invisible)
  el.textContent=text;el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';el.style.animationDuration=`${ms}ms`;noticeUntil=Date.now()+ms;clearTimeout(notice.t);notice.t=setTimeout(()=>{el.hidden=true;},ms);}
function checkEncounterHints(clock){
  if(clock<noticeUntil)return;const seen=loadSeenHints();
  for(const enc of encountersOf(round.level)){
    if(seen[enc.type]||Math.hypot(position.x-enc.x,position.z-enc.z)>RULES.encounters.hintRange)continue;
    markHintSeen(enc.type);notice(hintFor(enc.type));return;}
}
let houseLabels=[];
const CONTAINER_NAMES={wardrobe:'WARDROBE',loot_crate:'CRATE',medicine_cabinet:'MEDICINE'};
function renderHouseLabels(){for(const {ref,door,label} of houseLabels){const p=ref.progress??0,done=door?ref.open:ref.searched,busy=!done&&p>0;
  const text=door?(done?'DOOR · OPEN':busy?'OPENING…':'DOOR · STAND CLOSE'):(done?`${CONTAINER_NAMES[ref.kind]} · SEARCHED`:busy?`SEARCHING ${Math.round(p*100)}%`:`SEARCH ${CONTAINER_NAMES[ref.kind]} · STAND CLOSE`);
  if(label.caption.textContent!==text)label.caption.textContent=text;if(!door&&done)setIconText(label.shortEl,'check','');else setIconText(label.shortEl,'',door?(done?'':'DOOR'):'SEARCH');
  label.el.classList.toggle('done',done);label.el.classList.toggle('charging',busy);label.el.dataset.state=done?'done':busy?'busy':'idle';
  label.meter.hidden=!busy;label.meter.setAttribute('aria-valuenow',Math.round(p*100));label.fill.style.width=`${p*100}%`;label.defeated=door&&done&&ref.openedAt&&Date.now()-ref.openedAt>1500;}}
function showExtractToast(){const t=document.createElement('div');t.id='extract-toast';t.className='area-notice';t.setAttribute('role','status');t.textContent='EXTRACT OPEN · keep looting (bag at risk, timer running) · walk into the exit to extract';document.body.append(t);setTimeout(()=>t.remove(),6000);}
function loadLevel(){try{loadLevelInner();}catch(e){onFatal(e);}}
function loadLevelInner(){
  hideSwap();
  world?.dispose();clearBullets();clearInput();mouseKnown=false;weapon.scavenging=null;
  position={...round.level.start};aim={x:0,z:-1};target.set(position.x,0,position.z-1);
  player.position.set(position.x,0,position.z);
  world=buildWorld(round.level,scene,{quality:QUALITY,town:TOWN,pine:PINE,bunker:AREA_SEL==='bunker'?BUNKER:null});$('#world-labels').replaceChildren();labels=[];routeLabels=[];encounterLabels=[];
  dash.remaining=0;
  const spawn=moveWithActors(position,{x:1.13,z:1.13},[],round.level.walls,round.level.floors,RULES.bit.radius);
  bit=createBIT(spawn);bit.lastPlayer={...position};bit.trail=[{...position}];
  bitLabel=makeLabel('BIT',new THREE.Vector3(bit.x,1.5,bit.z),'bit-label','bit','BIT');
  for(const v of world.nodes){
    v.label=makeLabel('',new THREE.Vector3(v.node.x,1.9,v.node.z),'objective-node','node','GATE CONTROL');if(v.node.shielded)setIconText(v.label.shortEl,'stat-shield','GATE CONTROL');
    const meter=document.createElement('div');meter.className='node-meter';meter.hidden=true;meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','Node activation');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
    const fill=document.createElement('i');meter.append(fill);v.label.el.append(meter);v.label.meter=meter;v.label.fill=fill;
  }
  hazardLabels=(round.level.hazards??[]).map(h=>({hazard:h,label:(()=>{const l=makeLabel('',new THREE.Vector3(h.x,.35,h.z),'hazard-label hazard-icon');setIconText(l.caption,'hazard','');return l;})()}));
  world.exitLabel=makeLabel('',new THREE.Vector3(round.level.exit.x,1.8,round.level.exit.z),'exit-label','exit','EXIT');
  for(const room of round.level.rooms)makeLabel(room.name.toUpperCase(),new THREE.Vector3(room.x,.1,room.z-room.d/2+1),'room-label','room',room.name.toUpperCase());
  for(const v of world.enemies){
    v.maxHealth=v.enemy.health;
    v.label=makeLabel(`${enemyName(v.enemy)} · ${v.enemy.health}`,new THREE.Vector3(v.enemy.x,1.7,v.enemy.z),'enemy-label','enemy');v.label.enemy=v.enemy;
    const bar=document.createElement('div');bar.className='enemy-health-bar';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Enemy health');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',v.maxHealth);
    v.healthSegments=createHealthSegments(bar,v.maxHealth);v.label.el.append(bar);v.healthBar=bar;
    v.flash=makeLabel('',new THREE.Vector3(v.enemy.x,.65,v.enemy.z),'enemy-hit-flash');v.flash.el.replaceChildren();
    v.damage=makeLabel('',new THREE.Vector3(v.enemy.x,2,v.enemy.z),'enemy-damage');v.damage.defeated=true;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 80 80');svg.setAttribute('aria-hidden','true');
    for(const d of ['M15 8L29 22L20 27L34 41L23 48L34 69','M65 9L53 25L62 31L46 42L57 50L45 72','M4 42L19 35L23 43L36 38','M75 41L61 48L56 39L44 44']){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);}v.flash.el.append(svg);v.flash.defeated=true;
  }
  for(const door of round.level.doors??[])encounterLabels.push({door,label:makeLabel('',new THREE.Vector3(door.x,1.9,door.z),'door-label','node','DOOR')});
  for(const sp of round.level.spawners??[])encounterLabels.push({sp,label:makeLabel('',new THREE.Vector3(sp.x,1.5,sp.z),'spawn-label','node','SPAWN')});
  for(const v of world.lootBoxes)labelLoot(v);
  houseLabels=[];const H=round.level.house;
  if(H){const meter=l=>{const m=document.createElement('div');m.className='node-meter';m.hidden=true;m.setAttribute('role','progressbar');m.setAttribute('aria-valuemin','0');m.setAttribute('aria-valuemax','100');const f=document.createElement('i');m.append(f);l.el.append(m);l.meter=m;l.fill=f;return l;};
    houseLabels.push({ref:H.door,door:true,label:meter(makeLabel('',new THREE.Vector3(H.door.x,1.6,H.door.z),'house-label','node','DOOR'))});
    for(const c of H.containers)houseLabels.push({ref:c,label:meter(makeLabel('',new THREE.Vector3(c.x,1.3,c.z),'house-label','house','SEARCH'))});
    renderHouseLabels();}
  if(false)for(const choice of round.level.routeChoices){const label=makeLabel(`${choice.dir.x<0?'LEFT':'RIGHT'} · ${choice.kind==='loot'?'LOOT · SHORT ROUTE':'NODES · LONG ROUTE'}`,new THREE.Vector3(choice.sign.x,.6,choice.sign.z),choice.kind==='loot'?'choice-label loot-route':'choice-label node-route');routeLabels.push({choice,label,level:round.level});}
  combat=createCombat(round.level,Date.now());
  { const sl=$('#seed-label'); sl.textContent=`SEED ${round.seed}`; sl.hidden=!SEED_LABEL; }
  // $('#intro-order').textContent=`ORDER: ${round.order.objective.join(' + ')} · ${round.order.loadout.weapon} · ${round.order.loadout.ammo} rounds · ${round.order.health} health`;
  updateHUD();
  $('#level-corner').hidden=false;
}
function reset(requestedSeed){
  const seed=typeof requestedSeed==='string'&&requestedSeed?requestedSeed.slice(0,64):`${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8,'0')}-${++resetCount}`;
  const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState(null,'',url);
  resultPending=false;$('#inventory').hidden=true;
  dash=createDash();walkDirection={x:0,z:-1};
  // latestResult=null;
  // round=createRound(seed,Date.now(),raidOrder);weapon=createWeapon(round.order.loadout.ammo);
  round=createRound(seed,Date.now(),{...launch.stats,bagCapacity:launch.bag});if(launch.intro&&AREA_SEL==='bunker')applyIntroEncounter(round.level,launch.goal);if(!launch.intro&&AREA_SEL==='bunker')applyFirstPayoff(round.level,launch.payoff,launch.bag);initEquip(round,{weapon:launch.weapon?.id,gear:launch.gear});weapon=createWeapon(RULES.loadout.ammo,launch.weapon);round.kit={...launch.kit};initTool(round,launch.tool);cancelToolDrag();clearToolFx();setupWeaponHUD();viewport.classList.remove('round-ended','damaged');hitUntil=0;$('#round-over').hidden=true;$('#time-left').textContent='8:00';$('.timer').classList.remove('urgent');loadLevel();
  if(launch.payoff&&!launch.intro&&(launch.payoff!=='free_tool'||round.tool))notice(RULES.payoff[launch.payoff].notice,5000);
  if(typeof requestedSeed==='string')resetCount=round.level.choiceSide<0?1:0;
}
function finishRound(outcome=round.reason){
  if(!$('#round-over').hidden&&!resultPending)return;
  resultPending=outcome==='extraction'&&!round.over;
  if(round.over)writeRaidResult(globalThis.localStorage,buildRaidResult(round,{launch}));
  $('#return-base').hidden=!(launch.returnUrl&&round.over);
  $('#inventory').hidden=true;hideSwap();
  $('#continue-raid').hidden=!resultPending||launch.intro;$('#extract-raid').hidden=!resultPending;
  $('#new-round').hidden=!!launch.returnUrl||resultPending;
  let home=null;try{const saved=JSON.parse(localStorage.getItem('pr_meta_save'));if(saved?.v===7)home=saved;}catch{}
  const view=resultView(round,{launch,home,pending:resultPending});renderResult($('#round-over'),view);
  const tip=deathTip(round);for(const tipEl of [$('#death-tip'),$('#result-detail-tip')]){tipEl.hidden=!tip;if(tip)setIconText(tipEl,'info',`BIT: ${tip.text}`);}
  $('#result-close').setAttribute('aria-label',resultPending?(launch.intro?'Extract and secure':'Continue raid'):launch.returnUrl?'Return to base':'New raid');
  weapon.scavenging=null;clearInput();clearBullets();viewport.classList.add('round-ended');$('#round-over').hidden=false;
  updateHUD();
  const primary=resultPending?$('#extract-raid'):launch.returnUrl?$('#return-base'):$('#new-round');primary.focus({preventScroll:true});
}
$('#result-details-toggle').addEventListener('click',()=>toggleResultDetails($('#round-over')));
$('#result-close').addEventListener('click',()=>{const action=resultPending?(launch.intro?'#extract-raid':'#continue-raid'):launch.returnUrl?'#return-base':'#new-round';$(action).click();});
$('#return-base').addEventListener('click',()=>{if(!round?.over||!launch.returnUrl)return;writeRaidResult(globalThis.localStorage,buildRaidResult(round,{launch}));location.assign(launch.returnUrl);});
$('#reset').hidden=!!launch.returnUrl;$('#abandon').hidden=!launch.returnUrl;
$('#abandon').addEventListener('click',()=>{if(!round||round.over)return;if(!confirm('Abandon the raid? Your bag and equipment count as lost.'))return;if(abandonRound(round,Date.now()))finishRound();});
$('#extract-raid').addEventListener('click',()=>{if(!resultPending)return;if(extractRound(round,Date.now()))$('#round-over').hidden=true;finishRound();});
$('#reset').addEventListener('click',reset);$('#new-round').addEventListener('click',reset);
$('#continue-raid').addEventListener('click',()=>{tickRound(round,Date.now());if(round.over){finishRound();return;}resultPending=false;$('#round-over').hidden=true;viewport.classList.remove('round-ended');loadLevel();});
function fire(){
  if(!round||round.over||resultPending||tutorialOpen||!$('#inventory').hidden)return;
  tickRound(round,Date.now());if(round.over){finishRound();return;}
  const clock=Date.now();round.shooter=position;const shot=fireAimedWeapon(weapon,round,position,aim,clock,playerSolids);round.shooter=null;
  if(!shot){$('#ammo-hud').classList.add('empty');return;}
  if(shot.resolved){updateHUD();renderEnemyFeedback(clock);renderLabels();}
  const mesh=new THREE.Mesh(bulletGeometry,bulletMaterial);mesh.position.set(shot.x,.65,shot.z);mesh.rotation.y=Math.atan2(shot.dx,shot.dz);scene.add(mesh);bullets.push({shot,mesh});
}
function updateMouseAim(){
  raycaster.setFromCamera(mouse,camera);
  if(raycaster.ray.intersectPlane(ground,intersection)){const dx=intersection.x-position.x,dz=intersection.z-position.z,l=Math.hypot(dx,dz);if(l>.1)aim={x:dx/l,z:dz/l};}
}
// Weapon from base (?w=) sets magazine size; HUD shows its name and the medkits you brought (Q / tap to use).
function setupWeaponHUD(){
  const bars=document.querySelector('.ammo-bars');if(bars){bars.replaceChildren();for(let i=0;i<weapon.rule.capacity;i++){const s=document.createElement('i');s.className='ammo-slot loaded';bars.append(s);}}
  const name=$('#weapon-name');if(name)name.textContent=ITEM_NAMES[weapon.id]??'Basic Carbine';renderKitHUD();
}
function useKit(){if(!round||round.over||resultPending)return;if(useHealthKit(round,Date.now()))updateHUD();}
function renderKitHUD(){refreshKitLabels();const b=$('#use-kit');if(!b)return;const n=(round.kit?.medkit??0)+(round.bag.medkit??0);b.querySelector('b').textContent=n;b.disabled=!n||round.over||round.health>=(round.maxHealth??100);b.setAttribute('aria-label',`Use medkit (Q) · ${n} left`);}
function renderWeaponHUD(clock){
  renderKitHUD();
  const reloading=weapon.reloadAt!==null&&!round.over;
  const remaining=reloading?Math.max(0,weapon.reloadAt-clock):0;
  const W=weapon.rule,fraction=reloading?1-remaining/W.reloadMs:0;
  $('#ammo-hud').classList.toggle('empty',weapon.ammo===0);
  $('#ammo-hud').setAttribute('aria-label',`Magazine: ${weapon.ammo} of ${W.capacity} · Reserve: ${weapon.reserve===Infinity?'Unlimited':weapon.reserve}`);
  for(const [i,el] of [...document.querySelectorAll('.ammo-slot')].entries()){
    el.classList.toggle('loaded',i<weapon.ammo);el.classList.toggle('refilling',i===weapon.ammo&&reloading);
    el.style.setProperty('--fill',`${i<weapon.ammo?100:i===weapon.ammo?fraction*100:0}%`);
  }
  {const rt=$('#reload-time'),inf=weapon.reserve===Infinity,tail=reloading?` · +1 ${(remaining/1000).toFixed(1)} s`:'',k=`${weapon.ammo}/${W.capacity}|${inf?'inf':weapon.reserve}|${tail}`;
   if(rt.dataset.k!==k){rt.dataset.k=k;if(inf)rt.replaceChildren(`${weapon.ammo}/${W.capacity} · `,svgIcon('infinity'),tail);else rt.textContent=`${weapon.ammo}/${W.capacity} · ${weapon.reserve}${tail}`;}}
  // Scavenging is paused while reserve ammunition is unlimited.
  $('#player-health').setAttribute('aria-valuenow',round.health);
  renderHealthSegments(playerHealthSegments,round.health,round.maxHealth,10);$('#player-health').hidden=round.health<=0;
  $('#player-health').classList.toggle('urgent',round.health<=25);
  labelPoint.set(position.x,1.65,position.z).project(camera);
  $('#player-health').style.left=`${(labelPoint.x*.5+.5)*viewWidth}px`;
  $('#player-health').style.top=`${(-labelPoint.y*.5+.5)*viewHeight}px`;
  {const sh=$('#player-shield'),max=round.maxShield||0;if(sh){sh.hidden=!max||round.health<=0;if(max){sh.style.left=$('#player-health').style.left;sh.style.top=`${(-labelPoint.y*.5+.5)*viewHeight-12}px`;$('#player-shield-fill').style.width=`${Math.round(100*round.shield/max)}%`;sh.classList.toggle('broken',round.shield<=0);sh.setAttribute('aria-valuenow',round.shield);}}}
}
function resize(){viewWidth=stage.clientWidth;viewHeight=stage.clientHeight;renderer.setSize(viewWidth,viewHeight);const h=6,aspect=viewWidth/viewHeight;camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix();clearInput();}
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);resize();
const invRoot2=1/Math.sqrt(2),labelPoint=new THREE.Vector3();
function screenToWorld(x,y){return {x:(x+y)*invRoot2,z:(y-x)*invRoot2};}
const HUD_SELECTORS='.round-hud,#level-corner,.bag-panel,#dash,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,#weapon-name,.area-notice,#encounter-hint,.stick,.pickup-toast';
let hudRects=[],hudRectsAt=0;
function refreshHudRects(now){if(now-hudRectsAt<500)return;hudRectsAt=now;
  const box=$('#game').getBoundingClientRect();
  hudRects=[...document.querySelectorAll(HUD_SELECTORS)].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top};}).filter(r=>r.right>r.left);}
function renderLabels(){
  refreshHudRects(performance.now());
  const items=labels.filter(l=>l.range&&!l.defeated).map(l=>({id:l.id,kind:l.range,x:l.point.x,z:l.point.z,
    force:l.range==='enemy'?(l.el.classList.contains('locked')||l.el.classList.contains('winding')||(l.enemy?.introGuard||l.enemy?.encounter)&&l.enemy.attackPhase?'full':undefined):l===bitLabel?(bit?.healing?'full':'hidden'):(l===world.exitLabel&&!exitIsOpen(round)&&Math.hypot(l.point.x-position.x,l.point.z-position.z)>3.4?'dot':undefined)}));
  const plan=planLabels(items,position);
  for(const l of labels){
    labelPoint.copy(l.point).project(camera);
    const sx=(labelPoint.x*.5+.5)*viewWidth,sy=(-labelPoint.y*.5+.5)*viewHeight;
    const mode=l.range?plan.get(l.id)??'hidden':'full';
    if(l.el.dataset.mode!==mode){l.el.dataset.mode=mode;l.size=null;}
    if(!l.size&&!l.el.hidden&&l.el.offsetWidth){l.size=[l.el.offsetWidth,l.el.offsetHeight];const m=new DOMMatrixReadOnly(getComputedStyle(l.el).transform);l.anchorDy=l.el.offsetHeight+(m.f||0);}
    const [lw,lh]=l.size??[mode==='dot'?10:80,mode==='dot'?10:24];
    l.el.hidden=l.defeated||l.obscured||mode==='hidden'||Math.abs(labelPoint.x)>.95||Math.abs(labelPoint.y)>.9||(!l.range&&overHUD(sx,sy,hudRects,8,lw,lh)); // range labels: resolveLabels handles the HUD (with hold)
    l.sx=sx;l.sy=sy;
    if(!l.el.hidden){l.el.style.left=`${sx}px`;l.el.style.top=`${sy}px`;
      if(l.range)l.el.style.opacity=labelOpacity(l.range,Math.hypot(l.point.x-position.x,l.point.z-position.z)).toFixed(2);}
  }
  // shock-pad icons have priority; stacked enemy labels shift up (or hide) so nothing overlaps
  const boxes=[];
  // measure the real size every frame (text changes with range mode / state); one layout pass, reads only
  for(const l of labels)if(l.range&&!l.el.hidden&&l.el.offsetWidth){l.size=[l.el.offsetWidth,l.el.offsetHeight];}
  for(const {label} of hazardLabels)if(!label.el.hidden)boxes.push({id:label.id,x:label.sx,y:label.sy+18,w:40,h:40,priority:labelPriority({kind:'hazard'})});
  for(const l of labels)if(l.range&&!l.el.hidden){const [w,h]=l.size??[60,14];
    boxes.push({id:l.id,x:l.sx,y:l.sy+(l.anchorDy??0),w,h,priority:labelPriority({kind:l.range,needed:l.el.classList.contains('needed-loot'),attacking:l.el.classList.contains('winding')||l.el.classList.contains('locked'),dist:Math.hypot(l.point.x-position.x,l.point.z-position.z)})});}
  const shown=resolveLabels(boxes,{hud:hudRects,now:performance.now(),state:labelState});
  for(const {label} of hazardLabels)if(!label.el.hidden&&shown.get(label.id)===false)label.el.hidden=true;
  for(const l of labels)if(l.range&&!l.el.hidden&&shown.get(l.id)===false)l.el.hidden=true;
  // show-debounce: a label that was hidden comes back only after LABEL_SHOW_HOLD_MS, so threshold crossings can't blink
  const now=performance.now();
  for(const l of new Set([...labels,...hazardLabels.map(h=>h.label)])){if(!l.range&&!hazardLabels.some(h=>h.label===l))continue;
    if(l.el.hidden){l.wantSince=undefined;l.wasShown=false;continue;}
    if(l.wasShown)continue;
    l.wantSince??=now;
    if(l.everShown&&now-l.wantSince<LABEL_SHOW_HOLD_MS){l.el.hidden=true;continue;}
    l.wasShown=l.everShown=true;}
}
const LABEL_SHOW_HOLD_MS=1200;
const labelState=new Map();
let previous=performance.now();
// Screenshot/debug hook (only with ?debug): teleport, open the exit, jump to a level.
if(new URLSearchParams(location.search).has('debug'))window.__NR={
  teleport(x,z){position={x,z};},house:()=>({house:round.level.house,inside:world.house?.inside,roof:world.house?.roofOpacity,labels:houseLabels.map(h=>h.label.caption.textContent)}),state:()=>({position,level:round.level}),round:()=>round,project:(x,z)=>{const q=new THREE.Vector3(x,.5,z).project(camera);return {x:(q.x+1)/2*innerWidth,y:(1-q.y)/2*innerHeight};},
  openExit(){for(const n of round.level.nodes)n.active=true;updateHUD();},bagFull:()=>{round.bagFull=round.bagFull||{boxId:round.level.lootBoxes.find(b=>!b.collected)?.id,item:round.level.lootBoxes.find(b=>!b.collected)?.item};showSwap();},crash:()=>onFatal(new Error('debug crash')),info:()=>({geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures,calls:renderer.info.render.calls,children:scene.children.length,labels:document.querySelectorAll('#world-labels > *').length,level:round.level.number,over:round.over}),hz:()=>hazardLabels.map(h=>h.label.el.dataset.state),
  pickup(item){pickupToast(item);},pickupDemo(items=['cable','power_cell','servo','ai_fragment']){items.forEach((id,i)=>setTimeout(()=>pickupToast(id),i*350));},
  extractDemo(ids=['cable','power_cell','servo','ai_fragment','fuse','optical_sensor','data_core','scrap_alloy','gear_box']){const known=new Set(globalThis.DATA.items.map(i=>i.id));round.levelsCleared=Math.max(1,round.levelsCleared);for(const id of ids)if(known.has(id))round.bag[id]=(round.bag[id]||0)+1;if(extractRound(round,Date.now()))finishRound('extract');},
  async goLevel(n){const {generateLevel}=await import('./levels.js?v=1.81.0');round.level=generateLevel(n,round.seed);loadLevel();}};

// ---- Full bag: flash + toast + compact swap row (only at the moment it happens) ----
let bitHintUntil=0;const HINT_KEY='nr_bagfull_hint';
function showSwap(){{const t=document.getElementById('bag-toast');if(t)t.hidden=true;}
  const info=round.bagFull;if(!info)return;
  const panel=$('.bag-panel');panel?.classList.remove('bag-full-flash');void panel?.offsetWidth;panel?.classList.add('bag-full-flash');
  const box=round.level.lootBoxes.find(b=>b.id===info.boxId);if(box&&!box.revealed){box.revealed=true;const v=world.lootBoxes.find(x=>x.loot===box);if(v){world.applyReveal(v);setLootText(v);}}
  let el=$('#swap-row');if(!el){el=document.createElement('section');el.id='swap-row';el.className='swap-row pop-card';el.setAttribute('role','dialog');el.setAttribute('aria-label','Bag full – swap');$('#viewport').append(el);}
  el.dataset.kind='bag';el.replaceChildren();
  const head=document.createElement('div');head.className='swap-head';head.innerHTML='<b>Bag full – swap?</b><span>Tap an item to swap it</span>';
  const close=document.createElement('button');close.className='pop-x swap-close';close.type='button';close.append(svgIcon('close'));close.setAttribute('aria-label','Keep bag');close.onclick=hideSwap;head.classList.add('pop-head');el.append(close,head);
  const row=document.createElement('div');row.className='swap-items';
  const suggested=suggestSwap(launch.goal,round.bag,info.item);let suggestionShown=false;
  const chip=(id,isNew)=>{
    const b=document.createElement(isNew?'div':'button'),r=rarityOf(id);b.className='swap-item'+(isNew?' swap-new':'');b.dataset.rarity=r;b.style.setProperty('--rc',RARITY_COLORS[r]);
    const name=document.createElement('span');name.textContent=ITEM_NAMES[id]??id;b.append(name);
    const status=swapItemStatus(launch.goal,round.bag,id,isNew);
    if(status){const hint=document.createElement('small');hint.className='swap-purpose';hint.textContent=status;b.append(hint);b.classList.toggle('swap-needed',status==='NEEDED NOW');}
    if(!isNew&&!suggestionShown&&id===suggested){suggestionShown=true;b.classList.add('swap-suggested');const hint=document.createElement('small');hint.className='swap-suggestion';hint.textContent='SUGGESTED';b.append(hint);}
    return b;
  };
  if(launch.goal){const goal=document.createElement('div');goal.className='swap-goal';goal.textContent=`For ${launch.goal.name} LVL ${launch.goal.level} · extract to secure supplies`;el.append(goal);}
  const carried=document.createElement('div');carried.className='swap-carried';
  for(const id of bagItems(round.bag)){const b=chip(id,false);b.type='button';b.onclick=()=>{const d=swapLoot(round,info.boxId,id,Date.now());if(d){labelLoot(world.addLoot(d));for(const v of world.lootBoxes)if(v.loot.id===info.boxId)v.loot.collected=true;}clearBagFull();updateHUD();};carried.append(b);}
  const arrow=document.createElement('span');arrow.className='swap-arrow';arrow.append(svgIcon('swap'));row.append(carried,arrow,chip(info.item,true));el.append(row);el.hidden=false;
  const suggestedChip=carried.querySelector('.swap-suggested');if(suggestedChip)carried.scrollLeft=Math.max(0,suggestedChip.offsetLeft-carried.offsetLeft);
  clearTimeout(showSwap.t);showSwap.t=setTimeout(hideSwap,4000);
  try{const n=+(localStorage.getItem(HINT_KEY)||0);if(n<2){localStorage.setItem(HINT_KEY,String(n+1));bitHintUntil=Date.now()+3500;}}catch{}
}
// Kit slot full: short, non-blocking notice; the kit stays on the ground.
function notifyKitFull(){let t=$('#kit-toast');if(!t){t=document.createElement('div');t.id='kit-toast';t.className='kit-toast';t.setAttribute('role','status');$('#viewport').append(t);}
  t.textContent=`Health kits full (${RULES.kitMax.medkit}/${RULES.kitMax.medkit}) · left on the ground`;t.hidden=false;clearTimeout(notifyKitFull.t);notifyKitFull.t=setTimeout(()=>{t.hidden=true;},1600);}
function hideSwap(){const el=document.getElementById('swap-row');if(el)el.hidden=true;}
// Non-intrusive full bag (owner feedback v1.40.5): walking over loot only flashes the bag + a short toast.
// The swap row opens only when the player taps the bag or the blocked loot label, and closes when they walk away.
function nearBlocked(){const b=round?.bagFull&&round.level.lootBoxes.find(x=>x.id===round.bagFull.boxId);return !!b&&!b.collected&&Math.hypot(position.x-b.x,position.z-b.z)<=RULES.loot.pickupRadius*1.6;}
function blockedLabel(){const id=round?.bagFull?.boxId;return world?.lootBoxes.find(v=>v.loot.id===id)?.label;}
function notifyBagFull(){
  const panel=$('.bag-panel');panel?.classList.remove('bag-full-flash');void panel?.offsetWidth;panel?.classList.add('bag-full-flash');
  const box=round.level.lootBoxes.find(b=>b.id===round.bagFull.boxId);if(box&&!box.revealed){box.revealed=true;const v=world.lootBoxes.find(x=>x.loot===box);if(v){world.applyReveal(v);setLootText(v);}}
  const lab=blockedLabel();if(lab){lab.el.classList.add('swap-tap');lab.el.onclick=e=>{e.stopPropagation();showSwap();};}
  let t=$('#bag-toast');if(!t){t=document.createElement('div');t.id='bag-toast';t.className='bag-toast';t.setAttribute('role','status');$('#viewport').append(t);}
  t.textContent='Bag full · tap BAG to swap';t.hidden=false;clearTimeout(notifyBagFull.t);notifyBagFull.t=setTimeout(()=>{t.hidden=true;},1800);
}
function clearBagFull(){hideSwap();const lab=blockedLabel();if(lab){lab.el.classList.remove('swap-tap');lab.el.onclick=null;}const t=$('#bag-toast');if(t)t.hidden=true;if(round)round.bagFull=null;}
// ---- v1.59 equipment: pickups go to the character slots (never the bag) ----
function weaponStatsOf(id){const w=gearItem(id)?.weapon;return w?readWeapon(`id:${id},`+Object.entries(w).map(([k,v])=>`${k}:${v}`).join(',')):null;}
function gearToast(text,onTap=null){let t=$('#gear-toast');if(!t){t=document.createElement('button');t.type='button';t.id='gear-toast';t.className='bag-toast gear-toast';$('#viewport').append(t);}
  t.replaceChildren();t.append(document.createTextNode(text));t.onclick=onTap?e=>{e.stopPropagation();onTap();}:null;t.classList.toggle('tappable',!!onTap);t.setAttribute('role','status');t.hidden=false;clearTimeout(gearToast.t);gearToast.t=setTimeout(()=>{t.hidden=true;},onTap?2600:1800);}
function refreshGearLabels(){for(const v of world?.lootBoxes??[])if(v.label&&gearItem(v.loot.item)&&!v.loot.collected&&v.loot.revealed)setLootText(v);}
function onEquip(){const e=round.lastEquip;if(!e)return;round.lastEquip=null;
  if(e.slot==='weapon'){weapon=createWeapon(RULES.loadout.ammo,weaponStatsOf(e.item));setupWeaponHUD();}
  updateHUD();refreshGearLabels();gearToast(`${ITEM_NAMES[e.item]} equipped${e.old?` · ${ITEM_NAMES[e.old]} dropped`:''}`);}
function nearOffer(){const b=round?.gearOffer&&round.level.lootBoxes.find(x=>x.id===round.gearOffer.boxId);return !!b&&!b.collected&&Math.hypot(position.x-b.x,position.z-b.z)<=RULES.loot.pickupRadius*1.6;}
function offerLabel(){const id=round?.gearOffer?.boxId;return world?.lootBoxes.find(v=>v.loot.id===id)?.label;}
function notifyGearOffer(){const o=round.gearOffer;const lab=offerLabel();if(lab){lab.el.classList.add('swap-tap');lab.el.onclick=e=>{e.stopPropagation();showGearSwap();};}
  gearToast(`${o.slot==='armor'?'Armor':'Weapon'} slot taken · tap to swap`,showGearSwap);}
function clearGearOffer(){const lab=offerLabel();if(lab){lab.el.classList.remove('swap-tap');lab.el.onclick=null;}const el=$('#swap-row');if(el?.dataset.kind==='gear')el.hidden=true;if(round)round.gearOffer=null;}
function showGearSwap(){const o=round?.gearOffer;if(!o||round.over)return;const cur=round.equip[o.slot];{const t=$('#gear-toast');if(t)t.hidden=true;}
  let el=$('#swap-row');if(!el){el=document.createElement('section');el.id='swap-row';el.className='swap-row pop-card';el.setAttribute('role','dialog');$('#viewport').append(el);}
  el.dataset.kind='gear';el.setAttribute('aria-label',`${o.slot==='armor'?'Armor':'Weapon'} slot – swap`);el.replaceChildren();
  const head=document.createElement('div');head.className='swap-head pop-head';head.innerHTML=`<b>Swap ${o.slot==='armor'?'armor':'weapon'}?</b><span>Tap your current gear · it drops here</span>`;
  const close=document.createElement('button');close.className='pop-x swap-close';close.type='button';close.append(svgIcon('close'));close.setAttribute('aria-label','Keep current gear');close.onclick=()=>{el.hidden=true;};el.append(close,head);
  const row=document.createElement('div');row.className='swap-items';
  const chip=(id,isNew)=>{const b=document.createElement(isNew?'div':'button');const r=rarityOf(id);b.className='swap-item'+(isNew?' swap-new':'');b.dataset.rarity=r;b.style.setProperty('--rc',RARITY_COLORS[r]);setIconText(b,MATERIALS[id]?.icon??'pickup',ITEM_NAMES[id]??id);return b;};
  const mine=chip(cur,false);mine.type='button';mine.onclick=()=>{const boxId=o.boxId;const d=swapGear(round,boxId,Date.now());if(d){labelLoot(world.addLoot(d));for(const v of world.lootBoxes)if(v.loot.id===boxId)v.loot.collected=true;}el.hidden=true;clearGearOffer();onEquip();};
  const arrow=document.createElement('span');arrow.className='swap-arrow';arrow.append(svgIcon('swap'));row.append(mine,arrow,chip(o.item,true));el.append(row);el.hidden=false;
  clearTimeout(showSwap.t);showSwap.t=setTimeout(()=>{el.hidden=true;},5000);}
// ---- Visible fallback instead of a white page ----
let fatal=false;
function showFatal(title,msg,{retry=null,keep=false}={}){
  let el=document.getElementById('fatal');if(!el){el=document.createElement('section');el.id='fatal';el.className='fatal';el.setAttribute('role','alertdialog');document.body.append(el);}
  el.replaceChildren();const card=document.createElement('div');card.className='fatal-card';
  const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=msg;card.append(h,p);
  const btns=document.createElement('div');btns.className='fatal-btns';
  const mk=(t,f)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=f;btns.append(b);};
  if(retry)mk('Try again',()=>{el.hidden=true;retry();});
  mk('Reload',()=>location.reload());
  if(launch?.returnUrl)mk('Back to base',()=>{try{if(round&&!round.over)abandonRound(round,Date.now());writeRaidResult(globalThis.localStorage,buildRaidResult(round,{launch}));}catch{}location.assign(launch.returnUrl);});
  card.append(btns);el.append(card);el.hidden=false;
}
function onFatal(e){console.error('[node-raid] fatal',e);if(fatal)return;fatal=true;
  showFatal('Something went wrong','The raid view stopped. Your raid is still here – try again, or go back to base.',{retry:()=>{fatal=false;try{loadLevelInner();}catch(err){onFatal(err);return;}requestAnimationFrame(frame);}});}
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showFatal('Graphics paused','The browser reset the 3D view. Restoring…');});
renderer.domElement.addEventListener('webglcontextrestored',()=>{const el=document.getElementById('fatal');if(el&&!fatal)el.hidden=true;});
window.addEventListener('error',e=>{if(e.error)onFatal(e.error);});
window.addEventListener('unhandledrejection',e=>onFatal(e.reason??new Error('unhandled rejection')));
function frame(now){if(fatal)return;try{frameInner(now);}catch(e){onFatal(e);}}
function frameInner(now){
  const dt=Math.min((now-previous)/1000,.04);previous=now;elapsed+=dt;const clock=Date.now();
  if(tutorialOpen){renderer.render(scene,camera);requestAnimationFrame(frame);return;}
  tickRound(round,clock);
  const seconds=renderRoundClock(round,resultPending,$('#time-left'),$('#summary-time'));
  if(resultPending)$('#result-clock').textContent=$('#summary-time').textContent;
  $('.timer').classList.toggle('urgent',seconds<=60);
  if(round.over)finishRound();
  if(!round.over&&!resultPending){
    const positionBefore={...position},dashing=dash.remaining>0;
    let sx=movement.x,sy=movement.y;
    sx+=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    sy+=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
    const magnitude=Math.hypot(sx,sy);
    if(magnitude>.12){const scale=Math.min(1,magnitude)/magnitude,delta=doorAssist(round.level.house,position,screenToWorld(sx*scale,sy*scale));walkDirection=screenToWorld(sx/magnitude,sy/magnitude);if(dash.remaining===0)position=moveWithActors(position,{x:delta.x*round.stats.speed*dt,z:delta.z*round.stats.speed*dt},round.level.enemies,playerSolids,round.level.floors,RULES.playerRadius);}
    if(!round.over&&!resultPending)round.telemetry.distanceM+=Math.hypot(position.x-positionBefore.x,position.z-positionBefore.z);
    position=stepDash(dash,position,dt,round.level.enemies,playerSolids,round.level.floors);
    const stickDirection=stepAim(sticks[1].state.gesture,dt);
    if(stickDirection)aim=screenToWorld(stickDirection.x,stickDirection.y);
    else if(mouseKnown)updateMouseAim();
    // the guard's front shield needs to know where the shot comes from; grenades (stepTools) have no origin and ignore it
    round.shooter=position;const weaponChanged=stepWeapon(weapon,round,clock,dt,playerSolids);round.shooter=null;if(weaponChanged)updateHUD();
    const activeShots=new Set(weapon.projectiles.map(b=>b.id));
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(!activeShots.has(b.shot.id)){scene.remove(b.mesh);bullets.splice(i,1);}else b.mesh.position.set(b.shot.x,.65,b.shot.z);}
    if(collectLoot(round,position,clock,weapon)){updateHUD();if(round.lastBagPickup?.at===clock)pickupToast(round.lastBagPickup.item);{const h=nextPickupHint(round.bag);const t=h&&hintText(h);if(t)notice(t,6000);}renderKitHUD();if(round.bagFull&&round.bagFull.at===clock)notifyBagFull();if(round.kitFull&&round.kitFull.at===clock)notifyKitFull();if(round.lastEquip&&round.lastEquip.at===clock)onEquip();if(round.gearOffer&&round.gearOffer.at===clock)notifyGearOffer();if(round.lastPickup?.item==='keycard'&&round.lastPickup.at===clock)notice('KEYCARD · WALK UP TO THE LOCKED DOOR');}
    if(stepDoors(round,position,clock)){setCollisions();updateHUD();notice('DOOR UNLOCKED · KEYCARD USED');}
    checkEncounterHints(clock);
    if(round.gearOffer&&!nearOffer())clearGearOffer();
    if(round.bagFull&&!nearBlocked())clearBagFull();
    if(stepNodeInteraction(round,weapon,position,clock,solids))updateHUD();
    {const hs=stepHouse(round.level,position,clock,round.stats.searchMult);if(hs.loot.length)round.telemetry.searches=(round.telemetry.searches||0)+hs.loot.length;if(hs.changed){for(const b of hs.loot)labelLoot(world.addLoot(b));setCollisions();}renderHouseLabels();}
    const healthBefore=round.health;
    stepCombat(round,combat,position,clock,dt,playerSolids);
    if(stepTools(round,clock).length)updateHUD();
    stepHazards(round,position,clock,dt);world.animateHazards?.(clock);
    for(const {hazard,label} of hazardLabels){const t=hazardTiming(hazard,clock);label.el.dataset.state=t.state;
      label.el.setAttribute('aria-label',t.state==='on'?'Shock pad active':t.state==='warn'?'Shock pad charging':'Shock pad');}
    // if(stepScavenging(weapon,round,position,clock,[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))],{moving:magnitude>.12,hit:round.health<healthBefore}))updateHUD();
    setCollisions();
    if(round.health!==healthBefore){hitUntil=clock+200;updateHUD();}
    const moving=magnitude>.12||dashing||Math.hypot(position.x-positionBefore.x,position.z-positionBefore.z)>.001;
    if(stepBIT(bit,round,position,dt,moving,playerSolids,round.level.floors))updateHUD();
    if(round.over)finishRound();
    const result=enterExit(round,position,clock);
    if(result)finishRound('extraction');
  }
  viewport.classList.toggle('damaged',clock<hitUntil);
  if(round.over||resultPending||!$('#inventory').hidden)bit.healing=false;
  bitModel.position.set(bit.x,Math.sin(elapsed*3)*.06,bit.z);
  bitScreen.material.color.set(bit.healing?'#3FE0D0':'#75cfcc');
  bitLabel.point.set(bit.x,1.5,bit.z);bitLabel.caption.textContent=Date.now()<bitHintUntil?'BIT · Drop junk for better loot':bit.healing?'BIT · +5 HP/s':'BIT';bitLabel.el.classList.toggle('healing',bit.healing);
  healBeam.visible=healHalo.visible=bit.healing;
  if(bit.healing){const vertices=healBeamGeometry.attributes.position;vertices.setXYZ(0,bit.x,.8,bit.z);vertices.setXYZ(1,position.x,.65,position.z);vertices.needsUpdate=true;healHalo.position.set(position.x,.04,position.z);healHalo.scale.setScalar(1+Math.sin(elapsed*7)*.14);}
  const dashRemaining=Math.max(0,dash.readyAt-clock),dashUnavailable=round.over||resultPending||tutorialOpen||!$('#inventory').hidden;
  const charge=dashCharge(dash,clock);
  $('#dash').disabled=charge<1||dashUnavailable;
  $('#dash-time').textContent=dashRemaining>0?`${(dashRemaining/1000).toFixed(1)} s`:'READY';
  $('#dash').style.setProperty('--cooldown',`${dashRemaining/round.stats.dashCooldownMs*100}%`);
  $('#dash').setAttribute('aria-label',dashRemaining>0?`Dash cooldown ${(dashRemaining/1000).toFixed(1)} seconds`:'Dash ready');
  $('#dash-meter').setAttribute('aria-valuenow',Math.round(charge*100));$('#dash-fill').style.width=`${charge*100}%`;
  renderToolHUD();renderToolFx(clock);
  playerRing.material.color.set(dash.remaining>0?'#3FE0D0':'#b4d8d0');
  playerRing.scale.setScalar(dash.remaining>0?1.35:1);
  const visibleProjectiles=round.over?[]:combat.projectiles.filter(b=>clock>=(b.releaseAt??0));
  const aliveProjectiles=new Set(visibleProjectiles.map(b=>b.id));
  for(const [id,m] of enemyMeshes)if(!aliveProjectiles.has(id)){scene.remove(m);enemyMeshes.delete(id);}
  for(const b of visibleProjectiles){let m=enemyMeshes.get(b.id);if(!m){m=new THREE.Mesh(bulletGeometry,enemyBulletMaterial);scene.add(m);enemyMeshes.set(b.id,m);}m.position.set(b.x,.65,b.z);m.rotation.y=Math.atan2(b.dx,b.dz);}
  renderEnemyFeedback(clock);
  for(const v of world.nodes){const visible=v.node.active||traceTargets(position,v.node,round.level.walls,[v.node])?.kind==='node';v.group.visible=visible;v.label.obscured=!visible;
    const hold=round.nodeInteraction?.id===v.node.id?round.nodeInteraction:null;
    setNodeHold(v,hold?.progress??0);
    v.label.el.classList.toggle('charging',!!hold);
    v.label.meter.hidden=!hold;v.label.meter.setAttribute('aria-valuenow',Math.round((hold?.progress??0)*100));v.label.fill.style.width=`${(hold?.progress??0)*100}%`;
    v.label.caption.textContent=nodeCaption(v.node,clock);
  }
  
  for(const v of world.routes)for(const marker of v.markers)marker.visible=!routeComplete(v.level,v.choice);
  for(const v of world.lootBoxes){if(!v.loot.collected&&updateReveal(v.loot,position)){world.applyReveal(v);setLootText(v);}if(v.loot.collected&&v.group.visible)world.burst?.(v.loot.x,v.loot.z,v.color);v.group.visible=!v.loot.collected;v.label.defeated=v.loot.collected;}
  const holding=!!sticks[1].state.gesture?.direction||mouseDown||keys.has('Space');
  // Desktop: a faint preview follows the mouse; holding strengthens it.
  const aiming=!round.over&&(holding||mouseKnown);
  aimCone.material.opacity=holding?.45:.15;rangeRing.material.opacity=holding?.35:.12;
  const assisted=aiming?assistAim(position,aim,[...round.level.enemies,...round.level.nodes],playerSolids,weapon.rule):{target:null,direction:aim},displayAim=assisted.direction;
  lockMarker.visible=!!assisted.target;if(assisted.target)lockMarker.position.set(assisted.target.x,.08,assisted.target.z);
  for(const v of world.nodes)v.label.el.classList.toggle('locked',v.node===assisted.target);
  for(const v of world.enemies){v.label.el.classList.toggle('locked',v.enemy===assisted.target);if(v.enemy===assisted.target)setIconText(v.label.caption,'aim',enemyStateText(v.enemy));}
  const facing=facingDirection(holding,walkDirection,displayAim);
  if(round.over)playerOutline.visible=false;
  player.position.set(position.x,0,position.z);player.rotation.y=Math.atan2(facing.x,facing.z);playerRing.position.set(position.x,.025,position.z);
  rangeRing.visible=aiming;rangeRing.position.set(position.x,.06,position.z);rangeRing.scale.setScalar(weapon.rule.range/RULES.weapon.range);aimCone.visible=aiming;
  if(aiming){
    const footprint=aimConePoints(position,displayAim,weapon.rule.range,weapon.rule.coneHalfAngleDegrees*Math.PI/180,solids);
    let count=0;for(let i=1;i<footprint.length-1;i++)for(const p of [footprint[0],footprint[i],footprint[i+1]]){
      coneVertices[count++]=p.x;coneVertices[count++]=.065;coneVertices[count++]=p.z;
    }
    coneGeometry.attributes.position.needsUpdate=true;coneGeometry.setDrawRange(0,count/3);
  }
  target.lerp(new THREE.Vector3(position.x,0,position.z-1),1-Math.exp(-dt*6));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();
  if(!round.over&&clock>=visibilityCheckAt){
    visibilityCheckAt=clock+100;visibilityPoint.set(position.x,.65,position.z).sub(camera.position);
    visibilityRay.set(camera.position,visibilityPoint.clone().normalize());visibilityRay.far=visibilityPoint.length()-.08;
    playerOutline.visible=visibilityRay.intersectObject(world.group,true).some(hit=>hit.object.isMesh&&(Array.isArray(hit.object.material)?hit.object.material:[hit.object.material]).some(m=>m.depthWrite&&m.visible));
  }
  for(const cross of healCrosses){
    cross.group.visible=bit.healing&&round.health<100&&!round.over&&!resultPending;
    if(cross.group.visible){const life=(elapsed/ .65+cross.phase)%1,angle=cross.phase*Math.PI*2;cross.group.position.set(position.x+Math.cos(angle)*.9,.45+life*1.25,position.z+Math.sin(angle)*.9);cross.group.quaternion.copy(camera.quaternion);cross.material.opacity=Math.sin(life*Math.PI);cross.group.scale.setScalar(.8+life*.25);}
  }
  sun.position.copy(target).add(new THREE.Vector3(-8,18,10));sun.target.position.copy(target);
  world.house?.update(position,dt);world.animate(elapsed);renderEncounterLabels(clock);renderLabels();renderWeaponHUD(clock);renderer.render(scene,camera);requestAnimationFrame(frame);
}
reset(new URLSearchParams(location.search).get('seed'));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();$('#loading').hidden=true;requestAnimationFrame(frame);
// Boot loader stays up until the first frame has been rendered and painted, then fades out.
{const bl=document.getElementById('boot-loader');if(bl)requestAnimationFrame(()=>requestAnimationFrame(()=>{bl.classList.add('out');setTimeout(()=>bl.remove(),260);}));}
// Landscape only: on the first tap go fullscreen and lock orientation where supported (Android). iOS shows the .rotate screen.
{const once=()=>{document.removeEventListener('pointerdown',once,true);try{const el=document.documentElement,fs=el.requestFullscreen||el.webkitRequestFullscreen,lock=()=>{try{screen.orientation?.lock?.('landscape')?.catch?.(()=>{});}catch{}};if(fs&&!document.fullscreenElement){const p=fs.call(el,{navigationUI:'hide'});p?.then?p.then(lock,lock):lock();}else lock();}catch{}};document.addEventListener('pointerdown',once,true);}
gameReady=true;if(queuedStart){const q=queuedStart;queuedStart=null;q();}
