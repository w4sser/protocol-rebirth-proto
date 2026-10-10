import test from 'node:test';
import assert from 'node:assert/strict';
const round = await import('../round.js').catch(() => ({}));
test('the round ends at eight minutes even after background time without frames',()=>{
  assert.equal(typeof round.createRound,'function','round state exists');
  const r=round.createRound('clock',1000);
  round.tickRound(r,480999);assert.equal(r.over,false);assert.equal(r.remainingMs,1);
  round.tickRound(r,481000);assert.equal(r.over,true);assert.equal(r.remainingMs,0);
  assert.equal(round.activateNode(r,r.level.nodes[0].id,481000),false);
});
test('exit stays closed until every node is lit, and advances without resetting the clock',()=>{
  assert.equal(typeof round.createRound,'function');
  const r=round.createRound('advance',0);
  assert.equal(round.enterExit(r,r.level.exit,10000),null);assert.equal(r.level.number,1);
  round.activateNode(r,r.level.nodes[0].id,10001);
  assert.equal(round.enterExit(r,r.level.exit,10002),'next');assert.equal(r.level.number,2);
  assert.equal(r.deadline,480000);assert.equal(r.remainingMs,469998);
  round.activateNode(r,r.level.nodes[0].id,10003);
  assert.equal(round.enterExit(r,r.level.exit,10004),null);
  round.activateNode(r,r.level.nodes[1].id,10005);
  assert.equal(round.enterExit(r,{x:-100,z:-100},10006),null);
  assert.equal(round.enterExit(r,r.level.exit,10007),'next');assert.equal(r.level.number,3);
});
test('timeout wins over a level transition at the deadline',()=>{
  assert.equal(typeof round.createRound,'function');
  const r=round.createRound('deadline',0);
  round.activateNode(r,r.level.nodes[0].id,100);
  assert.equal(round.enterExit(r,r.level.exit,480000),null);assert.equal(r.over,true);assert.equal(r.level.number,1);
});
test('clearing three levels immediately ends and freezes the successful round',()=>{
  assert.equal(typeof round.createRound,'function');
  const r=round.createRound('three',0);
  for(let number=1;number<=3;number++){
    for(const n of r.level.nodes)round.activateNode(r,n.id,number*1000);
    assert.equal(round.enterExit(r,r.level.exit,number*1000),number===3?'complete':'next');
  }
  assert.equal(r.cleared,true);assert.equal(r.over,true);assert.equal(r.reason,'complete');assert.equal(r.level.number,3);
  round.tickRound(r,480000);assert.equal(r.remainingMs,477000);
  const fresh=round.createRound('new-seed',500000);
  assert.equal(fresh.level.number,1);assert.equal(fresh.remainingMs,480000);
  assert.notEqual(fresh.level.seed,r.level.seed);
});
test('death ends the run and freezes remaining time and progression in its summary',()=>{
  assert.equal(typeof round.takeDamage,'function');
  assert.equal(typeof round.roundSummary,'function');
  const r=round.createRound('death',0);
  round.activateNode(r,r.level.nodes[0].id,1000);round.enterExit(r,r.level.exit,2000);
  round.takeDamage(r,100,70000);
  assert.equal(r.over,true);assert.equal(r.health,0);
  assert.deepEqual(round.roundSummary(r),{reason:'death',levelsCleared:1,enemiesDefeated:0,nodesLit:1,remainingMs:410000,extracted:{scrap_alloy:0,power_cell:0,cable:0,fuse:0,medkit:0},lost:{scrap_alloy:0,power_cell:0,cable:0,fuse:0,medkit:0}});
  round.tickRound(r,600000);
  assert.equal(round.roundSummary(r).remainingMs,410000,'time stays frozen after death');
  assert.equal(round.activateNode(r,r.level.nodes[0].id,71000),false);
  const fresh=round.createRound('fresh',80000);
  assert.equal(fresh.health,100);assert.equal(fresh.nodesLit,0);assert.equal(fresh.levelsCleared,0);
});
test('timeout summary records zero time and cannot be overwritten by death',()=>{
  assert.equal(typeof round.takeDamage,'function');
  const r=round.createRound('timeout',0);
  round.takeDamage(r,100,480000);
  assert.deepEqual(round.roundSummary(r),{reason:'timeout',levelsCleared:0,enemiesDefeated:0,nodesLit:0,remainingMs:0,extracted:{scrap_alloy:0,power_cell:0,cable:0,fuse:0,medkit:0},lost:{scrap_alloy:0,power_cell:0,cable:0,fuse:0,medkit:0}});
});
test('defeated enemies count once across levels and reset with a new round',()=>{
  const r=round.createRound('kills',0),id=r.level.enemies[0].id;
  round.hitEnemy(r,id,10);assert.equal(r.enemiesDefeated,0);
  round.hitEnemy(r,id,20);round.hitEnemy(r,id,30);assert.equal(r.enemiesDefeated,1);
  round.activateNode(r,r.level.nodes[0].id,40);round.enterExit(r,r.level.exit,50);
  assert.equal(round.roundSummary(r).enemiesDefeated,1);
  assert.equal(round.createRound('fresh',100).enemiesDefeated,0);
});

test('health kits can be collected at full health and used later',()=>{
  const r=round.createRound('medkit',0);r.level.lootBoxes=[{id:'medkit',x:0,z:0,item:'medkit',collected:false}];
  assert.equal(round.collectLoot(r,{x:0,z:0},1000),true);assert.equal(r.health,100);assert.equal(r.bag.medkit,1);
  assert.equal(round.useHealthKit(r,1001),false);assert.equal(r.bag.medkit,1);
  round.takeDamage(r,10,1100);assert.equal(round.useHealthKit(r,1200),true);assert.equal(r.health,100);assert.equal(r.bag.medkit,0);
});
