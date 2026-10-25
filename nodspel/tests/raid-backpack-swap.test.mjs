import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bagItems,ITEM_NAMES} from '../raid.js';
import {createRound,collectLoot,initEquip,swapGear,bagCapacityOf} from '../round.js';

test('depleted Scout Rig entries do not occupy a backpack slot or block pickup',()=>{
  for(const count of [0,'0',null,undefined,-1]){
    const r=createRound('spent-rig',0,{bagCapacity:6});
    r.bag.cable=6;r.bag.scout_rig=count;
    assert.equal(bagItems(r.bag).length,6);
    r.bag.cable--;
    r.level.lootBoxes=[{id:'pickup',item:'fuse',x:0,z:0,collected:false}];
    assert.equal(collectLoot(r,{x:0,z:0},1),true);
    assert.equal(r.bag.fuse,1);
    assert.equal(bagItems(r.bag).length,bagCapacityOf(r));
    assert.equal(bagItems(r.bag).includes('scout_rig'),false);
  }
  assert.deepEqual(bagItems({scout_rig:1}),['scout_rig'],'usable loot still occupies its slot');
});

// Exercise the actual prompt callback without starting the WebGL renderer.
const source=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
const functionSource=name=>{
  const start=source.indexOf(`function ${name}(`);
  const end=source.indexOf('\nfunction ',start+1);
  return source.slice(start,end<0?undefined:end);
};
test('ground weapon prompt names the weapon; one tap swaps and renders the dropped gun',()=>{
  const r=createRound('tap-weapon',0);initEquip(r,{weapon:'smg_vector'});
  const box={id:'ground-gun',item:'rifle_marksman',x:0,z:0,collected:false,revealed:true};
  r.level.lootBoxes=[box];collectLoot(r,{x:0,z:0},1);
  let tap,text,equipped=0,cleared=0;const rendered=[];
  const label={el:{classList:{add(){}},onclick:null}};
  const world={lootBoxes:[{loot:box}],addLoot(d){rendered.push(d);return {loot:d};}};
  const notify=new Function('round','world','ITEM_NAMES','offerLabel','gearToast','nearOffer','clearGearOffer','swapGear','labelLoot','onEquip','Date',
    `${functionSource('notifyGearOffer')}\n${functionSource('showGearSwap').split('// ---- Visible fallback')[0]}\nreturn notifyGearOffer;`)(
    r,world,ITEM_NAMES,()=>label,(t,cb)=>{text=t;tap=cb;},()=>true,
    ()=>{cleared++;r.gearOffer=null;},swapGear,()=>{},()=>{equipped++;},{now:()=>2});
  notify();assert.ok(text.includes(ITEM_NAMES.rifle_marksman));assert.match(text,/tap to swap/);
  tap();
  assert.equal(r.equip.weapon,'rifle_marksman');assert.equal(box.collected,true);
  assert.equal(rendered.length,1);assert.equal(rendered[0].item,'smg_vector');
  assert.equal(rendered[0].revealed,true);assert.equal(rendered[0].blockedUntilLeft,true);
  assert.deepEqual({x:rendered[0].x,z:rendered[0].z},{x:box.x,z:box.z});
  assert.equal(equipped,1);assert.equal(cleared,1);assert.equal(r.gearOffer,null);
  assert.equal(bagItems(r.bag).length,0);
  collectLoot(r,{x:0,z:0},3);assert.equal(r.equip.weapon,'rifle_marksman','dropped gun is not immediately picked up');
});
