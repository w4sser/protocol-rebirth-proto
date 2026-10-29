import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRound,useHealthKit,healthKitBlock} from '../round.js?v=2.7.3';
import {hitstop,advanceHitstop,gameTime,inputPaused,pausePick} from '../perks.js?v=2.7.3';
import {initTool,canUseTool,toolCharges,throwTool,autoThrowPoint} from '../tools.js?v=2.7.3';
const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
function fn(name){
  const start=source.indexOf(`function ${name}(`);let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(start,i+1);}
  throw Error(name);
}
function harness(){
  const round=createRound('buffer',0);round.health=40;round.kit={medkit:2};
  initTool(round,{id:'tool_grenade',n:2});
  let wall=110;const notices=[];
  const ctx=vm.createContext({round,inputPaused,canUseTool,toolCharges,throwTool,autoThrowPoint,useHealthKit,healthKitBlock,
    resultPending:false,tutorialOpen:false,$:()=>({hidden:true}),position:{x:0,z:0},playerSolids:[],mouseKnown:false,walkDirection:{x:1,z:0},
    gameClock:()=>{advanceHitstop(round,wall);return gameTime(round,wall);},renderToolHUD(){},updateHUD(){},notice:s=>notices.push(s),
    firstHint(){},toolDef:()=>({}),toolDrag:{pointer:1,active:true,dir:{x:0,z:1},dist:3},cancelToolDrag(){},
  });
  vm.runInContext('let pendingTool=null,pendingKit=false;'+['toolBlocked','throwToolAt','toolTap','toolDragPoint','releaseTool','useKit','flushHitstopActions'].map(fn).join('\n'),ctx);
  hitstop(round,40,100);
  return {round,ctx,notices,resume(){wall=140;advanceHitstop(round,wall);ctx.flushHitstopActions();}};
}
for(const action of ['toolTap()','releaseTool({pointerId:1,type:"pointerup"})'])test(`${action} buffers during hitstop and throws once on resume`,()=>{
  const h=harness(),charges=toolCharges(h.round);
  assert.equal(canUseTool(h.round),false);
  assert.equal(h.ctx.toolBlocked(),false,'button remains usable during hitstop');
  vm.runInContext(action,h.ctx);h.ctx.flushHitstopActions();
  assert.equal(toolCharges(h.round),charges);
  h.resume();assert.equal(toolCharges(h.round),charges-1);
  assert.equal(h.round.toolFx.fuses.length,1);
  if(action.startsWith('release'))assert.equal(h.round.toolFx.fuses[0].z,3);
  h.ctx.flushHitstopActions();assert.equal(toolCharges(h.round),charges-1);
});
test('medkit buffers without spending or +0 feedback, then heals once',()=>{
  const h=harness();h.ctx.useKit();h.ctx.flushHitstopActions();
  assert.equal(h.round.health,40);assert.equal(h.round.kit.medkit,2);assert.deepEqual(h.notices,[]);
  h.resume();assert.ok(h.round.health>40);assert.equal(h.round.kit.medkit,1);
  assert.match(h.notices[0],/^Medkit: \+[1-9]\d* HP$/);
  h.ctx.flushHitstopActions();assert.equal(h.round.kit.medkit,1);
});
test('perk pick rejects fresh actions and never replays buffers while paused',()=>{
  const h=harness();pausePick(h.round,110);
  assert.equal(h.ctx.toolBlocked(),true);
  h.ctx.toolTap();h.ctx.useKit();h.resume();
  assert.equal(h.round.tool.thrown,0);assert.equal(h.round.kit.medkit,2);
});
