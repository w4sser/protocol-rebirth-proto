// v1.57: data/quests.js questFacts must match what the level generator actually spawns (quests must stay solvable).
import test from 'node:test'; import assert from 'node:assert'; import fs from 'node:fs'; import vm from 'node:vm';
import { generateLevel, setArea, AREAS } from '../levels.js';
const ctx = { window:{} }; ctx.DATA = undefined; vm.createContext(ctx);
vm.runInContext('var window=this; var DATA=window.DATA={};' + fs.readFileSync(new URL('../../data/quests.js', import.meta.url), 'utf8'), ctx);
const F = ctx.DATA.questFacts;
test('questFacts cover every area and zone', () => { for(const a of AREAS) for(let n = 1; n <= 3; n++) assert.ok(F[a] && F[a][n], a + n); });
test('listed enemies, items and houses really appear', () => {
  const S = 120;
  for(const a of AREAS){ setArea(a); for(let n = 1; n <= 3; n++){ const f = F[a][n], enem = {}, items = {}; let houses = 0;
    for(let s = 0; s < S; s++){ const L = generateLevel(n, 'qf' + s, a);
      for(const t of new Set(L.enemies.map(e => e.type))) enem[t] = (enem[t] || 0) + 1;
      for(const i of new Set([...L.lootBoxes.map(b => b.item), ...((L.house && L.house.containers) || []).map(c => c.item)])) items[i] = (items[i] || 0) + 1;
      if((L.house ? L.house.containers.length : 0) >= f.houses) houses++; }
    for(const t of f.enemies) assert.ok((enem[t] || 0) / S >= 0.4, a + n + ' enemy ' + t);
    for(const i of f.items) assert.ok((items[i] || 0) / S >= 0.12, a + n + ' item ' + i);
    assert.ok(houses / S >= 0.95, a + n + ' houses'); } }
});
