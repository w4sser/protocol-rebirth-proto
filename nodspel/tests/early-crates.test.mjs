import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,setArea,setQuestLoot,RULES} from '../levels.js?v=2.28.78';
import {createRound,collectLoot,swapLoot,extractRound} from '../round.js?v=2.28.78';
import {initFtueRound} from '../ftue.js?v=2.28.78';
import {applyIntroEncounter,applyFirstPayoff} from '../progression-goal.js?v=2.28.78';
import {walkMap} from '../encounters.js?v=2.28.78';
const goal={parts:[{id:'cable',need:1,secured:0},{id:'scrap_alloy',need:2,secured:0},{id:'scrap',kind:'currency',need:10,secured:0}]};
const units=(boxes,id)=>boxes.filter(b=>b.item===id).reduce((n,b)=>n+(b.quantity??1),0);

test('tutorial and guided Fabricator supplies fit three reachable crates with the full repair loot',()=>{
 setArea('bunker');
 for(let seed=0;seed<60;seed++)for(const intro of [false,true]){
   const r=createRound('early-'+seed,0);
   if(intro)applyIntroEncounter(r.level,goal);
   initFtueRound(r,{ftue:true},{getItem:()=>null});
   assert.equal(r.level.lootBoxes.length,3);
   assert.equal(units(r.level.lootBoxes,'scrap_alloy'),2);
   assert.equal(units(r.level.lootBoxes,'cable'),1);
   assert.ok(units(r.level.lootBoxes,'salvage_crate')*globalThis.DATA.items.find(i=>i.id==='salvage_crate').grantsCurrency.scrap>=10);
   const map=walkMap(r.level);
   for(const b of r.level.lootBoxes){
     assert.ok(map(b),'reachable '+b.id);
     for(let t=0;t<4&&!b.collected;t++)collectLoot(r,b,t);
     assert.equal(b.collected,true,'all units collected within bag capacity');
   }
   assert.equal(r.bag.scrap_alloy,2);assert.equal(r.bag.cable,1);assert.equal(r.bag.salvage_crate,1);
   r.levelsCleared=1;assert.ok(extractRound(r,20));assert.equal(r.extracted.scrap_alloy,2);assert.equal(r.extracted.cable,1);
   const l=generateLevel(1,'guided-'+seed,'bunker');applyIntroEncounter(l,goal);
   assert.equal(l.lootBoxes.length,3);assert.equal(units(l.lootBoxes,'scrap_alloy'),2);
 }
});

test('Bunker L1-L2 have 2-3 loot crates per room, including quest and payoff variants',()=>{
 setArea('bunker');
 for(let seed=0;seed<80;seed++)for(const n of [1,2]){
   setQuestLoot({item:'fuse',level:2});
   const l=generateLevel(n,'cap-'+seed,'bunker');
   if(n===1)applyFirstPayoff(l,'loot_cluster',8);
   for(const r of l.rooms){
     // The level-two loot branch belongs to the first room.
     const count=l.lootBoxes.filter(b=>{
       const nearest=l.rooms.reduce((a,c)=>Math.hypot(b.x-c.x,b.z-c.z)<Math.hypot(b.x-a.x,b.z-a.z)?c:a);
       return nearest===r;
     }).length;
     assert.ok(count>=2&&count<=RULES.earlyLoot.maxCratesPerRoom,`seed ${seed} L${n}: ${count}`);
   }
   if(n===2)assert.ok(l.lootBoxes.some(b=>b.item==='fuse'&&b.quest));
 }
 setQuestLoot(null);
});

test('bundled crate retains leftovers when bag fills and swapping takes only one unit',()=>{
 const r=createRound('partial',0);
 r.level.lootBoxes=[{id:'bundle',x:0,z:0,item:'scrap_alloy',quantity:3,collected:false}];
 r.bag.cable=3;
 collectLoot(r,{x:0,z:0},1);collectLoot(r,{x:0,z:0},2);
 const b=r.level.lootBoxes[0];assert.equal(r.bag.scrap_alloy,1);assert.equal(b.quantity,2);assert.equal(b.collected,false);
 assert.ok(swapLoot(r,b.id,'cable',3));assert.equal(b.quantity,1);assert.equal(b.collected,false);
});

test('mixed payoff contents remain collectible through the same crate',()=>{
 const r=createRound('mixed-payoff',0);
 r.level.lootBoxes=[{id:'cache',x:0,z:0,item:'cable',contents:['polymer_plate','salvage_crate'],collected:false}];
 for(let now=1;now<=3;now++)collectLoot(r,{x:0,z:0},now);
 assert.equal(r.bag.cable,1);assert.equal(r.bag.polymer_plate,1);assert.equal(r.bag.salvage_crate,1);
 assert.equal(r.level.lootBoxes[0].collected,true);
});

test('a guided raid with already-secured goals still has two readable caches',()=>{
 const l=generateLevel(1,'secured-guided','bunker');
 applyIntroEncounter(l,{parts:goal.parts.map(p=>({...p,secured:p.need}))});
 assert.equal(l.lootBoxes.length,2);
 assert.ok(Math.hypot(l.lootBoxes[0].x-l.lootBoxes[1].x,l.lootBoxes[0].z-l.lootBoxes[1].z)>2);
});
