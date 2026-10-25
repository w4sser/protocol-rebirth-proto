// PRB-92 T5 combat pass: no shield guard on L1, grenade thrower (warning -> fuse -> blast), rising body counts, Hard rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,AREAS,AREA_RULES,generateLevel,ruleSet} from '../levels.js';
// the Hard flag lives in the module instance round.js imports (it carries the ?v= tag), so flip it there
import {setHard,isHard} from '../levels.js?v=1.96.0';
import {createRound,ROUND_DURATION_MS,hitEnemy} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {readLaunch,buildRaidResult} from '../raid-result.js';
import {encounterDamage,shieldBlocks,hintFor,deathTip,angleTo,ENCOUNTER_TYPES} from '../encounters.js';

const E=RULES.encounters,G=E.grenadier,DT=.04;
const withHard=(on,fn)=>{setHard(on);try{return fn();}finally{setHard(false);}};

test('L1 never carries a front shield: bunker, archipelago, town, normal and Hard (60 seeds)',()=>{
  for(const hard of [false,true])for(const area of AREAS)for(let s=0;s<60;s++){
    const L=generateLevel(1,`l1-${s}`,area,hard);
    assert.ok(L.enemies.every(e=>!e.frontShield&&e.encounter!=='guard'),`${area} hard=${hard} l1-${s}`);
    assert.ok(!L.encounters.some(e=>e.type==='guard'));
  }
  for(const area of AREAS){assert.ok(!E.plan[area][0].includes('guard'));assert.ok(!RULES.hard.plan[area][0].includes('guard'));}
});

test('the shield guard lives on L2+ (bunker L2, Hard L2/L3) with a flank-able front shield',()=>{
  assert.deepEqual(E.plan.bunker[1],['guard']);
  for(let s=0;s<30;s++){
    const g=generateLevel(2,`g2-${s}`,'bunker').enemies.find(e=>e.encounter==='guard');
    assert.ok(g&&g.frontShield===E.guard.frontHalfAngleDeg,`guard on bunker L2 g2-${s}`);
    // front blocked, side and back land
    const from=deg=>{const a=g.facing+deg*Math.PI/180;return {x:g.x+Math.sin(a)*3,z:g.z+Math.cos(a)*3};};
    assert.equal(shieldBlocks(g,from(0)),true);assert.equal(shieldBlocks(g,from(60)),true);
    assert.equal(shieldBlocks(g,from(100)),false);assert.equal(shieldBlocks(g,from(-100)),false);assert.equal(shieldBlocks(g,from(180)),false);
    assert.ok(E.guard.warningMs>=E.telegraphMs,'guard warns >= 1 s');
  }
  for(const area of AREAS)for(const n of [2,3])assert.ok(generateLevel(n,'hg',area,true).enemies.some(e=>e.encounter==='guard')===RULES.hard.plan[area][n-1].includes('guard'),`${area} hard L${n} guard plan`);
});

test('bodies rise L1 < L2 < L3 in every area; Hard adds more on top of the same area',()=>{
  for(const area of AREAS)for(let s=0;s<20;s++){
    const n=[1,2,3].map(l=>generateLevel(l,`rise-${s}`,area).enemies.length),h=[1,2,3].map(l=>generateLevel(l,`rise-${s}`,area,true).enemies.length);
    assert.ok(n[0]<n[1]&&n[1]<n[2],`${area} normal ${n}`);assert.ok(h[0]<h[1]&&h[1]<h[2],`${area} hard ${h}`);
    for(let i=0;i<3;i++)assert.ok(h[i]>n[i],`${area} hard L${i+1} ${h[i]} > ${n[i]}`);
  }
  for(const a of AREAS)assert.ok(AREA_RULES[a].extraEnemies[0]>=1&&AREA_RULES[a].extraEnemies[2]>AREA_RULES[a].extraEnemies[0]);
  assert.deepEqual(RULES.levels.map(l=>l.enemies),[1,2,3]);
});

// ---- grenade thrower ----
test('grenadier rules: >= 1 s warning, same fuse / radius as the player Grenade, one hit <= 30 % max HP, hint + tip + name',()=>{
  const T=RULES.tools.defs.tool_grenade;
  assert.ok(G.warningMs>=E.telegraphMs);assert.equal(G.fuseMs,T.fuseMs);assert.equal(G.radius,T.radius);
  assert.ok(ENCOUNTER_TYPES.includes('grenadier'));assert.match(hintFor('grenadier'),/^THROWER · /);assert.equal(E.names.grenadier,'THROWER');
  assert.ok(E.tips.grenadier.text.length>10);assert.equal(RULES.enemyTypes.thrower.standoff,5);
  for(const maxHp of [50,100,200])for(const dmgMul of [1,1.25,1.15*1.2,1.25*1.2])assert.ok(encounterDamage({maxHealth:maxHp,level:{dmgMul}},'grenadier')<=Math.floor(maxHp*E.maxHitFraction));
  assert.equal(deathTip({over:true,reason:'death',lastHit:{source:'grenadier'}}).type,'grenadier');
});

