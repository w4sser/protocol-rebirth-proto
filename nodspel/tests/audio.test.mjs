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
  state='suspended';currentTime=0;sampleRate=48000;destination={};sources=[];decodes=0;
  createBuffer(channels,length,sampleRate){const data=new Float32Array(length);return {length,sampleRate,duration:length/sampleRate,getChannelData:()=>data};}
  createDynamicsCompressor(){return {threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param(),connect(node){this.destination=node;}};}
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
  for(const bus of ['music','sfx','voice'])assert.equal(a.buses[bus].destination,a.buses.master);
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
test('unlock defers quiet music until a gesture and repeated requests never duplicate it',async()=>{
  const a=fixture().audio;a.music();assert.equal(a.context,null);await a.unlock();await a.loop('music','pulse');
  a.music();await a.unlock();assert.equal(a.context.sources.length,1);assert.equal(a.context.sources[0].loop,true);
  assert.ok(config.defaults.music<=.15);assert.deepEqual(Object.keys(config.loops),['pulse']);
});
test('VO ducks music only by -6dB and restores edited user settings',async()=>{
  const a=fixture().audio;await a.unlock();assert.equal(await a.voice('hunters-inbound'),true);
  const factor=10**(-6/20);near(a.buses.music.gain.value,a.settings.music*factor);
  for(const key of ['sfx','voice','master'])near(a.buses[key].gain.value,a.settings[key]);
  a.set('sfx',.4);near(a.buses.sfx.gain.value,.4);a.set('music',.2);near(a.buses.music.gain.value,.2*factor);
  a.context.sources[0].stop();near(a.buses.music.gain.value,.2);near(a.buses.sfx.gain.value,.4);
  assert.equal(a.voiceBusy,false);assert.equal(a.ducked,false);
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
  const f=fixture(),a=f.audio;await a.unlock();await a.play('reload-carbine');f.advance(200);await a.play('reload-carbine');
  assert.equal(f.requests,1);assert.equal(a.context.decodes,1);assert.equal(a.context.sources.length,2);
  assert.equal(a.context.sources[0].playbackRate.value,1);
});
test('stopped music and pending SFX/VO cannot start after stop',async()=>{
  let release;const pending=new Promise(r=>release=r);
  const a=fixture({fetch:()=>pending}).audio;await a.unlock();
  const bed=a.loop('music','pulse'),shot=a.play('reload-carbine'),voice=a.voice('nice-shot');a.stop();
  release({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await Promise.all([bed,shot,voice]);
  assert.equal(a.context.sources.length,0);assert.equal(a.loops.size,0);assert.equal(a.voiceBusy,false);
});
test('stopping and restarting pending music starts only the current request',async()=>{
  let release;const a=fixture({fetch:()=>new Promise(r=>release=r)}).audio;await a.unlock();
  const old=a.loop('music','pulse');a.stop();const current=a.loop('music','pulse');
  release({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await Promise.all([old,current]);
  assert.equal(a.context.sources.length,1);assert.equal(a.loops.get('music').name,'pulse');
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
  let bytes=0,count=0;for(const dir of ['sfx','music','bit'])for(const file of await readdir(new URL(dir+'/',base)))if(/\.(ogg|m4a)$/.test(file)){bytes+=(await stat(new URL(dir+'/'+file,base))).size;count++;}
  assert.ok(bytes<2_000_000,`${bytes} bytes`);assert.equal(count,files.length*2);
  const expected=files.flatMap(file=>['ogg','m4a'].map(ext=>file+'.'+ext)).sort();
  const actual=[];for(const dir of ['sfx','music','bit'])for(const file of await readdir(new URL(dir+'/',base)))actual.push(dir+'/'+file);
  assert.deepEqual(actual.sort(),expected);
  const licensed=licenses.split('\n').filter(line=>line.startsWith('| `')).map(line=>line.split('`')[1]).sort();
  assert.deepEqual(licensed,expected);
  await assert.rejects(stat(new URL('ambience/',base)),{code:'ENOENT'});
  assert.ok(!Object.keys(config.sfx).some(name=>name.startsWith('step-')));
  assert.ok(licenses.includes(`Total shipping audio: ${bytes.toLocaleString('en-US')} bytes, ${count} files`));
  assert.match(licenses,/dedicated to the public domain under CC0-1\.0 by the project owner/);
  const bitRows=licenses.split('\n').filter(line=>line.startsWith('| `bit/'));
  assert.equal(bitRows.length,16);
  for(const row of bitRows)assert.match(row,/\| All rights reserved © Robert Wasser \|$/);
});

test('base settings UI changes persisted volumes and unlocks quiet music',async()=>{
  const {JSDOM}=require('../../node_modules/jsdom');
  const dom=new JSDOM(await readFile(new URL('../../index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'http://game/index.html'});
  const w=dom.window;w.AudioContext=FakeContext;w.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
  for(const file of ['data/audio.js','ui/audio.js','ui/base-audio.js'])w.eval(await readFile(new URL('../../'+file,import.meta.url),'utf8'));
  const inputs=w.document.querySelectorAll('.audio-settings input');assert.equal(inputs.length,7);
  assert.equal(w.document.querySelector('[aria-label="Ambience volume"]'),null);
  assert.equal(w.document.querySelector('[aria-label="Mute Ambience"]'),null);
  const range=w.document.querySelector('[aria-label="Music volume"]');range.value='.23';range.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.PR_AUDIO.settings.music,.23);assert.equal(JSON.parse(w.localStorage.getItem(config.storageKey)).music,.23);
  const close=w.document.querySelector('#settings-close');assert.equal(close.parentElement.id,'settings-menu');assert.ok(!close.closest('.audio-menu-body'));
  w.dispatchEvent(new w.Event('touchend'));await new Promise(r=>setTimeout(r,0));
  assert.equal(w.PR_AUDIO.unlocked,true);assert.equal(w.PR_AUDIO.loops.get('music').name,'pulse');
  const mute=w.document.querySelector('.audio-settings input[type=checkbox]');mute.checked=false;mute.dispatchEvent(new w.Event('change'));
  assert.equal(w.PR_AUDIO.settings.muted,true);near(w.PR_AUDIO.buses.master.gain.value,0);
  w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.PR_AUDIO.active.size,0);dom.window.close();
});

test('legacy ambience settings are ignored while supported settings survive migration',async()=>{
  const f=fixture({storage:{getItem:()=>JSON.stringify({ambience:.23,ambienceMuted:true,music:.18,musicMuted:true,sfx:.61,voice:.7,muted:true}),setItem:(key,value)=>f.values.set(key,value)}}),a=f.audio;
  assert.equal(a.settings.music,.18);assert.equal(a.settings.musicMuted,true);assert.equal(a.settings.sfx,.61);
  assert.equal(a.settings.voice,.7);assert.equal(a.settings.muted,true);
  assert.equal('ambience' in a.settings,false);assert.equal('ambienceMuted' in a.settings,false);
  a.set('ambience',.5);a.set('ambienceMuted',false);a.set('muted',false);await a.unlock();
  assert.deepEqual(Object.keys(a.buses).sort(),['master','music','sfx','voice']);
  const saved=JSON.parse(f.values.get(config.storageKey));assert.equal('ambience' in saved,false);assert.equal('ambienceMuted' in saved,false);
  assert.equal(saved.music,.18);assert.equal(saved.musicMuted,true);
});

test('master and each bus mute persist independently without losing volume',async()=>{
  const f=fixture(),a=f.audio;await a.unlock();
  for(const bus of ['music','sfx','voice']){
    a.set(bus,.37);a.set(bus+'Muted',true);near(a.buses[bus].gain.value,0);
    const restored=new AudioManager(config,f.env);assert.equal(restored.settings[bus+'Muted'],true);assert.equal(restored.settings[bus],.37);
    a.set(bus+'Muted',false);near(a.buses[bus].gain.value,.37);
  }
  a.set('musicMuted',true);a.set('muted',true);near(a.buses.master.gain.value,0);
  assert.equal(new AudioManager(config,f.env).settings.muted,true);
  a.set('muted',false);near(a.buses.master.gain.value,a.settings.master);near(a.buses.music.gain.value,0);near(a.buses.sfx.gain.value,.37);
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
  assert.equal(w.document.body.classList.contains('raid-paused'),true,'pause hides the in-raid controls while the dialog owns input');
  wall=6000;assert.equal(gameTime(round,wall),1000);
  assert.equal(w.document.querySelectorAll('.audio-settings input').length,7);
  assert.equal(w.document.querySelector('[aria-label="Ambience volume"]'),null);
  assert.equal(w.document.querySelector('[aria-label="Mute Ambience"]'),null);
  const music=w.document.querySelector('[aria-label="Music volume"]');music.value='.61';music.dispatchEvent(new w.Event('input'));
  const mute=w.document.querySelector('[aria-label="Mute Music"]');mute.checked=true;mute.dispatchEvent(new w.Event('change'));
  const saved=JSON.parse(w.localStorage.getItem(config.storageKey));assert.equal(saved.music,.61);assert.equal(saved.musicMuted,true);
  w.document.querySelector('#raid-settings-close').click();assert.equal(round.pauseAt,null);assert.equal(gameTime(round,wall),1000);assert.equal(settings.close(),false);
  assert.equal(w.document.body.classList.contains('raid-paused'),false,'closing restores the in-raid controls');
  pausePick(round,wall);assert.equal(settings.open(),false);settings.close();assert.equal(round.pauseAt,1000);
  assert.equal(w.document.body.classList.contains('raid-paused'),false,'a rejected open must not hide controls');
  dom.window.close();
});

test('pause menu Tab focus trap skips the hidden Abandon button in standalone mode',async()=>{
  const {JSDOM}=require('../../node_modules/jsdom');
  const {createAudioSettings}=await import('../audio-settings.js');
  const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'http://game/nodspel/index.html'});
  const w=dom.window;
  for(const file of ['data/audio.js','ui/audio.js'])w.eval(await readFile(new URL('../../'+file,import.meta.url),'utf8'));
  const settings=createAudioSettings({document:w.document,audio:w.PR_AUDIO,canOpen:()=>true,onPause:()=>{},onResume:()=>{}});
  assert.equal(w.document.querySelector('#abandon').hidden,true,'standalone mode (no returnUrl) leaves Abandon hidden');
  settings.open();
  assert.equal(w.document.activeElement,w.document.querySelector('#raid-settings-close'));
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Tab',shiftKey:true,cancelable:true}));
  assert.equal(w.document.activeElement,w.document.querySelector('#reset'),'shift+tab from the first control wraps to the last visible control, skipping the hidden Abandon button');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Tab',cancelable:true}));
  assert.equal(w.document.activeElement,w.document.querySelector('#raid-settings-close'),'tab from the last visible control wraps back to the first');
  dom.window.close();
});

test('cached raid pageshow restores only music and never revives a finished raid',async()=>{
  await import('../audio.js');
  const {JSDOM}=require('../../node_modules/jsdom');
  const dom=new JSDOM('',{url:'http://game/nodspel/'}),w=dom.window,a=fixture().audio;
  const previous={window:globalThis.window,document:globalThis.document,PR_AUDIO:globalThis.PR_AUDIO};
  globalThis.window=w;globalThis.document=w.document;globalThis.PR_AUDIO=a;
  try{
    const {audioEvent}=await import('../audio.js?pageshow-test');await a.unlock();
    audioEvent('start');await new Promise(r=>setTimeout(r,0));
    assert.equal(a.loops.get('music').name,'pulse');
    w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));
    assert.equal(a.active.size,0);assert.equal(a.desiredMusic,false);
    w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await new Promise(r=>setTimeout(r,0));
    assert.equal(a.desiredMusic,true);assert.equal(a.loops.get('music').name,'pulse');
    assert.equal([...a.active].filter(s=>s.loop).length,1);
    audioEvent('result',{success:true});
    w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));
    w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));
    assert.equal(a.desiredMusic,false);assert.equal(a.loops.size,0);
    audioEvent('start');
    w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:false}));
    w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));
    await new Promise(r=>setTimeout(r,0));assert.equal(a.desiredMusic,false);assert.equal(a.loops.size,0);
  }finally{
    a.stop();dom.window.close();
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete globalThis[key];else globalThis[key]=value;
    }
  }
});


