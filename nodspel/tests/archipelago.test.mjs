import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,AREAS,AREA_RULES,setArea,RULES} from '../levels.js';
test('area order is bunker → archipelago → town',()=>assert.deepEqual(AREAS,['bunker','archipelago','town']));
test('archipelago is larger, harder and carries the Town Survey on level 3',()=>{
  for(const n of [1,2,3]){const b=generateLevel(n,'arch-s','bunker'),a=generateLevel(n,'arch-s','archipelago');
    assert.equal(a.archipelago,true);assert.equal(a.area,'archipelago');assert.match(a.title,/^Archipelago/);
    const area=L=>L.rooms.reduce((s,r)=>s+r.w*r.d,0);assert.ok(area(a)>area(b)*1.3,'more open');
    assert.equal(a.enemies.length,b.enemies.length+AREA_RULES.archipelago.extraEnemies[n-1]);
    assert.ok(a.enemies.every(e=>e.health>=Math.round((n===3?RULES.enemyHealth:RULES.levels[n-1].enemyHealth)*1.25)));
    assert.ok(a.enemyDamage>b.enemyDamage);
    const solids=[...a.walls,...a.boxes];for(const e of a.enemies.filter(e=>e.extra))assert.ok(!solids.some(o=>Math.abs(e.x-o.x)<o.w/2+.4&&Math.abs(e.z-o.z)<o.d/2+.4),'extra enemy off walls');}
  assert.ok(generateLevel(3,'arch-s','archipelago').lootBoxes.some(b=>b.item==='town_survey'&&b.scout));
  assert.ok(generateLevel(3,'arch-s','bunker').lootBoxes.some(b=>b.item==='archipelago_chart'));
  assert.ok(!generateLevel(2,'arch-s','bunker').lootBoxes.some(b=>b.scout));
});
test('town is gated last and scales hardest',()=>{const t=generateLevel(2,'t','town'),a=generateLevel(2,'t','archipelago');assert.ok(t.enemyDamage>=a.enemyDamage);assert.equal(setArea('archipelago'),'archipelago');setArea('bunker');});
test('archipelago loot leans to tier 2',()=>{let t2=0,base=0;const T2=new Set(Object.keys(RULES.loot.weights[1]).filter(k=>!(k in RULES.loot.weights[0])));
  for(let i=0;i<40;i++){for(const b of generateLevel(1,'lt'+i,'archipelago').lootBoxes)if(T2.has(b.item))t2++;for(const b of generateLevel(1,'lt'+i,'bunker').lootBoxes)if(T2.has(b.item))base++;}
  assert.ok(t2>base,`t2 ${t2} vs ${base}`);});
