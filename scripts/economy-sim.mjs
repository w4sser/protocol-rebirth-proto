#!/usr/bin/env node
// Economy harness: real Node Raid generation + pickup/bag/extract functions.
// NOT a combat, pathfinding, extraction-success, or 30-day economy simulator.
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {generateLevel,randomFromSeed,extractScrapBonus,RULES,setArea,setHard,setLevelMode} from '../nodspel/levels.js';
import {createRound,collectLoot,extractRound,abandonRound,roundSummary} from '../nodspel/round.js';

const itemIndex=Object.fromEntries((globalThis.DATA?.items??[]).map(item=>[item.id,item]));
export function parseArgs(args){
  const o={runs:1000,seed:'economy-v1',success:0.70,depth3:0.30,area:'bunker',out:'verify-out/economy'};
  for(let i=0;i<args.length;i++){
    const a=args[i],v=args[i+1];
    if(!['--runs','--seed','--success','--depth3','--area','--out'].includes(a))throw Error('Unknown argument: '+a);
    if(v==null)throw Error('Missing value for '+a);
    o[a.slice(2)]=a==='--runs'||a==='--success'||a==='--depth3'?Number(v):v;i++;
  }
  if(!Number.isInteger(o.runs)||o.runs<1||o.runs>100000)throw Error('runs must be 1..100000');
  for(const k of ['success','depth3'])if(!Number.isFinite(o[k])||o[k]<0||o[k]>1)throw Error(k+' must be 0..1');
  if(!['bunker','archipelago','town'].includes(o.area))throw Error('Unknown area '+o.area);
  return o;
}
function add(target,id,n=1){target[id]=(target[id]??0)+n;}
function summary(values){const sorted=[...values].sort((a,b)=>a-b),pick=p=>sorted[Math.min(sorted.length-1,Math.floor(p*(sorted.length-1)))];return {mean:values.reduce((a,b)=>a+b,0)/values.length,p10:pick(.1),median:pick(.5),p90:pick(.9)};}
function csvEscape(v){const s=typeof v==='string'?v:JSON.stringify(v);return /[,\n"]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
export function simulate({runs=1000,seed='economy-v1',success=.7,depth3=.3,area='bunker'}={}){
  // No game rules are modified. Each run gets deterministic seed and actual generated loot boxes.
  setArea(area);setHard(false);setLevelMode('small');
  const rows=[],itemCounts={},bankedCounts={},scrap=[],bagged=[];
  for(let i=0;i<runs;i++){
    const id=seed+'-'+i,rng=randomFromSeed(id+':economy-outcome');
    const depth=rng()<depth3?3:2;
    const survives=rng()<success;
    const round=createRound(id,0),spawned=[],taken=[];
    // Optimistic access policy: teleport to every generated loot box. We do not simulate
    // movement, nodes, enemy damage, actual extraction timer, item swaps or loot strategy.
    // Collection, capacity, and post-raid bag security ARE actual round functions.
    let now=100;
    for(let d=1;d<=depth;d++){
      round.level=generateLevel(d,id,area,false,false);
      for(const box of round.level.lootBoxes){
        spawned.push({depth:d,item:box.item});
        add(itemCounts,box.item);
        const before=box.collected;
        collectLoot(round,{x:box.x,z:box.z},now++,null);
        if(!before&&box.collected)taken.push({depth:d,item:box.item});
      }
    }
    const bagBefore=Object.fromEntries(Object.entries(round.bag).filter(([,n])=>n>0));
    // The scenario has already assumed a successful return, so we set the stage-cleared
    // precondition; we are testing bag banking, not whether combat/nodes were completed.
    round.levelsCleared=depth;
    const worked=survives?extractRound(round,now):abandonRound(round,now);
    if(!worked)throw Error('Round settlement failed for '+id);
    const outcome=roundSummary(round);
    const banked=Object.fromEntries(Object.entries(outcome.extracted).filter(([,n])=>n>0));
    let scrapGained=survives?extractScrapBonus(depth):0,dataCores=0;
    for(const [item,n] of Object.entries(banked)){
      add(bankedCounts,item,n);
      const cur=itemIndex[item]?.grantsCurrency??{};
      scrapGained+=(cur.scrap??0)*n;
      dataCores+=(cur.dataCores??0)*n;
    }
    scrap.push(scrapGained);bagged.push(Object.values(banked).reduce((a,b)=>a+b,0));
    rows.push({seed:id,area,depth,success:survives,spawned:spawned.length,taken:taken.length,bag:JSON.stringify(bagBefore),banked:JSON.stringify(banked),lost:JSON.stringify(Object.fromEntries(Object.entries(outcome.lost).filter(([,n])=>n>0))),scrap: scrapGained,dataCores});
  }
  const ok=rows.filter(r=>r.success).length;
  return {metadata:{seed,runs,area,successAssumption:success,depth3Assumption:depth3,successfulRuns:ok,successRate:ok/runs,bagCapacity:RULES.loot.capacity,logic:'generateLevel + collectLoot + extractRound/abandonRound',limitations:'Optimistic pickup access; no combat/navigation/extract countdown; no paid economy; small levels only'},metrics:{scrapPerAttempt:summary(scrap),bankedItemsPerAttempt:summary(bagged),spawnedCounts:itemCounts,bankedCounts},rows};
}
export function writeOutputs(result,out){
  const dir=resolve(out);mkdirSync(dir,{recursive:true});
  const columns=['seed','area','depth','success','spawned','taken','bag','banked','lost','scrap','dataCores'];
  const csv=[columns.join(','),...result.rows.map(r=>columns.map(c=>csvEscape(r[c])).join(','))].join('\n')+'\n';
  writeFileSync(resolve(dir,'runs.csv'),csv);
  const {rows,...report}=result;
  writeFileSync(resolve(dir,'summary.json'),JSON.stringify(report,null,2)+'\n');
  return dir;
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
  const config=parseArgs(process.argv.slice(2));
  const result=simulate(config);
  const output=writeOutputs(result,config.out);
  process.stdout.write(JSON.stringify({output,...result.metadata,scrap:result.metrics.scrapPerAttempt},null,2)+'\n');
}