test('synthesized shots are cached, bounded and route through compressor, SFX and master',async()=>{
  const f=fixture(),a=f.audio;await a.unlock();
  for(const weapon of Object.keys(config.shots.weapons)){
    for(const enemy of [false,true]){
      assert.equal(await a.play('shoot-'+weapon,{enemy}),true);
      const source=a.context.sources.at(-1),buffer=source.buffer,samples=buffer.getChannelData(0);
      assert.equal(source.destination.destination,a.shotLimiter);
      assert.equal(a.shotLimiter.destination,a.buses.sfx);
      assert.equal(a.buses.sfx.destination,a.buses.master);
      assert.equal(a.buses.master.destination,a.context.destination);
      assert.ok(samples.every(x=>Number.isFinite(x)&&Math.abs(x)<=config.shots.ceiling));
      assert.ok(samples.some(x=>Math.abs(x)>.5));near(samples[0],0);near(samples.at(-1),0);
      f.advance(100);await a.play('shoot-'+weapon,{enemy});
      assert.equal(a.context.sources.at(-1).buffer,buffer);
    }
  }
  assert.equal(f.requests,0);assert.equal(a.context.decodes,0);assert.equal(a.shotCache.size,8);
  const [player,,enemy]=a.context.sources;
  assert.ok(enemy.destination.gain.value<player.destination.gain.value);
  a.set('sfx',.24);near(a.buses.sfx.gain.value,.24);
  for(const [key,value] of [['sfx',0],['sfxMuted',true],['master',0],['muted',true]]){
    a.set(key,value);f.advance(100);const count=a.context.sources.length;
    assert.equal(await a.play('shoot-carbine'),false);assert.equal(a.context.sources.length,count);
    if(key==='sfx'||key==='sfxMuted')near(a.buses.sfx.gain.value,0);else near(a.buses.master.gain.value,0);
    a.set(key,typeof value==='boolean'?false:.75);
  }
});

