import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createRound,initEquip,extractRound,takeDamage,tickRound,abandonRound} from '../round.js';
import {readLaunch,handoffRaidResult,RAID_RESULT_KEY} from '../raid-result.js';

const launch=readLaunch('?seed=eor&raidId=meta-eor&return=..%2Findex.html&gear=scout_rig&w=smg_vector');
function ended(reason){
  const r=createRound('eor',0);initEquip(r,{weapon:'smg_vector',gear:['scout_rig']});r.bag={cable:2,fuse:1};r.levelsCleared=1;
  if(reason==='extract')extractRound(r,10);
  if(reason==='death')takeDamage(r,1000,10);
  if(reason==='timeout')tickRound(r,r.durationMs+1);
  if(reason==='abandon')abandonRound(r,10);
  if(reason==='complete'){extractRound(r,10);r.reason='complete';}
  return r;
}
for(const reason of ['extract','complete','death','timeout','abandon'])test(`${reason} saves the full ledger before returning directly to base`,()=>{
  const events=[],r=ended(reason);
  const storage={setItem:(key,json)=>events.push({key,result:JSON.parse(json)})};
  assert.equal(handoffRaidResult(r,{launch,storage,navigate:url=>events.push(url)}),true);
  assert.equal(events.length,2);assert.equal(events[0].key,RAID_RESULT_KEY);assert.equal(events[1],'../index.html');
  const result=events[0].result;assert.equal(result.raidId,'meta-eor');
  const safe=['extract','complete'].includes(reason);
  assert.deepEqual(safe?result.extracted:result.lost,['cable','cable','fuse']);
  assert.deepEqual(safe?result.gearOut:result.equipmentLost,['smg_vector','scout_rig']);
});
test('checkpoint, standalone, restarted and failed persistence retain the raid UI',()=>{
  const r=ended('extract'),failStorage={setItem:()=>{throw Error('quota');}},store={setItem:()=>{}};
  const navigate=()=>assert.fail('must not leave the raid');
  assert.equal(handoffRaidResult(createRound('eor',0),{launch,storage:store,navigate}),false);
  for(const l of [{},{...launch,raidId:null},{...launch,seed:'other'},{...launch,returnUrl:'https://example.com'}])
    assert.equal(handoffRaidResult(r,{launch:l,storage:store,navigate}),false);
  assert.equal(handoffRaidResult(r,{launch,storage:failStorage,navigate}),false);
  assert.equal(handoffRaidResult(r,{launch,storage:store,navigate:()=>{throw Error('navigation');}}),false);
});

// Execute the shipped finishRound itself, with only rendering/platform boundaries
// stubbed. This catches an old-panel render before/after the real handoff.
const source=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
const finish=source.slice(source.indexOf('let resultReturning=false;'),source.indexOf("$('#result-details-toggle').addEventListener"));
for(const reason of ['extract','complete','death','timeout','abandon','checkpoint','storage-failure'])test(`game finishRound routes ${reason} through the correct presenter`,()=>{
  const events=[],elements=new Map();
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{hidden:true,setAttribute(){},focus(){}});return elements.get(selector);};
  const round=reason==='checkpoint'?createRound('eor',0):ended(reason==='storage-failure'?'death':reason);
  const storage={setItem:()=>{if(reason==='storage-failure')throw Error('quota');events.push('saved');},getItem:()=>null};
  const context={round,launch,resultPending:false,$:element,weapon:{},viewport:{classList:{add(){}}},localStorage:storage,
    handoffRaidResult:(r,opts)=>handoffRaidResult(r,{...opts,storage,navigate:()=>events.push('navigate')}),
    clearInput:()=>events.push('clear'),hideSwap(){},clearBullets(){},updateHUD(){},lastCombatFeedback:()=>'',deathTip:()=>null,setIconText(){},
    resultView:()=>({}),renderResult:()=>events.push('render')};
  runInNewContext(finish+`;finishRound(${reason==='checkpoint'?"'extraction'":''});`,context);
  if(['checkpoint','storage-failure'].includes(reason))assert.deepEqual(events,reason==='checkpoint'?['render','clear']:['render','clear']);
  else {assert.deepEqual(events,['saved','clear','navigate']);assert.equal(element('#round-over').hidden,true);runInNewContext('finishRound();',context);assert.equal(events.length,3,'no repeated navigation while leaving');}
});
