import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,RULES,makeDrum,setArea} from '../levels.js';
import {createRound,detonateDrum,igniteDrums} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';

const seeds=Array.from({length:30},(_,i)=>`drum-${i}`);

test('ordinary Bunker raids place 1-2 fuel drums per room, never over the shared cap',()=>{
  setArea('bunker');
  for(const s of seeds)for(const n of [1,2,3]){
    const l=generateLevel(n,s);
    assert.ok(l.barrels,`${s} L${n}: bunker raids carry a barrels array`);
    for(const room of l.rooms){
      const inRoom=l.barrels.filter(b=>Math.abs(b.x-room.x)<=room.w/2&&Math.abs(b.z-room.z)<=room.d/2);
      assert.ok(inRoom.length<=RULES.interactives.maxPerRoom,`${s} L${n} ${room.name}: ${inRoom.length} drums over the cap`);
    }
  }
  setArea('bunker');
});

test('fuel drums are Bunker-only: archipelago and town raids carry none',()=>{
  for(const area of ['archipelago','town']){
    setArea(area);
    for(const s of seeds.slice(0,5))for(const n of [1,2,3])
      assert.ok(!generateLevel(n,s).barrels?.length,`${area} ${s} L${n} should not place fuel drums`);
  }
  setArea('bunker');
});

test('fuel drum placement is deterministic per seed',()=>{
  setArea('bunker');
  for(const s of seeds)for(const n of [1,2,3]){
    const a=generateLevel(n,s),b=generateLevel(n,s);
    assert.deepEqual(a.barrels,b.barrels,`${s} L${n}`);
  }
});

test('fuel drums clear walls/crates, corridors/doors, nodes/loot/the exit, and each other',()=>{
  setArea('bunker');
  const D=RULES.drum;
  for(const s of seeds)for(const n of [1,2,3]){
    const l=generateLevel(n,s);
    const corridors=[...l.corridors??[],...(l.deadEnds??[]),...(l.closet?[l.closet]:[]),...(l.doors??[])];
    const keep=[l.start,l.exit,...l.nodes,...l.lootBoxes];
    for(const b of l.barrels){
      for(const o of [...l.walls,...l.boxes])
        assert.ok(!(Math.abs(b.x-o.x)<o.w/2+D.r&&Math.abs(b.z-o.z)<o.d/2+D.r),`${s} L${n}: drum overlaps a solid`);
      for(const o of corridors)
        assert.ok(!(Math.abs(b.x-o.x)<o.w/2+D.r&&Math.abs(b.z-o.z)<o.d/2+D.r),`${s} L${n}: drum blocks a corridor/door`);
      for(const o of keep)
        assert.ok(Math.hypot(b.x-o.x,b.z-o.z)>=2.2,`${s} L${n}: drum too close to a node/loot/start/exit`);
      for(const o of l.barrels)if(o!==b)assert.ok(Math.hypot(b.x-o.x,b.z-o.z)>=D.r*3,`${s} L${n}: drums overlap each other`);
    }
  }
});

test('fuel drums never share a room with a precision scripted encounter (guard/turret/swarm/shield)',()=>{
  setArea('bunker');
  for(const s of seeds)for(const n of [2,3]){
    const l=generateLevel(n,s);
    for(const room of l.rooms){
      const hasPrecisionEncounter=l.enemies.some(e=>e.encounter&&e.encounter!=='patrol'&&Math.abs(e.x-room.x)<=room.w/2&&Math.abs(e.z-room.z)<=room.d/2);
      if(!hasPrecisionEncounter)continue;
      const drumsHere=l.barrels.filter(b=>Math.abs(b.x-room.x)<=room.w/2&&Math.abs(b.z-room.z)<=room.d/2);
      assert.equal(drumsHere.length,0,`${s} L${n} ${room.name}: a drum shares a room with a scripted encounter`);
    }
  }
});

test('a patrol room (L1\'s gentle first teacher) still gets fuel drums, same as any other room',()=>{
  setArea('bunker');
  let sawPatrolRoomWithDrum=false;
  for(const s of seeds){
    const l=generateLevel(1,s);
    const hasPatrol=l.enemies.some(e=>e.encounter==='patrol');
    assert.ok(hasPatrol,`${s} L1: expected the patrol teacher`);
    if(l.barrels.length)sawPatrolRoomWithDrum=true;
  }
  assert.ok(sawPatrolRoomWithDrum,'at least one seed places a drum in L1 despite its patrol');
});

