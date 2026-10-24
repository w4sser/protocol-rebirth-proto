// v1.87: a tracked extract quest (Fuse Box: 2 Fuse from Bunker L2) guarantees one of its item on that level; off by default.
import test from 'node:test'; import assert from 'node:assert';
import { generateLevel, setArea, setQuestLoot } from '../levels.js';
test('tracked Fuse Box puts a Fuse on every Bunker L2, and ~1-2 raids finish it', () => {
  setArea('bunker'); setQuestLoot({ item:'fuse', level:2 });
  const N = 300;
  for(let s = 0; s < N; s++){ const f = generateLevel(2, 'ql' + s, 'bunker').lootBoxes.filter(b => b.item === 'fuse').length; assert.ok(f >= 1, 'seed ' + s); }
  assert.ok(generateLevel(1, 'ql1', 'bunker').lootBoxes.every(b => !b.quest), 'other levels untouched');
  setQuestLoot(null);
  let none = 0; for(let s = 0; s < N; s++) if(!generateLevel(2, 'ql' + s, 'bunker').lootBoxes.some(b => b.item === 'fuse')) none++;
  assert.ok(none > 0, 'without the quest the table is unchanged');
});
