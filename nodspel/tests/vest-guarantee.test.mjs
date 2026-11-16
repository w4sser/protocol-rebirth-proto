// PRB-162: craft-material guarantee for the Scavenger Vest recipe (2 Polymer Plate + 1 Scrap Alloy),
// once the Fabricator is built but the player hasn't raided for those materials yet. Generalizes
// setQuestLoot (one tracked item) to a short list, overwriting existing level-1 crates -- never
// adding new ones, so it stays compatible with the early-room crate-count budget.
import test from 'node:test'; import assert from 'node:assert/strict';
import '../../data/items.js';
import { generateLevel, setArea, setGuaranteeLoot, setQuestLoot, RULES } from '../levels.js';
import { readVestGuarantee } from '../progression-goal.js';
import { readLaunch } from '../raid-result.js';

test('readVestGuarantee validates the ?vestGuarantee= payload', () => {
  assert.deepEqual(readVestGuarantee(JSON.stringify([{ id:'polymer_plate', count:2 }, { id:'scrap_alloy', count:1 }])),
    [{ item:'polymer_plate', count:2 }, { item:'scrap_alloy', count:1 }]);
  assert.equal(readVestGuarantee(null), null);
  assert.equal(readVestGuarantee('not json'), null);
  assert.equal(readVestGuarantee(JSON.stringify([])), null, 'empty list is invalid');
  assert.equal(readVestGuarantee(JSON.stringify([{ id:'not_a_real_item', count:1 }])), null, 'unknown item id rejected');
  assert.equal(readVestGuarantee(JSON.stringify([{ id:'polymer_plate', count:0 }])), null, 'count must be >= 1');
  assert.equal(readVestGuarantee(JSON.stringify([{ id:'polymer_plate', count:1.5 }])), null, 'count must be an integer');
  assert.equal(readVestGuarantee(JSON.stringify([{ id:'polymer_plate', count:21 }])), null, 'count capped at 20');
  assert.equal(readVestGuarantee(JSON.stringify(Array.from({ length:7 }, () => ({ id:'polymer_plate', count:1 })))), null, 'list capped at 6 entries');
  assert.equal(readVestGuarantee(JSON.stringify([{ id:'polymer_plate', count:1 }, { id:'polymer_plate', count:1 }])), null, 'duplicate item ids rejected');
  assert.deepEqual(readLaunch('?vestGuarantee=' + encodeURIComponent(JSON.stringify([{ id:'scrap_alloy', count:1 }]))).vestGuarantee,
    [{ item:'scrap_alloy', count:1 }]);
  assert.equal(readLaunch('?seed=a').vestGuarantee, null);
});

const units=(level,id)=>level.lootBoxes.reduce((n,b)=>n+(b.item===id?(b.quantity??1):0)+(b.contents||[]).filter(x=>x===id).length,0);
test('missing vest units fit existing caches with the early cap and a concurrent quest', () => {
  setArea('bunker');
  for(let seed=0;seed<200;seed++){
    setGuaranteeLoot(null);setQuestLoot({item:'cable',level:1});
    const before=generateLevel(1,'vg'+seed,'bunker');
    setGuaranteeLoot([{item:'polymer_plate',count:2},{item:'scrap_alloy',count:1},{item:'salvage_crate',count:1}]);
    const level=generateLevel(1,'vg'+seed,'bunker');
    assert.equal(level.lootBoxes.length,before.lootBoxes.length,'no added crate');
    assert.ok(level.lootBoxes.some(b=>b.item==='cable'&&b.quest),'quest supply preserved');
    for(const room of level.rooms){
      const count=level.lootBoxes.filter(b=>level.rooms.reduce((a,c)=>Math.hypot(b.x-c.x,b.z-c.z)<Math.hypot(b.x-a.x,b.z-a.z)?c:a)===room).length;
      assert.ok(count>=RULES.earlyLoot.minCratesPerRoom&&count<=RULES.earlyLoot.maxCratesPerRoom);
    }
    assert.ok(units(level,'polymer_plate')>=2);
    assert.ok(units(level,'scrap_alloy')>=1);
    assert.ok(units(level,'salvage_crate')>=1);
  }
  setQuestLoot(null);setGuaranteeLoot(null);
});