test('a drum detonates when shot, damaging and knocking back enemies in its blast ring',()=>{
  setArea('bunker');
  const r=createRound('drum-shot',0);
  const drum=makeDrum('test-drum',r.level.rooms[0].x+2,r.level.rooms[0].z,{});
  r.level.barrels=[drum];
  r.level.enemies=[{id:'e1',kind:'enemy',type:'grunt',x:drum.x+1,z:drum.z,r:.48,health:3,speed:0,active:true}];
  const w=createWeapon(),p={x:drum.x-3,z:drum.z};
  assert.ok(fireAimedWeapon(w,r,p,{x:drum.x-p.x,z:drum.z-p.z},100,[]));
  assert.ok(stepWeapon(w,r,250,.4,[]));
  assert.equal(drum.active,true);
  assert.equal(r.level.enemies[0].health,0);
  assert.equal(r.drumExplosion.kills,1);
});

test('a grenadier blast cooks off a drum (telegraph, not an instant kill), which chains hop by hop',()=>{
  const r=createRound('drum-chain',0);
  // a sits inside the grenadier's own blast radius; b is outside it but inside a's chainRadius;
  // c is outside a's chainRadius but inside b's -- a 3-hop cascade, each hop its own cook-off delay.
  const G=RULES.encounters.grenadier.radius,D=RULES.drum;
  const a=makeDrum('a',0,0,{}),b=makeDrum('b',G+.5,0,{}),c=makeDrum('c',G+.5+D.chainRadius-.5,0,{});
  assert.ok(G+.5<=D.chainRadius,'fixture assumption: b is within a\'s chain radius');
  r.level.barrels=[a,b,c];r.level.enemies=[];
  const combat=createCombat(r.level,0);
  combat.blasts.push({id:1,x:0,z:0,fromX:-1,fromZ:0,radius:G,at:0,detonateAt:0,source:'thrower',enemyId:'x'});
  const player={x:100,z:100};
  stepCombat(r,combat,player,0,.016,[]);
  assert.equal(a.cookingAt,0,'the grenadier blast starts drum a cooking off');
  assert.equal(a.active,false,'cooking is a telegraph, not an immediate detonation');
  assert.equal(b.cookingAt,null,'b is outside the grenadier blast itself');
  stepCombat(r,combat,player,a.chainDelayMs-1,.016,[]);
  assert.equal(a.active,false,'not yet -- the telegraph has not elapsed');
  stepCombat(r,combat,player,a.chainDelayMs+1,.016,[]);
  assert.equal(a.active,true,'the telegraph elapsed; drum a detonates');
  assert.equal(b.cookingAt,a.chainDelayMs+1,'drum a detonating chains into drum b, within its own chain radius');
  assert.equal(c.cookingAt,null,'drum c is still out of range until b itself detonates');
  const bDoneAt=b.cookingAt+b.chainDelayMs+1;
  stepCombat(r,combat,player,bDoneAt,.016,[]);
  assert.equal(b.active,true,'drum b\'s own telegraph elapsed and it detonates');
  assert.equal(c.cookingAt,bDoneAt,'drum b detonating chains into drum c in turn');
});

test('outside the FTUE, a drum blast hurts and knocks back the player; the FTUE drum stays player-safe',()=>{
  const ordinary=createRound('drum-player',0);
  const drum=makeDrum('d1',0,0,{});
  ordinary.level.barrels=[drum];ordinary.level.enemies=[];
  const player={x:1,z:0};
  assert.ok(detonateDrum(ordinary,'d1',0,[],player));
  assert.equal(ordinary.health,100-drum.playerDamage);
  assert.ok(player.x>1,'the player is knocked outward from the drum');
  assert.ok(drum.playerDamage<100,'tuned as a warning, not a full-HP instakill');

  const ftueRound=createRound('drum-ftue-safe',0);
  const ftueDrum=makeDrum('ftue-barrel-1',0,0,{playerSafe:true});
  ftueRound.level.barrels=[ftueDrum];ftueRound.level.enemies=[];
  const ftuePlayer={x:1,z:0};
  assert.ok(detonateDrum(ftueRound,'ftue-barrel-1',0,[],ftuePlayer));
  assert.equal(ftueRound.health,100,'the FTUE drum never damages the player');
  assert.deepEqual(ftuePlayer,{x:1,z:0},'the FTUE drum never knocks the player back');
});

test('a grenadier blast cooks off a nearby drum, which does not immediately explode',()=>{
  const r=createRound('drum-grenadier',0);
  const drum=makeDrum('g1',1,0,{});
  r.level.barrels=[drum];r.level.enemies=[];
  igniteDrums(r,0,0,RULES.encounters.grenadier.radius,50);
  assert.equal(drum.cookingAt,50);
  assert.equal(drum.active,false);
});
