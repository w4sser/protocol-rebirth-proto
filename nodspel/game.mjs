import * as THREE from './vendor/three.module.js';
import {movePlayer,traceTargets,aimEndpoint} from './physics.mjs?v=1.14.0';
import {createRound,tickRound,enterExit,exitIsOpen,roundSummary,collectLoot,dropItem,useHealthKit,stepNodeInteraction} from './round.js?v=1.14.0';
import {createCombat,stepCombat} from './combat.js?v=1.14.0';
import {buildWorld} from './world.js?v=1.14.0';
import {RULES} from './levels.js?v=1.14.0';
import {createWeapon,fireWeapon,stepWeapon,assistAim} from './weapon.js?v=1.14.0';
import {beginAim,dragAim,releaseAim} from './controls.js?v=1.14.0';
// import {readOrder,raidResult,resultJSON} from './raid.js?v=1.14.0';
import {bagText,bagItems,ITEM_NAMES} from './raid.js?v=1.14.0';
// import {stepScavenging} from './scavenging.js?v=1.14.0';
import {routeComplete} from './objectives.js?v=1.14.0';

// File integration is paused; no order fetch or result export runs.
/*
const orderResponse=await fetch('./order.json?v=1.14.0');
if(!orderResponse.ok)throw new Error('The raid order could not be loaded.');
const raidOrder=readOrder(await orderResponse.json());
let latestResult=null,resultURL=null;
*/
let resultPending=false;

const $=s=>document.querySelector(s),viewport=$('#viewport');
let viewWidth=viewport.clientWidth,viewHeight=viewport.clientHeight;
const scene=new THREE.Scene();scene.background=new THREE.Color('#14191c');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
$('#game').appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-20,20,6,-6,.1,100);
const target=new THREE.Vector3(),cameraOffset=new THREE.Vector3(17,23,17);
scene.add(new THREE.HemisphereLight('#d8e8f1','#37414c',2.3));
const sun=new THREE.DirectionalLight('#fff0d7',3.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:50});sun.shadow.normalBias=.045;scene.add(sun,sun.target);

const cube=new THREE.BoxGeometry(1,1,1),materials={};
function box(x,y,z,w,h,d,color,parent){
  const m=new THREE.Mesh(cube,materials[color] ||= new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12}));
  m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