test('grouped vest supplies can be collected and extracted through the normal pickup path', async () => {
  const {createRound,collectLoot,extractRound}=await import('../round.js');
  // round.js uses the versioned module instance, just as the live game does.
  const live=await import('../levels.js?v=2.28.43');
  live.setGuaranteeLoot([{item:'polymer_plate',count:2},{item:'scrap_alloy',count:1},{item:'salvage_crate',count:1}]);
  const round=createRound('vest-pickups',0,{...RULES.playerStats.base,bagCapacity:20});
  const boxes=round.level.lootBoxes.filter(b=>b.guarantee);
  assert.ok(boxes.length);
  for(const box of boxes){
    for(let t=0;t<10&&!box.collected;t++)collectLoot(round,box,t);
    assert.ok(box.collected,'all grouped units collectible');
  }
  assert.equal(round.bag.polymer_plate,2);
  assert.equal(round.bag.scrap_alloy,1);
  assert.equal(round.bag.salvage_crate,1);
  round.levelsCleared=1;assert.ok(extractRound(round,20));
  assert.equal(round.extracted.polymer_plate,2);
  assert.equal(round.extracted.scrap_alloy,1);
  assert.ok(round.extracted.salvage_crate*globalThis.DATA.items.find(i=>i.id==='salvage_crate').grantsCurrency.scrap>=15);
  live.setGuaranteeLoot(null);
});

test('a fully satisfiable guarantee lands every item, and other levels/areas stay untouched', () => {
  setArea('bunker');
  setGuaranteeLoot([{ item:'scrap_alloy', count:1 }]);
  for(let s = 0; s < 50; s++){
    const level = generateLevel(1, 'vg1-' + s, 'bunker');
    assert.equal(level.lootBoxes.filter(b => b.item === 'scrap_alloy' && b.guarantee).length, 1, 'seed ' + s);
    setGuaranteeLoot([{ item:'scrap_alloy', count:1 }]);
  }
  setGuaranteeLoot([{ item:'scrap_alloy', count:1 }]);
  assert.ok(generateLevel(2, 'vg-l2', 'bunker').lootBoxes.every(b => !b.guarantee), 'level 2 is untouched (guarantee is level-1 only)');
  setGuaranteeLoot(null);
  let none = 0;
  for(let s = 0; s < 50; s++) if(!generateLevel(1, 'vg-off-' + s, 'bunker').lootBoxes.some(b => b.item === 'scrap_alloy')) none++;
  assert.ok(none > 0, 'without the guarantee the table rolls normally again');
});

test('setGuaranteeLoot rejects malformed/unknown entries the same way readVestGuarantee does', () => {
  setArea('bunker');
  setGuaranteeLoot([{ item:'not_a_real_item', count:2 }, { item:'scrap_alloy', count:1 }]);
  const level = generateLevel(1, 'vg-bad', 'bunker');
  assert.equal(level.lootBoxes.filter(b => b.item === 'not_a_real_item').length, 0);
  assert.equal(level.lootBoxes.filter(b => b.item === 'scrap_alloy' && b.guarantee).length, 1, 'the valid entry still applies');
  setGuaranteeLoot(null);
});

test('Big Map launches carry the same missing vest materials in existing caches', () => {
 setArea('bunker');
 for(let seed=0;seed<20;seed++){
  setGuaranteeLoot(null);const before=generateLevel(1,'vest-big-'+seed,'bunker',false,true);
  setGuaranteeLoot([{item:'polymer_plate',count:2},{item:'scrap_alloy',count:1},{item:'salvage_crate',count:1}]);
  const level=generateLevel(1,'vest-big-'+seed,'bunker',false,true);
  assert.equal(level.lootBoxes.length,before.lootBoxes.length);
  const guaranteed={lootBoxes:level.lootBoxes.filter(b=>b.guarantee)};
  assert.equal(units(guaranteed,'polymer_plate'),2);assert.equal(units(guaranteed,'scrap_alloy'),1);assert.equal(units(guaranteed,'salvage_crate'),1);
 }
 setGuaranteeLoot(null);
});