test('raid shot events select the synthesized weapon and quieter enemy path; shots vary without rebuilding buffers',async()=>{
  const f=fixture({random:()=>.2}),a=f.audio,previous=globalThis.PR_AUDIO;
  globalThis.PR_AUDIO=a;
  try{
    const {audioEvent}=await import('../audio.js?shot-route-test');await a.unlock();
    audioEvent('shoot',{weapon:'shotgun_breach'});
    const first=a.context.sources.at(-1);assert.ok(first);assert.equal(a.shotCache.size,1);
    f.advance(100);f.env.random=()=>.8;audioEvent('shoot',{weapon:'shotgun_breach'});
    const second=a.context.sources.at(-1);assert.equal(second.buffer,first.buffer);
    assert.ok(second.playbackRate.value>first.playbackRate.value);assert.ok(second.destination.gain.value>first.destination.gain.value);
    audioEvent('shoot',{enemy:true});const enemy=a.context.sources.at(-1);
    assert.equal(a.shotCache.size,2);assert.ok(enemy.destination.gain.value<first.destination.gain.value);
    a.set('sfx',0);f.advance(100);const count=a.context.sources.length;
    audioEvent('shoot',{weapon:'shotgun_breach'});assert.equal(a.context.sources.length,count);
    a.stop();assert.equal(a.active.size,0);
  }finally{globalThis.PR_AUDIO=previous;}
});

