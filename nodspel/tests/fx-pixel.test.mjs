import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createPixelFX,PIXEL_EFFECTS} from '../fx-pixel.js';
import {createPixelFeedback} from '../fx-feedback.js';
import {shotContact} from '../physics.mjs';
import {pickQuality} from '../art.js';
import {createRound} from '../round.js';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';
import {initTool,throwTool,stepTools} from '../tools.js';
import {createCombat,stepCombat} from '../combat.js';

function harness(quality='high',capacity=2){
  let canvases=0,bakes=0,writes=0;
  const document={createElement(){canvases++;return {getContext:()=>({putImageData(){writes++;}})};}};
  const bake=()=>{bakes++;return Object.fromEntries(Object.entries(PIXEL_EFFECTS).map(([k,def])=>[k,{def,w:128,h:128,duration:.2,frames:[{},{}]}]));};
  const scene=new THREE.Scene(),fx=createPixelFX(scene,{quality,capacity,document,bake});
  return {fx,scene,stats:()=>({canvases,bakes,writes})};
}
test('pool reuses sprite, material and 128px texture, caps bursts and disposes',()=>{
  const {fx,scene,stats}=harness(),first=fx.spawn('impact',1,2),sprite=first.sprite,texture=first.texture,material=sprite.material;
  assert.equal(texture.image.width,128);assert.equal(texture.image.height,128);assert.equal(sprite.isSprite,true);assert.equal(scene.children.some(c=>c.isLight),false);
  fx.spawn('collect',0,0);assert.equal(fx.spawn('hit',0,0),null);fx.update(.3);
  const reused=fx.spawn('hit',3,4);assert.equal(reused,first);assert.equal(reused.sprite,sprite);assert.equal(reused.texture,texture);assert.equal(sprite.material,material);
  fx.update(.01);fx.update(.01);assert.deepEqual(stats(),{canvases:2,bakes:1,writes:1});
  fx.dispose();assert.equal(scene.children.length,0);assert.equal(fx.spawn('hit',0,0),null);
});
test('Low allocates nothing; Medium/High enable and switching Low clears all loops',()=>{
  const {fx,stats}=harness('low');assert.equal(fx.spawn('shield',0,0),null);fx.update(1);assert.deepEqual(stats(),{canvases:0,bakes:0,writes:0});
  fx.setQuality('medium');const loop=fx.spawn('shield',0,0);fx.update(1);assert.equal(loop.active,true);
  fx.setQuality('low');assert.equal(loop.active,false);assert.equal(loop.sprite.visible,false);assert.equal(fx.spawn('hit',0,0),null);
  fx.setQuality('high');assert.ok(fx.spawn('hit',0,0));assert.equal(stats().bakes,1);assert.equal(stats().canvases,2);
  assert.equal(pickQuality({search:'?q=medium'}),'medium');assert.equal(pickQuality({storage:{getItem:()=> 'medium'}}),'medium');
});
test('feedback tracks extraction, shield EMP state and loot transitions once',()=>{
  const {fx}=harness('high',16),haptics={explosion(){},hit(){}},feedback=createPixelFeedback(fx,haptics);
  const level={exit:{x:5,z:6},nodes:[{active:false}],enemies:[{encounter:'shield_turret',health:2,x:1,z:1}]},round={level,health:100};
  const loot={loot:{x:2,z:3,revealed:false,collected:false}},world={lootBoxes:[loot]},player={x:0,z:0};
  feedback.reset(level);feedback.sync(round,world,player,0,0);assert.equal(fx.slots.filter(s=>s.active).length,1);
  level.nodes[0].active=true;loot.loot.revealed=true;feedback.sync(round,world,player,1,0);assert.equal(fx.slots.filter(s=>s.active).length,3);
  feedback.sync(round,world,player,2,0);assert.equal(fx.slots.filter(s=>s.active).length,3);
  level.enemies[0].shieldDownUntil=100;loot.loot.collected=true;feedback.sync(round,world,player,3,0);
  assert.equal(fx.slots.filter(s=>s.active&&s.clip.def===PIXEL_EFFECTS.shield).length,0);
  assert.equal(fx.slots.filter(s=>s.active&&s.clip.def===PIXEL_EFFECTS.collect).length,1);
  fx.setQuality('low');feedback.sync(round,world,player,4,0);assert.equal(fx.slots.filter(s=>s.active).length,0);
  fx.setQuality('high');feedback.sync(round,world,player,101,0);assert.equal(fx.slots.filter(s=>s.active).length,2);
});
test('feedback haptics work on Low and legacy reduced-feedback opt-out is respected',()=>{
  const {fx}=harness('low'),calls=[],h={hit:()=>calls.push('hit'),explosion:()=>calls.push('explosion')};let enabled=true;
  const feedback=createPixelFeedback(fx,h,{reducedFx:()=>enabled});feedback.playerHit(0,0);feedback.explosion(1,1);assert.deepEqual(calls,['hit','explosion']);
  enabled=false;feedback.playerHit(0,0);feedback.explosion(1,1);assert.equal(calls.length,2);
});
test('shot contact lands on wall/target surface instead of segment start or end',()=>{
  const a={x:0,z:0},b={x:10,z:0};
  assert.deepEqual(shotContact(a,b,{kind:'wall'},[{x:5,z:0,w:2,d:2}]),{x:4,z:0});
  const p=shotContact(a,b,{target:{x:5,z:0,r:1}},[]);assert.equal(p.x,4);assert.equal(p.z,0);
});
test('async preparation yields no sprites until ready and handles Low/disposal during baking',async()=>{
  let resolve;
  const scene=new THREE.Scene(),pending=new Promise(r=>{resolve=r;}),fx=createPixelFX(scene,{bake:()=>pending,document:{},capacity:0});
  assert.equal(fx.spawn('hit',0,0),null);fx.setQuality('low');resolve({});await fx.ready;assert.equal(fx.enabled,false);
  let finish;
  const disposed=createPixelFX(scene,{bake:()=>new Promise(r=>{finish=r;}),document:{},capacity:1});disposed.dispose();finish({});await disposed.ready;assert.equal(scene.children.length,0);
});
test('real shield-blocked hits only impact, damaging hits flash after resolution',()=>{
  const round=createRound('pixel-shield',0),events=[];
  round.level.nodes=[];round.level.walls=[];
  const e={id:'shield',kind:'enemy',x:4,z:0,r:.48,health:5,active:true,aggro:true,type:'guard',frontShield:70,facing:-Math.PI/2};
  round.level.enemies=[e];round.feedback={impact:(x,z,damage)=>events.push({x,z,damage})};
  function fire(){const w=createWeapon();assert.ok(fireAimedWeapon(w,round,{x:0,z:0},{x:1,z:0},1000,[]));stepWeapon(w,round,1001,1,[]);}
  fire();assert.equal(e.health,5);assert.equal(events[0].damage,false);
  e.facing=Math.PI/2;fire();assert.ok(e.health<5);assert.equal(events[1].damage,true);assert.ok(events[1].x>3&&events[1].x<4);
});
test('real grenades, EMP and artillery report once at detonation coordinates',()=>{
  const round=createRound('pixel-blasts',0),events=[];
  round.level.enemies=[];round.level.nodes=[];round.level.walls=[];
  round.feedback={explosion:(x,z)=>events.push(['explosion',x,z]),emp:(x,z)=>events.push(['emp',x,z])};
  initTool(round,{id:'tool_grenade',n:1});const grenade=throwTool(round,{x:0,z:0},{x:1,z:1},1000,[]);
  stepTools(round,grenade.detonateAt-1);assert.equal(events.length,0);stepTools(round,grenade.detonateAt);stepTools(round,grenade.detonateAt+1);assert.deepEqual(events,[['explosion',1,1]]);
  initTool(round,{id:'tool_emp',n:1});throwTool(round,{x:0,z:0},{x:2,z:1},3000,[]);assert.deepEqual(events[1],['emp',2,1]);
  const combat=createCombat(round.level,0);combat.blasts.push({x:2,z:3,radius:2,detonateAt:4000});
  stepCombat(round,combat,{x:10,z:10},4000,0,[]);stepCombat(round,combat,{x:10,z:10},4001,0,[]);assert.deepEqual(events[2],['explosion',2,3]);assert.equal(events.length,3);
});
