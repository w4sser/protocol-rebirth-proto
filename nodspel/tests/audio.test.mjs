import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir,stat} from 'node:fs/promises';
const require=createRequire(import.meta.url);
require('../../data/audio.js');
const {AudioManager}=require('../../ui/audio.js');
const config=globalThis.DATA.audio;
class Param{
  value=0;
  cancelScheduledValues(){}
  setTargetAtTime(v){this.value=v;}
}
class Gain{
  gain=new Param();
  connect(node){this.destination=node;}
  disconnect(){}
}
class Source{
  playbackRate={value:1};
  connect(node){this.destination=node;}
  disconnect(){}
  start(){this.started=true;}
  stop(){this.stopped=true;this.onended?.();}
}
class FakeContext{
  state='suspended';currentTime=0;destination={};sources=[];decodes=0;
  createGain(){return new Gain();}
  createBufferSource(){const s=new Source();this.sources.push(s);return s;}
  async resume(){this.state='running';}
  async decodeAudioData(){this.decodes++;return {duration:1};}
}
function fixture(extra={}){
  let now=0,requests=0;
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const env={AudioContext:FakeContext,storage,probe:{canPlayType:()=> 'probably'},now:()=>now,random:()=>.5,fetch:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},baseUrl:'http://game/assets/audio/',...extra};
  return {audio:new AudioManager(config,env),env,values,get requests(){return requests;},advance:ms=>now+=ms};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);

