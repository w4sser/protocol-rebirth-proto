import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy} from '../round.js?v=2.9.0';
import {RULES} from '../levels.js?v=2.9.0';
import {createCombat,stepCombat,telegraphDuration} from '../combat.js?v=2.9.0';
import {createWeapon,fireWeapon,stepWeapon} from '../weapon.js?v=2.9.0';
import {deathTip} from '../encounters.js?v=2.9.0';
import {recap,deathLine} from '../perks.js?v=2.9.0';
const player=()=>({x:0,z:4});
function arena(type='grunt',extra={}){
 const r=createRound('telegraphs',0),e={id:'foe',kind:'enemy',type,x:0,z:0,r:.48,health:20,speed:0,facing:0,aggro:true,spawnedAt:-Infinity,rangeMul:1,cooldownMul:1,...extra};
 Object.assign(r.level,{start:{x:0,z:4},rooms:[{x:0,z:0,w:30,d:30}],enemies:[e],nodes:[],walls:[],boxes:[],hazards:[],floors:[{x:0,z:0,w:30,d:30}],firstGraceMs:0,enemyWindupMs:0});
 const c=createCombat(r.level,0);c.graceUntil=0;c.nextFire.set(e.id,0);return {r,e,c};
}
for(const type of ['grunt','rusher','sentry','thrower','guard','turret','patrol','swarm'])test(`${type} draws a warning and never damages before minimum`,()=>{
 const extra=type==='guard'?{encounter:'guard',frontShield:RULES.encounters.guard.frontHalfAngleDeg}:type==='turret'?{encounter:'turret'}:type==='patrol'?{patrol:{points:[{x:0,z:0}],i:0},windupMs:RULES.encounters.patrol.windupMs}:type==='swarm'?{swarm:'spawn'}:{};
 const {r,e,c}=arena(type==='swarm'?'rusher':type==='guard'?'grunt':type==='turret'?'sentry':type,extra),p=player();
 stepCombat(r,c,p,100,.01,[]);assert.ok(e.windupAt!=null,'visible warning state');assert.ok(e.attackTarget,'floor target');
 const ready=e.windupAt;assert.ok(ready-100>=RULES.encounters.telegraphMs);
 for(let now=150;now<ready;now+=50){stepCombat(r,c,p,now,.05,[]);assert.equal(r.health,r.maxHealth);assert.equal(c.projectiles.length,0);}
 let damaged=false;for(let now=ready;now<ready+2500;now+=20){stepCombat(r,c,p,now,.02,[]);if(r.health<r.maxHealth){damaged=true;break;}}
 assert.ok(damaged,'the telegraphed attack eventually damages a stationary player');
});
test('sentry locks 300ms before firing and moving sideways dodges the committed shot',()=>{
 const {r,e,c}=arena('sentry'),p=player();stepCombat(r,c,p,100,0,[]);
 p.x=1;stepCombat(r,c,p,e.aimLockAt-1,0,[]);const locked={...e.attackTarget};
 p.x=-3;stepCombat(r,c,p,e.aimLockAt,0,[]);assert.deepEqual(e.attackTarget,locked);
 stepCombat(r,c,p,e.windupAt,0,[]);const b=c.projectiles[0];assert.ok(b);assert.ok(Math.abs(b.dx/b.dz-locked.x/locked.z)<1e-9);
 for(let now=1400;now<1900;now+=20)stepCombat(r,c,p,now,.02,[]);
 assert.equal(r.health,r.maxHealth);
});
test('charger hits a solid, stays still during a 1200ms stun, then warns anew',()=>{
 const {r,e,c}=arena('rusher'),p=player(),wall={x:0,z:2,w:3,d:.4};
 stepCombat(r,c,p,100,0,[wall]);const at=e.windupAt;stepCombat(r,c,p,at,0,[wall]);
 stepCombat(r,c,p,at+200,.2,[wall]);assert.equal(e.stunnedUntil,at+200+RULES.shooting.telegraphs.chargerStunMs);const z=e.z;
 stepCombat(r,c,p,e.stunnedUntil-1,.1,[wall]);assert.equal(e.z,z);assert.equal(e.windupAt,null);
 stepCombat(r,c,p,e.stunnedUntil,0,[wall]);assert.ok(e.windupAt>e.stunnedUntil);
});
test('flank x2, first unaware x3 capped without stacking, shields and blasts retain rules',()=>{
 const {r,e}=arena();hitEnemy(r,e.id,100,2,{x:0,z:-2});assert.equal(e.health,16);assert.equal(e.weakMarker,'FLANK');assert.match(recap(r,'1:0').join(' '),/Flank/);
 e.aggro=false;e.lastHitAt=null;e.nearMissAt=null;e.health=20;hitEnemy(r,e.id,200,2,{x:0,z:-2});assert.equal(e.health,14);assert.equal(e.weakMarker,'UNAWARE');assert.match(deathLine(r),/Unaware/);assert.match(recap(r,'1:0').join(' '),/Flank.*Unaware/);
 hitEnemy(r,e.id,300,2,{x:0,z:-2});assert.equal(e.health,10);
 e.frontShield=70;e.health=20;assert.equal(hitEnemy(r,e.id,400,2,{x:0,z:2}),false);assert.equal(e.health,20);
 hitEnemy(r,e.id,500,2,null);assert.equal(e.health,18,'blast has no positional bonus');
});
test('incoming shot preserves unaware x3 at 16 ms steps',()=>{
 const {r,e,c}=arena('patrol',{aggro:false,facing:Math.PI/2,patrol:{points:[{x:0,z:0}],i:0}}),p=player(),w=createWeapon();
 assert.ok(fireWeapon(w,p,{x:0,z:-1},0,r));
 let frames=0;
 for(let now=16;now<=1000&&e.lastHitAt==null;now+=16){
  stepWeapon(w,r,now,.016,[]);
  stepCombat(r,c,p,now,.016,[]);
  frames++;
 }
 assert.ok(frames>1,'projectile takes multiple frames to reach the target');
 assert.ok(e.lastHitAt!=null,'the opening shot connects');
 assert.equal(20-e.health,RULES.weapon.damage*3,'opening hit gets the unaware multiplier');
 assert.equal(e.weakMarker,'UNAWARE');
 const health=e.health;
 hitEnemy(r,e.id,e.lastHitAt+16,RULES.weapon.damage,p);
 assert.equal(health-e.health,RULES.weapon.damage,'prior hit removes opening-shot eligibility');
});
test('back cone includes 60 degrees and excludes its outside',()=>{
 for(const [deg,expected] of [[59,2],[60,2],[-60,2],[61,1],[180,1]]){const {r,e}=arena();const a=Math.PI+deg*Math.PI/180;hitEnemy(r,e.id,100,1,{x:Math.sin(a)*3,z:Math.cos(a)*3});assert.equal(20-e.health,expected);}
});
test('low cover blocks enemy shots; only adjacent player shots lean over it for their whole flight',()=>{
 const cover={x:0,z:2,w:2,d:1,encounterCover:true};
 const {r,e,c}=arena();c.projectiles.push({id:1,x:0,z:0,dx:0,dz:1,life:2});c.nextFire.set(e.id,Infinity);stepCombat(r,c,player(),100,.5,[cover]);assert.equal(r.health,r.maxHealth);assert.equal(c.projectiles.length,0);
 for(const [z,expected] of [[.7,true],[-1,false]]){
  const {r,e}=arena();e.z=4;const w=createWeapon();fireWeapon(w,{x:0,z},{x:0,z:1},0,r);
  for(let i=1;i<=40;i++)stepWeapon(w,r,i*10,.01,[cover]);assert.equal(e.health<20,expected);
 }
});
for(const type of ['grunt','rusher','sentry','thrower','guard','turret','patrol','swarm'])test(`death tip covers ${type}`,()=>assert.ok(deathTip({over:true,reason:'death',lastHit:{source:type}})?.text));

