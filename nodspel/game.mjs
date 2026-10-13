import * as THREE from './vendor/three.module.js';
import {moveWithActors,traceTargets,aimConePoints} from './physics.mjs?v=1.37.1';
import {rarityOf,updateReveal,RARITY_COLORS} from './rarity.js?v=1.37.1';
import {extractRound,abandonRound,createRound,tickRound,enterExit,exitIsOpen,roundSummary,collectLoot,dropItem,swapLoot,useHealthKit,stepNodeInteraction} from './round.js?v=1.37.1';
import {createCombat,stepCombat,stepHazards} from './combat.js?v=1.37.1';
import {buildWorld,setNodeHold} from './world.js?v=1.37.1';
import {RULES,totalNodes,hazardTiming} from './levels.js?v=1.37.1';
import {createWeapon,fireAimedWeapon,stepWeapon,assistAim} from './weapon.js?v=1.37.1';
import {beginAim,dragAim,stepAim,releaseAim,facingDirection} from './controls.js?v=1.37.1';
// import {readOrder,raidResult,resultJSON} from './raid.js?v=1.37.1';
import {bagText,bagItems,ITEM_NAMES} from './raid.js?v=1.37.1';
// import {stepScavenging} from './scavenging.js?v=1.37.1';
import {buildRaidResult,writeRaidResult,readLaunch} from './raid-result.js?v=1.37.1';
import {tutorialNeeded,completeTutorial} from './tutorial.js?v=1.37.1';
import {routeComplete} from './objectives.js?v=1.37.1';
import {createDash,startDash,stepDash,dashCharge} from './dash.js?v=1.37.1';
import {createBIT,stepBIT} from './bit.js?v=1.37.1';
import {createHealthSegments,renderHealthSegments} from './hud.js?v=1.37.1';
import {isGameKey,isTypingTarget,releaseButtonFocus} from './input.js?v=1.37.1';
import {PALETTE,pickQuality,qualitySettings} from './art.js?v=1.37.1';
import {planLabels,labelOpacity,overHUD,deoverlap} from './labels.js?v=1.37.1';

