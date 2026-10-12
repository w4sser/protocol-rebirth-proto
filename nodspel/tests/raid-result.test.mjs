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
import {safeReturnUrl,readLaunch} from '../raid-result.js';
test('return url accepts only same-origin relative paths',()=>{
  for(const ok of ['../','../index.html','./x.html','/proto/index.html','../index.html?a=1#base'])assert.equal(safeReturnUrl(ok),ok);
  for(const bad of ['https://evil.example','//evil.example','javascript:alert(1)','/\\evil.example','\\\\evil','../a b','data:text/html,x','','../<x>',null])assert.equal(safeReturnUrl(bad),null,String(bad));
});
test('launch params are read and validated',()=>{
  assert.deepEqual(readLaunch('?seed=abc&raidId=meta-1-ff&return=..%2Findex.html'),{seed:'abc',raidId:'meta-1-ff',returnUrl:'../index.html'});
  assert.deepEqual(readLaunch('?raidId=bad%20id&return=https%3A%2F%2Fx'),{seed:null,raidId:null,returnUrl:null});
});
test('meta raidId is used only for the launched seed',()=>{
  const r=createRound('launched',0);takeDamage(r,1000,1);
  assert.equal(buildRaidResult(r,{launch:{seed:'launched',raidId:'meta-x'}}).raidId,'meta-x');
  const r2=createRound('restarted',0);takeDamage(r2,1000,1);
  assert.equal(buildRaidResult(r2,{launch:{seed:'launched',raidId:'meta-x'}}).raidId,'nodspel:restarted');
});
test('round-over has a hidden return-to-base button',async()=>{
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<button id="return-base" hidden>Return to base<\/button>/);
});
