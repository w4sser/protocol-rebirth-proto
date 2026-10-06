import * as THREE from './vendor/three.module.js';
import {movePlayer,traceTargets} from './physics.mjs?v=1.7.0';
import {createRound,tickRound,enterExit,exitIsOpen,roundSummary,collectLoot} from './round.js?v=1.7.0';
import {createCombat,stepCombat} from './combat.js?v=1.7.0';
import {buildWorld} from './world.js?v=1.7.0';
import {RULES} from './levels.js?v=1.7.0';
import {createWeapon,fireWeapon,stepWeapon,assistAim} from './weapon.js?v=1.7.0';
import {beginAim,dragAim,releaseAim} from './controls.js?v=1.7.0';

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
const rangeRing=new THREE.Mesh(new THREE.RingGeometry(RULES.weapon.range-.04,RULES.weapon.range,96),new THREE.MeshBasicMaterial({color:'#8cf5df',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
rangeRing.rotation.x=-Math.PI/2;rangeRing.visible=false;scene.add(rangeRing);
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
  el.addEventListener('pointerdown',e=>{if(state.pointer!==null || round?.over)return;e.preventDefault();state.pointer=e.pointerId;state.gesture=onShot?beginAim(e.clientX,e.clientY):null;el.setPointerCapture(e.pointerId);el.classList.add('active');if(!onShot)update(e);});
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
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&keys.has('Space'))fire();keys.delete(e.code);});
function clearInput(){keys.clear();mouseDown=false;for(const {el,state,value,thumb} of sticks){if(state.pointer!==null&&el.hasPointerCapture(state.pointer))el.releasePointerCapture(state.pointer);state.pointer=null;state.gesture=null;value.x=value.y=0;thumb.style.transform='translate(-50%,-50%)';el.classList.remove('active','aiming');}}
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();if(round){tickRound(round,Date.now());if(round.over)finishRound();}});