// File integration is paused; no order fetch or result export runs.
/*
const orderResponse=await fetch('./order.json?v=1.37.1');
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
$('#tutorial-start').onclick=()=>{completeTutorial(tutorialStorage);tutorialOpen=false;$('#tutorial').hidden=true;clearInput();reset(new URLSearchParams(location.search).get('seed'));};
let viewWidth=viewport.clientWidth,viewHeight=viewport.clientHeight;
const QUALITY=pickQuality({search:location.search,storage:localStorage,nav:navigator,screen}),QS=qualitySettings(QUALITY);document.documentElement.dataset.quality=QUALITY;
const scene=new THREE.Scene();scene.background=new THREE.Color(PALETTE.bg);scene.fog=new THREE.Fog(PALETTE.fog,34,64);
const renderer=new THREE.WebGLRenderer({antialias:QS.antialias,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,QS.pixelRatio));renderer.shadowMap.enabled=QS.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
$('#game').appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-20,20,6,-6,.1,100);
const target=new THREE.Vector3(),cameraOffset=new THREE.Vector3(17,23,17);
scene.add(new THREE.HemisphereLight('#a9d4e6','#0d1a20',1.7));
const sun=new THREE.DirectionalLight('#dff3ff',2.3);sun.castShadow=QS.shadows;sun.shadow.mapSize.set(QS.shadowMap,QS.shadowMap);
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:50});sun.shadow.normalBias=.045;scene.add(sun,sun.target);

const cube=new THREE.BoxGeometry(1,1,1),materials={};
function box(x,y,z,w,h,d,color,parent){
  const m=new THREE.Mesh(cube,materials[color] ||= new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12}));
  m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
const player=new THREE.Group();scene.add(player);
box(0,.5,0,.62,.7,.62,'#bac4c7',player);box(0,.98,0,.48,.29,.46,'#e0e7e5',player);
box(0,.97,.24,.32,.075,.025,'#2c4a54',player);box(0,.65,.58,.16,.16,.67,'#242d34',player);
box(0,.67,.88,.18,.18,.12,'#75cfcc',player);box(-.23,.14,0,.19,.26,.42,'#27343d',player);box(.23,.14,0,.19,.26,.42,'#27343d',player);
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
const healBeam=new THREE.Line(healBeamGeometry,new THREE.LineBasicMaterial({color:'#15d6be',transparent:true,opacity:.65,depthTest:false}));healBeam.visible=false;healBeam.frustumCulled=false;healBeam.renderOrder=4;scene.add(healBeam);
const healHalo=new THREE.Mesh(new THREE.RingGeometry(.55,.64,48),new THREE.MeshBasicMaterial({color:'#15d6be',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));healHalo.rotation.x=-Math.PI/2;healHalo.visible=false;scene.add(healHalo);
const healCrosses=Array.from({length:6},(_,i)=>{
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:'#15d6be',transparent:true,depthTest:false,depthWrite:false});
  for(const [w,h] of [[.25,.055],[.055,.25]]){const m=new THREE.Mesh(cube,material);m.scale.set(w,h,.025);m.renderOrder=6;group.add(m);}
  group.visible=false;scene.add(group);return {group,material,phase:i/6};
});
const coneGeometry=new THREE.BufferGeometry(),coneVertices=new Float32Array(4096*9);
coneGeometry.setAttribute('position',new THREE.BufferAttribute(coneVertices,3));coneGeometry.setDrawRange(0,0);
const aimCone=new THREE.Mesh(coneGeometry,new THREE.MeshBasicMaterial({color:'#75cfcc',transparent:true,opacity:.24,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));aimCone.renderOrder=3;aimCone.frustumCulled=false;aimCone.visible=false;scene.add(aimCone);
const rangeRing=new THREE.Mesh(new THREE.RingGeometry(RULES.weapon.range-.04,RULES.weapon.range,96),new THREE.MeshBasicMaterial({color:'#75cfcc',transparent:true,opacity:.35,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
rangeRing.renderOrder=2;rangeRing.rotation.x=-Math.PI/2;rangeRing.visible=false;scene.add(rangeRing);
const lockMarker=new THREE.Mesh(new THREE.RingGeometry(.64,.73,32),new THREE.MeshBasicMaterial({color:'#15d6be',transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));lockMarker.rotation.x=-Math.PI/2;lockMarker.renderOrder=4;lockMarker.visible=false;scene.add(lockMarker);
const bulletGeometry=new THREE.BoxGeometry(RULES.weapon.shotRadius*2,.12,.38),bulletMaterial=new THREE.MeshBasicMaterial({color:'#75cfcc'});
const bullets=[],keys=new Set(),movement={x:0,y:0},shooting={x:0,y:0},sticks=[];
const enemyBulletMaterial=new THREE.MeshBasicMaterial({color:'#ff8175'}),enemyMeshes=new Map();
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
const raycaster=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.65),intersection=new THREE.Vector3(),mouse=new THREE.Vector2();
let mouseDown=false,mouseKnown=false;
function updateMouse(e){const r=viewport.getBoundingClientRect();mouse.set((e.clientX-r.left)/viewWidth*2-1,1-(e.clientY-r.top)/viewHeight*2);mouseKnown=true;}
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')updateMouse(e);});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){updateMouse(e);mouseDown=true;renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener('pointerup',e=>{if(mouseDown&&e.pointerType==='mouse'){updateMouse(e);updateMouseAim();fire();}mouseDown=false;});renderer.domElement.addEventListener('pointercancel',()=>{mouseDown=false;});
window.addEventListener('keydown',e=>{if(isTypingTarget(e.target))return;if(isGameKey(e.code)&&e.target?.closest?.('button')&&!e.target.closest('#inventory,#round-over,#tutorial'))e.preventDefault();if(tutorialOpen||!$('#inventory').hidden)return;if(e.code==='KeyQ'&&!e.repeat){e.preventDefault();useKit();}if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();if(!e.repeat)requestDash();}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}},{capture:true});
window.addEventListener('keyup',e=>{if(isGameKey(e.code)&&keys.has(e.code))e.preventDefault();if(e.code==='Space'&&keys.has('Space'))fire();keys.delete(e.code);},{capture:true});
document.addEventListener('click',e=>releaseButtonFocus(e,document),{capture:false});
function clearInput(){keys.clear();mouseDown=false;for(const {el,state,value,thumb} of sticks){if(state.pointer!==null&&el.hasPointerCapture(state.pointer))el.releasePointerCapture(state.pointer);state.pointer=null;state.gesture=null;value.x=value.y=0;thumb.style.transform='translate(-50%,-50%)';el.classList.remove('active','aiming');}}
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();if(round&&!tutorialOpen){tickRound(round,Date.now());if(round.over)finishRound();}});

function clearBullets(){for(const b of bullets)scene.remove(b.mesh);bullets.length=0;if(weapon)weapon.projectiles.length=0;for(const m of enemyMeshes.values())scene.remove(m);enemyMeshes.clear();}
let labels=[],routeLabels=[];
const enemyName=e=>!e.type||e.type==='grunt'?'ENEMY':e.type.toUpperCase();
function makeLabel(text,point,kind,range=null,short=''){
  const el=document.createElement('div');el.className=`node-label ${kind}`;
  const marker=document.createElement('span');marker.className='node-marker';el.append(marker);
  const caption=document.createElement('span');caption.className='full-text';caption.textContent=text;el.append(caption);
  const shortEl=document.createElement('span');shortEl.className='short-text';shortEl.textContent=short;el.append(shortEl);
  $('#world-labels').append(el);
  const label={el,caption,shortEl,point,range,id:labels.length};labels.push(label);return label;
}
function setCollisions(){
  solids=[...round.level.walls,...round.level.boxes];
  if(!exitIsOpen(round))solids.push({x:round.level.exit.x,z:round.level.exit.z,w:2,d:.22});
  playerSolids=[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
}
function updateHUD(){
  $('#bag-items').textContent=bagText(round.bag);
  $('#bag-count').textContent=`BAG ${bagItems(round.bag).length}/${RULES.loot.capacity} · AT RISK${round.levelsCleared?' · CARRIED':''}`;
  renderInventory();
  const lit=round.level.nodes.filter(n=>n.active).length,open=exitIsOpen(round);
  $('#health-value').textContent=round.health;$('.health').classList.toggle('urgent',round.health<=25);
  $('#progress').textContent=`NODES ${lit}/${round.level.nodes.length} · RUN ${round.nodesLit}/${TOTAL_NODES}`;
  for(const v of world.nodes){v.label.el.classList.toggle('done',v.node.active);v.label.caption.textContent=v.node.active?'ACTIVE':v.node.shielded?'SHIELDED · STAND CLOSE':'STAND CLOSE';}
  world.exitLabel.el.classList.toggle('done',open);world.exitLabel.caption.textContent=round.cleared?'ALL LEVELS CLEARED':open?'EXIT · OPEN':'EXIT · LOCKED';
  world.setExit(open);setCollisions();
}
function labelLoot(v){v.label=makeLabel('?',new THREE.Vector3(v.loot.x,.7,v.loot.z),v.loot.marked?'loot-label marked-loot':'loot-label','loot','?');setLootText(v);}
function setLootText(v){const l=v.label,r=rarityOf(v.loot.item);l.el.dataset.rarity=v.loot.revealed?r:'unknown';
  if(!v.loot.revealed){l.caption.textContent='?';l.shortEl.textContent='?';return;}
  const n=ITEM_NAMES[v.loot.item]??'Ammo';l.caption.textContent=`◆ ${n} · COLLECT`;l.shortEl.textContent=n;}
function renderInventory(){
  const items=bagItems(round.bag),list=$('#inventory-slots');list.replaceChildren();
  $('#inventory-count').textContent=`${items.length} / ${RULES.loot.capacity} slots`;
  for(let i=0;i<RULES.loot.capacity;i++){
    const row=document.createElement('div'),name=document.createElement('span'),item=items[i];row.className='inventory-slot';name.textContent=`${i+1} · ${item?ITEM_NAMES[item]:'Empty'}`;row.append(name);
    if(item){const rr=rarityOf(item);row.dataset.rarity=rr;row.style.setProperty('--rc',RARITY_COLORS[rr]);
      if(item==='medkit'){const use=document.createElement('button');use.textContent=`Use +${RULES.rewards.medkitHealth} HP`;use.disabled=round.health>=100;use.onclick=()=>{useHealthKit(round,Date.now());updateHUD();};row.append(use);}
      const drop=document.createElement('button');drop.textContent='Drop';drop.onclick=()=>{const box=dropItem(round,item,position,Date.now());if(box){box.revealed=true;labelLoot(world.addLoot(box));};updateHUD();};row.append(drop);
    }
    list.append(row);
  }
}
$('#use-kit').onclick=()=>useKit();
$('#open-bag').onclick=()=>{if(round.over||resultPending)return;clearInput();renderInventory();$('#inventory').hidden=false;};
$('#close-bag').onclick=()=>{$('#inventory').hidden=true;clearInput();};
function renderEnemyFeedback(clock){
  for(const v of world.enemies){
    const alive=v.enemy.health>0&&v.enemy.active!==false;
    v.group.visible=alive;v.group.position.set(v.enemy.x,0,v.enemy.z);v.group.rotation.y=Math.atan2(position.x-v.enemy.x,position.z-v.enemy.z);
    v.label.point.set(v.enemy.x,1.7,v.enemy.z);const winding=alive&&v.enemy.windupAt!=null;v.label.el.classList.toggle('winding',winding);v.label.caption.textContent=`${winding?'! ':''}${enemyName(v.enemy)} · ${v.enemy.health}`;v.label.defeated=!alive;v.label.el.hidden=!alive;
    v.healthBar.setAttribute('aria-valuenow',v.enemy.health);renderHealthSegments(v.healthSegments,v.enemy.health,v.maxHealth);
    const age=clock-(v.enemy.lastHitAt??-Infinity);v.flash.defeated=age>=RULES.feedback.hitFlashMs||v.enemy.active===false;
    v.flash.point.set(v.enemy.x,.65,v.enemy.z);v.flash.el.style.opacity=`${Math.max(0,1-age/RULES.feedback.hitFlashMs)}`;
    v.flash.el.classList.toggle('flashing',!v.flash.defeated);
    v.damage.defeated=age>=RULES.feedback.damageNumberMs||v.enemy.active===false;
    v.damage.caption.textContent=`−${v.enemy.lastDamage??0}`;
    v.damage.point.set(v.enemy.x,1+Math.min(1,age/RULES.feedback.damageNumberMs)*.7,v.enemy.z);
    v.damage.el.style.opacity=`${Math.max(0,1-age/RULES.feedback.damageNumberMs)}`;
  }
}
function loadLevel(){try{loadLevelInner();}catch(e){onFatal(e);}}
function loadLevelInner(){
  hideSwap();
  world?.dispose();clearBullets();clearInput();mouseKnown=false;weapon.scavenging=null;
  position={...round.level.start};aim={x:0,z:-1};target.set(position.x,0,position.z-1);
  player.position.set(position.x,0,position.z);
  world=buildWorld(round.level,scene,{quality:QUALITY});$('#world-labels').replaceChildren();labels=[];routeLabels=[];
  dash.remaining=0;
  const spawn=moveWithActors(position,{x:1.13,z:1.13},[],round.level.walls,round.level.floors,RULES.bit.radius);
  bit=createBIT(spawn);bit.lastPlayer={...position};bit.trail=[{...position}];
  bitLabel=makeLabel('BIT',new THREE.Vector3(bit.x,1.5,bit.z),'bit-label','bit','BIT');
  for(const v of world.nodes){
    v.label=makeLabel('',new THREE.Vector3(v.node.x,1.9,v.node.z),'objective-node','node',v.node.shielded?'NODE ⛨':'NODE');
    const meter=document.createElement('div');meter.className='node-meter';meter.hidden=true;meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','Node activation');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
    const fill=document.createElement('i');meter.append(fill);v.label.el.append(meter);v.label.meter=meter;v.label.fill=fill;
  }
  hazardLabels=(round.level.hazards??[]).map(h=>({hazard:h,label:makeLabel('⚡',new THREE.Vector3(h.x,.35,h.z),'hazard-label hazard-icon')}));
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
  for(const v of world.lootBoxes)labelLoot(v);
  if(false)for(const choice of round.level.routeChoices){const label=makeLabel(`${choice.dir.x<0?'↙':'↗'} ${choice.kind==='loot'?'LOOT · SHORT ROUTE':'NODES · LONG ROUTE'}`,new THREE.Vector3(choice.sign.x,.6,choice.sign.z),choice.kind==='loot'?'choice-label loot-route':'choice-label node-route');routeLabels.push({choice,label,level:round.level});}
  combat=createCombat(round.level,Date.now());
  $('#seed-label').textContent=`SEED ${round.seed}`;
  $('#corner-name').textContent=`${round.level.number} / 3 · ${round.level.title}`;
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
  round=createRound(seed,Date.now(),launch.stats);weapon=createWeapon(RULES.loadout.ammo,launch.weapon);round.kit={...launch.kit};setupWeaponHUD();viewport.classList.remove('round-ended','damaged');hitUntil=0;$('#round-over').hidden=true;$('#time-left').textContent='8:00';$('.timer').classList.remove('urgent');loadLevel();
  if(typeof requestedSeed==='string')resetCount=round.level.choiceSide<0?1:0;
}
function finishRound(outcome=round.reason){
  if(!$('#round-over').hidden&&!resultPending)return;
  resultPending=outcome==='extraction'&&!round.over;
  /*
  latestResult=raidResult(round,weapon,outcome);
  const json=resultJSON(latestResult);
  try{localStorage.setItem('nodspel.result.json',json);}catch{}
  if(resultURL)URL.revokeObjectURL(resultURL);
  resultURL=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  $('#save-result').href=resultURL;
  $('#result-json').textContent=json;
  */
  // RaidResult v1 handoff to meta (only once the whole round is over).
  if(round.over)writeRaidResult(globalThis.localStorage,buildRaidResult(round,{launch}));
  $('#return-base').hidden=!(launch.returnUrl&&round.over);
  $('#inventory').hidden=true;
  $('#continue-raid').hidden=!resultPending;$('#extract-raid').hidden=!resultPending;
  $('#new-round').hidden=!!launch.returnUrl;
  $('#round-over-eyebrow').textContent=resultPending?'LEVEL CLEAR · EXTRACT TO SECURE, OR CONTINUE AT RISK':'ROUND OVER';
  weapon.scavenging=null;clearInput();clearBullets();viewport.classList.add('round-ended');$('#round-over').hidden=false;
  const summary=roundSummary(round),seconds=Math.ceil(summary.remainingMs/1000);
  $('#round-over-title').textContent=outcome==='extraction'?'Level cleared':summary.reason==='complete'?'All levels cleared':summary.reason==='extract'?'Extracted':summary.reason==='abandon'?'Raid abandoned':summary.reason==='death'?'You died':'Time is up';
  $('#summary-enemies').textContent=summary.enemiesDefeated;
  $('#summary-levels').textContent=`${summary.levelsCleared} / 3`;$('#summary-nodes').textContent=`${summary.nodesLit} / ${TOTAL_NODES}`;
  $('#summary-time').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  // $('#summary-extracted').textContent=latestResult.extracted.join(' · ')||'Empty';
  // $('#summary-lost').textContent=latestResult.lost.join(' · ')||'Empty';
  $('#summary-extracted').textContent=outcome==='extraction'?`Not yet · carrying ${round.exitLoot.map(id=>ITEM_NAMES[id]).join(' · ')||'nothing'} at risk`:bagText(round.extracted);
  $('#summary-lost').textContent=bagText(round.lost);
  updateHUD();
  // Static hosting has no writable result endpoint. Export the same result
  // as a local file; the visible link also works if automatic downloads stop.
  // $('#save-result').click();
}
$('#return-base').addEventListener('click',()=>{if(!round?.over||!launch.returnUrl)return;writeRaidResult(globalThis.localStorage,buildRaidResult(round,{launch}));location.assign(launch.returnUrl);});
$('#reset').hidden=!!launch.returnUrl;$('#abandon').hidden=!launch.returnUrl;
$('#abandon').addEventListener('click',()=>{if(!round||round.over)return;if(!confirm('Abandon the raid? Your bag and equipment count as lost.'))return;if(abandonRound(round,Date.now()))finishRound();});
$('#extract-raid').addEventListener('click',()=>{if(!resultPending)return;if(extractRound(round,Date.now()))$('#round-over').hidden=true;finishRound();});
$('#reset').addEventListener('click',reset);$('#new-round').addEventListener('click',reset);
$('#continue-raid').addEventListener('click',()=>{tickRound(round,Date.now());if(round.over){finishRound();return;}resultPending=false;$('#round-over').hidden=true;viewport.classList.remove('round-ended');loadLevel();});
function fire(){
  if(!round||round.over||resultPending||tutorialOpen||!$('#inventory').hidden)return;
  tickRound(round,Date.now());if(round.over){finishRound();return;}
  const clock=Date.now(),shot=fireAimedWeapon(weapon,round,position,aim,clock,playerSolids);
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
function renderKitHUD(){const b=$('#use-kit');if(!b)return;const n=(round.kit?.medkit??0)+(round.bag.medkit??0);b.querySelector('b').textContent=n;b.disabled=!n||round.over||round.health>=(round.maxHealth??100);b.setAttribute('aria-label',`Use medkit (Q) · ${n} left`);}
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
  $('#reload-time').textContent=`${weapon.ammo}/${W.capacity} · ${weapon.reserve===Infinity?'∞':weapon.reserve}${reloading?` · +1 ${(remaining/1000).toFixed(1)} s`:''}`;
  // Scavenging is paused while reserve ammunition is unlimited.
  $('#player-health').setAttribute('aria-valuenow',round.health);
  renderHealthSegments(playerHealthSegments,round.health,round.maxHealth,10);$('#player-health').hidden=round.health<=0;
  $('#player-health').classList.toggle('urgent',round.health<=25);
  labelPoint.set(position.x,1.65,position.z).project(camera);
  $('#player-health').style.left=`${(labelPoint.x*.5+.5)*viewWidth}px`;
  $('#player-health').style.top=`${(-labelPoint.y*.5+.5)*viewHeight}px`;
}
function resize(){viewWidth=viewport.clientWidth;viewHeight=viewport.clientHeight;renderer.setSize(viewWidth,viewHeight);const h=6,aspect=viewWidth/viewHeight;camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix();clearInput();}
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(viewport);resize();
const invRoot2=1/Math.sqrt(2),labelPoint=new THREE.Vector3();
function screenToWorld(x,y){return {x:(x+y)*invRoot2,z:(y-x)*invRoot2};}
const HUD_SELECTORS='.round-hud,#level-corner,.bag-panel,#dash,#abandon,#use-kit,#ammo-hud,#weapon-name';
let hudRects=[],hudRectsAt=0;
function refreshHudRects(now){if(now-hudRectsAt<500)return;hudRectsAt=now;
  const box=$('#game').getBoundingClientRect();
  hudRects=[...document.querySelectorAll(HUD_SELECTORS)].filter(e=>!e.hidden&&e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect();return {left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top};}).filter(r=>r.right>r.left);}
