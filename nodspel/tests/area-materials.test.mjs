// v1.75 area materials: drop only in the specified areas/levels, items and icons exist.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {generateLevel,RULES,AREAS,houseItem} from '../levels.js';
import {ITEM_NAMES} from '../raid.js';
import {rarityOf} from '../rarity.js';
const sprite=fs.readFileSync(new URL('../ui-icons.svg',import.meta.url),'utf8');
const N=250,drops={};
for(const a of AREAS)for(let n=1;n<=3;n++){const got=drops[`${a}${n}`]={world:{},house:{}};
  for(let s=0;s<N;s++){const L=generateLevel(n,'am'+s,a);
    for(const b of L.lootBoxes)got.world[b.item]=(got.world[b.item]||0)+1;
    for(const c of L.house?.containers||[])got.house[c.item]=(got.house[c.item]||0)+1;}}
const count=(id,where)=>Object.entries(drops).filter(([,g])=>g[where][id]).map(([k])=>k).sort();
test('area materials are raid items with icons and rarity',()=>{
  for(const [id,icon,r] of [['tidal_coil','item-tidal-coil','rare'],['frost_glass','item-frost-glass','rare'],['core_ash','item-core-ash','epic']]){
    assert.ok(ITEM_NAMES[id],id);assert.ok(RULES.loot.types.includes(id),id+' fits the bag');assert.equal(rarityOf(id),r);assert.ok(sprite.includes(`id="${icon}"`),icon);}});
test('Tidal Coil drops only in Archipelago L2 and L3',()=>{assert.deepEqual(count('tidal_coil','world'),['archipelago2','archipelago3']);assert.deepEqual(count('tidal_coil','house'),[]);});
test('Frost Glass drops only from Town L2 and L3 house containers',()=>{assert.deepEqual(count('frost_glass','house'),['town2','town3']);assert.deepEqual(count('frost_glass','world'),[]);});
test('Core Ash drops only on level 3 and never on the first two levels',()=>{
  for(const w of ['world','house'])for(const k of count('core_ash',w))assert.ok(k.endsWith('3'),k);
  assert.ok(count('core_ash','world').length>=2,'drops in more than one area');
  assert.equal(RULES.loot.weights[0].core_ash??0,0);assert.equal(RULES.loot.weights[1].core_ash??0,0);assert.ok(RULES.loot.weights[2].core_ash>0&&RULES.loot.weights[2].core_ash<=.5,'low weight');});
test('medicine cabinets stay medkits, other areas use no Frost Glass',()=>{
  assert.equal(houseItem('medicine_cabinet',2,.5),'medkit');
  for(let i=0;i<200;i++)assert.notEqual(houseItem('loot_crate',2,i/200,'bunker'),'frost_glass');});
