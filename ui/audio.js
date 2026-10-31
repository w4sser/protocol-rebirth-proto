/* Shared classic script: also importable for side effects by the raid and require() in tests. */
(function(root){
  'use strict';
  class AudioManager {
    constructor(config,env={}){
      this.config=config;this.env=env;this.settings={...config.defaults};
      this.context=null;this.buses={};this.cache=new Map();this.shotCache=new Map();this.shotLimiter=null;this.active=new Set();this.loops=new Map();this.loopTokens=new Map();
      this.lastSfx=new Map();this.lastVoice=new Map();this.globalVoiceAt=-Infinity;this.voiceBusy=false;this.voiceToken=0;this.epoch=0;this.ducked=false;this.unlocked=false;this.wasUnlocked=false;this.desiredMusic=false;
      try{this.storage=env.storage===undefined?root.localStorage:env.storage;const saved=JSON.parse(this.storage?.getItem(config.storageKey)||'null');if(saved&&typeof saved==='object')for(const key of Object.keys(this.settings)){if(typeof this.settings[key]==='boolean'){if(typeof saved[key]==='boolean')this.settings[key]=saved[key];}else if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))this.settings[key]=Math.max(0,Math.min(1,saved[key]));}}catch(_){/* Private browsing and bad settings are harmless. */}
      const probe=env.probe||((typeof root.Audio==='function')?new root.Audio():null);
      const vorbis=probe?.canPlayType?.('audio/ogg; codecs="vorbis"'),aac=probe?.canPlayType?.('audio/mp4; codecs="mp4a.40.2"');
      this.format=aac&&vorbis!=='probably'?'m4a':vorbis?'ogg':'m4a';
      this.baseUrl=env.baseUrl||new URL('../assets/audio/',typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:root.location?.href||'http://localhost/ui/audio.js').href;
    }
    now(){return this.env.now?this.env.now():Date.now();}
    init(){
      if(this.context)return true;
      const Factory=this.env.AudioContext||root.AudioContext||root.webkitAudioContext;if(!Factory)return false;
      try{this.context=new Factory();this.context.onstatechange=()=>{this.unlocked=this.context.state==='running';if(this.unlocked)this.wasUnlocked=true;};this.context.onstatechange();for(const key of ['master','music','sfx','voice'])this.buses[key]=this.context.createGain();this.buses.master.connect(this.context.destination);for(const key of ['music','sfx','voice'])this.buses[key].connect(this.buses.master);this.applyVolumes();return true;}catch(_){this.context=null;this.unlocked=false;return false;}
    }
    async unlock(){
      if(!this.init())return false;
      if(!await this.resume())return false;
      if(this.desiredMusic)await this.loop('music','pulse');return this.unlocked;
    }
    // Keep prior permission separate: WebKit clears unlocked during interruptions.
    async resume(){
      try{if(this.context.state!=='running')await this.context.resume();}catch(_){}
      this.unlocked=this.context.state==='running';if(this.unlocked)this.wasUnlocked=true;return this.unlocked;
    }
    installUnlock(target){
      const unlock=()=>{if(this.unlocked&&this.context?.state==='running')return;void this.unlock();};
      // WebKit needs resume() in the original trusted activation stack.
      const gestures=target.defaultView||target;
      for(const type of ['touchend','click','keydown','pointerup'])gestures.addEventListener(type,unlock,{capture:true,passive:true});
      const visibility=gestures.document||target;
      visibility.addEventListener('visibilitychange',()=>{if(visibility.visibilityState==='visible')unlock();});
    }
    set(key,value){
      if(!(key in this.settings))return;
      if(typeof this.settings[key]==='boolean'){if(typeof value!=='boolean')return;this.settings[key]=value;}else{if(!Number.isFinite(value))return;this.settings[key]=Math.max(0,Math.min(1,value));}
      this.applyVolumes();try{this.storage?.setItem(this.config.storageKey,JSON.stringify(this.settings));}catch(_){}
    }
    applyVolumes(){
      if(!this.context)return;
      for(const [key,node] of Object.entries(this.buses)){
        const duck=this.ducked&&key==='music'?Math.pow(10,this.config.duckDb/20):1;
        const value=((key==='master'?this.settings.muted:this.settings[key+'Muted'])?0:this.settings[key])*duck;
        node.gain.cancelScheduledValues(this.context.currentTime);node.gain.setTargetAtTime(value,this.context.currentTime,this.ducked?this.config.duckAttack:this.config.duckRelease);
      }
    }
    duck(value){this.ducked=value;this.applyVolumes();}
    async load(file){
      if(!this.cache.has(file)){
        const request=(async()=>{
          const fetcher=this.env.fetch||root.fetch,format=this.format;
          const decode=async extension=>{const response=await fetcher(new URL(file+'.'+extension,this.baseUrl).href);if(!response.ok)throw new Error('Audio unavailable');return this.context.decodeAudioData(await response.arrayBuffer());};
          try{return await decode(format);}catch(error){if(format!=='ogg')throw error;const buffer=await decode('m4a');this.format='m4a';return buffer;}
        })();
        this.cache.set(file,request);request.catch(()=>{if(this.cache.get(file)===request)this.cache.delete(file);});
      }
      return this.cache.get(file);
    }
    shotBuffer(weapon,enemy){
      const key=weapon+(enemy?'-enemy':'');if(this.shotCache.has(key))return this.shotCache.get(key);
      const C=this.config.shots,rate=this.context.sampleRate,buffer=this.context.createBuffer(1,Math.ceil(rate*C.duration),rate),out=buffer.getChannelData(0),dry=new Float32Array(out.length);
      const alpha=hz=>1-Math.exp(-2*Math.PI*hz/rate),hi=alpha(C.highpassHz),body=alpha(C.bodyHz),tail=alpha(C.tailHz);
      let seed=0x51f15e,low=0,mid=0,air=0;
      for(let i=0;i<out.length;i++){
        // Local deterministic noise: build once per weapon/distance, never per shot.
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/0x80000000-1,t=i/rate;
        low+=hi*(noise-low);mid+=body*(noise-mid);air+=tail*(noise-air);
        const phase=2*Math.PI*(C.thumpEndHz*t+(C.thumpStartHz-C.thumpEndHz)*C.thumpDrop*(1-Math.exp(-t/C.thumpDrop)));
        const crack=(noise-low)*C.crackGain*(enemy?C.enemyCrack:1)*Math.exp(-t/C.crackDecay);
        const thump=Math.sin(phase)*C.thumpGain*(enemy?C.enemyThump:1)*Math.exp(-t/C.thumpDecay);
        dry[i]=Math.min(1,t/C.attack)*(crack+thump+mid*C.bodyGain*Math.exp(-t/C.bodyDecay)+air*C.tailGain*Math.exp(-t/C.tailDecay));
      }
      for(let i=0;i<out.length;i++){
        let value=dry[i];for(const echo of C.echoes){const j=i-Math.round(echo.delay*rate);if(j>=0)value+=dry[j]*echo.gain;}
        out[i]=C.ceiling*Math.tanh(value*C.drive)*Math.min(1,(out.length-1-i)/(rate*C.fade));
      }
      this.shotCache.set(key,buffer);return buffer;
    }
    shotDestination(){
      if(!this.shotLimiter){
        this.shotLimiter=this.context.createDynamicsCompressor();
        for(const [key,value] of Object.entries(this.config.shots.compressor))this.shotLimiter[key].value=value;
        this.shotLimiter.connect(this.buses.sfx);
      }
      return this.shotLimiter;
    }
    source(buffer,bus,gain,pitch=1,loop=false,destination=null){
      const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;source.loop=loop;source.playbackRate.value=pitch;level.gain.value=gain;
      source.connect(level);level.connect(destination||this.buses[bus]);this.active.add(source);
      source.onended=()=>{this.active.delete(source);source.disconnect();level.disconnect();};source.start();return source;
    }
    async play(name,{enemy=false}={}){
      const cue=this.config.sfx[name]||(name.startsWith('shoot-')?this.config.sfx['shoot-carbine']:null);if(!cue||this.settings.muted)return false;
      if(this.context?.state!=='running'&&(this.unlocked||this.wasUnlocked))await this.resume();
      if(!this.unlocked||this.context?.state!=='running')return false;
      const now=this.now(),epoch=this.epoch,shot=name.startsWith('shoot-'),key=name+(enemy?'-enemy':'');
      if(shot&&(this.settings.sfx===0||this.settings.sfxMuted||this.settings.master===0))return false;
      if(now-(this.lastSfx.get(key)??-Infinity)<cue.minGap)return false;this.lastSfx.set(key,now);
      if(shot){
        try{const C=this.config.shots,weapon=Object.prototype.hasOwnProperty.call(C.weapons,name.slice(6))?name.slice(6):'carbine',W=C.weapons[weapon],random=this.env.random||Math.random;
        this.source(this.shotBuffer(weapon,enemy),'sfx',cue.gain*W.gain*(enemy?C.enemyGain:1)*(1+(random()*2-1)*this.config.gainVariation),W.pitch*(1+(random()*2-1)*this.config.pitchVariation),false,this.shotDestination());
        return true;}catch(_){return false;}
      }
      try{const buffer=await this.load(cue.file);if(epoch!==this.epoch||!this.unlocked||this.settings.muted)return false;const random=this.env.random||Math.random;this.source(buffer,'sfx',cue.gain*(1+(random()*2-1)*this.config.gainVariation),1+(random()*2-1)*this.config.pitchVariation);return true;}catch(_){return false;}
    }
    async voice(name){
      if(this.context?.state!=='running'&&(this.unlocked||this.wasUnlocked))await this.resume();
      const now=this.now(),cooldown=this.config.voiceCooldowns[name]??this.config.voiceCooldownMs;
      if(!this.config.voices.includes(name)||!this.unlocked||this.context?.state!=='running'||this.settings.muted||(this.settings.voice===0||this.settings.voiceMuted)||this.voiceBusy||now-this.globalVoiceAt<this.config.globalVoiceCooldownMs||now-(this.lastVoice.get(name)??-Infinity)<cooldown)return false;
      this.voiceBusy=true;const token=++this.voiceToken;
      try{
        const buffer=await this.load('bit/'+name);if(token!==this.voiceToken||this.settings.muted||(this.settings.voice===0||this.settings.voiceMuted))return false;
        this.duck(true);const source=this.source(buffer,'voice',this.config.voiceGain),cleanup=source.onended;
        this.lastVoice.set(name,this.now());this.globalVoiceAt=this.now();
        source.onended=()=>{cleanup();if(token===this.voiceToken){this.voiceBusy=false;this.duck(false);}};return true;
      }catch(_){return false;}finally{if(token===this.voiceToken&&!this.ducked)this.voiceBusy=false;}
    }
    async loop(slot,name){
      const epoch=this.epoch;
      if(this.context?.state!=='running'&&(this.unlocked||this.wasUnlocked)){await this.resume();if(epoch!==this.epoch)return;}
      if(this.loops.get(slot)?.name===name)return;
      this.stopLoop(slot);const token=this.loopTokens.get(slot),cue=this.config.loops[name];if(!cue||!this.unlocked||this.context?.state!=='running')return;
      // Reserve the slot while decoding; repeated music calls share one pending request.
      this.loops.set(slot,{name,source:null});
      try{const buffer=await this.load(cue.file);if(this.loopTokens.get(slot)!==token)return;this.loops.set(slot,{name,source:this.source(buffer,cue.bus,cue.gain,1,true)});}catch(_){if(this.loopTokens.get(slot)===token)this.loops.delete(slot);}
    }
    stopLoop(slot){this.loopTokens.set(slot,(this.loopTokens.get(slot)||0)+1);const entry=this.loops.get(slot);this.loops.delete(slot);if(entry?.source)entry.source.stop();}
    music(){this.desiredMusic=true;if(this.unlocked)void this.loop('music','pulse');}
    stop(){this.epoch++;this.desiredMusic=false;for(const slot of this.loops.keys())this.stopLoop(slot);this.voiceToken++;this.voiceBusy=false;this.duck(false);for(const source of [...this.active]){try{source.stop();}catch(_){}}}
    settingsUI(container){
      if(!container)return;
      const group=document.createElement('fieldset');group.className='audio-settings';const legend=document.createElement('legend');legend.textContent='Audio';group.append(legend);
      const master=document.createElement('label'),enabled=document.createElement('input');master.className='audio-master';enabled.type='checkbox';enabled.checked=!this.settings.muted;enabled.setAttribute('aria-label','Master audio');const status=document.createTextNode(enabled.checked?'MASTER on':'MASTER off');enabled.onchange=()=>{this.set('muted',!enabled.checked);status.textContent=enabled.checked?'MASTER on':'MASTER off';};master.append(enabled,status);group.append(master);
      for(const key of ['music','sfx','voice']){
        const row=document.createElement('div'),label=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input'),muteLabel=document.createElement('label'),mute=document.createElement('input');
        row.className='audio-row';text.textContent=key==='sfx'?'SFX':key[0].toUpperCase()+key.slice(1);input.type='range';input.min='0';input.max='1';input.step='0.01';input.value=String(this.settings[key]);input.setAttribute('aria-label',text.textContent+' volume');input.oninput=()=>this.set(key,Number(input.value));label.append(text,input);
        mute.type='checkbox';mute.checked=this.settings[key+'Muted'];mute.setAttribute('aria-label','Mute '+text.textContent);mute.onchange=()=>this.set(key+'Muted',mute.checked);muteLabel.append(mute,document.createTextNode('Mute'));row.append(label,muteLabel);group.append(row);
      }
      container.append(group);
    }
  }
  root.PRAudioManager=AudioManager;
  if(root.DATA?.audio){root.PR_AUDIO=new AudioManager(root.DATA.audio);if(typeof document!=='undefined')root.PR_AUDIO.installUnlock(window);}
  if(typeof module!=='undefined'&&module.exports)module.exports={AudioManager};
})(typeof window!=='undefined'?window:globalThis);
