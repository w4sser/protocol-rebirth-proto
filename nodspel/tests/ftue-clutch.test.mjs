import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRound,activateNode,enterExit,exitIsOpen,tickRound,takeDamage} from '../round.js?v=2.22.2';
import {FTUE,initFtueRound,startFtueClutch,ftueClutchSeconds} from '../ftue.js?v=2.22.2';
import {RULES} from '../levels.js?v=2.22.2';
import {STAKES} from '../stakes.js?v=2.22.2';
import {createPixelFeedback} from '../fx-feedback.js?v=2.22.2';

function setup(attempt=0){
  const r=createRound('ftue-clutch',0);
  initFtueRound(r,{ftue:true},{getItem:()=>JSON.stringify({attempts:attempt})});
  return r;
}
function open(r,now=100){for(const n of r.level.nodes)activateNode(r,n.id,now);}

test('first open exit immediately starts exactly one weak, aggro FTUE hunter wave with retry scaling',()=>{
  assert.ok(FTUE.clutch.hunters>=2&&FTUE.clutch.hunters<=3);
  for(const attempt of [0,1,2]){
    const r=setup(attempt),before=r.level.enemies.length;
    assert.equal(r.ftueClutch,undefined);
    open(r);
    const clutch=r.ftueClutch;
    assert.equal(clutch.startedAt,100);
    assert.equal(clutch.endsAt,100+FTUE.clutch.countdownMs);
    assert.equal(r.level.enemies.length,before+FTUE.clutch.hunters);
    for(const e of clutch.spawned){
      assert.ok(r.level.enemies.includes(e));
      assert.equal(e.type,'rusher');
      assert.ok(e.active&&e.aggro&&e.hunter&&e.swarm);
      assert.equal(e.health,STAKES.waveRusherHealth*r.ftue.healthMul);
      assert.equal(e.speed,RULES.levels[0].enemySpeed*RULES.enemyTypes.rusher.speedMul*r.ftue.speedMul);
    }
    for(const now of [101,500,11000]){tickRound(r,now);startFtueClutch(r,now);}
    assert.equal(r.ftueClutch,clutch);
    assert.equal(r.level.enemies.length,before+FTUE.clutch.hunters);
    assert.equal(r.level.number,1);
  }
});

test('countdown reaches zero without failure, lost loot, or closing extraction',()=>{
  const r=setup();r.bag.scrap_alloy=2;
  assert.equal(ftueClutchSeconds(r,0),null);
  open(r);
  const end=r.ftueClutch.endsAt;
  assert.equal(ftueClutchSeconds(r,100),Math.ceil(FTUE.clutch.countdownMs/1000));
  assert.equal(ftueClutchSeconds(r,end-1001),2);
  assert.equal(ftueClutchSeconds(r,end-1),1);
  for(const now of [end,end+5000]){
    tickRound(r,now);
    assert.equal(ftueClutchSeconds(r,now),0);
    assert.equal(r.over,false);assert.equal(r.reason,null);
    assert.equal(r.bag.scrap_alloy,2);assert.ok(exitIsOpen(r));
    assert.equal(enterExit(r,{x:100,z:100},now),null);
  }
});

for(const delay of [0,FTUE.clutch.countdownMs+1000])test(`beam contact extracts and secures loot at countdown offset ${delay}`,()=>{
  const r=setup();r.bag.scrap_alloy=2;open(r);
  const level=r.level;
  assert.equal(enterExit(r,level.exit,100+delay),'complete');
  assert.equal(r.level,level);assert.equal(r.levelsCleared,1);
  assert.equal(r.reason,'extract');assert.ok(r.over);
  assert.equal(r.extracted.scrap_alloy,2);assert.equal(r.bag.scrap_alloy,0);
  assert.equal(ftueClutchSeconds(r,100+delay),null);
});

test('attempt 3 remains protected after both countdown and raid deadline expire',()=>{
  const r=setup(2);r.bag.scrap_alloy=2;open(r);
  const now=r.deadline+FTUE.clutch.countdownMs;
  takeDamage(r,1e9,now);tickRound(r,now);
  assert.equal(r.health,1);assert.equal(r.over,false);assert.equal(ftueClutchSeconds(r,now),0);
  assert.equal(enterExit(r,r.level.exit,now),'complete');
  assert.equal(r.reason,'extract');assert.equal(r.extracted.scrap_alloy,2);
});

test('existing extraction beam lights at the exit immediately and stays lit after countdown',()=>{
  const r=setup(),events=[];
  const pixel={enabled:true,clear(){},update(){},stop(slot){slot.active=false;},
    spawn(name,x,z,options){events.push({name,x,z,options});return {active:true,serial:1,sprite:{position:{set(){}}}};}};
  const feedback=createPixelFeedback(pixel,{}),world={lootBoxes:[]};
  feedback.sync(r,world,r.level.start,0,.016);
  assert.equal(events.length,0);
  open(r);feedback.sync(r,world,r.level.start,100,.016);
  assert.deepEqual(events,[{name:'respawn',x:r.level.exit.x,z:r.level.exit.z,options:{loop:true}}]);
  tickRound(r,r.ftueClutch.endsAt+1000);
  feedback.sync(r,world,r.level.start,r.gameNow,.016);
  assert.equal(events.length,1,'beam persists without respawning');
  assert.ok(exitIsOpen(r));
});

test('non-FTUE and intro-only raids preserve state byte for byte through clutch helpers and keep normal exit behavior',()=>{
  for(const intro of [false,true]){
    const r=createRound('normal-clutch',0);
    initFtueRound(r,{intro},{getItem(){throw Error('must not read FTUE storage');}});
    open(r);const before=JSON.stringify(r);
    startFtueClutch(r,100);
    assert.equal(ftueClutchSeconds(r,100),null);
    assert.equal(JSON.stringify(r),before);
    assert.equal(r.level.enemies.some(e=>e.id.startsWith('ftue-hunter')),false);
    r.bag.scrap_alloy=2;
    assert.equal(enterExit(r,r.level.exit,101),'next');
    assert.equal(r.level.number,2);assert.equal(r.over,false);
    assert.equal(r.bag.scrap_alloy,2);assert.equal(r.extracted.scrap_alloy,0);
  }
});

test('clutch cannot start before exit opens, on later sectors, or on ended raids',()=>{
  const r=setup();startFtueClutch(r,0);assert.equal(r.ftueClutch,undefined);
  for(const state of [{over:true},{level:{...r.level,number:2}}]){
    const next=setup();for(const n of next.level.nodes)n.active=true;
    Object.assign(next,state);startFtueClutch(next,100);assert.equal(next.ftueClutch,undefined);
  }
});

test('game presents countdown through existing notice and renders spawned hunters',async()=>{
  const src=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(src,/spawnEnemyVisuals\(clutch\.spawned\)/);
  assert.match(src,/EXTRACT IN \$\{seconds\}/);
  assert.match(src,/EXTRACT OPEN - Reach the beam to secure your loot\./);
});
