import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,areaTable,randomFromSeed,pickWeighted} from '../levels.js?v=2.28.0';
import {applyBunkerLootBands} from '../big-loot.js?v=2.28.0';
import {graphDistances} from '../zone-graph.js?v=2.28.0';
const items=Object.fromEntries(globalThis.DATA.items.map(i=>[i.id,i]));
const tables=[1,2,3].map(n=>areaTable('bunker',n,'world'));
function fixture(){return {big:true,area:'bunker',seed:'unit-test',rooms:[],walls:[],lootBoxes:Array.from({length:8},(_,i)=>({id:`box-${i}`,roomId:i,x:i*20,z:0,item:'salvage_crate',collected:false}))};}
function options(level){return {tables,items,distances:Object.fromEntries(level.lootBoxes.map(b=>[b.roomId,b.roomId])),randomFromSeed,pickWeighted};}

test('three common opportunities then two middle pools and deeper loot, without extra crates',()=>{
 const level=fixture(),before=structuredClone(level);assert.equal(applyBunkerLootBands(level,options(level)),8);
 assert.deepEqual(level.lootBoxes.map(b=>b.lootTier),[1,1,1,2,2,3,3,3]);
 for(let i=0;i<8;i++){const b=level.lootBoxes[i];assert.ok(tables[b.lootTier-1][b.item]);assert.equal(b.x,before.lootBoxes[i].x);assert.equal(b.id,before.lootBoxes[i].id);}
 assert.deepEqual(level.walls,before.walls);assert.equal(level.lootBoxes.length,before.lootBoxes.length);
});
test('key, node-locked vault, chart, gear, kits, authored and unknown pickups survive unchanged',()=>{
 const level=fixture();const special=[
  {item:'keycard',key:'key'}, {item:'rebirth_shard',requiresNode:'node'},
  {item:'archipelago_chart'}, {item:'smg_vector'}, {item:'medkit'}, {item:'ammo_pack'},
  {item:'cable',marked:true}, {item:'unknown_future_item'}, {item:'cable',collected:true}
 ].map((s,i)=>({id:`special-${i}`,roomId:i,x:0,z:0,...s}));
 const expected=structuredClone(special);level.lootBoxes.push(...special);applyBunkerLootBands(level,options(level));assert.deepEqual(special,expected);
});
test('independent seeded rolls are repeatable, order-independent and idempotent',()=>{
 const a=fixture(),b=fixture();b.lootBoxes.reverse();applyBunkerLootBands(a,options(a));applyBunkerLootBands(b,options(b));
 const sort=l=>l.lootBoxes.slice().sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(sort(a),sort(b));
 const snapshot=structuredClone(a);assert.equal(applyBunkerLootBands(a,options(a)),0);assert.deepEqual(a,snapshot);
});
test('small, non-Bunker, intro and FTUE levels are not altered',()=>{
 for(const patch of [{big:false},{area:'archipelago'},{area:'town'},{intro:true},{ftue:true}]){const l=Object.assign(fixture(),patch),before=structuredClone(l);assert.equal(applyBunkerLootBands(l),0);assert.deepEqual(l,before);}
});
test('unreachable rooms are not silently assigned accessible loot bands',()=>{
 const l=fixture(),o=options(l);delete o.distances[7];const last=structuredClone(l.lootBoxes[7]);applyBunkerLootBands(l,o);assert.deepEqual(l.lootBoxes[7],last);
});
test('short maps retain a middle-tier opportunity; invalid pools fail closed',()=>{
 const l=fixture();l.lootBoxes.length=2;applyBunkerLootBands(l,options(l));assert.deepEqual(l.lootBoxes.map(b=>b.lootTier),[1,2]);
 const bad=fixture();assert.throws(()=>applyBunkerLootBands(bad,{...options(bad),tables:[{},tables[1],tables[2]]}),TypeError);
});
test('1000 real Bunker Big Maps expose required common and middle materials with varied rolls',()=>{
 const counts={cable:0,scrap_alloy:0,polymer_plate:0,power_cell:0},unique=new Set();
 for(let i=0;i<1000;i++){
  const l=generateLevel(1,`loot-band-${i}`,'bunker',false,true),dist=graphDistances(l.graph);
  const ids=new Set();for(const b of l.lootBoxes){assert.ok(!ids.has(b.id));ids.add(b.id);if(b.lootTier){assert.ok(Number.isFinite(dist[b.roomId]));assert.ok(tables[b.lootTier-1][b.item]);}}
  const found=new Set(l.lootBoxes.map(b=>b.item));for(const id of Object.keys(counts))if(found.has(id))counts[id]++;
  unique.add(l.lootBoxes.map(b=>b.item).join('|'));
  const key=l.lootBoxes.find(b=>b.key==='big-vault-key');assert.ok(key?.requiresNode);
  for(const poi of l.graph.pois.filter(p=>p.type==='vault')){const box=l.lootBoxes.find(b=>b.roomId===poi.roomId&&!b.key);assert.ok(box.requiresNode);assert.equal(box.lootTier,undefined);}
 }
 for(const [id,n] of Object.entries(counts))assert.ok(n>0&&n<1000,`${id}: nonzero availability without a per-raid guarantee (${n})`);
 assert.ok(unique.size>100);console.log('LOOT_COVERAGE_1000',JSON.stringify(counts));
});