function clearBullets(){for(const b of bullets)scene.remove(b.mesh);bullets.length=0;if(weapon)weapon.projectiles.length=0;for(const m of enemyMeshes.values())scene.remove(m);enemyMeshes.clear();}
let labels=[];
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
  $('#bag-scrap').textContent=round.bag.scrap;$('#bag-cell').textContent=round.bag.powerCell;
  $('#secured-scrap').textContent=round.extracted.scrap;$('#secured-cell').textContent=round.extracted.powerCell;
  const lit=round.level.nodes.filter(n=>n.active).length,open=exitIsOpen(round);
  $('#level-counter').textContent=`BANA ${round.level.number} / 3`;
  $('#health-value').textContent=round.health;$('.health').classList.toggle('urgent',round.health<=25);
  $('#progress').textContent=`${lit} / ${round.level.nodes.length}`;
  $('.mission').classList.toggle('done',open);
  $('#mission-label').textContent=round.cleared?'ALLA BANOR KLARA':`BANA ${round.level.number} · ${round.level.title.toUpperCase()}`;
  $('#status').textContent=round.cleared?'Tre banor avklarade':open?'Utgången är öppen':round.level.nodes.length===1?'Tänd noden':'Tänd alla noder';
  const remainingEnemies=round.level.enemies.filter(e=>e.health>0&&e.active!==false).length;
  $('#hint').textContent=open?'Gå till utgången för att extrahera väskan.':`${remainingEnemies} ${remainingEnemies===1?'fiende':'fiender'} kvar · Gå nära lådor för att plocka.`;
  if(round.over){$('#status').textContent=round.reason==='complete'?'Alla banor klara':round.reason==='death'?'Du dog':'Tiden är slut';$('#hint').textContent='Ny runda börjar från noll.';}
  for(const v of world.nodes){v.label.el.classList.toggle('done',v.node.active);v.label.caption.textContent=`NOD ${v.node.id.split('-')[1]}${v.node.active?' · AKTIV':''}`;}
  world.exitLabel.el.classList.toggle('done',open);world.exitLabel.caption.textContent=round.cleared?'ALLA BANOR KLARA':open?'UTGÅNG · ÖPPEN':'UTGÅNG · LÅST';
  world.setExit(open);setCollisions();
}
function loadLevel(){
  world?.dispose();clearBullets();clearInput();mouseKnown=false;
  position={...round.level.start};aim={x:0,z:-1};target.set(position.x,0,position.z-1);
  player.position.set(position.x,0,position.z);
  world=buildWorld(round.level,scene);$('#world-labels').replaceChildren();labels=[];
  for(const v of world.nodes)v.label=makeLabel('',new THREE.Vector3(v.node.x,1.9,v.node.z),'');
  world.exitLabel=makeLabel('',new THREE.Vector3(round.level.exit.x,1.8,round.level.exit.z),'exit-label');
  for(const room of round.level.rooms)makeLabel(room.name.toUpperCase(),new THREE.Vector3(room.x,.1,room.z-room.d/2+1),'room-label');
  for(const v of world.enemies)v.label=makeLabel(`FIENDE · ${v.enemy.health}`,new THREE.Vector3(v.enemy.x,1.7,v.enemy.z),'enemy-label');
  for(const v of world.lootBoxes)v.label=makeLabel('LÅDA · PLOCKA',new THREE.Vector3(v.loot.x,1.2,v.loot.z),'loot-label');
  combat=createCombat(round.level,Date.now());
  $('#seed-label').textContent=`SEED ${round.seed}`;
  $('#corner-name').textContent=`${round.level.number} / 3 · ${round.level.title}`;
  $('#intro-number').textContent=`BANA ${round.level.number} / 3`;
  $('#intro-name').textContent=round.level.title;
  $('#intro-seed').textContent=`SEED ${round.seed}`;
  updateHUD();
  $('#level-toast').hidden=false;$('#level-corner').hidden=true;toastUntil=Date.now()+3000;
}
function reset(requestedSeed){
  const seed=typeof requestedSeed==='string'&&requestedSeed?requestedSeed.slice(0,64):`${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8,'0')}-${++resetCount}`;
  const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState(null,'',url);
  round=createRound(seed,Date.now());weapon=createWeapon();viewport.classList.remove('round-ended','damaged');hitUntil=0;$('#round-over').hidden=true;$('#time-left').textContent='8:00';$('.timer').classList.remove('urgent');loadLevel();
}
function finishRound(){
  if(!$('#round-over').hidden)return;
  clearInput();clearBullets();viewport.classList.add('round-ended');$('#round-over').hidden=false;
  const summary=roundSummary(round),seconds=Math.ceil(summary.remainingMs/1000);
  $('#round-over-title').textContent=summary.reason==='complete'?'Alla banor klara':summary.reason==='death'?'Du dog':'Tiden är slut';
  $('#summary-enemies').textContent=summary.enemiesDefeated;
  $('#summary-levels').textContent=`${summary.levelsCleared} / 3`;$('#summary-nodes').textContent=`${summary.nodesLit} / 6`;
  $('#summary-time').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('#summary-extracted').textContent=`${summary.extracted.scrap} skrot · ${summary.extracted.powerCell} power cells`;
  $('#summary-lost').textContent=`${summary.lost.scrap} skrot · ${summary.lost.powerCell} power cells`;
  $('#level-toast').hidden=true;updateHUD();
}
$('#reset').addEventListener('click',reset);$('#new-round').addEventListener('click',reset);
function fire(){
  if(!round||round.over)return;
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
  $('#ammo-hud').setAttribute('aria-label',`Ammo: ${weapon.ammo} av ${RULES.weapon.capacity} skott`);
  for(const [i,el] of [...document.querySelectorAll('.ammo-slot')].entries()){
    el.classList.toggle('loaded',i<weapon.ammo);el.classList.toggle('refilling',i===weapon.ammo&&reloading);
    el.style.setProperty('--fill',`${i<weapon.ammo?100:i===weapon.ammo?fraction*100:0}%`);
  }
  $('#reload-time').textContent=round.over?'':reloading?`+1 om ${(remaining/1000).toFixed(1)} s`: '3 / 3';
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
  if(!round.over){
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
    if(collectLoot(round,position,clock))updateHUD();
    const healthBefore=round.health;
    stepCombat(round,combat,position,clock,dt,[...solids,...round.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))]);
    setCollisions();
    if(round.health!==healthBefore){hitUntil=clock+200;updateHUD();}
    if(round.over)finishRound();
    const result=enterExit(round,position,clock);
    if(result==='next')loadLevel();else if(result==='complete')finishRound();
  }
  viewport.classList.toggle('damaged',clock<hitUntil);
  const aliveProjectiles=new Set(round.over?[]:combat.projectiles.map(b=>b.id));
  for(const [id,m] of enemyMeshes)if(!aliveProjectiles.has(id)){scene.remove(m);enemyMeshes.delete(id);}
  if(!round.over)for(const b of combat.projectiles){let m=enemyMeshes.get(b.id);if(!m){m=new THREE.Mesh(bulletGeometry,enemyBulletMaterial);scene.add(m);enemyMeshes.set(b.id,m);}m.position.set(b.x,.65,b.z);m.rotation.y=Math.atan2(b.dx,b.dz);}
  for(const v of world.enemies){v.group.visible=v.enemy.health>0&&v.enemy.active!==false;v.group.position.set(v.enemy.x,0,v.enemy.z);v.group.rotation.y=Math.atan2(position.x-v.enemy.x,position.z-v.enemy.z);v.label.point.set(v.enemy.x,1.7,v.enemy.z);v.label.caption.textContent=`FIENDE · ${v.enemy.health}`;v.label.defeated=v.enemy.health<=0||v.enemy.active===false;}
  for(const v of world.nodes){const visible=v.node.active||traceTargets(position,v.node,round.level.walls,[v.node])?.kind==='node';v.group.visible=visible;v.label.obscured=!visible;}
  for(const v of world.lootBoxes){v.group.visible=!v.loot.collected;v.label.defeated=v.loot.collected;}
  const aiming=!round.over&&(!!sticks[1].state.gesture?.direction||mouseDown||keys.has('Space'));
  const assisted=aiming?assistAim(position,aim,[...round.level.enemies,...round.level.nodes],solids):{target:null,direction:aim},displayAim=assisted.direction;
  lockMarker.visible=!!assisted.target;if(assisted.target)lockMarker.position.set(assisted.target.x,.08,assisted.target.z);
  for(const v of world.nodes)v.label.el.classList.toggle('locked',v.node===assisted.target);
  for(const v of world.enemies){v.label.el.classList.toggle('locked',v.enemy===assisted.target);if(v.enemy===assisted.target)v.label.caption.textContent=`⌖ FIENDE · ${v.enemy.health}`;}
  player.position.set(position.x,0,position.z);player.rotation.y=Math.atan2(displayAim.x,displayAim.z);playerRing.position.set(position.x,.025,position.z);
  rangeRing.visible=aiming;rangeRing.position.set(position.x,.06,position.z);aimLine.visible=aiming;
  const points=aimLine.geometry.attributes.position;points.setXYZ(0,position.x+displayAim.x*.7,.065,position.z+displayAim.z*.7);points.setXYZ(1,position.x+displayAim.x*RULES.weapon.range,.065,position.z+displayAim.z*RULES.weapon.range);points.needsUpdate=true;aimLine.computeLineDistances();
  if(clock>=toastUntil){$('#level-toast').hidden=true;$('#level-corner').hidden=false;}
  target.lerp(new THREE.Vector3(position.x,0,position.z-1),1-Math.exp(-dt*6));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();
  sun.position.copy(target).add(new THREE.Vector3(-8,18,10));sun.target.position.copy(target);
  world.animate(elapsed);renderLabels();renderWeaponHUD(clock);renderer.render(scene,camera);requestAnimationFrame(frame);
}
reset(new URLSearchParams(location.search).get('seed'));camera.position.copy(target).add(cameraOffset);camera.lookAt(target);camera.updateMatrixWorld();$('#loading').hidden=true;requestAnimationFrame(frame);