test('grenadier is placed on mid / late levels and never alone on L1 in normal play',()=>{
  for(let s=0;s<30;s++){
    const L=generateLevel(2,`gr-${s}`,'archipelago'),t=L.enemies.find(e=>e.encounter==='grenadier');
    assert.ok(t&&t.type==='thrower'&&t.active!==false,`archipelago L2 gr-${s}`);
    assert.ok(L.floors.some(f=>Math.abs(t.x-f.x)<=f.w/2&&Math.abs(t.z-f.z)<=f.d/2));
    assert.ok(Math.hypot(t.x-L.start.x,t.z-L.start.z)>=G.distance-3);
    for(const area of AREAS)assert.ok(!generateLevel(1,`gr-${s}`,area).enemies.some(e=>e.encounter==='grenadier'),'no thrower on normal L1');
  }
  // regular throwers also come from the L2 / L3 mix
  let regular=0;for(let s=0;s<60;s++)for(const n of [2,3])regular+=generateLevel(n,`mix-${s}`,'archipelago').enemies.filter(e=>e.type==='thrower'&&!e.encounter).length;
  assert.ok(regular>0,'the mix produces throwers');
});

function throwerSim(){
  const r=createRound('thrower',0);Object.assign(r.level,{enemyDamage:undefined,enemyWindupMs:0,firstGraceMs:undefined,enemyCooldownMs:undefined});
  const T=RULES.enemyTypes.thrower;
  const t={id:'t1',kind:'enemy',x:0,z:0,r:.48,health:2,speed:0,type:'thrower',encounter:'grenadier',rangeMul:T.rangeMul,cooldownMul:1,standoff:T.standoff,active:true,windupMs:G.warningMs,cooldownMs:G.cooldownMs};
  r.level.enemies=[t];r.level.walls=[];r.level.boxes=[];r.level.nodes=[];
  r.level.rooms=[{x:0,z:2,w:30,d:30,doors:[]}]; // one big room: no arrival grace
  const c=createCombat(r.level,1000);c.graceUntil=1000;c.moveAt=1000;c.visited.add(0);
  return {r,t,c,now:1000};
}
const run=(S,P,ms,until=null)=>{for(let k=0;k<ms/(DT*1000);k++){S.now+=DT*1000;const p=typeof P==='function'?P(S):P;stepCombat(S.r,S.c,p,S.now,DT,[]);if(until?.(S))return true;}return false;};

test('grenadier: warning ring >= 1 s, then a fused blast, then damage inside the ring (<= 30 % HP)',()=>{
  const S=throwerSim(),P={x:0,z:4.5};
  let warnAt=null,lobAt=null,boomAt=null,hpBefore=S.r.health;
  for(let k=0;k<400&&boomAt===null;k++){S.now+=DT*1000;stepCombat(S.r,S.c,P,S.now,DT,[]);
    if(S.t.windupAt!=null&&warnAt===null){warnAt=S.now;assert.deepEqual(S.t.attackTarget,P,'the ring is fixed on where you stood when the warning began');}
    if(S.c.blasts.length&&lobAt===null)lobAt=S.now;
    if(lobAt!==null&&!S.c.blasts.length)boomAt=S.now;}
  assert.ok(warnAt!==null&&lobAt!==null&&boomAt!==null,'warning, lob and blast all happened');
  assert.ok(lobAt-warnAt>=G.warningMs-DT*1000,`warning ${lobAt-warnAt} ms`);
  assert.ok(boomAt-lobAt>=G.fuseMs-DT*1000,`fuse ${boomAt-lobAt} ms`);
  assert.ok(boomAt-warnAt>=E.telegraphMs+G.fuseMs-2*DT*1000,'>= 2 s from first sign to damage');
  const dmg=hpBefore-S.r.health;assert.ok(dmg>0&&dmg<=Math.floor(S.r.maxHealth*E.maxHitFraction),`blast took ${dmg}`);
  assert.equal(S.r.lastHit.source,'grenadier');
});

