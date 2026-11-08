#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {generateLevel,RULES} from '../nodspel/levels.js?v=2.28.0';
import {isOrdinaryLoot} from '../nodspel/big-loot.js?v=2.28.0';
import {movePlayer} from '../nodspel/physics.mjs?v=2.28.0';
const root=new URL('../',import.meta.url),baselineFile=new URL('../nodspel/.big-level-loot-baseline.mjs',import.meta.url);
const base=process.env.LOOT_BASE_SHA||'88a9ac6364d0dcf5463c2a5f700f4817960ecaca';
if(!/^[a-f0-9]{40}$/.test(base))throw Error('Invalid baseline SHA');
const n=Number(process.argv[2]??1000);if(!Number.isInteger(n)||n<1||n>5000)throw Error('Expected 1..5000 seeds');
const items=Object.fromEntries(globalThis.DATA.items.map(i=>[i.id,i]));
const count=()=>({cable:0,scrap_alloy:0,polymer_plate:0,power_cell:0});
const metrics={baseline:count(),candidate:count()};
function geometry(l){return {rooms:l.rooms,floors:l.floors,walls:l.walls,boxes:l.boxes,nodes:l.nodes,enemies:l.enemies,graph:l.graph,doors:l.doors,spawners:l.spawners,lootPositions:l.lootBoxes.map(({id,x,z,roomId,requiresNode,key})=>({id,x,z,roomId,requiresNode,key}))};}
// Static audit uses the real movement function, actor radius and pickup radius, NOT teleport-to-loot.
// It excludes renderer-added props, live enemies, combat and locked-door interactions.
function access(l){
 const step=.5,radius=RULES.playerRadius,solids=[...l.walls,...l.boxes,...l.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))],floors=l.floors;
 const minX=Math.min(...floors.map(f=>f.x-f.w/2)),maxX=Math.max(...floors.map(f=>f.x+f.w/2));
 const minZ=Math.min(...floors.map(f=>f.z-f.d/2)),maxZ=Math.max(...floors.map(f=>f.z+f.d/2));
 const key=(i,j)=>`${i},${j}`,seen=new Set([key(0,0)]),queue=[[0,0]],remaining=new Set(l.lootBoxes.filter(b=>isOrdinaryLoot(b,items[b.item])).map(b=>b.id));
 const exits=new Set(l.extracts.filter(e=>e.type==='open').map(e=>e.id));
 for(let k=0;k<queue.length;k++){
  const [i,j]=queue[k],p={x:l.start.x+i*step,z:l.start.z+j*step};
  for(const b of l.lootBoxes)if(remaining.has(b.id)&&Math.hypot(b.x-p.x,b.z-p.z)<=RULES.loot.pickupRadius)remaining.delete(b.id);
  for(const e of l.extracts)if(exits.has(e.id)&&Math.hypot(e.x-p.x,e.z-p.z)<=e.r)exits.delete(e.id);
  for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const id=key(i+di,j+dj);if(seen.has(id))continue;
   const target={x:p.x+di*step,z:p.z+dj*step};if(target.x<minX||target.x>maxX||target.z<minZ||target.z>maxZ)continue;
   const q=movePlayer(p,{x:di*step,z:dj*step},solids,floors,radius);
   if(Math.hypot(q.x-target.x,q.z-target.z)>1e-6)continue;
   seen.add(id);queue.push([i+di,j+dj]);
  }
 }
 return {seed:l.seed,radius,step,reachableSamples:seen.size,unreachableOrdinary:[...remaining].map(id=>{const b=l.lootBoxes.find(x=>x.id===id);return {id,item:b.item,x:b.x,z:b.z,roomId:b.roomId};}),unreachableOpenExits:[...exits]};
}
try{
 writeFileSync(baselineFile,execFileSync('git',['show',`${base}:nodspel/big-level.js`],{cwd:root,encoding:'utf8'}));
 const {generateBigLevel:old}=await import(baselineFile.href);
 const accessResults=[];
 for(let i=0;i<n;i++){
  const seed=`loot-audit-${i}`,before=old(seed,'bunker'),after=generateLevel(1,seed,'bunker',false,true);
  assert.deepEqual(geometry(after),geometry(before),'Only loot identity/metadata may change');
  const protectedBefore=before.lootBoxes.filter(b=>!isOrdinaryLoot(b,items[b.item]));
  for(const b of protectedBefore)assert.deepEqual(after.lootBoxes.find(x=>x.id===b.id),b,'Protected pickup changed');
  for(const [name,l] of [['baseline',before],['candidate',after]]){const found=new Set(l.lootBoxes.map(b=>b.item));for(const id of Object.keys(metrics[name]))if(found.has(id))metrics[name][id]++;}
  if(i<12)accessResults.push(access(after));
  if(i<20)for(const area of ['archipelago','town'])assert.deepEqual(generateLevel(1,seed,area,false,true),old(seed,area),'Non-Bunker must be unchanged');
 }
 assert.ok(metrics.candidate.power_cell>metrics.baseline.power_cell,'Middle source not restored');
 const report={base,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),seeds:n,metrics,accessResults,scope:'Generated contents, protected pickups, geometry equality and static pre-render access. Not device telemetry, combat or frame-rate validation.'};
 mkdirSync(new URL('../verify-out/big-loot/',import.meta.url),{recursive:true});
 writeFileSync(new URL('../verify-out/big-loot/report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log('BIG_LOOT_AUDIT',JSON.stringify({seeds:n,metrics,staticAccessSeeds:accessResults.length,withUnreachableLoot:accessResults.filter(x=>x.unreachableOrdinary.length).length,withUnreachableExit:accessResults.filter(x=>x.unreachableOpenExits.length).length}));
}finally{try{unlinkSync(baselineFile);}catch{}}
