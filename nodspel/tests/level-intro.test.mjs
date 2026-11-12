import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRound,tickRound} from '../round.js?v=2.28.17';
import {pausePick,resumePick,gameTime,inputPaused} from '../perks.js?v=2.28.17';
import {levelIntroTitle,LEVEL_INTRO_MS} from '../level-intro.mjs?v=2.28.17';

test('levelIntroTitle names only discrete bunker levels, not big/continuous areas',()=>{
  assert.equal(levelIntroTitle({number:1,big:false}),'BUNKER LEVEL 1');
  assert.equal(levelIntroTitle({number:2,big:false}),'BUNKER LEVEL 2');
  assert.equal(levelIntroTitle({number:3,big:false}),'BUNKER LEVEL 3');
  assert.equal(levelIntroTitle({number:1,big:true}),null,'archipelago/town is one continuous level, no card');
  assert.equal(levelIntroTitle({number:2,big:false,area:'archipelago'}),null,'non-bunker area has no card');
  assert.equal(levelIntroTitle(null),null);
});
test('the card is short: well under half a round-two-minute warning window',()=>{
  assert.ok(LEVEL_INTRO_MS>0&&LEVEL_INTRO_MS<=2000,'card should read as a brief beat, not a loading screen');
});
test('the raid timer does not tick while the intro pause is held (tickRound itself refuses to advance)',()=>{
  const r=createRound('intro-pause',0);
  tickRound(r,1000);const remaining=r.remainingMs;
  pausePick(r,1000);
  tickRound(r,1000+LEVEL_INTRO_MS+5000);
  assert.equal(r.remainingMs,remaining,'remainingMs is frozen for the whole card duration, even past it');
  assert.equal(inputPaused(r),true);
  resumePick(r,1000+LEVEL_INTRO_MS);
  assert.equal(inputPaused(r),false);
  assert.equal(gameTime(r,1000+LEVEL_INTRO_MS+40),1000+40,'clock resumes from where it was paused, not from wall time');
});

const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
function fn(name){
  const start=source.indexOf(`function ${name}(`);let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(start,i+1);}
  throw Error(name);
}
assert.match(source,/showLevelIntro\(\);\s*\n\}/,'loadLevelInner calls showLevelIntro() before returning');

function harness(level,search=''){
  const round={level,pauseAt:null,pausedMs:0};
  const dom={introHidden:true,introText:''};
  const els={'#level-intro-text':{set textContent(v){dom.introText=v;}},'#level-intro':{get hidden(){return dom.introHidden;},set hidden(v){dom.introHidden=v;}}};
  const ctx=vm.createContext({round,levelIntroTitle,LEVEL_INTRO_MS:15,pausePick,resumePick,levelIntroTimer:null,
    $:sel=>els[sel],setTimeout,clearTimeout,Date,URLSearchParams,location:{search}});
  vm.runInContext(fn('showLevelIntro'),ctx);
  return {round,dom,ctx};
}
test('showLevelIntro pauses the round and blocks the view, then auto-resumes after the card',async()=>{
  const h=harness({number:2,big:false});
  h.ctx.showLevelIntro();
  assert.equal(h.dom.introText,'BUNKER LEVEL 2');
  assert.equal(h.dom.introHidden,false);
  assert.equal(h.round.pauseAt!=null,true,'round is paused for the duration of the card');
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(h.dom.introHidden,true);
  assert.equal(h.round.pauseAt,null,'round resumes once the card clears');
});
test('showLevelIntro is a no-op outside discrete bunker levels (big/continuous areas)',()=>{
  const h=harness({number:1,big:true});
  h.ctx.showLevelIntro();
  assert.equal(h.dom.introHidden,true);
  assert.equal(h.round.pauseAt,null,'never pauses a level that has no title to show');
});
test('debug harness URLs skip the card unless they opt in with levelIntro=1',()=>{
  const skip=harness({number:1,big:false},'?debug=1');skip.ctx.showLevelIntro();
  assert.equal(skip.dom.introHidden,true);assert.equal(skip.round.pauseAt,null);
  const opt=harness({number:1,big:false},'?debug=1&levelIntro=1');opt.ctx.showLevelIntro();
  assert.equal(opt.dom.introText,'BUNKER LEVEL 1');assert.equal(opt.round.pauseAt!=null,true);
});