const player=new THREE.Group();scene.add(player);
box(0,.5,0,.62,.7,.62,'#bac4c7',player);box(0,.98,0,.48,.29,.46,'#e0e7e5',player);
box(0,.97,.24,.32,.075,.025,'#2c4a54',player);box(0,.65,.58,.16,.16,.67,'#242d34',player);
box(0,.67,.88,.18,.18,.12,'#8cf5df',player);box(-.23,.14,0,.19,.26,.42,'#27343d',player);box(.23,.14,0,.19,.26,.42,'#27343d',player);
const playerRing=new THREE.Mesh(new THREE.RingGeometry(.48,.53,48),new THREE.MeshBasicMaterial({color:'#b4d8d0',transparent:true,opacity:.55,side:THREE.DoubleSide}));
playerRing.rotation.x=-Math.PI/2;scene.add(playerRing);
const aimLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#d3fff3',transparent:true,opacity:.95,depthTest:false,depthWrite:false}));aimLine.renderOrder=3;scene.add(aimLine);
const rangeRing=new THREE.Mesh(new THREE.RingGeometry(RULES.weapon.range-.04,RULES.weapon.range,96),new THREE.MeshBasicMaterial({color:'#8cf5df',transparent:true,opacity:.85,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
rangeRing.renderOrder=2;rangeRing.rotation.x=-Math.PI/2;rangeRing.visible=false;scene.add(rangeRing);
const lockMarker=new THREE.Mesh(new THREE.RingGeometry(.64,.73,32),new THREE.MeshBasicMaterial({color:'#ffe0a1',transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));lockMarker.rotation.x=-Math.PI/2;lockMarker.renderOrder=4;lockMarker.visible=false;scene.add(lockMarker);
const bulletGeometry=new THREE.BoxGeometry(RULES.weapon.shotRadius*2,.12,.38),bulletMaterial=new THREE.MeshBasicMaterial({color:'#b5fff1'});
const bullets=[],keys=new Set(),movement={x:0,y:0},shooting={x:0,y:0},sticks=[];
const enemyBulletMaterial=new THREE.MeshBasicMaterial({color:'#ff8175'}),enemyMeshes=new Map();
let round,world,combat,weapon,position,solids=[],playerSolids=[],aim={x:0,z:-1},elapsed=0,toastUntil=0,resetCount=0,hitUntil=0;

// Independent pointer capture lets both thumbs work at the same time.
function setupStick(selector,value,onShot){
  const el=$(selector),thumb=el.querySelector('.thumb'),state={pointer:null,gesture:null};sticks.push({el,state,value,thumb});
  function update(e){
    const r=el.getBoundingClientRect(),limit=r.width*.32;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
    const length=Math.hypot(x,y);if(length>limit){x*=limit/length;y*=limit/length;}
    value.x=x/limit;value.y=y/limit;thumb.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;
    if(onShot&&state.gesture){dragAim(state.gesture,e.clientX,e.clientY);el.classList.toggle('aiming',!!state.gesture.direction);}
  }
  el.addEventListener('pointerdown',e=>{if(state.pointer!==null || round?.over || !$('#inventory').hidden)return;e.preventDefault();state.pointer=e.pointerId;state.gesture=onShot?beginAim(e.clientX,e.clientY):null;el.setPointerCapture(e.pointerId);el.classList.add('active');if(!onShot)update(e);});
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
window.addEventListener('keydown',e=>{if(!$('#inventory').hidden)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&keys.has('Space'))fire();keys.delete(e.code);});
function clearInput(){keys.clear();mouseDown=false;for(const {el,state,value,thumb} of sticks){if(state.pointer!==null&&el.hasPointerCapture(state.pointer))el.releasePointerCapture(state.pointer);state.pointer=null;state.gesture=null;value.x=value.y=0;thumb.style.transform='translate(-50%,-50%)';el.classList.remove('active','aiming');}}
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();if(round){tickRound(round,Date.now());if(round.over)finishRound();}});

function clearBullets(){for(const b of bullets)scene.remove(b.mesh);bullets.length=0;if(weapon)weapon.projectiles.length=0;for(const m of enemyMeshes.values())scene.remove(m);enemyMeshes.clear();}
let labels=[],routeLabels=[];
function makeLabel(text,point,kind){
  const el=document.createElement('div');el.className=`node-label ${kind}`;
  const marker=document.createElement('span');marker.className='node-marker';el.append(marker);
  const caption=document.createElement('span');caption.textContent=text;el.append(caption);$('#world-labels').append(el);
  const label={el,caption,point};labels.push(label);return label;
}
function setCollisions(){
  solids=[...round.level.walls,...round.level.boxes];
  if(!exitIsOpen(round))solids.push({x:round.level.exit.x,z:round.level.exit.z,w:2,d:.22});
  playerSolids=[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4})),...round.level.enemies.filter(e=>e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
}
function updateHUD(){
  $('#bag-items').textContent=bagText(round.bag);
  $('#bag-count').textContent=`BAG ${bagItems(round.bag).length}/${RULES.loot.capacity} · AT RISK`;
  renderInventory();
  $('#secured-items').textContent=bagText(round.extracted);
  const lit=round.level.nodes.filter(n=>n.active).length,open=exitIsOpen(round);
  $('#level-counter').textContent=`LEVEL ${round.level.number} / 3`;
  $('#health-value').textContent=round.health;$('.health').classList.toggle('urgent',round.health<=25);
  $('#progress').textContent=`${lit} / ${round.level.nodes.length}`;
  $('.mission').classList.toggle('done',open);
  $('#mission-label').textContent=round.cleared?'ALL LEVELS CLEARED':`LEVEL ${round.level.number} · ${round.level.title.toUpperCase()}`;
  $('#status').textContent=round.cleared?'Three levels cleared':open?'The exit is open':round.level.nodes.length===1?'Activate the node':'Activate all nodes';
  const remainingEnemies=round.level.enemies.filter(e=>e.health>0&&e.active!==false).length;
  $('#hint').textContent=bagItems(round.bag).length>=RULES.loot.capacity?'Bag full · Open bag to drop or use an item.':open?'Reach the exit to extract your bag.':`${remainingEnemies} ${remainingEnemies===1?'enemy':'enemies'} left · Walk near crates to collect.`;
  if(round.over){$('#status').textContent=round.reason==='complete'?'All levels cleared':round.reason==='death'?'You died':'Time is up';$('#hint').textContent='A new round starts fresh.';}
  for(const v of world.nodes){v.label.el.classList.toggle('done',v.node.active);v.label.caption.textContent=`NODE ${v.node.id.split('-')[1]}${v.node.active?' · ACTIVE':''}`;}
  world.exitLabel.el.classList.toggle('done',open);world.exitLabel.caption.textContent=round.cleared?'ALL LEVELS CLEARED':open?'EXIT · OPEN':'EXIT · LOCKED';
  world.setExit(open);setCollisions();
}
function labelLoot(v){v.label=makeLabel(`◆ ${ITEM_NAMES[v.loot.item]??'Ammo'} · COLLECT`,new THREE.Vector3(v.loot.x,1.4,v.loot.z),v.loot.marked?'loot-label marked-loot':'loot-label');}
function renderInventory(){
  const items=bagItems(round.bag),list=$('#inventory-slots');list.replaceChildren();
  $('#inventory-count').textContent=`${items.length} / ${RULES.loot.capacity} slots`;
  for(let i=0;i<RULES.loot.capacity;i++){
    const row=document.createElement('div'),name=document.createElement('span'),item=items[i];row.className='inventory-slot';name.textContent=`${i+1} · ${item?ITEM_NAMES[item]:'Empty'}`;row.append(name);
    if(item){
      if(item==='medkit'){const use=document.createElement('button');use.textContent=`Use +${RULES.rewards.medkitHealth} HP`;use.disabled=round.health>=100;use.onclick=()=>{useHealthKit(round,Date.now());updateHUD();};row.append(use);}
      const drop=document.createElement('button');drop.textContent='Drop';drop.onclick=()=>{const box=dropItem(round,item,position,Date.now());if(box)labelLoot(world.addLoot(box));updateHUD();};row.append(drop);
    }
    list.append(row);
  }
}
$('#open-bag').onclick=()=>{if(round.over||resultPending)return;clearInput();renderInventory();$('#inventory').hidden=false;};
$('#close-bag').onclick=()=>{$('#inventory').hidden=true;clearInput();};
function loadLevel(){
  world?.dispose();clearBullets();clearInput();mouseKnown=false;weapon.scavenging=null;
  position={...round.level.start};aim={x:0,z:-1};target.set(position.x,0,position.z-1);
  player.position.set(position.x,0,position.z);
  world=buildWorld(round.level,scene);$('#world-labels').replaceChildren();labels=[];routeLabels=[];
  for(const v of world.nodes){
    v.label=makeLabel('',new THREE.Vector3(v.node.x,1.9,v.node.z),'');
    const meter=document.createElement('div');meter.className='node-meter';meter.hidden=true;meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','Node activation');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
    const fill=document.createElement('i');meter.append(fill);v.label.el.append(meter);v.label.meter=meter;v.label.fill=fill;
  }
  world.exitLabel=makeLabel('',new THREE.Vector3(round.level.exit.x,1.8,round.level.exit.z),'exit-label');
  for(const room of round.level.rooms)makeLabel(room.name.toUpperCase(),new THREE.Vector3(room.x,.1,room.z-room.d/2+1),'room-label');
  for(const v of world.enemies)v.label=makeLabel(`ENEMY · ${v.enemy.health}`,new THREE.Vector3(v.enemy.x,1.7,v.enemy.z),'enemy-label');
  for(const v of world.lootBoxes)labelLoot(v);
  for(const choice of round.level.routeChoices){const label=makeLabel(`${choice.dir.x<0?'↙':'↗'} ${choice.kind==='loot'?'LOOT · SHORT ROUTE':'NODES · LONG ROUTE'}`,new THREE.Vector3(choice.sign.x,.6,choice.sign.z),choice.kind==='loot'?'choice-label loot-route':'choice-label node-route');routeLabels.push({choice,label,level:round.level});}
  combat=createCombat(round.level,Date.now());
  $('#seed-label').textContent=`SEED ${round.seed}`;
  $('#corner-name').textContent=`${round.level.number} / 3 · ${round.level.title}`;
  $('#intro-number').textContent=`LEVEL ${round.level.number} / 3`;
  $('#intro-name').textContent=round.level.title;
  $('#intro-seed').textContent=`SEED ${round.seed}`;
  // $('#intro-order').textContent=`ORDER: ${round.order.objective.join(' + ')} · ${round.order.loadout.weapon} · ${round.order.loadout.ammo} rounds · ${round.order.health} health`;
  updateHUD();
  $('#level-toast').hidden=false;$('#level-corner').hidden=true;toastUntil=Date.now()+3000;
}
function reset(requestedSeed){
  const seed=typeof requestedSeed==='string'&&requestedSeed?requestedSeed.slice(0,64):`${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8,'0')}-${++resetCount}`;
  const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState(null,'',url);
  resultPending=false;$('#inventory').hidden=true;
  // latestResult=null;
  // round=createRound(seed,Date.now(),raidOrder);weapon=createWeapon(round.order.loadout.ammo);
  round=createRound(seed,Date.now());weapon=createWeapon(RULES.loadout.ammo);viewport.classList.remove('round-ended','damaged');hitUntil=0;$('#round-over').hidden=true;$('#time-left').textContent='8:00';$('.timer').classList.remove('urgent');loadLevel();
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
  $('#inventory').hidden=true;
  $('#continue-raid').hidden=!resultPending;
  $('#round-over-eyebrow').textContent=resultPending?'THE EXIT EXTRACTED YOUR BAG':'ROUND OVER';
  weapon.scavenging=null;clearInput();clearBullets();viewport.classList.add('round-ended');$('#round-over').hidden=false;
  const summary=roundSummary(round),seconds=Math.ceil(summary.remainingMs/1000);
  $('#round-over-title').textContent=outcome==='extraction'?'Extraction complete':summary.reason==='complete'?'All levels cleared':summary.reason==='death'?'You died':'Time is up';
  $('#summary-enemies').textContent=summary.enemiesDefeated;
  $('#summary-levels').textContent=`${summary.levelsCleared} / 3`;$('#summary-nodes').textContent=`${summary.nodesLit} / 6`;
  $('#summary-time').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  // $('#summary-extracted').textContent=latestResult.extracted.join(' · ')||'Empty';
  // $('#summary-lost').textContent=latestResult.lost.join(' · ')||'Empty';
  $('#summary-extracted').textContent=outcome==='extraction'?(round.exitLoot.map(id=>ITEM_NAMES[id]).join(' · ')||'Empty'):bagText(round.extracted);
  $('#summary-lost').textContent=bagText(round.lost);
  $('#level-toast').hidden=true;updateHUD();
  // Static hosting has no writable result endpoint. Export the same result
  // as a local file; the visible link also works if automatic downloads stop.
  // $('#save-result').click();
}
$('#reset').addEventListener('click',reset);$('#new-round').addEventListener('click',reset);
$('#continue-raid').addEventListener('click',()=>{tickRound(round,Date.now());if(round.over){finishRound();return;}resultPending=false;$('#round-over').hidden=true;viewport.classList.remove('round-ended');loadLevel();});
function fire(){
  if(!round||round.over||resultPending||!$('#inventory').hidden)return;
  tickRound(round,Date.now());if(round.over){finishRound();return;}
  const assisted=assistAim(position,aim,[...round.level.enemies,...round.level.nodes],solids);
  const shot=fireWeapon(weapon,position,assisted.direction,Date.now());
  if(!shot){$('#ammo-hud').classList.add('empty');return;}
  const mesh=new THREE.Mesh(bulletGeometry,bulletMaterial);mesh.position.set(shot.x,.65,shot.z);mesh.rotation.y=Math.atan2(shot.dx,shot.dz);scene.add(mesh);bullets.push({shot,mesh});
}
function updateMouseAim(){
  raycaster.setFromCamera(mouse,camera);
  if(raycaster.ray.intersectPlane(ground,intersection)){const dx=intersection.x-position.x,dz=intersection.z-position.z,l=Math.hypot(dx,dz);if(l>.1)aim={x:dx/l,z:dz/l};}
}
function renderWeaponHUD(clock){
  const reloading=weapon.reloadAt!==null&&!round.over;
  const remaining=reloading?Math.max(0,weapon.reloadAt-clock):0;
  const fraction=reloading?1-remaining/RULES.weapon.reloadMs:0;
  $('#ammo-hud').classList.toggle('empty',weapon.ammo===0);
  $('#ammo-hud').setAttribute('aria-label',`Magazine: ${weapon.ammo} of ${RULES.weapon.capacity} · Reserve: ${weapon.reserve===Infinity?'Unlimited':weapon.reserve}`);
  for(const [i,el] of [...document.querySelectorAll('.ammo-slot')].entries()){
    el.classList.toggle('loaded',i<weapon.ammo);el.classList.toggle('refilling',i===weapon.ammo&&reloading);
    el.style.setProperty('--fill',`${i<weapon.ammo?100:i===weapon.ammo?fraction*100:0}%`);
  }
  $('#reload-time').textContent=round.over?'':`${weapon.ammo}/${RULES.weapon.capacity} · ${weapon.reserve===Infinity?'∞':weapon.reserve}${reloading?` · +1 ${(remaining/1000).toFixed(1)} s`:''}`;
  // Scavenging is paused while reserve ammunition is unlimited.
  $('#player-health').setAttribute('aria-valuenow',round.health);
  $('#player-health-fill').style.width=`${round.health}%`;
  $('#player-health').classList.toggle('urgent',round.health<=25);
  labelPoint.set(position.x,1.65,position.z).project(camera);
  $('#player-health').style.left=`${(labelPoint.x*.5+.5)*viewWidth}px`;
  $('#player-health').style.top=`${(-labelPoint.y*.5+.5)*viewHeight}px`;
}
function resize(){viewWidth=viewport.clientWidth;viewHeight=viewport.clientHeight;renderer.setSize(viewWidth,viewHeight);const h=6,aspect=viewWidth/viewHeight;camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix();clearInput();}
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(viewport);resize();
const invRoot2=1/Math.sqrt(2),labelPoint=new THREE.Vector3();
function screenToWorld(x,y){return {x:(x+y)*invRoot2,z:(y-x)*invRoot2};}
function renderLabels(){
  for(const l of labels){labelPoint.copy(l.point).project(camera);l.el.hidden=l.defeated||l.obscured||Math.abs(labelPoint.x)>.95||Math.abs(labelPoint.y)>.9;if(!l.el.hidden){l.el.style.left=`${(labelPoint.x*.5+.5)*viewWidth}px`;l.el.style.top=`${(-labelPoint.y*.5+.5)*viewHeight}px`;}}
}
let previous=performance.now();
function frame(now){
  const dt=Math.min((now-previous)/1000,.04);previous=now;elapsed+=dt;const clock=Date.now();tickRound(round,clock);
  const seconds=Math.ceil(round.remainingMs/1000),time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  if($('#time-left').textContent!==time)$('#time-left').textContent=time;
  $('.timer').classList.toggle('urgent',seconds<=60);
  if(round.over)finishRound();
  if(!round.over&&!resultPending){
    let sx=movement.x,sy=movement.y;
    sx+=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    sy+=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
    const magnitude=Math.hypot(sx,sy);
    if(magnitude>.12){const scale=Math.min(1,magnitude)/magnitude,delta=screenToWorld(sx*scale,sy*scale);position=movePlayer(position,{x:delta.x*4.5*dt,z:delta.z*4.5*dt},playerSolids,round.level.floors,.36);}
    const stickDirection=sticks[1].state.gesture?.direction;
    if(stickDirection)aim=screenToWorld(stickDirection.x,stickDirection.y);
    else if(mouseKnown)updateMouseAim();
    if(stepWeapon(weapon,round,clock,dt,solids))updateHUD();
    const activeShots=new Set(weapon.projectiles.map(b=>b.id));
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(!activeShots.has(b.shot.id)){scene.remove(b.mesh);bullets.splice(i,1);}else b.mesh.position.set(b.shot.x,.65,b.shot.z);}
    if(collectLoot(round,position,clock,weapon))updateHUD();
    if(stepNodeInteraction(round,weapon,position,clock,solids))updateHUD();
    const healthBefore=round.health;
    stepCombat(round,combat,position,clock,dt,[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))]);
    // if(stepScavenging(weapon,round,position,clock,[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))],{moving:magnitude>.12,hit:round.health<healthBefore}))updateHUD();
    setCollisions();
    if(round.health!==healthBefore){hitUntil=clock+200;updateHUD();}
    if(round.over)finishRound();
    const result=enterExit(round,position,clock);
    if(result)finishRound('extraction');
  }
  viewport.classList.toggle('damaged',clock<hitUntil);
  const aliveProjectiles=new Set(round.over?[]:combat.projectiles.map(b=>b.id));
  for(const [id,m] of enemyMeshes)if(!aliveProjectiles.has(id)){scene.remove(m);enemyMeshes.delete(id);}
  if(!round.over)for(const b of combat.projectiles){let m=enemyMeshes.get(b.id);if(!m){m=new THREE.Mesh(bulletGeometry,enemyBulletMaterial);scene.add(m);enemyMeshes.set(b.id,m);}m.position.set(b.x,.65,b.z);m.rotation.y=Math.atan2(b.dx,b.dz);}
  for(const v of world.enemies){v.group.visible=v.enemy.health>0&&v.enemy.active!==false;v.group.position.set(v.enemy.x,0,v.enemy.z);v.group.rotation.y=Math.atan2(position.x-v.enemy.x,position.z-v.enemy.z);v.label.point.set(v.enemy.x,1.7,v.enemy.z);v.label.caption.textContent=`ENEMY · ${v.enemy.health}`;v.label.defeated=v.enemy.health<=0||v.enemy.active===false;}
  for(const v of world.nodes){const visible=v.node.active||traceTargets(position,v.node,round.level.walls,[v.node])?.kind==='node';v.group.visible=visible;v.label.obscured=!visible;
    const hold=round.nodeInteraction?.id===v.node.id?round.nodeInteraction:null;
    v.label.el.classList.toggle('charging',!!hold);
    v.label.meter.hidden=!hold;v.label.meter.setAttribute('aria-valuenow',Math.round((hold?.progress??0)*100));v.label.fill.style.width=`${(hold?.progress??0)*100}%`;
    v.label.caption.textContent=`NODE ${v.node.id.split('-')[1]}${v.node.active?' · ACTIVE':hold?` · ACTIVATING ${Math.ceil((1-hold.progress)*RULES.resources.nodeHoldMs/1000)} s`:' · STAY NEAR 2 s'}`;
  }
  for(const v of routeLabels)v.label.defeated=routeComplete(v.level,v.choice);
  for(const v of world.routes)for(const marker of v.markers)marker.visible=!routeComplete(v.level,v.choice);
  for(const v of world.lootBoxes){v.group.visible=!v.loot.collected;v.label.defeated=v.loot.collected;}
  const aiming=!round.over&&(!!sticks[1].state.gesture?.direction||mouseDown||keys.has('Space'));
  const assisted=aiming?assistAim(position,aim,[...round.level.enemies,...round.level.nodes],solids):{target:null,direction:aim},displayAim=assisted.direction;
  lockMarker.visible=!!assisted.target;if(assisted.target)lockMarker.position.set(assisted.target.x,.08,assisted.target.z);
  for(const v of world.nodes)v.label.el.classList.toggle('locked',v.node===assisted.target);
  for(const v of world.enemies){v.label.el.classList.toggle('locked',v.enemy===assisted.target);if(v.enemy===assisted.target)v.label.caption.textContent=`⌖ ENEMY · ${v.enemy.health}`;}
  player.position.set(position.x,0,position.z);player.rotation.y=Math.atan2(displayAim.x,displayAim.z);playerRing.position.set(position.x,.025,position.z);
  rangeRing.visible=aiming;rangeRing.position.set(position.x,.06,position.z);aimLine.visible=aiming;
  const end=aimEndpoint(position,displayAim,RULES.weapon.range,solids),startDistance=Math.min(.7,Math.hypot(end.x-position.x,end.z-position.z));
  const points=aimLine.geometry.attributes.position;points.setXYZ(0,position.x+displayAim.x*startDistance,.065,position.z+displayAim.z*startDistance);points.setXYZ(1,end.x,.065,end.z);points.needsUpdate=true;aimLine.computeLineDistances();
  if(clock>=toastUntil){$('#level-toast').hidden=true;$('#level-corner').hidden=false;}
  target.lerp(new THREE.Vector3(position.x,0,position.z-1),1-Math.exp(-dt*6));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();
  sun.position.copy(target).add(new THREE.Vector3(-8,18,10));sun.target.position.copy(target);
  world.animate(elapsed);renderLabels();renderWeaponHUD(clock);renderer.render(scene,camera);requestAnimationFrame(frame);
}
reset(new URLSearchParams(location.search).get('seed'));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();$('#loading').hidden=true;requestAnimationFrame(frame);