function renderLabels(){
  refreshHudRects(performance.now());
  const items=labels.filter(l=>l.range&&!l.defeated).map(l=>({id:l.id,kind:l.range,x:l.point.x,z:l.point.z,
    force:l.range==='enemy'?(l.el.classList.contains('locked')||l.el.classList.contains('winding')?'full':undefined):l===bitLabel?(bit?.healing?'full':'hidden'):(l===world.exitLabel&&!exitIsOpen(round)&&Math.hypot(l.point.x-position.x,l.point.z-position.z)>3.4?'dot':undefined)}));
  const plan=planLabels(items,position);
  for(const l of labels){
    labelPoint.copy(l.point).project(camera);
    const sx=(labelPoint.x*.5+.5)*viewWidth,sy=(-labelPoint.y*.5+.5)*viewHeight;
    const mode=l.range?plan.get(l.id)??'hidden':'full';
    if(l.el.dataset.mode!==mode){l.el.dataset.mode=mode;l.size=null;}
    if(!l.size&&!l.el.hidden&&l.el.offsetWidth)l.size=[l.el.offsetWidth,l.el.offsetHeight];
    const [lw,lh]=l.size??[mode==='dot'?10:80,mode==='dot'?10:24];
    l.el.hidden=l.defeated||l.obscured||mode==='hidden'||Math.abs(labelPoint.x)>.95||Math.abs(labelPoint.y)>.9||overHUD(sx,sy,hudRects,8,lw,lh);
    l.sx=sx;l.sy=sy;
    if(!l.el.hidden){l.el.style.left=`${sx}px`;l.el.style.top=`${sy}px`;
      if(l.range)l.el.style.opacity=labelOpacity(l.range,Math.hypot(l.point.x-position.x,l.point.z-position.z)).toFixed(2);}
  }
  // shock-pad icons have priority; stacked enemy labels shift up (or hide) so nothing overlaps
  const boxes=[];
  for(const {label} of hazardLabels)if(!label.el.hidden)boxes.push({id:label.id,x:label.sx,y:label.sy+18,w:40,h:40,fixed:true});
  for(const l of labels)if(l.range==='enemy'&&!l.el.hidden){const [w,h]=l.size??[60,14];boxes.push({id:l.id,x:l.sx,y:l.sy,w,h});}
  const shifts=deoverlap(boxes);
  for(const l of labels)if(l.range==='enemy'&&!l.el.hidden){const dy=shifts.get(l.id);if(dy===null)l.el.hidden=true;else if(dy)l.el.style.top=`${l.sy-dy}px`;}
}
let previous=performance.now();
// Screenshot/debug hook (only with ?debug): teleport, open the exit, jump to a level.
if(new URLSearchParams(location.search).has('debug'))window.__NR={
  teleport(x,z){position={x,z};},state:()=>({position,level:round.level}),
  openExit(){for(const n of round.level.nodes)n.active=true;updateHUD();},bagFull:()=>{round.bagFull=round.bagFull||{boxId:round.level.lootBoxes.find(b=>!b.collected)?.id,item:round.level.lootBoxes.find(b=>!b.collected)?.item};showSwap();},crash:()=>onFatal(new Error('debug crash')),info:()=>({geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures,calls:renderer.info.render.calls,children:scene.children.length,labels:document.querySelectorAll('#world-labels > *').length,level:round.level.number,over:round.over}),hz:()=>hazardLabels.map(h=>h.label.el.dataset.state),
  async goLevel(n){const {generateLevel}=await import('./levels.js?v=1.37.1');round.level=generateLevel(n,round.seed);loadLevel();}};

