import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createRound,takeDamage,tickRound,initEquip} from '../round.js?v=2.22.2';
import {RULES} from '../levels.js?v=2.22.2';
import {applyIntroEncounter} from '../progression-goal.js?v=2.22.2';
import {FTUE,ftueAssist,initFtueRound} from '../ftue.js?v=2.22.2';
import {createWeapon,fireAimedWeapon,stepWeapon,tapTarget} from '../weapon.js?v=2.22.2';
import {createCombat,stepCombat} from '../combat.js?v=2.22.2';
import {traceTargets} from '../physics.mjs?v=2.22.2';
import '../../data/raid-camera.js';

const goal={parts:[{id:'scrap_alloy',kind:'item',need:2,secured:0}]};
const seeds=['ftue','alpha','beta','gamma','delta','one','two','three','four','five'];
const storage=attempts=>({getItem:()=>JSON.stringify({attempts})});
function setup(seed,attempts=0,intro=true){
  const r=createRound(seed,0);
  if(intro)applyIntroEncounter(r.level,goal);
  initFtueRound(r,{ftue:true},storage(attempts));
  initEquip(r,{weapon:'basic_carbine',gear:[]});
  return r;
}
const solids=r=>[...r.level.walls,...r.level.boxes];

test('FTUE grunts have fixed room positions, clear firing lanes and immediate tap targets across seeds',()=>{
  for(const seed of seeds)for(const intro of [false,true]){
    const r=setup(seed,0,intro),p=r.level.start;
    assert.equal(r.level.enemies.length,2);
    for(const [i,e] of r.level.enemies.entries()){
      assert.equal(e.type,'grunt');assert.equal(e.active,true);assert.equal(e.aggro,true);
      assert.ok(Math.abs(e.x-r.level.rooms[0].x-FTUE.enemies[i].x)<1e-8);
      assert.ok(Math.abs(e.z-r.level.rooms[0].z-FTUE.enemies[i].z)<1e-8);
      const d=Math.hypot(e.x-p.x,e.z-p.z);
      assert.ok(e.z<p.z&&d>=3.5&&d<=5,`${seed} forward distance ${d}`);
      assert.ok(d<RULES.combat.range&&d<RULES.weapon.range*RULES.shooting.tapRangeMul);
      assert.notEqual(traceTargets(p,e,solids(r),[])?.kind,'wall',`${seed} intro=${intro} LOS ${e.id}`);
      assert.equal(tapTarget(p,[e],solids(r))?.id,e.id);
    }
  }
});

test('FTUE only replaces enemies: supplies, cover, gate, door and exit remain identical',()=>{
  for(const seed of seeds){
    const r=createRound(seed,0);applyIntroEncounter(r.level,goal);
    const before=structuredClone(r.level);
    initFtueRound(r,{ftue:true},storage(0));
    for(const key of ['lootBoxes','boxes','walls','nodes','doors','exit','start'])assert.deepEqual(r.level[key],before[key],key);
  }
});

test('stationary bot tapping every 0.5 seconds gets a kill within 10 seconds with real combat and spread',()=>{
  for(const seed of seeds){
    const r=setup(seed),w=createWeapon(),p={...r.level.start},c=createCombat(r.level,0);
    // Pin the shot RNG to repeatable spread extremes, never eliminate spread.
    let n=0;w.rand=()=>[0,1,.2,.8][n++%4];
    for(let now=0;now<=10000&&!r.enemiesDefeated&&!r.over;now+=20){
      if(now%500===0)fireAimedWeapon(w,r,p,{x:0,z:-1},now,solids(r),false,true);
      stepWeapon(w,r,now,.02,solids(r));
      stepCombat(r,c,p,now,.02,solids(r));
    }
    assert.ok(r.enemiesDefeated>0,`${seed}: first kill before 10s (HP ${r.health})`);
    assert.equal(r.over,false);
  }
});

test('attempts select normal, assisted and protected tuning; storage errors default to normal',()=>{
  for(const n of [0,1,2,3,100]){
    const r=setup('ramp',n),cfg=ftueAssist(n);
    assert.equal(r.ftue,cfg);
    assert.equal(r.level.enemies[0].health,RULES.levels[0].enemyHealth*cfg.healthMul);
    assert.equal(r.level.enemies[0].speed,RULES.levels[0].enemySpeed*cfg.speedMul);
    takeDamage(r,20,10);assert.equal(r.health,100-20*cfg.damageMul);
  }
  assert.equal(ftueAssist(0).damageMul,1);
  assert.ok(ftueAssist(1).damageMul<1&&ftueAssist(1).healthMul<1&&ftueAssist(1).speedMul<1);
  const r=createRound('bad-storage',0);initFtueRound(r,{ftue:true},{getItem(){throw Error('blocked');}});
  assert.equal(r.ftue,FTUE.attempts[0]);
});

