/* Shared classic script: also importable for side effects by the raid and require() in tests. */
(function(root){
  'use strict';
  class AudioManager {
    constructor(config,env={}){
      this.config=config;this.env=env;this.settings={...config.defaults};
      this.context=null;this.buses={};this.cache=new Map();this.buffers=new Map();this.shotCache=new Map();this.shotLimiter=null;this.active=new Set();this.loops=new Map();this.loopTokens=new Map();this.fadingMusic=null;
      this.pendingVoices=new Set();this.consumedVoices=new Set();this.requestedVoices=new Map();
      this.lastSfx=new Map();this.lastVoice=new Map();this.globalVoiceAt=-Infinity;this.voiceBusy=false;this.voiceToken=0;this.epoch=0;this.ducked=false;this.unlocked=false;this.wasUnlocked=false;this.desiredMusic=false;
      this.unlockPromise=null;this.stateWaiters=new Set();this.pendingDrain=null;this.suspendedByHidden=false;
      // Debug-overlay bookkeeping (PRB-159): cheap bookkeeping maintained unconditionally inside
      // load()/drop() below (just a few Map/array writes) so the hidden overlay has real numbers
      // the instant it opens; reading it costs nothing while the overlay stays closed.
      this.pendingFiles=new Set();this.failedFiles=new Map();this.decodedFiles=new Set();this.lastError=null;this.dropLog=[];
      try{this.storage=env.storage===undefined?root.localStorage:env.storage;const saved=JSON.parse(this.storage?.getItem(config.storageKey)||'null');if(saved&&typeof saved==='object')for(const key of Object.keys(this.settings)){if(typeof this.settings[key]==='boolean'){if(typeof saved[key]==='boolean')this.settings[key]=saved[key];}else if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))this.settings[key]=Math.max(0,Math.min(1,saved[key]));}}catch(_){/* Private browsing and bad settings are harmless. */}
      const probe=env.probe; // Capability probe only; playback uses the shared Web Audio context.
      const aac=probe?.canPlayType?.('audio/mp4; codecs="mp4a.40.2"');
      // Prefer AAC even when WebKit advertises probable Vorbis support: decode can still stall.
      this.format=aac?'m4a':'ogg';
      this.baseUrl=env.baseUrl||new URL('../assets/audio/',typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:root.location?.href||'http://localhost/ui/audio.js').href;
    }
    now(){return this.env.now?this.env.now():Date.now();}
    init(){
      if(this.context)return true;
      const Factory=this.env.AudioContext||root.AudioContext||root.webkitAudioContext;if(!Factory)return false;
      try{
        this.context=new Factory();
        // The real statechange event; iOS can leave state 'interrupted' (or just 'suspended')
        // for a while after resume() resolves, and this is the only reliable notice of the
        // eventual (possibly much later) transition to 'running'.
        this.context.onstatechange=()=>{this.markUnlocked(this.context.state==='running');};
        this.context.onstatechange();
        for(const key of ['master','music','sfx','voice'])this.buses[key]=this.context.createGain();this.buses.master.connect(this.context.destination);for(const key of ['music','sfx','voice'])this.buses[key].connect(this.buses.master);this.applyVolumes();return true;
      }catch(_){this.context=null;this.unlocked=false;return false;}
    }
    async unlock(){
      if(!this.init())return false;
      if(!await this.resume())return false;
      await this.drainPending();
      return this.unlocked;
    }
    // Replay whatever queued while locked (voices) or desired (music) once the context is
    // actually running -- called both from unlock() (explicit gesture flush) and from
    // markUnlocked() below (the async 'running' transition itself, which can land with no
    // further gesture in between on iOS). Shares one in-flight promise: a concurrent/later
    // caller (e.g. unlock()'s own explicit call, racing a markUnlocked()-triggered one from a
    // resume() that lands on the same tick) joins the same drain instead of a second, empty one.
    drainPending(){
      if(this.hidden())return Promise.resolve();
      if(!this.pendingDrain)this.pendingDrain=this.runDrainPending().finally(()=>{this.pendingDrain=null;});
      return this.pendingDrain;
    }
    // PRB-159: the page can go hidden/backgrounded between any await above and here; document is
    // the only source of truth iOS gives us (no per-call signal threaded through every caller).
    hidden(){return typeof document!=='undefined'&&document.visibilityState==='hidden';}
    // The one place a dropped play()/voice() records why, for the hidden debug overlay's "last 8
    // drop reasons" -- never thrown, never logged to the console, just a bounded ring buffer.
    drop(name,reason){
      this.dropLog.push({name,reason,at:this.now()});
      if(this.dropLog.length>8)this.dropLog.shift();
      return false;
    }
    async runDrainPending(){
      for(const name of [...this.pendingVoices])await this.requestVoice(name);
      if(this.desiredMusic)await this.loop('music',this.musicName||'pulse',this.musicFade||0);
    }
    // The single place this.unlocked actually changes. Every caller that determines the context
    // is (or is not) running funnels through here -- the real statechange event (init()), a
    // direct post-resume() state check (resume() below), or armUnlockWait()'s own cap timeout --
    // so an in-flight armUnlockWait()/stateWaiters promise always resolves the instant ANY of
    // those paths discovers 'running', not only the one that happened to arm it.
    markUnlocked(running){
      const becameRunning=running&&!this.unlocked;
      this.unlocked=running;if(running)this.wasUnlocked=true;
      for(const waiter of [...this.stateWaiters])waiter(running);
      if(becameRunning)void this.drainPending();
    }
    // Keep prior permission separate: WebKit clears unlocked during interruptions. iOS can also
    // leave context.state 'suspended'/'interrupted' for a while after resume() resolves -- once
    // resume() itself has not thrown, wait (capped) for the real 'running' transition instead of
    // trusting the resolved promise alone.
    async resume(){
      // PRB-159 regression fix: never resume (or even arm a wait that could flip this.unlocked)
      // while the page is hidden/backgrounded -- that is exactly how the 'playback' audioSession
      // category kept the music loop alive after the app was closed. Every caller (play/voice/
      // loop/installUnlock's gesture+recover handlers) already bails before reaching here too;
      // this is the last line of defense.
      if(this.hidden())return false;
      if(this.context.state==='running'){this.markUnlocked(true);return true;}
      let resumed=false;
      try{this.armUnlockWait();await this.context.resume();resumed=true;}catch(_){}
      if(this.hidden())return false;
      this.markUnlocked(this.context.state==='running');
      if(!this.unlocked&&resumed&&this.unlockPromise)this.markUnlocked(await this.unlockPromise);
      return this.unlocked;
    }
    // iOS WebKit: context.state can stay 'suspended' (or 'interrupted') synchronously after
    // resume() runs, flipping to 'running' asynchronously, sometimes 100ms+ later. Arm a capped
    // wait for that transition so play()/voice()/requestVoice() can hold for it (treating any
    // resume issued inside/after a gesture as "unlocking in progress") instead of hard-dropping
    // the sound. Resolves true the instant state is already running, false past the cap.
    armUnlockWait(capMs){
      if(this.hidden()){const resolved=Promise.resolve(false);this.unlockPromise=resolved;return resolved;}
      const cap=capMs??(this.config.unlockWaitMs??1500);
      const promise=new Promise(resolve=>{
        if(!this.context){resolve(false);return;}
        if(this.context.state==='running'){resolve(true);return;}
        if(this.context.state==='closed'){resolve(false);return;}
        let settled=false,timer;
        const waiter=running=>{
          if(settled||!running)return;
          settled=true;this.stateWaiters.delete(waiter);clearTimeout(timer);resolve(true);
        };
        this.stateWaiters.add(waiter);
        timer=(this.env.setTimeout||root.setTimeout||setTimeout)(()=>{
          if(settled)return;
          settled=true;this.stateWaiters.delete(waiter);resolve(this.context.state==='running');
        },cap);
        if(timer&&typeof timer.unref==='function')timer.unref();
      });
      this.unlockPromise=promise;
      return promise;
    }
    // iOS Safari only honours ctx.resume() as a real unlock when it runs synchronously inside
    // the original gesture, together with actually starting a sound in that same tick -- an
    // awaited resume() (this.resume()/unlock()) a microtask later is too late on that platform.
    // Callers fire this first, then still call unlock() for the real (possibly async) decode
    // of any voices/music queued while locked.
    unlockSync(){
      if(this.hidden()||!this.init())return false;
      try{const p=this.context.resume();if(p&&typeof p.catch==='function')p.catch(()=>{});}catch(_){}
      try{
        const buffer=this.context.createBuffer(1,1,this.context.sampleRate),source=this.context.createBufferSource();
        source.buffer=buffer;source.connect(this.context.destination);source.start(0);
      }catch(_){}
      this.markUnlocked(this.context.state==='running');
      // iOS WebKit flips context.state to 'running' asynchronously (sometimes 100ms+ later) even
      // though resume() ran synchronously above -- arm a capped wait so play/voice/requestVoice
      // can hold for it instead of dropping the first sound, and retry any decode that failed or
      // stalled while the context was still suspended (pre-gesture).
      this.armUnlockWait();
      this.retryDecodes();
      // PRB-159: iOS/Safari's Web Audio defaults to the 'ambient' session category -- it obeys
      // the ringer/mute switch, mixes with other apps' audio, and (critically) does NOT play in
      // the background once the app is closed/backgrounded. PRB-158 switched this to 'playback'
      // to beat the silent switch, but 'playback' is exactly what also kept the music loop
      // running after the app was closed (Robert's report: "now the music keeps playing even
      // after the app is closed"). Set 'ambient' explicitly -- not just leaving it unset -- so a
      // future platform default change can't silently reopen this regression; background
      // playback is instead prevented ourselves, deliberately, via suspendForHidden() below.
      // Feature-detected and wrapped: harmless (a no-op) on every platform without it.
      try{const nav=this.env.navigator||root.navigator;if(nav&&nav.audioSession)nav.audioSession.type='ambient';}catch(_){}
      return this.unlocked;
    }
    // PRB-159: stop background audio ourselves instead of relying on an audioSession category.
    // Called on visibilitychange->hidden, pagehide and freeze (bfcache eviction/freeze). Stops
    // (never just pauses -- BufferSources cannot be paused) every active loop so nothing keeps
    // rendering, but leaves desiredMusic/musicName/musicFade untouched so loop() recreates the
    // same music the instant we come back (see drainPending()/markUnlocked()); also pauses any
    // stray HTMLMediaElement (none ship today, but a future one must not keep playing either),
    // then suspends the shared context itself so even synthesized SFX (no loop, no element)
    // cannot render while hidden. suspendedByHidden marks this as OUR suspend, specifically so
    // installUnlock's recover() (visible/pageshow) -- and only that path, only once previously
    // unlocked -- is what resumes it again, never some unrelated code path.
    suspendForHidden(){
      if(!this.context||this.suspendedByHidden)return;
      this.suspendedByHidden=true;
      for(const slot of [...this.loops.keys()])this.stopLoop(slot);
      if(typeof document!=='undefined'&&document.querySelectorAll)for(const el of document.querySelectorAll('audio,video'))try{el.pause();}catch(_){}
      try{const p=this.context.suspend();if(p&&typeof p.catch==='function')p.catch(()=>{});}catch(_){}
    }
    installUnlock(target){
      const unlock=()=>{if(this.hidden())return;if(this.unlocked&&this.context?.state==='running')return;this.unlockSync();void this.unlock();};
      // WebKit needs resume() in the original trusted activation stack. touchstart/pointerdown
      // catch a joystick-hold gesture whose matching touchend/pointerup can be seconds away (iOS
      // does accept resume() from touchstart/pointerdown); touchend/pointerup/click/keydown stay
      // as a second chance for anything that slips through.
      const gestures=target.defaultView||target;
      for(const type of ['touchstart','pointerdown','touchend','click','keydown','pointerup'])gestures.addEventListener(type,unlock,{capture:true,passive:true});
      // 'interrupted' (phone call, Siri, app switch, lock screen) behaves like 'suspended': retry
      // on the next visible tick, the next pageshow (bfcache restore) and the next gesture above.
      // Both fire on every normal page load too (pageshow always does, even outside bfcache), so
      // gate on having unlocked at least once already -- nothing to recover before that, and
      // resume() cannot do real work outside a trusted gesture anyway. PRB-159: also the only
      // path that clears suspendedByHidden and resumes a context we suspended for being hidden.
      const recover=()=>{if(this.hidden())return;this.suspendedByHidden=false;if(this.wasUnlocked)unlock();};
      gestures.addEventListener('pageshow',recover);
      const visibility=gestures.document||target;
      visibility.addEventListener('visibilitychange',()=>{if(visibility.visibilityState==='visible')recover();else if(visibility.visibilityState==='hidden')this.suspendForHidden();});
      gestures.addEventListener('pagehide',()=>this.suspendForHidden());
      visibility.addEventListener('freeze',()=>this.suspendForHidden());
    }
    // Decode every SFX/VO/loop buffer up front (during the splash, before any gesture -- a
    // suspended AudioContext still decodes fine) so the first sounds after unlockSync() never
    // lose a race to a slow fetch+decodeAudioData. Safe to call with no AudioContext factory
    // available (jsdom/tests without one): resolves false rather than throwing.
    allFiles(){
      return [...Object.values(this.config.sfx).map(cue=>cue.file),
        ...this.config.voices.map(name=>'bit/'+name),
        ...Object.values(this.config.loops).map(cue=>cue.file)];
    }
    async preload(){
      if(!this.init())return false;
      await Promise.all(this.allFiles().map(file=>this.load(file).catch(()=>{})));
      return true;
    }
    // Hidden debug overlay (triple-tap the version label): a cheap snapshot, read on demand only
    // while the overlay is open -- adds zero cost while closed beyond the bookkeeping load()/
    // drop() already do for every file/play regardless.
    debugStats(){
      const nav=this.env.navigator||root.navigator;
      return {
        contextState:this.context?.state??'none',
        sampleRate:this.context?.sampleRate??null,
        baseLatency:this.context?.baseLatency??null,
        unlocked:this.unlocked,wasUnlocked:this.wasUnlocked,
        format:this.format,
        decoded:this.decodedFiles.size,total:this.allFiles().length,
        pending:[...this.pendingFiles],
        failed:[...this.failedFiles.entries()].map(([file,error])=>({file,error})),
        drops:this.dropLog.slice(),
        lastError:this.lastError,
        visibilityState:typeof document!=='undefined'?document.visibilityState:'unknown',
        audioSessionType:nav?.audioSession?.type??null,
      };
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
    // Fetches each extension at most once per file and keeps the raw ArrayBuffer (`buffers`), so a
    // decode that fails or stalls (old iOS can do this on a context created before any gesture)
    // can be retried from the same bytes -- decodeAudioData detaches/consumes its input, so every
    // attempt gets its own slice() copy rather than reusing the stored buffer directly.
    async decodeFile(file){
      const tryExtension=async extension=>{
        const key=file+'.'+extension;
        let buffer=this.buffers.get(key);
        if(!buffer){
          const fetcher=this.env.fetch||root.fetch;
          const response=await fetcher(new URL(key,this.baseUrl).href);
          if(!response.ok)throw new Error('Audio unavailable');
          buffer=await response.arrayBuffer();
          this.buffers.set(key,buffer);
        }
        const decode=this.context.decodeAudioData(buffer.slice(0));
        // PRB-159: some WebKit versions never settle decodeAudioData on Ogg Vorbis at all rather
        // than rejecting it -- an unresolved promise never reaches the catch below, so the
        // format never falls back to m4a and every later file keeps re-trying the same hang.
        // Cap only the ogg attempt (m4a is the known-good format once chosen) so a stall still
        // reaches the fallback instead of hanging forever.
        if(extension!=='ogg')return decode;
        return Promise.race([decode,new Promise((_,reject)=>{
          const timer=(this.env.setTimeout||root.setTimeout||setTimeout)(()=>reject(new Error('ogg-decode-stalled')),this.config.decodeWaitMs??2500);
          if(timer&&typeof timer.unref==='function')timer.unref();
        })]);
      };
      const format=this.format;
      try{return await tryExtension(format);}
      catch(error){
        if(format!=='ogg')throw error;
        // Switch away from the failing format immediately (before awaiting the fallback), not
        // just after it succeeds -- any other file whose decodeFile() call starts concurrently
        // (e.g. during preload()'s Promise.all) must not also pay for a known-bad ogg attempt.
        this.format='m4a';
        return await tryExtension('m4a');
      }
    }
    async load(file){
      if(!this.cache.has(file)){
        const request=this.decodeFile(file);
        this.cache.set(file,request);this.pendingFiles.add(file);
        request.then(
          ()=>{this.pendingFiles.delete(file);this.decodedFiles.add(file);this.failedFiles.delete(file);},
          error=>{
            this.pendingFiles.delete(file);this.decodedFiles.delete(file);
            if(this.cache.get(file)===request)this.cache.delete(file);
            const message=error&&error.message?error.message:String(error);
            this.failedFiles.set(file,message);this.lastError=message;
          }
        );
      }
      return this.cache.get(file);
    }
    // Race load(file) against a cap so a stalled decode cannot block playback forever; the
    // underlying load() promise keeps running/caching regardless of which side of the race wins.
    raceLoad(file,capMs){
      const request=this.load(file);
      let timer;
      const timeout=new Promise((_,reject)=>{
        timer=(this.env.setTimeout||root.setTimeout||setTimeout)(()=>reject(new Error('decode-timeout')),capMs??(this.config.decodeWaitMs??2500));
        if(timer&&typeof timer.unref==='function')timer.unref();
      });
      return Promise.race([request,timeout]).finally(()=>clearTimeout(timer));
    }
    // (Re)decode any file whose fetch already succeeded (bytes kept in `buffers`) but whose
    // decode failed or never finished before the gesture -- never re-fetches, just retries the
    // decode from the stored bytes.
    retryDecodes(){
      const files=new Set();
      for(const key of this.buffers.keys()){
        const file=key.replace(/\.(ogg|m4a)$/,'');
        if(!this.cache.has(file))files.add(file);
      }
      for(const file of files)void this.load(file).catch(()=>{});
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
    source(buffer,bus,gain,pitch=1,loop=false,destination=null,fade=0){
      const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;source.loop=loop;source.playbackRate.value=pitch;level.gain.value=fade?0:gain;if(fade){level.gain.setValueAtTime(0,this.context.currentTime);level.gain.linearRampToValueAtTime(gain,this.context.currentTime+fade);}source.prLevel=level;
      source.connect(level);level.connect(destination||this.buses[bus]);this.active.add(source);
      source.onended=()=>{this.active.delete(source);source.disconnect();level.disconnect();};source.start();return source;
    }
    async play(name,{enemy=false}={}){
      const cue=this.config.sfx[name]||(name.startsWith('shoot-')?this.config.sfx['shoot-carbine']:null);
      if(!cue)return this.drop(name,'unknown-cue');
      if(this.settings.muted)return this.drop(name,'muted');
      if(this.hidden())return this.drop(name,'hidden');
      if(this.context?.state!=='running'&&(this.unlocked||this.wasUnlocked||this.unlockPromise))await this.resume();
      if(this.hidden())return this.drop(name,'hidden');
      if(!this.unlocked||this.context?.state!=='running')return this.drop(name,'not-unlocked');
      const now=this.now(),epoch=this.epoch,shot=name.startsWith('shoot-'),key=name+(enemy?'-enemy':'');
      if(shot&&(this.settings.sfx===0||this.settings.sfxMuted||this.settings.master===0))return this.drop(name,'sfx-muted');
      if(now-(this.lastSfx.get(key)??-Infinity)<cue.minGap)return this.drop(name,'min-gap');
      this.lastSfx.set(key,now);
      if(shot){
        try{const C=this.config.shots,weapon=Object.prototype.hasOwnProperty.call(C.weapons,name.slice(6))?name.slice(6):'carbine',W=C.weapons[weapon],random=this.env.random||Math.random;
        this.source(this.shotBuffer(weapon,enemy),'sfx',cue.gain*W.gain*(enemy?C.enemyGain:1)*(1+(random()*2-1)*this.config.gainVariation),W.pitch*(1+(random()*2-1)*this.config.pitchVariation),false,this.shotDestination());
        return true;}catch(error){return this.drop(name,'synthesis: '+(error?.message||error));}
      }
      try{
        const buffer=await this.raceLoad(cue.file);
        if(this.hidden())return this.drop(name,'hidden');
        if(epoch!==this.epoch||!this.unlocked||this.settings.muted)return this.drop(name,'stale-or-muted');
        const random=this.env.random||Math.random;this.source(buffer,'sfx',cue.gain*(1+(random()*2-1)*this.config.gainVariation),1+(random()*2-1)*this.config.pitchVariation);return true;
      }catch(error){return this.drop(name,'decode: '+(error?.message||error));}
    }
    // youre-back is BIT's cold-open greeting: it may only ever be heard while that screen (.intro)
    // is on screen, never replayed later onto the homecoming summary once BIT has left.
    // It also stops an in-flight/playing line of that name (e.g. the unlock on the ENTER tap's pointerdown
    // started it a moment before the click dismissed the intro), so it cannot carry over onto the summary.
    cancelVoice(name){this.pendingVoices.delete(name);this.consumedVoices.add(name);
      if(this.requestedVoices.has(name)||this.voiceName===name){this.voiceToken++;this.voiceBusy=false;
        if(this.voiceName===name&&this.voiceSource){try{this.voiceSource.stop();}catch(_){}}
        this.voiceSource=null;this.voiceName=null;this.duck(false);}}
    // One-shot presentation cues survive autoplay lock and deduplicate concurrent renders. While
    // still locked, if a gesture has already armed an unlock attempt (armUnlockWait()), wait for
    // it (capped) instead of only queueing for a later explicit unlock() -- the intro-not-present
    // guard and every mute/settings guard are re-checked right before play, not only here.
    async requestVoice(name){
      if(!this.config.voices.includes(name)||this.consumedVoices.has(name))return false;
      if(name==='youre-back'&&typeof document!=='undefined'&&!document.querySelector('.intro')){this.cancelVoice(name);return false;}
      if(this.settings.muted||this.settings.voiceMuted||this.settings.voice===0||this.settings.master===0){
        this.pendingVoices.delete(name);this.consumedVoices.add(name);return false;
      }
      if(this.requestedVoices.has(name))return this.requestedVoices.get(name);
      if(!this.unlocked||this.context?.state!=='running'){
        this.pendingVoices.add(name);
        if(!this.unlockPromise)return false;
        const waited=this.unlockPromise;
        const request=waited.then(async ok=>{
          this.pendingVoices.delete(name);
          if(!ok||this.consumedVoices.has(name))return false;
          // Re-check at PLAY time: the intro (or mute settings) may have changed while we waited.
          if(name==='youre-back'&&typeof document!=='undefined'&&!document.querySelector('.intro')){this.cancelVoice(name);return false;}
          if(this.settings.muted||this.settings.voiceMuted||this.settings.voice===0||this.settings.master===0){this.consumedVoices.add(name);return false;}
          const played=await this.voice(name);
          if(played||this.settings.muted||this.settings.voiceMuted||this.settings.voice===0||this.settings.master===0)this.consumedVoices.add(name);
          return played;
        }).finally(()=>this.requestedVoices.delete(name));
        this.requestedVoices.set(name,request);
        return request;
      }
      this.pendingVoices.delete(name);
      const request=this.voice(name).then(played=>{
        if(played||this.settings.muted||this.settings.voiceMuted||this.settings.voice===0||this.settings.master===0)this.consumedVoices.add(name);
        return played;
      }).finally(()=>this.requestedVoices.delete(name));
      this.requestedVoices.set(name,request);return request;
    }
    async voice(name){
      if(this.hidden())return this.drop(name,'hidden');
      if(this.context?.state!=='running'&&(this.unlocked||this.wasUnlocked||this.unlockPromise))await this.resume();
      if(this.hidden())return this.drop(name,'hidden');
      const now=this.now(),cooldown=this.config.voiceCooldowns[name]??this.config.voiceCooldownMs;
      if(!this.config.voices.includes(name))return this.drop(name,'unknown-voice');
      if(!this.unlocked||this.context?.state!=='running')return this.drop(name,'not-unlocked');
      if(this.settings.muted||this.settings.voice===0||this.settings.voiceMuted)return this.drop(name,'voice-muted');
      if(this.voiceBusy)return this.drop(name,'voice-busy');
      if(now-this.globalVoiceAt<this.config.globalVoiceCooldownMs)return this.drop(name,'global-cooldown');
      if(now-(this.lastVoice.get(name)??-Infinity)<cooldown)return this.drop(name,'per-line-cooldown');
      this.voiceBusy=true;const token=++this.voiceToken;
      try{
        const buffer=await this.raceLoad('bit/'+name,this.config.voiceDecodeWaitMs??6000);
        if(this.hidden())return this.drop(name,'hidden');
        if(name==='youre-back'&&typeof document!=='undefined'&&!document.querySelector('.intro'))return this.drop(name,'intro-gone');
        if(token!==this.voiceToken||this.settings.muted||(this.settings.voice===0||this.settings.voiceMuted))return this.drop(name,'stale-or-muted');
        this.duck(true);const source=this.source(buffer,'voice',this.config.voiceGain),cleanup=source.onended;this.voiceSource=source;this.voiceName=name;
        this.lastVoice.set(name,this.now());this.globalVoiceAt=this.now();
        source.onended=()=>{cleanup();if(this.voiceSource===source){this.voiceSource=null;this.voiceName=null;}if(token===this.voiceToken){this.voiceBusy=false;this.duck(false);}};return true;
      }catch(error){return this.drop(name,'decode: '+(error?.message||error));}finally{if(token===this.voiceToken&&!this.ducked)this.voiceBusy=false;}
    }
    async loop(slot,name,fade=0){
      if(this.hidden())return;
      const epoch=this.epoch,tokenBeforeResume=this.loopTokens.get(slot);
      if(this.context?.state!=='running'&&(this.unlocked||this.wasUnlocked||this.unlockPromise))await this.resume();
      if(this.hidden())return;
      if(epoch!==this.epoch||this.loopTokens.get(slot)!==tokenBeforeResume)return;
      if(this.loops.get(slot)?.name===name)return;
      this.stopLoop(slot);const token=this.loopTokens.get(slot),cue=this.config.loops[name];if(!cue||!this.unlocked||this.context?.state!=='running')return;
      // Reserve the slot while decoding; repeated music calls share one pending request.
      this.loops.set(slot,{name,source:null});
      try{
        const buffer=await this.load(cue.file);
        if(this.hidden()){if(this.loopTokens.get(slot)===token)this.loops.delete(slot);return;}
        if(epoch!==this.epoch||this.loopTokens.get(slot)!==token)return;
        if(slot==='music')this.retireFadingMusic();
        this.loops.set(slot,{name,source:this.source(buffer,cue.bus,cue.gain,1,true,null,fade)});
      }catch(_){if(this.loopTokens.get(slot)===token)this.loops.delete(slot);}
    }
    retireFadingMusic(){
      const source=this.fadingMusic;this.fadingMusic=null;
      if(source){try{source.stop();}catch(_){}}
    }
    stopLoop(slot){this.loopTokens.set(slot,(this.loopTokens.get(slot)||0)+1);const entry=this.loops.get(slot);this.loops.delete(slot);if(slot==='music')this.retireFadingMusic();if(entry?.source)entry.source.stop();}
    music(name='pulse',fade=0){this.desiredMusic=true;this.musicName=name;this.musicFade=fade;if(this.unlocked)void this.loop('music',name,fade);}
    fadeMusic(seconds=.8){
      this.desiredMusic=false;
      // Invalidate requests waiting for either resume or decode.
      const entry=this.loops.get('music');this.loopTokens.set('music',(this.loopTokens.get('music')||0)+1);this.loops.delete('music');
      // A repeated PLAY keeps the existing fade tracked until it ends or is replaced.
      const source=entry?.source||this.fadingMusic;
      if(!source||!this.context)return Promise.resolve();
      this.fadingMusic=source;
      const cleanup=source.onended;
      if(entry?.source)source.onended=()=>{cleanup?.();if(this.fadingMusic===source)this.fadingMusic=null;};
      const param=source.prLevel.gain,now=this.context.currentTime;
      if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
      else{param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);}
      param.linearRampToValueAtTime(0,now+seconds);source.stop(now+seconds);
      return new Promise(resolve=>setTimeout(resolve,seconds*1000));
    }
    stop(){this.epoch++;this.desiredMusic=false;this.retireFadingMusic();for(const slot of this.loops.keys())this.stopLoop(slot);this.voiceToken++;this.voiceBusy=false;this.duck(false);for(const source of [...this.active]){try{source.stop();}catch(_){}}}
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
  if(root.DATA?.audio){
    // PRB-159: this default construction used to pass no env at all, so the constructor's
    // `!probe?'ogg':...` fallback always picked 'ogg' -- on iOS, decodeAudioData on Ogg Vorbis
    // fails (or hangs) on most versions, so every SFX/VO fetched+decoded .ogg, failed, then
    // fetched+decoded .m4a too: double the network/decode work for every one of the ~56 files,
    // racing (and often losing to) the 2.5s raceLoad cap. Build a real probe here: a detached
    // audio element's canPlayType(), never inserted into the DOM or played (Web Audio
    // decoding only, same as every other AudioManager construction in this codebase/its tests).
    const probe=typeof document!=='undefined'&&document.createElement?document.createElement('audio'):null;
    root.PR_AUDIO=new AudioManager(root.DATA.audio,probe?{probe}:{});
    if(typeof document!=='undefined')root.PR_AUDIO.installUnlock(window);
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={AudioManager};
})(typeof window!=='undefined'?window:globalThis);
