const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
require('../data/audio.js');
const config=globalThis.DATA.audio;
const {AudioManager}=require('../ui/audio.js');
class Param{
  constructor(){this.value=1;this.ramps=[];}
  cancelScheduledValues(){} cancelAndHoldAtTime(){}
  setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}
  linearRampToValueAtTime(v,t){this.ramps.push([v,t]);this.value=v;}
}
class Context{
  constructor(){this.state='running';this.currentTime=10;this.destination={};this.sources=[];}
  createGain(){return {gain:new Param(),connect(){},disconnect(){}};}
  createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){},start(){},stop(t){this.stopAt=t;}};this.sources.push(s);return s;}
  async decodeAudioData(){return {};}
}
function fixture(fetcher){let requests=0;const audio=new AudioManager(config,{AudioContext:Context,storage:null,baseUrl:'http://game/assets/audio/',fetch:fetcher||(async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};})});return {audio,get requests(){return requests;}};}
test('theme config and optional start hook',()=>{
  assert.deepEqual(config.loops['bunker-theme'],{file:'music/bunker-theme',bus:'music',gain:.5});
  assert.ok(config.loops.pulse);assert.equal(config.startTheme,null);
});
test('Web Audio only across base, engine and splash',()=>{
  for(const file of ['ui/audio.js','ui/base-audio.js','app.js','index.html']){
    const source=fs.readFileSync(require.resolve('../'+file),'utf8');
    assert.doesNotMatch(source,/<audio\b|new\s+(?:root\.|window\.)?Audio\s*\(|navigator\.mediaSession|audioSession\s*[.=]/i,file);
  }
});
test('theme loads only after unlock, fades independently of the music volume, and stops at fade end',async()=>{
  const f=fixture(),a=f.audio;a.music('bunker-theme',1.5);
  assert.equal(f.requests,0);assert.equal(a.context,null);
  await a.unlock();assert.equal(f.requests,1);
  const source=a.loops.get('music').source;
  assert.deepEqual(source.prLevel.gain.ramps,[[.5,11.5]]);
  a.set('music',.3);assert.equal(a.buses.music.gain.value,.3);
  await a.fadeMusic(.001);
  assert.equal(a.desiredMusic,false);assert.equal(a.loops.size,0);
  assert.equal(source.stopAt,10.001);assert.deepEqual(source.prLevel.gain.ramps.at(-1),[0,10.001]);
  assert.equal(a.buses.music.gain.value,.3);
});
test('a theme decode completing after raid fade cannot restart music',async()=>{
  let release;const pending=new Promise(r=>release=r);const {audio:a}=fixture(()=>pending);
  await a.unlock();a.music('bunker-theme',1.5);
  await a.fadeMusic(.8);release({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
  await new Promise(setImmediate);assert.equal(a.context.sources.length,0);assert.equal(a.loops.size,0);
});
test('base hook stays silent on splash, fades on PLAY and resumes theme on return',()=>{
  const calls=[],listeners={},audio={config,music:(...a)=>calls.push(['music',...a]),fadeMusic:s=>{calls.push(['fade',s]);return Promise.resolve();}};
  let splash=true;
  const window={PR_AUDIO:audio,addEventListener:(type,fn)=>listeners[type]=fn};
  const document={body:{classList:{contains:()=>splash}},querySelector:()=>null,addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../ui/base-audio.js'),'utf8'),{window,document});
  assert.deepEqual(calls,[]);window.PR_AUDIO_PLAY();assert.deepEqual(calls,[['fade',.8]]);
  splash=false;listeners['pr:splash-finished']();listeners.pageshow();
  assert.deepEqual(calls.slice(1),[['music','bunker-theme',1.5],['music','bunker-theme',1.5]]);
});
test('raid entry invokes fade and waits before navigating',async()=>{
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const segment=app.slice(app.indexOf('    const raidUrl = coreLaunchUrl'),app.indexOf('\n  deploy(){'));
  const body=segment.slice(0,segment.lastIndexOf('\n  },'));
  let release;const faded=new Promise(r=>release=r),calls=[];
  const sandbox={session:{},window:{PR_NAVIGATE:u=>calls.push('navigate'),PR_AUDIO_RAID_ENTRY:()=>{calls.push('fade');return faded;}},coreLaunchUrl:()=>'/raid',l:{},metaReturnPath:()=>'',location:{pathname:'/'},stats:{},gear:[],weapon:null,kit:null,launchTool:null,raidBagCapacity:()=>0,raidArea:()=>'',hard:false,intro:true,questLaunchParam:()=>null,progressionGoal:()=>null,pay:null};
  vm.runInNewContext(body,sandbox);assert.deepEqual(calls,['fade']);
  release();await new Promise(setImmediate);assert.deepEqual(calls,['fade','navigate']);
});
test('music requests wait for first paint even if pageshow or unlock happens early',()=>{
  const calls=[],frames=[],listeners={};
  const window={PR_AUDIO:{config,music:(...args)=>calls.push(args)},requestAnimationFrame:fn=>frames.push(fn),addEventListener:(type,fn)=>listeners[type]=fn};
  const document={body:{classList:{contains:()=>false}},querySelector:()=>null,addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../ui/base-audio.js'),'utf8'),{window,document});
  listeners.pageshow();assert.deepEqual(calls,[]);
  frames.shift()();assert.deepEqual(calls,[]);
  frames.shift()();assert.deepEqual(calls,[['bunker-theme',1.5]]);
});
test('optional start theme uses the same loop API when explicitly enabled',()=>{
  const calls=[];
  const window={PR_AUDIO:{config:{...config,startTheme:'bunker-theme'},music:(...args)=>calls.push(args)},addEventListener(){}};
  const document={body:{classList:{contains:()=>true}},querySelector:()=>null,addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../ui/base-audio.js'),'utf8'),{window,document});
  assert.deepEqual(calls,[['bunker-theme',1.5]]);
});
test('default-off hook also stays silent before app marks the splash active',()=>{
  const calls=[];
  const window={PR_AUDIO:{config,music:(...args)=>calls.push(args)},addEventListener(){}};
  const document={body:{classList:{contains:()=>false}},getElementById:id=>id==='splash'?{}:null,querySelector:()=>null,addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../ui/base-audio.js'),'utf8'),{window,document});
  assert.deepEqual(calls,[]);
});