test('failed fetch/decode samples leave unlock, shots and later sample retries usable',async()=>{
  for(const failure of ['fetch','decode']){
    let fail=true;
    class Context extends FakeContext{async decodeAudioData(){if(fail&&failure==='decode')throw Error('decode');return super.decodeAudioData();}}
    const f=fixture({AudioContext:Context,fetch:async()=>{if(fail&&failure==='fetch')throw Error('fetch');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}}),a=f.audio;
    a.music();assert.equal(await a.unlock(),true);assert.equal(a.loops.size,0);
    assert.equal(await a.play('reload-carbine'),false);assert.equal(a.unlocked,true);
    assert.equal(await a.play('shoot-carbine'),true);
    fail=false;f.advance(200);assert.equal(await a.play('reload-carbine'),true);
    await a.loop('music','pulse');assert.ok(a.loops.get('music').source.started);
  }
});

test('Ogg fetch or decode failure retries AAC and uses AAC for future files',async()=>{
  for(const failure of ['fetch','decode']){
    const urls=[];
    class Context extends FakeContext{async decodeAudioData(bytes){if(bytes.byteLength===1)throw Error('bad ogg');return super.decodeAudioData();}}
    const a=fixture({AudioContext:Context,fetch:async url=>{urls.push(url);if(url.endsWith('.ogg')&&failure==='fetch')throw Error('fetch');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(url.endsWith('.ogg')?1:2)};}}).audio;
    await a.unlock();assert.equal(await a.play('reload-carbine'),true);assert.equal(a.format,'m4a');
    assert.equal(await a.play('ui-tap'),true);
    assert.deepEqual(urls.map(url=>url.split('/').at(-1)),['reload-carbine.ogg','reload-carbine.m4a','ui-tap.m4a']);
  }
});

