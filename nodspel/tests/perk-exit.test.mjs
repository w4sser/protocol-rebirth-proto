import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createRound,enterExit,tickRound} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {createWeapon,stepWeapon,playerDisplaced} from '../weapon.js';
import {createDash,stepDash} from '../dash.js';
import {moveWithActors} from '../physics.mjs';
import {RULES} from '../levels.js';
import {createPerkUI} from '../perk-ui.js';
import {perkState,pausePick,resumePick,gameTime,choosePerk,roomAt} from '../perks.js';
import {isGameKey,isTypingTarget} from '../input.js';

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
// Run production action handlers and the simulation portion of the production frame,
// stopping after combat to avoid a WebGL renderer in this DOM integration test.
const handlers=source.slice(source.indexOf('function openPerk('),source.indexOf("for(const type of ['pointerdown'"));
const keyboard=source.slice(source.indexOf("window.addEventListener('keydown'"),source.indexOf("document.addEventListener('click'"));
// frameInner calls combatSnapshot() (defined earlier in the module, near updateHUD) to decide whether a
// shield/equip/capacity change needs a HUD refresh — pull it in too or the slice below leaves it undefined.
const snapshotHelpers=extractFn('combatSnapshot')+'\n'+extractFn('combatSnapshotChanged');
const frame=snapshotHelpers+'\n'+source.slice(source.indexOf('function frameInner('),source.indexOf('    playerMoving=playerMoving||playerDisplaced(beforeCombat,position);'))+'\n  }\n}';

