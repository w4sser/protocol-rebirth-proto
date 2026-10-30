// v2.4 (reviewer finding): a shield-only hit — e.g. a Scout Rig soaking exactly its shield value — can
// consume the spent armor and shrink bagCapacity without ever moving health. frameInner used to gate the
// HUD refresh on health alone, so the shield readout, equip slot and bag-count badge all stayed stale
// until some unrelated event forced a redraw. Exercises the actual combatSnapshot/combatSnapshotChanged
// helpers game.mjs uses to decide whether to call updateHUD(), not just the round.js state they read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRound,initEquip,takeDamage} from '../round.js';

const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
function extractFn(name){
  const start=source.indexOf(`function ${name}(`);
  if(start<0)throw new Error(`function ${name} not found in game.mjs`);
  let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}
function snapshotter(round){
  const ctx=vm.createContext({round});
  vm.runInContext(extractFn('combatSnapshot')+'\n'+extractFn('combatSnapshotChanged'),ctx);
  vm.runInContext('var before=combatSnapshot(round);',ctx);
  return ()=>vm.runInContext('combatSnapshotChanged(before,round)',ctx);
}

test('a shield-only hit that consumes a rig (Scout Rig) is flagged as HUD-dirty even though health is untouched',()=>{
  const r=createRound('spent-rig-hud',0,{shield:10,bagCapacity:5});
  initEquip(r,{gear:['scout_rig']});
  const changed=snapshotter(r);
  takeDamage(r,10,10);
  assert.equal(r.health,100,'health untouched: shield absorbed the full hit');
  assert.equal(r.equip.armor,null,'rig consumed');
  assert.equal(r.bagCapacity,4,'bag capacity shrinks once the rig is gone');
  assert.equal(changed(),true,'HUD refresh must trigger on shield/equipment/capacity change, not just health');
});

test('a hit that only drains shield (armor survives) still flags HUD-dirty',()=>{
  const r=createRound('shield-drain-hud',0,{shield:25});
  initEquip(r,{gear:['scavenger_vest']});
  const changed=snapshotter(r);
  takeDamage(r,10,1);
  assert.equal(r.health,100);assert.equal(r.shield,15);assert.equal(r.equip.armor,'scavenger_vest');
  assert.equal(changed(),true,'shield value moved even though equipment and capacity did not');
});

test('an untouched round is never flagged as HUD-dirty',()=>{
  const r=createRound('idle-hud',0,{shield:10,bagCapacity:5});
  initEquip(r,{gear:['scout_rig']});
  const changed=snapshotter(r);
  assert.equal(changed(),false);
});

test('the frame combat path actually refreshes the HUD after shield-only rig consumption',()=>{
  const round=createRound('spent-rig-frame',0,{shield:10,bagCapacity:5});
  initEquip(round,{gear:['scout_rig']});
  let refreshes=0;
  const context=vm.createContext({
    round,position:{x:0,z:0},playerMoving:false,combat:{},clock:10,dt:0,playerSolids:[],now:10,dash:null,
    stepCombat:()=>takeDamage(round,10,10),playerDisplaced:()=>false,stepTools:()=>[],
    stepHazards(){},world:{burst(){}},hazardLabels:[],setCollisions(){},hitUntil:0,
    updateHUD:()=>{refreshes++;},
    RULES:{feedback:{cameraShake:{playerDamage:{distance:.15,ms:200},hit:{distance:.05,ms:80},kill:{distance:.12,ms:150}}},hitstop:{hitMs:40,killMs:90,lastKillMs:140},enemyTypes:{}},
    human:null,operatorFX:{sparks(){}},QUALITY:'low',
    addShake(){},hitstop(){},hapticPulse(){},spawnKillMarker(){},lastHitFeelSerial:0,
  });
  const start=source.indexOf('const combatBefore=combatSnapshot(round);');
  const end=source.indexOf('const moving=magnitude',start);
  assert(start>=0&&end>start,'combat frame block exists');
  vm.runInContext(extractFn('combatSnapshot')+'\n'+extractFn('combatSnapshotChanged')+'\n'+source.slice(start,end),context);
  assert.equal(round.health,100);assert.equal(round.equip.armor,null);assert.equal(round.bagCapacity,4);
  assert.equal(refreshes,1,'production frame calls updateHUD without a health change');
});
