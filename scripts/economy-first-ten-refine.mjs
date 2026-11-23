#!/usr/bin/env node
// Reproducible analysis adapter. Exact guarded edits apply ONLY to the simulation harness in a temporary file.
// Production gameplay modules are imported unchanged. Run after economy-first-ten.mjs to compare snapshots.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
let s=readFileSync(new URL('./economy-first-ten.mjs',import.meta.url),'utf8');
function replace(a,b){if(!s.includes(a))throw Error('Analysis adapter anchor changed: '+a);s=s.replace(a,b);}
replace("['items','modules','progression']","['items','modules','progression','vendors','recipes']");
replace('activateNode,enterExit}','activateNode,enterExit,swapLoot}');
const a=s.indexOf('export const SCENARIOS=['),b=s.indexOf('\n];',a)+3;
if(a<0||b<3)throw Error('Scenario anchor missing');
s=s.slice(0,a)+`export const SCENARIOS=[
 {id:'big_vendor_current',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1,trade:true},
 {id:'big_tiered_3',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true,tiered:true,swaps:true},
 {id:'big_tiered_4',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true,tiered:true,swaps:true,fastStart:true},
 {id:'big_tiered_4_partial',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:.65,earlyPool:true,tiered:true,swaps:true,fastStart:true},
 {id:'big_tiered_4_p50',mode:'big',p:.5,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true,tiered:true,swaps:true,fastStart:true},
 {id:'big_tiered_4_p85',mode:'big',p:.85,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true,tiered:true,swaps:true,fastStart:true},
 {id:'big_tiered_4_repairs',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true,tiered:true,swaps:true,fastStart:true,repairs:true}
];`+s.slice(b);
replace('  const c=COSTS[goal];','  const c=COSTS[goal];\n  if(st.trade)tradeForGoal(st,goal);');
replace('function rank(st,goal,bag,id){',`function tradeForGoal(st,goal){
 const c=COSTS[goal],v=DATA.vendors[0],reserve={};
 for(const g of ids.filter(g=>!st.built[g]))for(const [id,n] of Object.entries(COSTS[g].items??{}))reserve[id]=(reserve[id]??0)+n;
 // Sell surplus/non-project ordinary items using the actual vendor multiplier. Never sell scouting intel.
 for(const [id,n] of Object.entries(st.items)){
  const it=ITEMS[id];if(it?.scouts||(it?.uses??[]).includes('story')||!it?.sellValue)continue;
  const sell=Math.max(0,n-(reserve[id]??0));
  if(sell){st.scrap+=sell*Math.floor(it.sellValue*v.sellMultiplier);st.items[id]-=sell;}
 }
 // Deterministic common-material purchases, funded only by already banked Scrap, reserving BUILD cost.
 for(const [id,n] of Object.entries(c.items??{})){
  const stock=v.stock.find(x=>x.itemId===id&&x.currency==='scrap'&&!x.requires);
  if(!stock)continue;
  const qty=Math.min(Math.max(0,n-(st.items[id]??0)),Math.max(0,Math.floor((st.scrap-(c.scrap??0))/stock.price)));
  st.scrap-=qty*stock.price;st.tradeSpent=(st.tradeSpent??0)+qty*stock.price;st.items[id]=(st.items[id]??0)+qty;
 }
}
function retainRank(st,bag,id){return rank(st,nextGoal(st),{...bag,[id]:Math.max(0,(bag[id]??0)-1)},id);}
function rank(st,goal,bag,id){`);
replace('  collectLoot(r,b,now++,null);',`  collectLoot(r,b,now++,null);
  if(config.swaps&&!b.collected&&!ITEMS[b.item]?.slot&&!b.key&&b.item!=='ammo_pack'&&b.item!=='medkit'){
   const incoming=rank(st,nextGoal(st),r.bag,b.item);
   // Compare value of REMOVING a unit, not value of adding yet another copy.
   const removable=Object.keys(clean(r.bag)).filter(id=>id!==b.item&&retainRank(st,r.bag,id)<incoming).sort((a,b)=>retainRank(st,r.bag,a)-retainRank(st,r.bag,b));
   if(removable.length)swapLoot(r,b.id,removable[0],now++);
  }`);
