import test from 'node:test';import assert from 'node:assert/strict';
// data/modules.js, data/recipes.js and data/vendors.js (loaded transitively for DATA.itemInfo) assume a
// browser `window`; a dynamic import after this shim lets the pure module run under plain node:test too.
if(typeof globalThis.window==='undefined')globalThis.window=globalThis;
const {hintText}=await import('../item-hints.js?v=2.28.29');
const {sellValueText,neededForText,hasSeenMaterial,markMaterialSeen,materialPickupBitLine}=await import('../loot-value.js?v=2.28.29');

function memoryStorage(){
  const m=new Map();
  return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>void m.set(k,String(v))};
}

test('sell value text comes from DATA.items sellValue, or null when there is nothing to sell',()=>{
  assert.equal(sellValueText('cable'),`≈${globalThis.DATA.itemInfo('cable').sell} Scrap`);
  assert.match(hintText('cable'),new RegExp(`sell it for ${globalThis.DATA.itemInfo('cable').sell} Scrap`),'toast value matches the BIT line and the vendor price');
  assert.equal(sellValueText('ai_fragment'),`≈${globalThis.DATA.itemInfo('ai_fragment').sell} Scrap`);
  assert.equal(sellValueText('archipelago_chart'),null,'scouting items have sellValue 0');
});

test('needed-for text only fires for the carried unit that is currently load-bearing for the goal',()=>{
  const goal={name:'Fabricator',parts:[{id:'cable',need:2,secured:0}]};
  assert.equal(neededForText(goal,{cable:2},'cable'),'NEEDED FOR Fabricator');
  assert.equal(neededForText(goal,{cable:3},'cable'),null,'surplus unit does not regress the goal if removed');
  assert.equal(neededForText(goal,{cable:1,data_core:1},'data_core'),null,'not part of the goal');
  assert.equal(neededForText(null,{cable:1},'cable'),null,'standalone raids have no tracked goal');
  const secured={name:'Fabricator',parts:[{id:'cable',need:2,secured:2}]};
  assert.equal(neededForText(secured,{cable:1},'cable'),null,'already secured at home');
});

test('needed-for recognizes currency-granting salvage, same as swap-guidance',()=>{
  const salvage=globalThis.DATA.items.find(i=>i.grantsCurrency?.scrap);
  const goal={name:'Vault',parts:[{id:'scrap',kind:'currency',need:salvage.grantsCurrency.scrap,secured:0}]};
  assert.equal(neededForText(goal,{[salvage.id]:1},salvage.id),'NEEDED FOR Vault');
});

test('first-ever pickup of a material shows a BIT line once, derived from item-hints.js; repeats are quiet',()=>{
  const storage=memoryStorage();
  assert.equal(hasSeenMaterial('cable',storage),false);
  const line=materialPickupBitLine('cable',{},storage);
  assert.match(line,/^BIT: Cable\./);
  assert.equal(hasSeenMaterial('cable',storage),true);
  assert.equal(materialPickupBitLine('cable',{},storage),null,'already seen');
});

test('markMaterialSeen is idempotent and reports whether it newly recorded the id',()=>{
  const storage=memoryStorage();
  assert.equal(markMaterialSeen('fuse',storage),true);
  assert.equal(markMaterialSeen('fuse',storage),false);
  assert.equal(hasSeenMaterial('fuse',storage),true);
});

test('missing or corrupt storage is tolerated: treated as never-seen, never throws',()=>{
  assert.equal(hasSeenMaterial('cable',undefined),false);
  assert.doesNotThrow(()=>materialPickupBitLine('cable',{},undefined));
  const corrupt={getItem:()=>'{not json',setItem(){throw new Error('quota');}};
  assert.equal(hasSeenMaterial('cable',corrupt),false);
  assert.doesNotThrow(()=>materialPickupBitLine('cable',{},corrupt));
  const notAnArray={getItem:()=>'{"a":1}',setItem(){}};
  assert.equal(hasSeenMaterial('cable',notAnArray),false);
});

test('the FTUE and the guided intro raid never show the BIT line and never mark the material seen',()=>{
  const storage=memoryStorage();
  assert.equal(materialPickupBitLine('cable',{intro:true},storage),null);
  assert.equal(hasSeenMaterial('cable',storage),false,'intro raid does not record it, so the next ordinary raid still introduces it');
  assert.equal(materialPickupBitLine('cable',{ftue:true},storage),null);
  assert.equal(hasSeenMaterial('cable',storage),false);
  const line=materialPickupBitLine('cable',{},storage);
  assert.match(line,/^BIT: Cable\./,'an ordinary raid afterwards still introduces it');
});