test('attempt 3+ survives repeated lethal hits and expired deadlines, preserving hit feedback and carried loot',()=>{
  for(const n of [2,3,50]){
    const r=setup('protected',n);r.bag.scrap_alloy=2;
    for(const now of [10,20,r.deadline+1000,r.deadline+1000000]){
      const before=r.ftueHitSerial??0;
      assert.equal(takeDamage(r,1e9,now),true);
      assert.equal(r.health,1);assert.equal(r.over,false);assert.equal(r.reason,null);
      assert.equal(r.ftueHitSerial,before+1);assert.equal(r.lastDamageAt,now);
      tickRound(r,now);assert.ok(r.remainingMs>=1000);
      assert.equal(r.bag.scrap_alloy,2);
    }
  }
  for(const n of [0,1]){
    const r=setup('risk',n);takeDamage(r,1e9,10);assert.equal(r.reason,'death');
    const t=setup('timer-risk',n);tickRound(t,t.deadline);assert.equal(t.reason,'timeout');
  }
});

test('non-FTUE and intro-only rounds are byte-identical after FTUE initialization and retain lethal damage/timeout',()=>{
  for(const intro of [false,true])for(const seed of seeds){
    const r=createRound(seed,0);if(intro)applyIntroEncounter(r.level,goal);
    const before=JSON.stringify(r);
    initFtueRound(r,{intro,ftue:false},{getItem(){throw Error('must not read storage');}});
    assert.equal(JSON.stringify(r),before);
    takeDamage(r,1e9,10);assert.equal(r.health,0);assert.equal(r.reason,'death');
    const t=createRound(seed,0);initFtueRound(t,{intro},storage(2));tickRound(t,t.deadline);assert.equal(t.reason,'timeout');
  }
});

test('reset wiring reads fresh attempts on every retry and displays the assisted BIT line',async()=>{
  const src=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(src,/initFtueRound\(round,launch,localStorage\)/);
  assert.match(src,/notice\(round\.ftue\.line\)/);
  assert.match(src,/round\.ftueHitSerial!==ftueHitBefore/);
  // Execute the shipped persistence helper, then the same initializer reset uses.
  const bump=src.slice(src.indexOf('function ftueBumpAttempt()'),src.indexOf('\n',src.indexOf('function ftueBumpAttempt()')));
  let raw=JSON.stringify({attempts:0});
  const store={getItem:()=>raw,setItem:(key,value)=>{raw=value;}};
  for(const n of [0,1,2]){
    const r=createRound('retry',0);initFtueRound(r,{ftue:true},store);assert.equal(r.ftue,FTUE.attempts[n]);
    runInNewContext(bump+';ftueBumpAttempt();',{localStorage:store,FTUE_KEY:'pr_ftue_v1'});
  }
});

test('both FTUE grunts fit the unchanged default orthographic camera at both landscape viewports',()=>{
  const C=globalThis.DATA.raidCamera,o=C.offset,len=Math.hypot(o.x,o.y,o.z);
  // Camera right = normalized up cross view; camera up = view cross right.
  const right={x:o.z/Math.hypot(o.x,o.z),z:-o.x/Math.hypot(o.x,o.z)};
  const up={x:-o.y/len*o.x/Math.hypot(o.x,o.z),y:Math.hypot(o.x,o.z)/len,z:-o.y/len*o.z/Math.hypot(o.x,o.z)};
  for(const seed of seeds)for(const [w,h] of [[844,390],[667,375]]){
    const r=setup(seed),p=r.level.start;
    for(const e of r.level.enemies)for(const y of [0,1.7]){
      const dx=e.x-p.x,dz=e.z-p.z-C.targetOffsetZ;
      const x=dx*right.x+dz*right.z,v=dx*up.x+y*up.y+dz*up.z;
      assert.ok(Math.abs(x)<C.halfHeight*w/h-.5&&Math.abs(v)<C.halfHeight-.5,`${seed} ${w}x${h}: ${x},${v}`);
    }
  }
});