test('buses connect through master, volumes clamp and persist',async()=>{
  const f=fixture(),a=f.audio;assert.equal(a.context,null);await a.unlock();
  for(const bus of ['music','ambience','sfx','voice'])assert.equal(a.buses[bus].destination,a.buses.master);
  assert.equal(a.buses.master.destination,a.context.destination);
  a.set('master',.4);near(a.buses.master.gain.value,.4);a.set('sfx',10);near(a.buses.sfx.gain.value,1);
  a.set('voice',NaN);assert.equal(a.settings.voice,config.defaults.voice);
  const restored=new AudioManager(config,f.env);assert.equal(restored.settings.master,.4);assert.equal(restored.settings.sfx,1);
  a.set('muted',true);near(a.buses.master.gain.value,0);assert.equal(JSON.parse(f.values.get(config.storageKey)).muted,true);
});
test('invalid/blocked storage is harmless and saved values are validated',()=>{
  const invalid=fixture({storage:{getItem:()=>'{bad'}}).audio;assert.deepEqual(invalid.settings,config.defaults);
  const blocked=fixture({storage:{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}}}).audio;
  assert.doesNotThrow(()=>blocked.set('master',.3));
  const a=fixture({storage:{getItem:()=>JSON.stringify({master:-4,voice:'loud',muted:'false',sfx:3})}}).audio;
  assert.equal(a.settings.master,0);assert.equal(a.settings.sfx,1);assert.equal(a.settings.voice,config.defaults.voice);assert.equal(a.settings.muted,false);
});
test('format selection uses explicit Vorbis support otherwise AAC',()=>{
  assert.equal(fixture().audio.format,'ogg');assert.equal(fixture({probe:{canPlayType:()=>''}}).audio.format,'m4a');
});
test('unlock defers loops until a gesture and repeated unlock never duplicates a bed',async()=>{
  const a=fixture().audio;a.area('archipelago');assert.equal(a.context,null);await a.unlock();await a.loop('area','archipelago');
  await a.unlock();assert.equal(a.context.sources.length,1);assert.equal(a.context.sources[0].loop,true);
});
test('VO ducks all nonvoice buses exactly -6dB and restores edited user settings',async()=>{
  const a=fixture().audio;await a.unlock();assert.equal(await a.voice('hunters-inbound'),true);
  const factor=10**(-6/20);for(const key of ['sfx','music','ambience'])near(a.buses[key].gain.value,a.settings[key]*factor);
  near(a.buses.voice.gain.value,a.settings.voice);near(a.buses.master.gain.value,a.settings.master);
  a.set('sfx',.4);near(a.buses.sfx.gain.value,.4*factor);
  a.context.sources[0].stop();near(a.buses.sfx.gain.value,.4);assert.equal(a.voiceBusy,false);assert.equal(a.ducked,false);
});
test('global and per-line cooldowns; no overlapping voice',async()=>{
  const f=fixture(),a=f.audio;await a.unlock();await a.voice('hunters-inbound');assert.equal(await a.voice('bag-heavy'),false);
  a.context.sources[0].stop();assert.equal(await a.voice('bag-heavy'),false);f.advance(config.globalVoiceCooldownMs);
  assert.equal(await a.voice('hunters-inbound'),false);assert.equal(await a.voice('bag-heavy'),true);a.context.sources.at(-1).stop();
  f.advance(config.voiceCooldownMs);assert.equal(await a.voice('hunters-inbound'),true);
});
test('loading reserves VO slot and failed load releases it without consuming cooldown',async()=>{
  let release;const pending=new Promise(r=>release=r);
  const a=fixture({fetch:()=>pending}).audio;await a.unlock();const first=a.voice('nice-shot');assert.equal(a.voiceBusy,true);assert.equal(await a.voice('bag-heavy'),false);
  release({ok:false});assert.equal(await first,false);assert.equal(a.voiceBusy,false);assert.equal(a.ducked,false);assert.equal(a.lastVoice.size,0);
});
test('single cached fetch/decode across repeated cues',async()=>{
  const f=fixture(),a=f.audio;await a.unlock();await a.play('shoot-carbine');f.advance(100);await a.play('shoot-carbine');
  assert.equal(f.requests,1);assert.equal(a.context.decodes,1);assert.equal(a.context.sources.length,2);
  assert.equal(a.context.sources[0].playbackRate.value,1);
});
test('replaced/stopped ambience and pending SFX/VO cannot start after stop',async()=>{
  let release;const pending=new Promise(r=>release=r);
  const a=fixture({fetch:()=>pending}).audio;await a.unlock();
  const bed=a.loop('area','archipelago'),shot=a.play('shoot-carbine'),voice=a.voice('nice-shot');a.stop();
  release({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await Promise.all([bed,shot,voice]);
  assert.equal(a.context.sources.length,0);assert.equal(a.loops.size,0);assert.equal(a.voiceBusy,false);
});
test('changing an area while loading starts only the most recent loop',async()=>{
  const replies=[];const a=fixture({fetch:()=>new Promise(r=>replies.push(r))}).audio;await a.unlock();
  const old=a.loop('area','archipelago'),current=a.loop('area','bunker');
  replies[1]({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await current;
  replies[0]({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await old;
  assert.equal(a.context.sources.length,1);assert.equal(a.loops.get('area').name,'bunker');
});
test('muting during pending VO suppresses it; retry is allowed',async()=>{
  let release;const a=fixture({fetch:()=>new Promise(r=>release=r)}).audio;await a.unlock();const voice=a.voice('nice-shot');a.set('muted',true);
  release({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});assert.equal(await voice,false);assert.equal(a.voiceBusy,false);assert.equal(a.context.sources.length,0);
  a.set('muted',false);assert.equal(await a.voice('nice-shot'),true);
});
test('all registered assets have both formats, licensing entries and fit the shipping budget',async()=>{
  const base=new URL('../../assets/audio/',import.meta.url),licenses=await readFile(new URL('LICENSES.md',base),'utf8');
  const files=[...Object.values(config.sfx).map(x=>x.file),...Object.values(config.loops).map(x=>x.file),...config.voices.map(x=>'bit/'+x)];
  for(const file of files)for(const ext of ['ogg','m4a']){assert.ok((await stat(new URL(file+'.'+ext,base))).size>0);assert.ok(licenses.includes('`'+file+'.'+ext+'`'));}
  let bytes=0,count=0;for(const dir of ['sfx','ambience','music','bit'])for(const file of await readdir(new URL(dir+'/',base)))if(/\.(ogg|m4a)$/.test(file)){bytes+=(await stat(new URL(dir+'/'+file,base))).size;count++;}
  assert.ok(bytes<2_000_000,`${bytes} bytes`);assert.ok(count>100);
  assert.match(licenses,/dedicated to the public domain under CC0-1\.0 by the project owner/);
  const bitRows=licenses.split('\n').filter(line=>line.startsWith('| `bit/'));
  assert.equal(bitRows.length,16);
  for(const row of bitRows)assert.match(row,/CC0-1\.0 \(dedicated by the project owner\)/);
});

test('base settings UI changes persisted volumes and unlocks the base bed',async()=>{
  const {JSDOM}=require('../../node_modules/jsdom');
  const dom=new JSDOM(await readFile(new URL('../../index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'http://game/index.html'});
  const w=dom.window;w.AudioContext=FakeContext;w.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
  for(const file of ['data/audio.js','ui/audio.js','ui/base-audio.js'])w.eval(await readFile(new URL('../../'+file,import.meta.url),'utf8'));
  const inputs=w.document.querySelectorAll('.audio-settings input');assert.equal(inputs.length,9);
  const range=w.document.querySelector('[aria-label="Ambience volume"]');range.value='.23';range.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.PR_AUDIO.settings.ambience,.23);assert.equal(JSON.parse(w.localStorage.getItem(config.storageKey)).ambience,.23);
  const close=w.document.querySelector('#settings-close');assert.equal(close.parentElement.id,'settings-menu');assert.ok(!close.closest('.audio-menu-body'));
  w.document.dispatchEvent(new w.Event('pointerdown'));await new Promise(r=>setTimeout(r,0));
  assert.equal(w.PR_AUDIO.unlocked,true);assert.equal(w.PR_AUDIO.loops.get('area').name,'base');
  const mute=w.document.querySelector('.audio-settings input[type=checkbox]');mute.checked=false;mute.dispatchEvent(new w.Event('change'));
  assert.equal(w.PR_AUDIO.settings.muted,true);near(w.PR_AUDIO.buses.master.gain.value,0);
  w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.PR_AUDIO.active.size,0);dom.window.close();
});

test('footsteps follow wooden piers, houses, biome defaults and authored metal floors',async()=>{
  const {footstepSurface}=await import('../audio.js');
  const p={x:0,z:0},floor={x:0,z:0,w:4,d:4};
  assert.equal(footstepSurface({floors:[floor]},p,'archipelago'),'gravel');
  assert.equal(footstepSurface({floors:[{...floor,dir:'z'}]},p,'archipelago'),'wood');
  assert.equal(footstepSurface({floors:[floor],house:{floor}},p,'archipelago'),'wood');
  assert.equal(footstepSurface({floors:[{...floor,surface:'metal'}]},p,'bunker'),'metal');
  assert.equal(footstepSurface({floors:[floor]},p,'bunker'),'concrete');
});


test('master and each bus mute persist independently without losing volume',async()=>{
  const f=fixture(),a=f.audio;await a.unlock();
  for(const bus of ['music','ambience','sfx','voice']){
    a.set(bus,.37);a.set(bus+'Muted',true);near(a.buses[bus].gain.value,0);
    const restored=new AudioManager(config,f.env);assert.equal(restored.settings[bus+'Muted'],true);assert.equal(restored.settings[bus],.37);
    a.set(bus+'Muted',false);near(a.buses[bus].gain.value,.37);
  }
  a.set('musicMuted',true);a.set('muted',true);near(a.buses.master.gain.value,0);
  assert.equal(new AudioManager(config,f.env).settings.muted,true);
  a.set('muted',false);near(a.buses.master.gain.value,a.settings.master);near(a.buses.music.gain.value,0);near(a.buses.ambience.gain.value,.37);
  a.set('voiceMuted','true');assert.equal(a.settings.voiceMuted,false);
  a.set('voiceMuted',true);assert.equal(await a.voice('nice-shot'),false);
});

test('raid settings pause once, preserve time and resume only their own pause',async()=>{
  const {JSDOM}=require('../../node_modules/jsdom');
  const {createAudioSettings}=await import('../audio-settings.js');
  const {pausePick,resumePick,gameTime}=await import('../perks.js');
  const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'http://game/nodspel/index.html'});
  const w=dom.window;
  for(const file of ['data/audio.js','ui/audio.js'])w.eval(await readFile(new URL('../../'+file,import.meta.url),'utf8'));
  const round={pausedMs:0,pauseAt:null};let wall=1000;
  const settings=createAudioSettings({document:w.document,audio:w.PR_AUDIO,canOpen:()=>round.pauseAt==null,onPause:()=>pausePick(round,wall),onResume:()=>resumePick(round,wall)});
  w.document.querySelector('#raid-settings-open').click();assert.equal(round.pauseAt,1000);assert.equal(settings.open(),false);
  wall=6000;assert.equal(gameTime(round,wall),1000);
  const ambience=w.document.querySelector('[aria-label="Ambience volume"]');ambience.value='.61';ambience.dispatchEvent(new w.Event('input'));
  const mute=w.document.querySelector('[aria-label="Mute Ambience"]');mute.checked=true;mute.dispatchEvent(new w.Event('change'));
  const saved=JSON.parse(w.localStorage.getItem(config.storageKey));assert.equal(saved.ambience,.61);assert.equal(saved.ambienceMuted,true);
  w.document.querySelector('#raid-settings-close').click();assert.equal(round.pauseAt,null);assert.equal(gameTime(round,wall),1000);assert.equal(settings.close(),false);
  pausePick(round,wall);assert.equal(settings.open(),false);settings.close();assert.equal(round.pauseAt,1000);
  dom.window.close();
});

test('persisted raid pageshow restores the last area bed without reviving stopped raids',async()=>{
  // Prime shared side effects before replacing the manager for this lifecycle test.
  await import('../audio.js');
  const {JSDOM}=require('../../node_modules/jsdom');
  const dom=new JSDOM('',{url:'http://game/nodspel/'}),w=dom.window,a=fixture().audio;
  const previous={window:globalThis.window,document:globalThis.document,audio:globalThis.PR_AUDIO};
  globalThis.window=w;globalThis.document=w.document;globalThis.PR_AUDIO=a;
  try{
    const {audioEvent}=await import('../audio.js?pageshow-test');
    await a.unlock();
    for(const area of ['archipelago','town','bunker']){
      audioEvent('area',{area});await new Promise(r=>setTimeout(r,0));
      w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));
      assert.equal(a.active.size,0);assert.equal(a.desiredArea,null);
      w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:false}));
      assert.equal(a.desiredArea,null);
      // A fresh cached navigation captures the current area again.
      audioEvent('area',{area});
      w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));
      w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));
      await new Promise(r=>setTimeout(r,0));
      assert.equal(a.desiredArea,area);
      assert.equal(a.loops.get('area').name,config.areaBeds[area]||'bunker');
      assert.equal([...a.active].filter(s=>s.loop).length,1);
    }
    audioEvent('result',{success:true});
    w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));
    w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));
    assert.equal(a.desiredArea,null);assert.equal(a.loops.size,0);
    audioEvent('area',{area:'archipelago'});
    w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:false}));
    w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));
    assert.equal(a.desiredArea,null);
  }finally{
    a.stop();dom.window.close();
    for(const [key,value] of Object.entries({window:previous.window,document:previous.document,PR_AUDIO:previous.audio})){
      if(value===undefined)delete globalThis[key];else globalThis[key]=value;
    }
  }
});
