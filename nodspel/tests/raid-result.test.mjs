import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,collectLoot,activateNode,enterExit,takeDamage} from '../round.js';
import {buildRaidResult,writeRaidResult,RAID_RESULT_KEY} from '../raid-result.js';
const extractLevel=(r,item,t)=>{const box=r.level.lootBoxes[0];box.item=item;collectLoot(r,box,t);for(const n of r.level.nodes)activateNode(r,n.id,t+1);return enterExit(r,r.level.exit,t+2);};
test('no result while the round is still running',()=>{assert.equal(buildRaidResult(createRound('rr',0)),null);});
test('death after a level exit loses everything carried in the raid',()=>{
  const r=createRound('rr-death',0);
  assert.equal(extractLevel(r,'cable',1),'next');
  const box=r.level.lootBoxes[0];box.item='fuse';collectLoot(r,box,10);
  takeDamage(r,1000,11);
  const {skills,stats,gear,weapon,kitLeft,...res}=buildRaidResult(r,{endedAt:5});
  assert.deepEqual(gear,[]);assert.equal(weapon,'basic_carbine');assert.deepEqual(kitLeft,{medkit:0});assert.equal(stats.speed,3.6);assert.equal(skills.damageTaken,100);
  assert.deepEqual(res,{schema:'protocol-rebirth/raid-result',version:1,raidId:'nodspel:rr-death',seed:'rr-death',area:'bunker',outcome:'death',reason:'death',levelsCleared:1,enemiesDefeated:0,nodesLit:r.nodesLit,remainingMs:r.remainingMs,extracted:[],lost:['cable','fuse'],endedAt:5});
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
  const pick=({seed,raidId,returnUrl})=>({seed,raidId,returnUrl});
  assert.deepEqual(pick(readLaunch('?seed=abc&raidId=meta-1-ff&return=..%2Findex.html')),{seed:'abc',raidId:'meta-1-ff',returnUrl:'../index.html'});
  assert.deepEqual(pick(readLaunch('?raidId=bad%20id&return=https%3A%2F%2Fx')),{seed:null,raidId:null,returnUrl:null});
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
import {extractRound,abandonRound} from '../round.js';
test('extract after a level ends the raid with everything secured',()=>{
  const r=createRound('rr-ex',0);
  assert.equal(extractRound(r,1),false,'no extract before any level exit');
  assert.equal(extractLevel(r,'cable',1),'next');
  assert.ok(extractRound(r,5));
  const res=buildRaidResult(r);
  assert.equal(res.outcome,'extract');assert.equal(res.reason,'extract');assert.deepEqual(res.extracted,['cable']);assert.deepEqual(res.lost,[]);
});
test('abandon loses the bag and is reported as death; timeout is reported as timeout',()=>{
  const r=createRound('rr-ab',0);const box=r.level.lootBoxes[0];box.item='fuse';collectLoot(r,box,1);
  assert.ok(abandonRound(r,2));assert.equal(abandonRound(r,3),false);
  const res=buildRaidResult(r);
  assert.equal(res.outcome,'death');assert.equal(res.reason,'abandon');assert.deepEqual(res.lost,['fuse']);
});
test('launched raids hide Restart in favour of Abandon, and level exits offer Extract or Next level',async()=>{
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),js=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(html,/<button id="abandon"[^>]*hidden>/);assert.match(html,/<button id="extract-raid" hidden>Extract<\/button><button id="continue-raid" hidden>Next level<\/button>/);
  assert.match(js,/\$\('#reset'\)\.hidden=!!launch\.returnUrl/);assert.match(js,/\$\('#new-round'\)\.hidden=!!launch\.returnUrl/);
});
