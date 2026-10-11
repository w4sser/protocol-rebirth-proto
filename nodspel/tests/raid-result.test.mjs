import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,collectLoot,activateNode,enterExit,takeDamage} from '../round.js';
import {buildRaidResult,writeRaidResult,RAID_RESULT_KEY} from '../raid-result.js';
const extractLevel=(r,item,t)=>{const box=r.level.lootBoxes[0];box.item=item;collectLoot(r,box,t);for(const n of r.level.nodes)activateNode(r,n.id,t+1);return enterExit(r,r.level.exit,t+2);};
test('no result while the round is still running',()=>{assert.equal(buildRaidResult(createRound('rr',0)),null);});
test('death keeps loot secured at earlier exits and lists the bag as lost',()=>{
  const r=createRound('rr-death',0);
  assert.equal(extractLevel(r,'cable',1),'next');
  const box=r.level.lootBoxes[0];box.item='fuse';collectLoot(r,box,10);
  takeDamage(r,1000,11);
  const res=buildRaidResult(r,{endedAt:5});
  assert.deepEqual(res,{schema:'protocol-rebirth/raid-result',version:1,raidId:'nodspel:rr-death',seed:'rr-death',outcome:'death',levelsCleared:1,enemiesDefeated:0,nodesLit:r.nodesLit,remainingMs:r.remainingMs,extracted:['cable'],lost:['fuse'],endedAt:5});
});
test('result is written as JSON under the shared key',()=>{
  const r=createRound('rr-w',0);takeDamage(r,1000,1);const store={};
  assert.ok(writeRaidResult({setItem:(k,v)=>{store[k]=v;}},buildRaidResult(r)));
  assert.equal(JSON.parse(store[RAID_RESULT_KEY]).outcome,'death');
  assert.equal(writeRaidResult({setItem:()=>{throw new Error('full');}},buildRaidResult(r)),false);
});
