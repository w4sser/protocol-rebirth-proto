import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound} from '../round.js?v=2.11.3';
import {RULES} from '../levels.js?v=2.11.3';
import {createWeapon,fireAimedWeapon,stepWeapon,steerShot} from '../weapon.js?v=2.11.3';
const origin={x:0,z:0},facing={x:1,z:0};
const foe=(id,x,z)=>({id,kind:'enemy',type:'grunt',aggro:true,active:true,x,z,r:.48,health:10,facing:0});
function arena(enemies=[],spreadDegrees=0,rand=()=>.5){
  const round=createRound('tap-shot',0);round.level.nodes=[];round.level.enemies=enemies;
  const weapon=createWeapon(Infinity,{spreadDegrees});weapon.rand=rand;
  return {round,weapon,fire:(tap=true,now=0)=>fireAimedWeapon(weapon,round,origin,facing,now,[],false,tap)};
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const angle=b=>Math.atan2(b.dz,b.dx)*180/Math.PI;

test('tap range is 80% and expires without reaching a target beyond it',()=>{
  const target=foe('outside',6.7,0),a=arena([target]),tap=a.fire();
  close(tap.remaining,a.weapon.rule.range*.8);
  // No sweep may exceed the reduced remaining distance, even on a long frame.
  stepWeapon(a.weapon,a.round,400,.4,[]);
  assert.equal(a.weapon.projectiles.length,0);assert.equal(target.health,10);
  const aimed=arena();close(aimed.fire(false).remaining,aimed.weapon.rule.range);
});
for(const spread of [0,6])test(`tap always scatters by 1.5x max(weapon spread, 3), base spread ${spread}`,()=>{
  for(const sample of [0,.25,1]){
    const a=arena([foe('nearest',4,0)],spread,()=>sample),shot=a.fire();
    close(angle(shot),(sample*2-1)*Math.max(spread,3)*1.5);
    assert.equal(shot.aimAssisted,false,'target selection must not cancel spread');
  }
});
test('tap selects the nearest enemy only once and ignores node aim assist',()=>{
  const a=arena([foe('far',5,0),foe('near',0,-3)]),shot=a.fire();
  close(shot.dx,0);close(shot.dz,-1);
  a.round.level.enemies[1].x=3;a.round.level.enemies[1].z=-2;
  stepWeapon(a.weapon,a.round,20,.02,[]);
  close(shot.dx,0);close(shot.dz,-1);
  const b=arena();b.round.level.nodes=[{id:'node',kind:'node',x:3,z:.4,r:.5,active:false}];
  close(angle(b.fire()),0,'node must not snap a tap away from its facing fallback');
});
test('tap cannot home onto a target entering the cone after fire',()=>{
  const a=arena(),shot=a.fire();a.round.level.enemies=[foe('later',4,.6)];
  // This target is in the ordinary weapon homing cone; both direct and frame steering must ignore taps.
  steerShot(shot,a.round.level.enemies,[],a.weapon.rule,.05);
  stepWeapon(a.weapon,a.round,50,.05,[]);
  close(shot.dx,1);close(shot.dz,0);
  const b=arena();const manual=b.fire(false);b.round.level.enemies=[foe('later',4,.6)];
  stepWeapon(b.weapon,b.round,50,.05,[]);assert.ok(manual.dz>0,'ordinary free aimed shots retain homing');
});
test('an initially centered tap can miss an enemy that moves sideways during flight',()=>{
  for(const moves of [false,true]){
    const target=foe('moving',4,0),a=arena([target]),shot=a.fire();
    stepWeapon(a.weapon,a.round,50,.05,[]);assert.equal(target.health,10,'not an instant guaranteed hit');
    if(moves)target.z=2;
    for(let i=2;i<=8;i++)stepWeapon(a.weapon,a.round,i*50,.05,[]);
    close(shot.dz,0);
    assert.equal(target.health,moves?10:9,moves?'lateral movement evades the shot':'stationary target is hittable');
  }
});
test('aimed shots keep their range, assisted direction and free-aim spread',()=>{
  const assisted=arena([foe('target',4,.4)],6,()=>1),shot=assisted.fire(false);
  assert.equal(shot.aimAssisted,true);close(angle(shot),Math.atan2(.4,4)*180/Math.PI);
  close(shot.remaining,assisted.weapon.rule.range);
  const free=arena([],6,()=>1);close(angle(free.fire(false)),6);
  const basic=arena([],0,()=>1);close(angle(basic.fire(false)),0);
  // A tap does not leave a mode flag on the weapon for the next aimed shot.
  const a=arena([],6,()=>1);a.fire();const aimed=a.fire(false,200);
  assert.equal(aimed.tap,false);close(aimed.remaining,a.weapon.rule.range);close(angle(aimed),6);
});

test('real fire path buffers tap mode and selects its target when hitstop ends',async()=>{
  const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
  const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  function block(start){let end=source.indexOf('{',start),depth=0;for(;end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}'&&!--depth)return source.slice(start,end+1);}throw Error('unbalanced block');}
  const a=arena([foe('target',4,0)]),shots=[];
  const ctx=vm.createContext({round:a.round,weapon:a.weapon,position:origin,aim:facing,player:{rotation:{y:Math.PI/2}},
    playerSolids:[],playerMoving:false,tutorialOpen:false,resultPending:false,inputPaused:()=>false,tickRound:()=>{},gameClock:()=>100,
    $:()=>({hidden:true,classList:{add(){}}}),
    fireAimedWeapon:(...args)=>{shots.push(fireAimedWeapon(...args));return null;},
  });
  vm.runInContext('let pendingShot=null;'+block(source.indexOf('function fire(')),ctx);
  a.round.hitstopUntil=40;ctx.fire(true);assert.equal(shots.length,0);
  // Target moves after gesture release, before the actual shot.
  a.round.level.enemies[0].x=0;a.round.level.enemies[0].z=4;
  a.round.hitstopUntil=null;ctx.frozen=false;
  vm.runInContext(block(source.indexOf('if(!frozen&&pendingShot)')),ctx);
  assert.equal(shots[0].tap,true);close(shots[0].dx,0);close(shots[0].dz,1);
  close(shots[0].remaining,a.weapon.rule.range*.8);
  ctx.gameClock=()=>300;ctx.fire();assert.equal(shots[1].tap,false);
  close(shots[1].remaining,a.weapon.rule.range);
});
