import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy,tickRound} from '../round.js?v=2.9.1';
import {perkState,updateClears,pickReady,gameTime,hitstop,advanceHitstop,pausePick,resumePick,inputPaused} from '../perks.js?v=2.9.1';
import {tapTarget,tapDirection} from '../weapon.js?v=2.9.1';
import {RULES} from '../levels.js?v=2.9.1';
import {createDash,startDash} from '../dash.js?v=2.9.1';
import {createCombat,stepCombat,stepHazards} from '../combat.js?v=2.9.1';
const pos={x:0,z:0};
const enemy=(id,x=2,z=0)=>({id,kind:'enemy',type:'grunt',x,z,r:.48,health:1,active:true});
function arena(){
  const r=createRound('combat-feel',0);
  Object.assign(r.level,{rooms:[{x:0,z:0,w:20,d:20}],enemies:[enemy('a')],nodes:[],hazards:[],walls:[],boxes:[],floors:[{x:0,z:0,w:30,d:30}]});
  return r;
}
const quiet={projectiles:[],blasts:[]},off=()=> 'off';
test('perk requires kill delay and continuous calm, timer runs throughout the delay',()=>{
  const r=arena();updateClears(r,pos);hitEnemy(r,'a',100,1);updateClears(r,pos);
  assert.equal(perkState(r).rooms['1:0'].clearedAt,100);
  assert.equal(pickReady(r,quiet,pos,100,off),null);
  assert.equal(pickReady(r,quiet,pos,1099,off),null);
  assert.equal(pickReady(r,quiet,pos,1100,off),'1:0');
  assert.equal(pickReady(r,{projectiles:[{}],blasts:[]},pos,1101,off),null);
  assert.equal(pickReady(r,quiet,pos,1200,off),null);
  assert.equal(pickReady(r,quiet,pos,1799,off),null);
  assert.equal(pickReady(r,quiet,pos,1800,off),'1:0');
  tickRound(r,1800);assert.equal(r.pauseAt==null,true);assert.equal(r.remainingMs,r.durationMs-1800);
});
test('perk last kill comes from death time even if clear detection occurs later',()=>{
  const r=arena();hitEnemy(r,'a',100,1);tickRound(r,900);updateClears(r,pos);
  assert.equal(perkState(r).rooms['1:0'].clearedAt,100);
  assert.equal(pickReady(r,quiet,pos,900,off),null);
  assert.equal(pickReady(r,quiet,pos,1500,off),'1:0');
});
test('hitstop pause accounting uses exact freeze deadlines despite late animation frames',()=>{
  const r=arena();
  for(const [at,ms] of [[100,40],[400,90],[800,140]]){
    hitstop(r,ms,at);assert.equal(gameTime(r,at+ms-1),at-(r.pausedMs??0));
    assert.equal(inputPaused(r),false,'hitstop does not capture UI/input as a modal');
    advanceHitstop(r,at+ms+19);
  }
  assert.equal(r.pausedMs,270);assert.equal(gameTime(r,1200),930);
  tickRound(r,gameTime(r,1200));assert.equal(r.remainingMs,r.durationMs-930);
});
test('overlapping hitstops and perk pauses share one clock without double counting',()=>{
  const r=arena();hitstop(r,40,100);hitstop(r,90,120);advanceHitstop(r,240);
  assert.equal(r.pausedMs,110);
  hitstop(r,140,300);pausePick(r,320);assert.equal(inputPaused(r),true);
  advanceHitstop(r,800);assert.notEqual(r.pauseAt,null,'picker owns pause after opening during hitstop');
  resumePick(r,900);assert.equal(r.pausedMs,710);assert.equal(gameTime(r,1000),290);
  pausePick(r,1100);hitstop(r,90,1150);advanceHitstop(r,1400);assert.equal(inputPaused(r),true);
  resumePick(r,1500);assert.equal(r.pausedMs,1110);
});
test('tap targets nearest visible enemy in the full circle, respecting range and cover',()=>{
  const behind=enemy('behind',-2),front=enemy('front',4),outside=enemy('far',8),hidden=enemy('hidden',0,2);
  const walls=[{x:0,z:1,w:1,d:.4}];
  assert.equal(tapTarget(pos,[front,behind,outside,hidden],walls).id,'behind');
  assert.equal(tapTarget(pos,[hidden,outside],walls),null);
});
for(const kind of ['projectile','blast','hazard'])test(`dash blocks ${kind} in first 150 ms, damage returns at boundary`,()=>{
  for(const offset of [149,150]){
    const r=arena();r.level.enemies=[];const c=createCombat(r.level,0);c.graceUntil=0;
    const d=createDash();startDash(d,{x:1,z:0},1000);const now=1000+offset;
    if(kind==='projectile')c.projectiles.push({id:1,x:-1,z:0,dx:1,dz:0,life:2,damage:10});
    if(kind==='blast')c.blasts.push({x:0,z:0,radius:2,detonateAt:now,source:'grenadier'});
    if(kind==='hazard'){
      r.level.hazards=[{x:0,z:0,w:2,d:2,phaseMs:0,dps:1000}];
      // Find an active hazard instant without relying on its tuning phase.
      r.level.hazards[0].phaseMs=RULES.hazard.offMs-now;
      stepHazards(r,pos,now,.04,d);
    }else stepCombat(r,c,pos,now,.2,[],d);
    if(offset===149)assert.equal(r.health,r.stats.maxHealth);
    else assert.ok(r.health<r.stats.maxHealth,`${kind} damage resumes at iframe boundary`);
  }
});
test('simultaneous kills keep every presentation event and mark the final room kill',()=>{
  const r=arena();r.level.enemies.push(enemy('b',-2));
  hitEnemy(r,'a',100,1);hitEnemy(r,'b',100,1);
  assert.deepEqual(r.hitFeels.map(e=>e.kind),['kill','lastKill']);
  assert.equal(RULES.dash.cooldownMs,2500);assert.equal(RULES.playerStats.clamp.dashCooldownMs[0],1500);
});