test('grenadier solution 1: step out of the ring after the warning and the blast misses',()=>{
  const S=throwerSim();let moved=false;
  const P0={x:0,z:4.5};
  run(S,st=>moved?{x:P0.x+G.radius+1,z:P0.z}:P0,5000,st=>{if(st.c.blasts.length)moved=true;return false;});
  assert.ok(moved,'a blast was lobbed');assert.equal(S.r.health,S.r.maxHealth,'dodged');
});

test('grenadier solution 2: kill it during the warning and nothing is lobbed',()=>{
  const S=throwerSim(),P={x:0,z:4.5};
  run(S,P,5000,st=>st.t.windupAt!=null);assert.ok(S.t.windupAt!=null,'winding up');
  assert.equal(hitEnemy(S.r,'t1',S.now,2,P),true);assert.equal(S.t.health,0);
  run(S,P,4000);assert.equal(S.c.blasts.length,0);assert.equal(S.r.health,S.r.maxHealth);
});

// ---- Hard ----
test('Hard rules: table, flag, timer, hp / damage multipliers, 2+ encounters per level, remixed seed',()=>{
  const H=RULES.hard;assert.deepEqual([H.hpMul,H.dmgMul,H.timerMul],[1.4,1.2,.8]);
  assert.equal(isHard(),false);
  for(const area of AREAS){
    for(const n of [1,2,3]){
      const N=generateLevel(n,'hard-x',area,false),Hd=generateLevel(n,'hard-x',area,true);
      assert.equal(Hd.hard,true);assert.equal(N.hard,undefined);
      assert.ok(Hd.encounters.length>=2,`${area} L${n} hard has ${Hd.encounters.length} encounters`);
      assert.deepEqual(Hd.encounters.map(e=>e.type).sort(),[...H.plan[area][n-1]].sort());
      assert.equal(Hd.seed.startsWith('hard^'),true);assert.ok(Hd.enemyDamage>N.enemyDamage);
      const reg=e=>!e.encounter&&!e.extra;
      const nh=N.enemies.filter(reg).map(e=>e.health),hh=Hd.enemies.filter(reg).map(e=>e.health);
      assert.ok(Math.min(...hh)>=Math.min(...nh),'hard enemies are never softer');
      assert.equal(Hd.dmgMul,ruleSet(area,true).dmgMul);
    }
    assert.ok(ruleSet(area,true).hpMul>ruleSet(area,false).hpMul);
  }
  // the same raid seed gives a different layout draw than normal, but is deterministic
  assert.deepEqual(generateLevel(3,'hard-y','bunker',true),generateLevel(3,'hard-y','bunker',true));
  assert.notDeepEqual(generateLevel(3,'hard-y','bunker',true).nodes,generateLevel(3,'hard-y','bunker',false).nodes);
  // damage per hit stays under the cap even with area x Hard multipliers
  for(const area of AREAS)for(const t of ['guard','turret','patrol','swarm','grenadier'])assert.ok(encounterDamage({maxHealth:100,level:{dmgMul:ruleSet(area,true).dmgMul}},t)<=30,`${area} ${t}`);
});

test('Hard loot tilts up the tiers and adds Core Ash on L2 / L3 only',()=>{
  const ash=(n,hard)=>{let c=0;for(let s=0;s<200;s++)c+=generateLevel(n,`ash-${s}`,'bunker',hard).lootBoxes.filter(b=>b.item==='core_ash').length;return c;};
  assert.equal(ash(1,true),0);assert.ok(ash(3,true)>ash(3,false)*2,'Core Ash is far more common on Hard L3');assert.ok(ash(2,true)>ash(2,false));
});

test('?hard=1 sets the Hard clock (-20 %), tags the round and the raid result; default raids are untouched',()=>{
  assert.equal(readLaunch('?seed=a&hard=1').hard,true);assert.equal(readLaunch('?seed=a').hard,false);assert.equal(readLaunch('?hard=yes').hard,false);
  const n=createRound('t',0);assert.equal(n.durationMs,ROUND_DURATION_MS);assert.equal(n.hard,false);
  withHard(true,()=>{
    const r=createRound('t',100);assert.equal(r.durationMs,Math.round(ROUND_DURATION_MS*.8));assert.equal(r.remainingMs,r.durationMs);assert.equal(r.deadline,100+r.durationMs);
    assert.equal(r.level.hard,true,'level 1 is generated with the Hard rules');
    r.over=true;r.reason='death';assert.equal(buildRaidResult(r).hard,true);
  });
  assert.equal(isHard(),false);const done=createRound('t',0);done.over=true;done.reason='death';assert.equal('hard' in buildRaidResult(done),false);
});