replace("  const selected=route.slice(0,reaches3?6:4),early=new Set(route.slice(0,3).map(x=>x.id));",`  const selected=route.slice(0,reaches3?6:4);
  const earlyCount=config.fastStart&&!st.built.fabricator?4:3;
  const early=new Set(route.slice(0,earlyCount).map(x=>x.id));
  const middle=new Set(route.slice(earlyCount,earlyCount+2).map(x=>x.id));`);
replace('   const g=gather(r,boxes,st,config,discover,now);',`   if(config.tiered&&middle.has(room.id))for(const box of boxes)if(!box.requiresNode&&!box.key&&box.item!=='medkit'&&box.item!=='ammo_pack'){
    // Candidate spatial tiering: use current depth-2 pool in middle rooms; deep optional source remains unchanged.
    box.item=pickWeighted(RULES.loot.weights[1],randomFromSeed(seed+':middle:'+box.id)());
   }
   const g=gather(r,boxes,st,config,discover,now);`);
replace('built:{},vest:false};','built:{},vest:false,trade:!!config.trade,tradeSpent:0,repairs:0};');
replace('   if(useful){stall=0;progress++;}else maxStall=Math.max(maxStall,++stall);',`   if(useful){stall=0;progress++;}else if(a.goal)maxStall=Math.max(maxStall,++stall);
   // Optional test of 3 cosmetic fixes at 5 Scrap, only from surplus beyond the next BUILD's Scrap requirement.
   if(config.repairs&&[1,3,5].includes(wins)&&st.scrap-(COSTS[nextGoal(st)]?.scrap??0)>=5){st.scrap-=5;st.repairs++;}`);
replace('endScrap:st.scrap,endItems:', 'tradeSpent:st.tradeSpent,repairs:st.repairs,endScrap:st.scrap,endItems:');
replace('stall3:players.filter(p=>p.maxStall>=3).length,players', 'stall3:players.filter(p=>p.maxStall>=3).length,threeRepairs:players.filter(p=>p.repairs>=3).length,tradeScrapMedian:q(players.map(p=>p.tradeSpent??0),.5),players');
replace(" console.log('FIRST_TEN_SELF_TESTS_OK');", ` const testState={items:{},built:{},scrap:20};
 assert.equal(retainRank(testState,{cable:2,scrap_alloy:2},'cable'),100,'retain the last needed Cable');
 assert.equal(retainRank(testState,{cable:2,scrap_alloy:2},'scrap_alloy'),100,'retain the last needed Alloy');
 console.log('FIRST_TEN_SELF_TESTS_OK');`);
replace("const out='verify-out/first-ten'","const out='verify-out/first-ten-refined'");
replace("candidate:'Replace ordinary floor loot in first 3 visited Big Map rooms with actual early pool; no extra crates or guaranteed drops; not gameplay code'", "candidate:'Spatial early/middle/deep pools; optional 4 early rooms only before Fabricator; real swapLoot for deliberate replacement; separately model existing free vendor. No gameplay changes.'");
replace("'Vendors, recycling, hand-ins, quests, maintenance, crafting restocks, purchasing, home overflow, live navigation, combat and time costs'", "'Except the vendor scenario: vendors. All scenarios exclude quest rewards, crafting, maintenance, purchases, overflow, navigation and combat. Candidate repair prices are invented test values.'");
const target=new URL('./.economy-first-ten-refined.generated.mjs',import.meta.url);
try{writeFileSync(target,s);execFileSync(process.execPath,[target.pathname,process.argv[2]??'1000'],{stdio:'inherit'});}finally{try{unlinkSync(target);}catch{}}