// ---- Full bag: flash + toast + compact swap row (only at the moment it happens) ----
let bitHintUntil=0;const HINT_KEY='nr_bagfull_hint';
function showSwap(){
  const info=round.bagFull;if(!info)return;
  const panel=$('.bag-panel');panel?.classList.remove('bag-full-flash');void panel?.offsetWidth;panel?.classList.add('bag-full-flash');
  const box=round.level.lootBoxes.find(b=>b.id===info.boxId);if(box&&!box.revealed){box.revealed=true;const v=world.lootBoxes.find(x=>x.loot===box);if(v){world.applyReveal(v);setLootText(v);}}
  let el=$('#swap-row');if(!el){el=document.createElement('section');el.id='swap-row';el.className='swap-row';el.setAttribute('role','dialog');el.setAttribute('aria-label','Bag full – swap');$('#viewport').append(el);}
  el.replaceChildren();
  const head=document.createElement('div');head.className='swap-head';head.innerHTML='<b>Bag full – swap?</b><span>Tap an item to drop it</span>';
  const close=document.createElement('button');close.className='swap-close';close.type='button';close.textContent='✕';close.setAttribute('aria-label','Keep bag');close.onclick=hideSwap;head.append(close);el.append(head);
  const row=document.createElement('div');row.className='swap-items';
  const chip=(id,isNew)=>{const b=document.createElement(isNew?'div':'button');const r=rarityOf(id);b.className='swap-item'+(isNew?' swap-new':'');b.dataset.rarity=r;b.style.setProperty('--rc',RARITY_COLORS[r]);b.textContent=ITEM_NAMES[id]??id;return b;};
  for(const id of bagItems(round.bag)){const b=chip(id,false);b.type='button';b.onclick=()=>{const d=swapLoot(round,info.boxId,id,Date.now());if(d){labelLoot(world.addLoot(d));for(const v of world.lootBoxes)if(v.loot.id===info.boxId)v.loot.collected=true;}hideSwap();updateHUD();};row.append(b);}
  const arrow=document.createElement('span');arrow.className='swap-arrow';arrow.textContent='⇄';row.append(arrow,chip(info.item,true));el.append(row);el.hidden=false;
  clearTimeout(showSwap.t);showSwap.t=setTimeout(hideSwap,6000);
  try{const n=+(localStorage.getItem(HINT_KEY)||0);if(n<2){localStorage.setItem(HINT_KEY,String(n+1));bitHintUntil=Date.now()+3500;}}catch{}
}
function hideSwap(){const el=document.getElementById('swap-row');if(el)el.hidden=true;if(round)round.bagFull=null;}
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
  const seconds=Math.ceil(round.remainingMs/1000),time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  if($('#time-left').textContent!==time)$('#time-left').textContent=time;
  $('.timer').classList.toggle('urgent',seconds<=60);
  if(round.over)finishRound();
  if(!round.over&&!resultPending){
    const positionBefore={...position},dashing=dash.remaining>0;
    let sx=movement.x,sy=movement.y;
    sx+=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    sy+=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
    const magnitude=Math.hypot(sx,sy);
    if(magnitude>.12){const scale=Math.min(1,magnitude)/magnitude,delta=screenToWorld(sx*scale,sy*scale);walkDirection=screenToWorld(sx/magnitude,sy/magnitude);if(dash.remaining===0)position=moveWithActors(position,{x:delta.x*round.stats.speed*dt,z:delta.z*round.stats.speed*dt},round.level.enemies,playerSolids,round.level.floors,RULES.playerRadius);}
    if(!round.over&&!resultPending)round.telemetry.distanceM+=Math.hypot(position.x-positionBefore.x,position.z-positionBefore.z);
    position=stepDash(dash,position,dt,round.level.enemies,playerSolids,round.level.floors);
    const stickDirection=stepAim(sticks[1].state.gesture,dt);
    if(stickDirection)aim=screenToWorld(stickDirection.x,stickDirection.y);
    else if(mouseKnown)updateMouseAim();
    if(stepWeapon(weapon,round,clock,dt,playerSolids))updateHUD();
    const activeShots=new Set(weapon.projectiles.map(b=>b.id));
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(!activeShots.has(b.shot.id)){scene.remove(b.mesh);bullets.splice(i,1);}else b.mesh.position.set(b.shot.x,.65,b.shot.z);}
    if(collectLoot(round,position,clock,weapon)){updateHUD();if(round.bagFull)showSwap();}
    if(stepNodeInteraction(round,weapon,position,clock,solids))updateHUD();
    const healthBefore=round.health;
    stepCombat(round,combat,position,clock,dt,playerSolids);
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
  bitScreen.material.color.set(bit.healing?'#15d6be':'#75cfcc');
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
  playerRing.material.color.set(dash.remaining>0?'#15d6be':'#b4d8d0');
  playerRing.scale.setScalar(dash.remaining>0?1.35:1);
  const aliveProjectiles=new Set(round.over?[]:combat.projectiles.map(b=>b.id));
  for(const [id,m] of enemyMeshes)if(!aliveProjectiles.has(id)){scene.remove(m);enemyMeshes.delete(id);}
  if(!round.over)for(const b of combat.projectiles){let m=enemyMeshes.get(b.id);if(!m){m=new THREE.Mesh(bulletGeometry,enemyBulletMaterial);scene.add(m);enemyMeshes.set(b.id,m);}m.position.set(b.x,.65,b.z);m.rotation.y=Math.atan2(b.dx,b.dz);}
  renderEnemyFeedback(clock);
  for(const v of world.nodes){const visible=v.node.active||traceTargets(position,v.node,round.level.walls,[v.node])?.kind==='node';v.group.visible=visible;v.label.obscured=!visible;
    const hold=round.nodeInteraction?.id===v.node.id?round.nodeInteraction:null;
    setNodeHold(v,hold?.progress??0);
    v.label.el.classList.toggle('charging',!!hold);
    v.label.meter.hidden=!hold;v.label.meter.setAttribute('aria-valuenow',Math.round((hold?.progress??0)*100));v.label.fill.style.width=`${(hold?.progress??0)*100}%`;
    v.label.caption.textContent=v.node.active?'ACTIVE':v.node.shielded?'SHIELDED · STAND CLOSE':'STAND CLOSE';
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
  for(const v of world.enemies){v.label.el.classList.toggle('locked',v.enemy===assisted.target);if(v.enemy===assisted.target)v.label.caption.textContent=`⌖ ${enemyName(v.enemy)} · ${v.enemy.health}`;}
  const facing=facingDirection(holding,walkDirection,displayAim);
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
  for(const cross of healCrosses){
    cross.group.visible=bit.healing&&round.health<100&&!round.over&&!resultPending;
    if(cross.group.visible){const life=(elapsed/ .65+cross.phase)%1,angle=cross.phase*Math.PI*2;cross.group.position.set(position.x+Math.cos(angle)*.9,.45+life*1.25,position.z+Math.sin(angle)*.9);cross.group.quaternion.copy(camera.quaternion);cross.material.opacity=Math.sin(life*Math.PI);cross.group.scale.setScalar(.8+life*.25);}
  }
  sun.position.copy(target).add(new THREE.Vector3(-8,18,10));sun.target.position.copy(target);
  world.animate(elapsed);renderLabels();renderWeaponHUD(clock);renderer.render(scene,camera);requestAnimationFrame(frame);
}
reset(new URLSearchParams(location.search).get('seed'));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();$('#loading').hidden=true;requestAnimationFrame(frame);
// Landscape only: on the first tap go fullscreen and lock orientation where supported (Android). iOS shows the .rotate screen.
{const once=()=>{document.removeEventListener('pointerdown',once,true);try{const el=document.documentElement,fs=el.requestFullscreen||el.webkitRequestFullscreen,lock=()=>{try{screen.orientation?.lock?.('landscape')?.catch?.(()=>{});}catch{}};if(fs&&!document.fullscreenElement){const p=fs.call(el,{navigationUI:'hide'});p?.then?p.then(lock,lock):lock();}else lock();}catch{}};document.addEventListener('pointerdown',once,true);}
