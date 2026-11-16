import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {prepareCombatAudio,waitForCombatAudio} from '../audio-ready.js';
const require=createRequire(import.meta.url);
require('../../data/audio.js');
const {AudioManager}=require('../../ui/audio.js');
const config=globalThis.DATA.audio;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
class Param{value=0;cancelScheduledValues(){}setValueAtTime(){}linearRampToValueAtTime(){}setTargetAtTime(){}}
class WebKitContext{
  state='suspended';sampleRate=44100;currentTime=0;destination={};pending=[];sources=[];gesture=false;resumedInGesture=false;
  createGain(){return {gain:new Param(),connect(){},disconnect(){}};}
  createBuffer(c,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};}
  createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){},start(){s.started=true;},stop(){}};this.sources.push(s);return s;}
  resume(){this.resumedInGesture=this.gesture;if(!this.gesture)return Promise.reject(Error('gesture required'));this.state='running';this.onstatechange?.();return Promise.resolve();}
  decodeAudioData(){return new Promise((resolve,reject)=>this.pending.push({resolve,reject}));}
}
function fixture(){
  const urls=[];
  const audio=new AudioManager(config,{AudioContext:WebKitContext,storage:null,probe:{canPlayType:type=>type.startsWith('audio/mp4')?'probably':''},fetch:async url=>{urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
  audio.init();return {audio,ctx:audio.context,urls};
}
test('raid waits for every combat decode, selects AAC, prewarms shots, then starts',async()=>{
  const {audio,ctx,urls}=fixture();
  const ready=prepareCombatAudio(audio);let starts=0;
  const start=waitForCombatAudio(ready).then(ok=>{assert.equal(ok,true);starts++;});
  await tick();assert.equal(starts,0);assert.ok(urls.length>20);assert.ok(urls.every(url=>url.endsWith('.m4a')));
  assert.equal(audio.shotCache.size,8);
  const last=ctx.pending.pop();ctx.pending.splice(0).forEach(p=>p.resolve({duration:1}));
  await tick();assert.equal(starts,0,'one undecoded combat cue still holds play');
  last.resolve({duration:1});await start;assert.equal(starts,1);
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.ok(game.indexOf('await waitForRaidAudio();')<game.indexOf("reset(new URLSearchParams(location.search).get('seed'));camera"));
  assert.match(game,/if\(gameReady\)return;\s*event.stopImmediatePropagation/);
});
test('cap releases play while pending and failed buffers keep loading, first pending cue plays within 150ms',async()=>{
  const {audio,ctx}=fixture();
  const retries=[];
  const ready=prepareCombatAudio(audio,{schedule:fn=>retries.push(fn)});
  await tick();ctx.pending.shift().reject(Error('pre-gesture decode failed'));
  await tick();assert.equal(retries.length,1);
  let cap;const start=waitForCombatAudio(ready,{schedule:fn=>{cap=fn;return 1;},cancel:()=>{}});
  cap();assert.equal(await start,false);
  ctx.gesture=true;audio.unlockSync();ctx.gesture=false;
  assert.equal(ctx.resumedInGesture,true); // resume happened within the trusted stack
  await tick();retries.shift()();
  // Choose a sample still being decoded, then finish it inside the short play deadline.
  audio.sfxWaitMs=150;
  const play=audio.play('impact-wall');
  ctx.pending.splice(0).forEach(p=>p.resolve({duration:1}));
  assert.equal(await play,true,'first request queues behind its in-flight decode');
  assert.equal(await ready,true,'cap does not cancel outstanding loads/retries');
});
test('first raid joystick touchstart/pointerdown synchronously unlocks and retries failed decodes',async()=>{
  for(const type of ['touchstart','pointerdown']){
    const {audio,ctx}=fixture(),handlers={};
    audio.failedFiles.set('sfx/impact-wall','decode');audio.buffers.set('sfx/impact-wall.m4a',new ArrayBuffer(1));
    const target={addEventListener:(name,fn)=>{handlers[name]=fn;},document:{addEventListener(){}}};
    audio.installUnlock(target);
    ctx.gesture=true;handlers[type]();assert.equal(ctx.resumedInGesture,true);assert.equal(ctx.sources[0].started,true);ctx.gesture=false;
    assert.ok(audio.pendingFiles.has('sfx/impact-wall'),'failed sample decode retries during unlock');
    ctx.pending.splice(0).forEach(p=>p.resolve({duration:1}));await tick();
    assert.ok(audio.decodedFiles.has('sfx/impact-wall'));
  }
});