test('production rendering draws coral aim lines and the permanent shield arc',async()=>{
 const THREE=await import('../vendor/three.module.js');
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
 const start=source.indexOf('    // Floor geometry is local'),end=source.indexOf("    if(v.enemy.introGuard||v.enemy.encounter==='guard'",start);
 const {aimEndpoint}=await import('../physics.mjs?v=2.9.0');
 const render=vm.runInNewContext(`(v,alive)=>{${source.slice(start,end)}}`,{THREE,RULES,TOOL_CORAL:'coral',aimEndpoint,solids:[]});
 const guard={enemy:{frontShield:70,encounter:'guard'},group:new THREE.Group()};render(guard,true);
 assert.equal(guard.shieldFloor.visible,true);assert.equal(guard.shieldFloor.material.opacity,RULES.shooting.telegraphs.shieldDimOpacity);
 const positions=guard.shieldFloor.geometry.attributes.position;
 assert.equal(positions.count,RULES.shooting.telegraphs.arcSegments+1);
 const half=RULES.encounters.guard.frontHalfAngleDeg*Math.PI/180;
 assert.ok(Math.abs(positions.getX(0)+Math.sin(half)*RULES.shooting.telegraphs.shieldRadius)<1e-6);
 guard.enemy.attackPhase='warning';render(guard,true);assert.equal(guard.shieldFloor.material.opacity,RULES.shooting.telegraphs.shieldBrightOpacity);
 for(const type of ['grunt','rusher','sentry']){
  const v={enemy:{type,x:0,z:0,windupAt:1000,attackTarget:{x:0,z:6}},group:new THREE.Group()};render(v,true);
  assert.equal(v.aimFloor.visible,true);assert.ok(v.aimFloor.geometry.attributes.position.getZ(1)>0);
  v.enemy.windupAt=null;render(v,true);assert.equal(v.aimFloor.visible,false);
 }
});
