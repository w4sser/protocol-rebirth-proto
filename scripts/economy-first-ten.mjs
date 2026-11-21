#!/usr/bin/env node
/** Analysis only. Imports production generation, pickup and settlement. Does NOT simulate combat or human navigation. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {generateLevel,RULES,randomFromSeed,pickWeighted,extractScrapBonus} from '../nodspel/levels.js';
import {createRound,collectLoot,extractRound,abandonRound,activateNode,enterExit} from '../nodspel/round.js';
import {graphDistances} from '../nodspel/zone-graph.js';

const ctx={window:{}};vm.createContext(ctx);
for(const f of ['items','modules','progression'])vm.runInContext(readFileSync(new URL('../data/'+f+'.js',import.meta.url),'utf8'),ctx);
const DATA=ctx.window.DATA,ITEMS=Object.fromEntries(DATA.items.map(x=>[x.id,x]));
const ids=['fabricator','bit_bay','storage','rebirth_core'];
const COSTS=Object.fromEntries(ids.map(id=>[id,DATA.modules.find(m=>m.id===id).levels.find(l=>l.level===(id==='rebirth_core'?2:1)).cost]));
const clean=bag=>Object.fromEntries(Object.entries(bag??{}).filter(([,v])=>v>0));
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const count=o=>Object.keys(o).length;
const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.ceil(p*s.length)-1]??s[0];};
const clone=o=>JSON.parse(JSON.stringify(o));

export const SCENARIOS=[
 {id:'small_baseline',mode:'small',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1},
 {id:'big_baseline',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1},
 {id:'big_legacy_start',mode:'big',p:.7,startScrap:20,startAlloy:1,policy:'goal',coverage:1},
 {id:'big_early_pool',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true},
 {id:'big_early_pool_p50',mode:'big',p:.5,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true},
 {id:'big_early_pool_p85',mode:'big',p:.85,startScrap:20,startAlloy:0,policy:'goal',coverage:1,earlyPool:true},
 {id:'big_early_pool_partial',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'goal',coverage:.65,earlyPool:true},
 {id:'big_early_pool_first_seen',mode:'big',p:.7,startScrap:20,startAlloy:0,policy:'first',coverage:1,earlyPool:true},
 {id:'big_early_pool_no_start_cash',mode:'big',p:.7,startScrap:0,startAlloy:0,policy:'goal',coverage:1,earlyPool:true}
];
function nextGoal(st){return ids.find(id=>!st.built[id])??null;}
function need(st,goal,id){return Math.max(0,(COSTS[goal]?.items?.[id]??0)-(st.items[id]??0));}
function build(st,index,attempt){
 const completed=[];
 // Auto-build AFFORDABLE tracked projects after a return; no one-per-day constraint.
 for(let goal=nextGoal(st);goal;goal=nextGoal(st)){
  const c=COSTS[goal];
  if(st.scrap<(c.scrap??0)||st.dataCores<(c.dataCores??0)||Object.entries(c.items??{}).some(([id,n])=>(st.items[id]??0)<n))break;
  st.scrap-=c.scrap??0;st.dataCores-=c.dataCores??0;
  for(const [id,n] of Object.entries(c.items??{}))st.items[id]-=n;
  st.built[goal]={success:index,attempt};completed.push(goal);
  if(goal==='fabricator')st.vest=true;
 }
 return completed;
}
function rank(st,goal,bag,id){
 if(need(st,goal,id)>(bag[id]??0))return 100;
 if(ITEMS[id]?.grantsCurrency?.scrap && st.scrap<(COSTS[goal]?.scrap??0))return 80;
 if(ids.some(g=>!st.built[g]&&need(st,g,id)>(bag[id]??0)))return 40;
 if(ITEMS[id]?.grantsCurrency)return 20;
 return 1;
}
function gather(r,boxes,st,config,rng,now){
 const visited=boxes.filter(b=>rng()<config.coverage);
 const sources=visited.map(b=>({id:b.id,item:b.item}));
 // Actual collectLoot sees every box in the level (including adjacent ones). Sorting changes strategy, not pickup logic.
 while(visited.length){
  if(config.policy==='goal')visited.sort((a,b)=>rank(st,nextGoal(st),r.bag,b.item)-rank(st,nextGoal(st),r.bag,a.item)||a.id.localeCompare(b.id));
  const b=visited.shift();if(b.collected)continue;
  collectLoot(r,b,now++,null);
 }
 return {sources,now};
}
function convert(items,st){
 for(const [id,n] of Object.entries(items)){
  const grant=ITEMS[id]?.grantsCurrency;
  if(grant){st.scrap+=(grant.scrap??0)*n;st.dataCores+=(grant.dataCores??0)*n;}
  else st.items[id]=(st.items[id]??0)+n;
 }
}

export function attempt(st,config,seed){
 const rng=randomFromSeed(seed+':outcome'),reaches3=rng()<.3,success=rng()<config.p;
 const r=createRound(seed,0,{...RULES.playerStats.base,bagCapacity:4+(st.vest?1:0)+(st.built.storage?1:0)});
 const discover=randomFromSeed(seed+':discover');let now=100,all=[];
 if(config.mode==='big'){
  r.level=generateLevel(1,seed,'bunker',false,true);
  const distances=graphDistances(r.level.graph);
  const route=[...r.level.rooms].sort((a,b)=>distances[a.id]-distances[b.id]||a.id-b.id);
  // Explicit optimistic traversal policy: 4 rooms, or 6 for the 30% deeper-route sample; combat not simulated.
  const selected=route.slice(0,reaches3?6:4),early=new Set(route.slice(0,3).map(x=>x.id));
  for(const room of selected){
   for(const node of r.level.nodes.filter(n=>n.roomId===room.id))activateNode(r,node.id,now++);
   const boxes=r.level.lootBoxes.filter(b=>b.roomId===room.id);
   if(config.earlyPool){for(const b of boxes)if(early.has(room.id)&&!b.requiresNode&&!b.key&&b.item!=='medkit'&&b.item!=='ammo_pack'){
    // CANDIDATE ONLY: same crate count, three early rooms use the real depth-1 pool. No guaranteed target drop.
    b.item=pickWeighted(RULES.loot.weights[0],randomFromSeed(seed+':early:'+b.id)());
   }}
   const g=gather(r,boxes,st,config,discover,now);now=g.now;all.push(...g.sources);
  }
 }else{
  const depth=reaches3?3:2;
  for(let d=1;d<=depth;d++){
   for(const n of r.level.nodes)activateNode(r,n.id,now++);
   const g=gather(r,r.level.lootBoxes,st,config,discover,now);now=g.now;all.push(...g.sources);
   // Last stage's outcome is settled below. Earlier forward gates never bank loot.
   if(d<depth){assert.equal(enterExit(r,r.level.exit,now++),'next');assert.equal(sum(r.extracted),0);}
  }
 }
 const carried=clean(r.bag),before={scrap:st.scrap,items:clone(st.items)},goal=nextGoal(st);
 if(success){
  if(config.mode==='big'){
   const exit=r.level.extracts.find(e=>e.type==='open');assert.ok(exit);
   assert.equal(enterExit(r,exit,now++),'complete');
  }else{
   if(r.level.number===3)enterExit(r,{x:-999,z:-999},now++);
   const transition=enterExit(r,r.level.exit,now++);
   if(transition==='next')assert.equal(extractRound(r,now++),true);
   else assert.equal(transition,'complete');
  }
  assert.ok(['extract','complete'].includes(r.reason));
  convert(clean(r.extracted),st);st.scrap+=extractScrapBonus(r.levelsCleared);
 }else{
  assert.equal(abandonRound(r,now++),true);assert.equal(sum(r.extracted),0);
  st.vest=false; // The commissioned vest is a losable copy, not a permanent bag upgrade.
  // No BIT rescue or insurance. Secure Slot: analysis assumes 1 selected missing ordinary material when Vault exists.
  if(st.built.storage){const id=Object.keys(carried).find(id=>need(st,goal,id)>0&&!['archipelago_chart','town_survey'].includes(id));if(id)convert({[id]:1},st);}
 }
 let useful=false;
 if(goal)useful=(st.scrap>before.scrap&&before.scrap<(COSTS[goal].scrap??0))||Object.keys(COSTS[goal].items??{}).some(id=>(st.items[id]??0)>(before.items[id]??0)&& (before.items[id]??0)<COSTS[goal].items[id]);
 return {success,depth:r.level.number,levelsCleared:r.levelsCleared,carried,banked:clean(r.extracted),scrapDelta:st.scrap-before.scrap,useful,sourceCount:all.length,goal};
}

export function simulate(config,n=1000){
 const players=[],curve=Array.from({length:10},(_,i)=>({success:i+1,players:0,progressReturns:0,fabricator:0,bit_bay:0,storage:0,rebirth_core:0}));
 for(let i=0;i<n;i++){
  const st={scrap:config.startScrap,dataCores:0,items:{scrap_alloy:config.startAlloy},built:{},vest:false};
  let wins=0,tries=0,stall=0,maxStall=0,progress=0;
  while(wins<10&&tries<100){
   tries++;const a=attempt(st,config,'first-ten-v1:p'+i+':a'+tries);
   if(!a.success)continue;
   wins++;const done=build(st,wins,tries);const useful=a.useful||done.length>0;
   if(useful){stall=0;progress++;}else maxStall=Math.max(maxStall,++stall);
   const row=curve[wins-1];row.players++;row.progressReturns+=Number(useful);
   for(const id of ids)row[id]+=Number(!!st.built[id]);
  }
  players.push({scenario:config.id,player:i,successes:wins,attempts:tries,maxStall,progressReturns:progress,...Object.fromEntries(ids.flatMap(id=>[[id+'_success',st.built[id]?.success??null],[id+'_attempt',st.built[id]?.attempt??null]])),endScrap:st.scrap,endItems:JSON.stringify(clean(st.items))});
 }
 const milestones=ids.map(id=>{const done=players.filter(p=>p[id+'_success']!==null);return {id,reached:done.length,n,by3:done.filter(p=>p[id+'_success']<=3).length,by5:done.filter(p=>p[id+'_success']<=5).length,by10:done.length,medianSuccessAmongAchievers:q(done.map(p=>p[id+'_success']),.5),p90SuccessAmongAchievers:q(done.map(p=>p[id+'_success']),.9),medianAttemptAmongAchievers:q(done.map(p=>p[id+'_attempt']),.5)};});
 return {scenario:config,milestones,curve,attempts:{p10:q(players.map(p=>p.attempts),.1),p50:q(players.map(p=>p.attempts),.5),p90:q(players.map(p=>p.attempts),.9)},stall3:players.filter(p=>p.maxStall>=3).length,players};
}
export function audit(n=1000){
 return ['small1','small2','small3','big'].map(mode=>{
  const seen={},units={};let boxes=0,ordinary=0,roomCount=0;
  for(let i=0;i<n;i++){
   const level=generateLevel(mode==='big'?1:Number(mode.slice(-1)),'audit-'+i,'bunker',false,mode==='big');
   const bag={};roomCount+=level.rooms.length;
   for(const b of level.lootBoxes){if(b.key||b.item==='medkit'||b.item==='ammo_pack')continue;boxes++;if(!b.requiresNode)ordinary++;bag[b.item]=(bag[b.item]??0)+1;units[b.item]=(units[b.item]??0)+1;}
   for(const id of Object.keys(bag))seen[id]=(seen[id]??0)+1;
  }
  return {mode,n,boxes,ordinary,roomCount,seen,units};
 });
}
export function verify(){
 for(const mode of ['small','big']){
  const c={id:'check',mode,p:0,startScrap:20,startAlloy:0,policy:'goal',coverage:1};
  const st={scrap:20,dataCores:0,items:{},built:{},vest:true};
  const a=attempt(st,c,'check-'+mode);assert.equal(sum(a.banked),0);assert.equal(st.scrap,20);assert.equal(count(st.items),0);assert.equal(st.vest,false);
  const result1=simulate({...c,p:.7},5),result2=simulate({...c,p:.7},5);assert.deepEqual(result1,result2);
 }
 const all=simulate({...SCENARIOS[3],p:1},10);assert.ok(all.players.every(x=>x.attempts===10));
 console.log('FIRST_TEN_SELF_TESTS_OK');
}
function toCSV(rows){const keys=Object.keys(rows[0]??{}),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [keys.join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n';}
function main(){
 verify();const n=Number(process.argv[2]??1000);assert.ok(Number.isInteger(n)&&n>=1&&n<=10000);
 const out='verify-out/first-ten';mkdirSync(out,{recursive:true});
 const rows=[],reports=[];for(const c of SCENARIOS){const r=simulate(c,n);rows.push(...r.players);const {players,...s}=r;reports.push(s);console.log('SCENARIO_RESULT '+JSON.stringify(s));}
 const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gameBaseline:'88a9ac6364d0dcf5463c2a5f700f4817960ecaca',n,costs:COSTS,spawnAudit:audit(n),reports,assumptions:{mode:'Offline source-calibrated scenario, not human or full combat simulation',fixedOrder:ids,success:'Exogenous p, independent of gear, skill or depth',depth:'30% deep preference; small D2/D3, big nearest 4/6 rooms, optimistic access',defaultStart:'Core L1 restored; 20 Scrap retained as legacy cash assumption; 0 spare Alloy from two consumed intro items',excluded:'Vendors, recycling, hand-ins, quests, maintenance, crafting restocks, purchasing, home overflow, live navigation, combat and time costs',secureSlot:'One selected ordinary missing unit after Vault; proposed detail, not finalized D1-A',candidate:'Replace ordinary floor loot in first 3 visited Big Map rooms with actual early pool; no extra crates or guaranteed drops; not gameplay code'}};
 writeFileSync(out+'/summary.json',JSON.stringify(report,null,2)+'\n');writeFileSync(out+'/players.csv',toCSV(rows));
 console.log('AUDIT_RESULT '+JSON.stringify({sourceCommit:report.sourceCommit,gameBaseline:report.gameBaseline,n,costs:COSTS,spawnAudit:report.spawnAudit}));
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8').split('\n');
 const hit=app.map((s,i)=>({s,i})).filter(x=>/function (canBuild|canUpgrade|roomAccess|unlockRoom|buildModule)|case ["'](BUILD|UPGRADE|ROOM)|CORE_RESULT|function .*Ingest/.test(x.s));
 for(const h of hit.slice(0,12))console.log('SOURCE_AUDIT '+JSON.stringify({line:h.i+1,lines:app.slice(Math.max(0,h.i-2),h.i+20)}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