test('AAC is preferred when supported without probable Vorbis support',()=>{
  for(const vorbis of ['','maybe','probably']){
    const a=fixture({probe:{canPlayType:type=>type.includes('mp4')?'probably':vorbis}}).audio;
    assert.equal(a.format,vorbis==='probably'?'ogg':'m4a');
  }
});

test('interrupted contexts recover through every gesture, visibility and playback path',async()=>{
  class Context extends FakeContext{resumes=0;async resume(){this.resumes++;await super.resume();this.onstatechange?.();}}
  const a=fixture({AudioContext:Context}).audio,listeners=new Map(),target={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn)};
  a.installUnlock(target);await a.unlock();
  const interrupt=()=>{a.context.state='interrupted';a.context.onstatechange();assert.equal(a.unlocked,false);};
  for(const name of ['pointerup','touchend','click','keydown','visibilitychange']){
    interrupt();const count=a.context.resumes;listeners.get(name)();await new Promise(r=>setTimeout(r,0));
    assert.equal(a.context.resumes,count+1);assert.equal(a.unlocked,true);
  }
  interrupt();target.visibilityState='hidden';const count=a.context.resumes;listeners.get('visibilitychange')();assert.equal(a.context.resumes,count);
  assert.equal(await a.play('shoot-carbine'),true);assert.equal(a.unlocked,true);
  interrupt();assert.equal(await a.voice('nice-shot'),true);assert.equal(a.unlocked,true);
  interrupt();await a.loop('music','pulse');assert.equal(a.unlocked,true);assert.ok(a.loops.get('music').source.started);
  // Recover even before WebKit delivers its statechange notification.
  a.context.state='interrupted';assert.equal(a.unlocked,true);assert.equal(await a.play('shoot-rifle'),true);
  interrupt();a.context.resume=async()=>{throw Error('blocked');};assert.equal(await a.unlock(),false);assert.equal(a.unlocked,false);
  a.context.state='running';a.context.onstatechange();assert.equal(a.unlocked,true);
});

test('unknown shot uses carbine and synthesis errors return false',async()=>{
  const f=fixture(),a=f.audio;await a.unlock();assert.equal(await a.play('shoot-unknown'),true);
  const source=a.context.sources.at(-1);assert.equal(source.buffer,a.shotBuffer('carbine',false));
  near(source.playbackRate.value,config.shots.weapons.carbine.pitch);
  a.shotBuffer=()=>{throw Error('synthesis');};f.advance(100);assert.equal(await a.play('shoot-unknown'),false);
});

test('audioSession is left unchanged and no media playback session is requested',async()=>{
  const audioSession={type:'auto'},a=fixture({navigator:{audioSession}}).audio;
  assert.equal(a.init(),true);assert.equal(audioSession.type,'auto');assert.equal(await a.unlock(),true);
  const blocked=fixture({navigator:{audioSession:{set type(value){throw Error('unsupported');}}}}).audio;
  assert.equal(await blocked.unlock(),true);
});

 test('activation listeners capture on window and resume synchronously before handler returns',()=>{
  const registrations=new Map();let resumed=false;
  class Context extends FakeContext{resume(){resumed=true;this.state='running';return Promise.resolve();}}
  const a=fixture({AudioContext:Context}).audio;
  const window={addEventListener:(name,fn,options)=>registrations.set(name,{fn,options}),document:{addEventListener(){}}};
  a.installUnlock(window);
  for(const name of ['touchend','click','keydown','pointerup']){
    assert.equal(registrations.get(name).options.capture,true);
    a.init();a.context.state='suspended';a.unlocked=false;resumed=false;
    registrations.get(name).fn();assert.equal(resumed,true,name+' resumes in the activation stack');
  }
});
