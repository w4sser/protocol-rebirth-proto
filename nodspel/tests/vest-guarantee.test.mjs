// PRB-162: craft-material guarantee for the Scavenger Vest recipe (2 Polymer Plate + 1 Scrap Alloy),
// once the Fabricator is built but the player hasn't raided for those materials yet. Generalizes
// setQuestLoot (one tracked item) to a short list, overwriting existing level-1 crates -- never
// adding new ones, so it stays compatible with the early-room crate-count budget.
import test from 'node:test'; import assert from 'node:assert/strict';
import '../../data/items.js';
import { generateLevel, setArea, setGuaranteeLoot } from '../levels.js';
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

test('setGuaranteeLoot overwrites existing level-1 crates deterministically, never adding new ones', () => {
  setArea('bunker');
  setGuaranteeLoot([{ item:'polymer_plate', count:2 }, { item:'scrap_alloy', count:1 }]);
  const N = 200;
  for(let s = 0; s < N; s++){
    const level = generateLevel(1, 'vg' + s, 'bunker');
    const before = level.lootBoxes.length;
    const eligible = level.lootBoxes.filter(b => !b.key).length; // a locked closet's keycard box can't be overwritten
    const pp = level.lootBoxes.filter(b => b.item === 'polymer_plate' && b.guarantee).length;
    const sa = level.lootBoxes.filter(b => b.item === 'scrap_alloy' && b.guarantee).length;
    // Level 1 has 2 crates (RULES.loot.counts[0]); the need (3) exceeds that, so this single level
    // claims as many as exist and the remainder stays pending for the next raid's recomputed need.
    assert.equal(level.lootBoxes.length, before, 'seed ' + s + ': no crates added, only overwritten');
    assert.equal(pp + sa, Math.min(eligible, 3), 'seed ' + s + ': claims every available crate up to the need');
    setGuaranteeLoot([{ item:'polymer_plate', count:2 }, { item:'scrap_alloy', count:1 }]); // reset between seeds
  }
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