test('exit picker minimize resumes movement, combat and timer; resume preserves the offer and exit requires a pick',()=>{
  const dom=new JSDOM('<main id="viewport"><div id="encounter-hint"></div><div id="inventory" hidden></div><span id="time-left"></span><span id="summary-time"></span><div class="timer"></div></main>');
  globalThis.document=dom.window.document;
  try{
    const r=createRound('exit-minimize',0),position={x:0,z:0};
    // A pre-killed enemy gives the room something to have cleared: an empty room (never assigned an enemy) must not offer a perk.
    Object.assign(r.level,{rooms:[{x:0,z:0,w:10,d:10}],enemies:[{id:'e0',kind:'enemy',type:'grunt',x:0,z:0,r:.48,health:0,active:true}],nodes:[],hazards:[],walls:[],boxes:[],floors:[{x:0,z:0,w:30,d:30}],exit:{x:0,z:0,r:1},start:position});
    const combat=createCombat(r.level,0);combat.graceUntil=0;combat.moveAt=0;
    const corner=document.createElement('div');corner.id='level-corner';document.querySelector('main').append(corner);
    const resume=document.createElement('button');resume.className='perk-resume';resume.type='button';corner.append(resume);let wall=1000;
    let shots=0,dashes=0;
    const key=(type,code)=>{const event=new dom.window.KeyboardEvent(type,{code,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(event);return event;};
    const noop=()=>{},context=vm.createContext({
      round:r,position:{...position},combat,weapon:createWeapon(Infinity),dash:createDash(),
      window:dom.window,isGameKey,isTypingTarget,fire:()=>shots++,requestDash:()=>dashes++,
      perkState,pausePick,resumePick,choosePerk,enterExit,tickRound,roomAt,stepCombat,stepWeapon,stepDash,moveWithActors,playerDisplaced,RULES,
      Date:{now:()=>wall},perkKey:null,perkChoosing:false,perkResume:resume,
      $:s=>document.querySelector(s),clearInput:noop,cancelToolDrag:noop,hideSwap:noop,updateHUD:noop,
      setTimeout:fn=>fn(),finishRound:()=>assert.fail('unexpected extraction'),
      gameClock:()=>gameTime(r,wall),previous:0,elapsed:0,tutorialOpen:false,resultPending:false,
      movement:{x:0,y:0},keys:new Set(),playerMoving:false,playerSolids:[],solids:[],sticks:[{}, {state:{gesture:{}}}],
      stepAim:()=>null,mouseKnown:false,screenToWorld:(x,y)=>({x,z:y}),doorAssist:(_house,_pos,delta)=>delta,
      bullets:[],collectLoot:()=>false,stepDoors:()=>false,checkEncounterHints:noop,
      stepNodeInteraction:()=>false,stepHouse:()=>({loot:[],changed:false}),renderHouseLabels:noop,
      renderRoundClock:()=>Math.ceil(r.remainingMs/1000),
      renderer:{render:noop},scene:{},camera:{},requestAnimationFrame:noop,frame:noop
    });
    context.perkUI=createPerkUI(document.querySelector('main'),(...args)=>context.act(...args));
    vm.runInContext(keyboard+'\n'+handlers+'\n'+frame,context);
    assert.equal(enterExit(r,position,wall),'perk');context.openPerk(perkState(r).queue[0]);
    const ids=[...perkState(r).rooms['1:0'].offer],remaining=r.remainingMs;
    assert.equal(r.perkExitPending,true);assert.notEqual(r.pauseAt,null);
    wall=6000;document.querySelector('.pop-x').click();
    assert.equal(r.pauseAt,null);assert.equal(r.perkExitPending,false);assert.equal(resume.hidden,false);
    assert.equal(document.activeElement,resume,'minimize leaves the accessible resume button focused');
    // Staying in the exit must not reopen the minimized offer or change levels.
    assert.equal(enterExit(r,position,gameTime(r,wall)),null);assert.equal(r.level.number,1);
    const enemy={id:'live',kind:'enemy',type:'grunt',x:3,z:0,r:.48,health:2,active:true,aggro:true,speed:2,standoff:.5};r.level.enemies.push(enemy);
    assert.equal(key('keydown','KeyD').defaultPrevented,true);
    wall=7000;context.frameInner(40);
    assert.ok(context.position.x>0,'production frame moves the player');
    assert.equal(key('keyup','KeyD').defaultPrevented,true);
    assert.equal(context.keys.has('KeyD'),false,'keyup releases movement on the focused resume button');
    assert.equal(key('keydown','Space').defaultPrevented,true);
    assert.equal(key('keyup','Space').defaultPrevented,true);
    assert.equal(shots,1,'Space fires through the production keyboard handler');
    assert.equal(context.keys.has('Space'),false);
    assert.equal(key('keydown','ShiftLeft').defaultPrevented,true);
    key('keyup','ShiftLeft');assert.equal(dashes,1,'Shift requests a dash through the production keyboard handler');
    assert.equal(key('keydown','Enter').defaultPrevented,false,'Enter remains available for button activation');
    assert.equal(document.activeElement,resume);
    assert.ok(enemy.x<3,'production frame advances enemy combat');
    assert.equal(r.remainingMs,remaining-1000);
    wall=8000;context.act('resume');
    assert.deepEqual([...perkState(r).rooms['1:0'].offer],ids);assert.notEqual(r.pauseAt,null);assert.equal(resume.hidden,true);
    key('keydown','KeyD');key('keydown','Space');key('keyup','Space');key('keydown','ShiftLeft');
    assert.equal(context.keys.size,0,'the open picker blocks gameplay keyboard input');assert.equal(shots,1);assert.equal(dashes,1);
    const frozenX=context.position.x,frozenEnemyX=enemy.x;wall=18000;context.frameInner(80);
    assert.equal(context.position.x,frozenX);assert.equal(enemy.x,frozenEnemyX);assert.equal(gameTime(r,wall),3000);
    document.querySelector('.perk-choice').click();
    assert.equal(r.pauseAt,null);assert.equal(perkState(r).queue.length,0);assert.equal(perkState(r).taken[0],ids[0]);
    assert.equal(enterExit(r,{x:10,z:0},gameTime(r,wall)),null,'choosing away from exit does not transition');
    assert.equal(enterExit(r,position,gameTime(r,wall)),'next');assert.equal(r.level.number,2);
  }finally{delete globalThis.document;dom.window.close();}
});