test('a later kill in a pending room restarts the delay and calm window',()=>{
  const r=arena();updateClears(r,pos);hitEnemy(r,'a',100,1);updateClears(r,pos);pickReady(r,quiet,pos,100,off);
  r.level.enemies.push(enemy('reinforcement'));hitEnemy(r,'reinforcement',1000,1);
  assert.equal(pickReady(r,quiet,pos,1000,off),null);
  assert.equal(pickReady(r,quiet,pos,1999,off),null);
  assert.equal(pickReady(r,quiet,pos,2000,off),'1:0');
});

test('production enemy visuals flash independently, collapse, and remove their kill particles',async()=>{
  const THREE=await import('../vendor/three.module.js');
  const {buildWorld}=await import('../world.js?v=2.9.1');
  const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
  const r=createRound('feel-visuals',0),[first,second]=r.level.enemies;
  first.health=2;first.active=second.active=true;
  const world=buildWorld(r.level,new THREE.Scene(),{quality:'low'});
  try{
    const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
    const start=source.indexOf('function renderEnemyFeedback(clock){'),end=source.indexOf('    if(v.beam)',start);
    const context=vm.createContext({world,position:pos,RULES});
    vm.runInContext(source.slice(start,end)+'\n  }\n}',context);
    hitEnemy(r,first.id,100,1);context.renderEnemyFeedback(100);
    const a=world.enemies.find(v=>v.enemy.id===first.id),b=world.enemies.find(v=>v.enemy.id===second.id);
    assert.equal(a.meshFlash.material.color.getHexString(),'ffffff');assert.ok(a.meshFlash.material.opacity>0);
    assert.equal(b.meshFlash.material.opacity,0,'flashing one mesh never changes another enemy');
    context.renderEnemyFeedback(180);assert.equal(a.meshFlash.material.opacity,0);
    hitEnemy(r,first.id,200,1);context.renderEnemyFeedback(375);
    assert.equal(a.group.visible,true);assert.equal(a.group.scale.x,.5);assert.ok(a.group.rotation.x>0);
    context.renderEnemyFeedback(550);assert.equal(a.group.visible,false);
    const before=world.group.children.length;
    world.burst(first.x,first.z,RULES.enemyTypes[first.type]?.color,true);
    assert.equal(world.group.children.length,before+1+RULES.feedback.burst.particles);
    world.animate(0);for(let i=1;i<=7;i++)world.animate(i/10);
    assert.equal(world.group.children.length,before,'expired particles and ring leave the scene');
  }finally{world.dispose();}
});

test('tap without a visible target fires along current facing, while a target behind overrides it',()=>{
  assert.deepEqual(tapDirection(pos,{x:-1,z:0},[],[]),{x:-1,z:0});
  assert.deepEqual(tapDirection(pos,{x:1,z:0},[enemy('behind',-2)],[]),{x:-1,z:0});
});
