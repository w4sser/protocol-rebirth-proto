// PRB-158 (Robert's iPhone playtest of v2.28.36): "the sound is still not fully loaded when I
// start playing" and "the 'You're back' VO doesn't play." Every other audio test in this repo
// (nodspel/tests/audio.test.mjs's FakeContext) flips context.state to 'running' effectively
// synchronously the instant resume() is called -- that hid the real iOS bug: WebKit resolves
// resume() (and even starts decoding) while state is still 'suspended', flipping to 'running'
// asynchronously, sometimes 100ms+ later. FakeIOSAudioContext below models that lag (plus
// 'interrupted', a touchstart-only gesture and a decode that only starts working post-unlock) so
// these tests fail the way the real phone did before ui/audio.js's armUnlockWait()/markUnlocked()
// fix, and stay red if that fix regresses. See docs/design-audio-oct28.md "iOS unlock model".
const assert = require("assert");
const path = __dirname + "/..";
const { JSDOM } = require("jsdom");
global.window = {};
require(path + "/data/audio.js");
const { AudioManager } = require(path + "/ui/audio.js");
const config = global.window.DATA.audio;

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

class Param{ constructor(){ this.value = 0; } cancelScheduledValues(){} setValueAtTime(v){ this.value = v; } linearRampToValueAtTime(v){ this.value = v; } setTargetAtTime(v){ this.value = v; } }
class Gain{ constructor(){ this.gain = new Param(); } connect(node){ this.destination = node; } disconnect(){} }
class Source{ constructor(){ this.playbackRate = { value: 1 }; } connect(node){ this.destination = node; } disconnect(){} start(){ this.started = true; } stop(){ this.stopped = true; this.onended?.(); } }

// state starts 'suspended'. resume() only actually resumes when called while `gestureOpen` is
// true AND state is still 'suspended' (recovering FROM 'interrupted' needs no fresh gesture --
// WebKit already granted this context once); either way the state flip to 'running' lands
// asynchronously ~120ms later via a real setTimeout, firing onstatechange, never synchronously.
class FakeIOSAudioContext{
  constructor(){
    this.state = "suspended"; this.currentTime = 0; this.sampleRate = 44100; this.destination = {};
    this.sources = []; this.gestureOpen = false; this.decodeBroken = false; this.onstatechange = null;
  }
  createBuffer(channels, length, sampleRate){ const data = new Float32Array(length); return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data }; }
  createGain(){ return new Gain(); }
  createBufferSource(){ const s = new Source(); this.sources.push(s); return s; }
  createDynamicsCompressor(){ return { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), connect(node){ this.destination = node; } }; }
  resume(){
    if(this.state === "running") return Promise.resolve();
    if(this.resuming) return this.resuming; // already resuming -- join the same eventual flip
    if(this.state === "suspended" && !this.gestureOpen) return Promise.reject(new Error("resume() outside a trusted gesture does nothing on iOS"));
    this.resuming = new Promise(resolve => {
      setTimeout(() => {
        this.resuming = null;
        if(this.state !== "closed"){ this.state = "running"; this.onstatechange?.(); }
        resolve();
      }, 120);
    });
    return this.resuming;
  }
  // Old iOS can stall/fail decodeAudioData while the context is still suspended (pre-gesture);
  // decodeBroken models that -- real bytes, a real async delay, but a rejection until cleared.
  decodeAudioData(){
    return new Promise((resolve, reject) => {
      setTimeout(() => { if(this.decodeBroken) reject(new Error("decode stalled (old iOS)")); else resolve({ duration: 1 }); }, 30);
    });
  }
  interrupt(){ this.state = "interrupted"; this.onstatechange?.(); }
  // PRB-159: suspendForHidden() calls context.suspend() on hidden/pagehide/freeze -- real iOS
  // flips state synchronously too (unlike resume()'s async lag modeled above).
  suspend(){ this.state = "suspended"; this.onstatechange?.(); return Promise.resolve(); }
}

function fetchOk(){ return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); }

// A trivial always-succeeds context (synchronous resume/suspend, no gesture gating, no decode
// failures) for the default-construction test below, where the format probe itself -- not the
// iOS resume-lag modeled by FakeIOSAudioContext -- is what's under test.
function SimpleIOSContext(){
  this.state = "suspended"; this.currentTime = 0; this.sampleRate = 44100; this.destination = {};
  this.onstatechange = null;
}
SimpleIOSContext.prototype.createBuffer = function(channels, length, sampleRate){ const data = new Float32Array(length); return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data }; };
SimpleIOSContext.prototype.createGain = function(){ return new Gain(); };
SimpleIOSContext.prototype.createBufferSource = function(){ return new Source(); };
SimpleIOSContext.prototype.createDynamicsCompressor = function(){ return { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), connect(node){ this.destination = node; } }; };
SimpleIOSContext.prototype.resume = function(){ this.state = "running"; this.onstatechange?.(); return Promise.resolve(); };
SimpleIOSContext.prototype.suspend = function(){ this.state = "suspended"; this.onstatechange?.(); return Promise.resolve(); };
SimpleIOSContext.prototype.decodeAudioData = function(){ return Promise.resolve({ duration: 1 }); };

function fixture(installTarget, envOverrides){
  const ctx = new FakeIOSAudioContext();
  const env = { AudioContext: function(){ return ctx; }, fetch: () => fetchOk(), navigator: {}, ...envOverrides };
  const audio = new AudioManager(config, env);
  if(installTarget) audio.installUnlock(installTarget);
  return { audio, ctx };
}

(async function(){
  // 1) The first play() right after the gesture-tap plays -- it waits for the real 'running'
  // transition instead of dropping the sound just because state is still 'suspended'
  // synchronously (unlockSync() cannot see 120ms into the future).
  {
    const { audio, ctx } = fixture();
    ctx.gestureOpen = true;
    assert.equal(audio.unlockSync(), false, "state is still 'suspended' at this exact synchronous instant");
    const played = audio.play("ui-confirm");
    ctx.gestureOpen = false;
    assert.equal(await played, true, "the first sound after the tap waits for 'running' instead of dropping");
  }

  // 2) youre-back requested at the line reveal while locked/decoding plays once unlock + decode
  // resolve, as long as the intro is still mounted.
  {
    const dom = new JSDOM('<div class="intro"></div>');
    global.document = dom.window.document;
    try{
      const { audio, ctx } = fixture();
      ctx.gestureOpen = true;
      audio.unlockSync(); // the start-tap, long before the intro's first line reveals
      ctx.gestureOpen = false;
      const requested = audio.requestVoice("youre-back"); // first line reveal: still locked/decoding
      assert.equal(audio.pendingVoices.has("youre-back"), true, "queues while locked/decoding");
      assert.equal(await requested, true, "plays once unlock + decode resolve, intro still mounted");
      assert.equal(audio.lastVoice.has("youre-back"), true);
    } finally { delete global.document; }
  }

  // 3) If ENTER (cancelVoice, after the intro navigates away) happens before unlock/decode
  // resolve, it never plays -- the intro-not-present guard and consumedVoices are re-checked at
  // PLAY time, not only at request time.
  {
    const dom = new JSDOM('<div class="intro"></div>');
    global.document = dom.window.document;
    try{
      const { audio, ctx } = fixture();
      ctx.gestureOpen = true;
      audio.unlockSync();
      ctx.gestureOpen = false;
      const requested = audio.requestVoice("youre-back");
      dom.window.document.querySelector(".intro").remove();
      audio.cancelVoice("youre-back");
      assert.equal(await requested, false, "cancelled before unlock/decode resolved -- never plays");
      await sleep(200); // let the already-armed unlock/decode actually settle; still must not play
      assert.equal(audio.lastVoice.has("youre-back"), false);
    } finally { delete global.document; }
  }

  // 3b) Slow decode (iOS decodes after unlock): the intro leaves while the youre-back buffer is
  // still decoding. The play-time guard after decode must stop it -- never heard after ENTER.
  {
    const dom = new JSDOM('<div class="intro"></div>');
    global.document = dom.window.document;
    try{
      const { audio, ctx } = fixture();
      ctx.decodeAudioData = () => new Promise(resolve => setTimeout(() => resolve({ duration: 1 }), 400));
      ctx.gestureOpen = true;
      audio.unlockSync();
      ctx.gestureOpen = false;
      const requested = audio.requestVoice("youre-back");
      await sleep(200); // running now, buffer still decoding
      dom.window.document.querySelector(".intro").remove();
      assert.equal(await requested, false, "intro gone before decode finished -- must not start");
      assert.equal(audio.lastVoice.has("youre-back"), false);
    } finally { delete global.document; }
  }

  // 4) 'interrupted' (phone call, Siri, app switch, lock screen) behaves like 'suspended' and
  // recovers on the next visibilitychange -> visible, with no fresh gesture required (WebKit
  // already granted this context once); sounds play again afterwards.
  {
    const dom = new JSDOM("");
    // jsdom defaults visibilityState to 'prerender' (unconfigurable getter) -- force 'visible' so
    // installUnlock's visibility.visibilityState==='visible' check actually passes.
    Object.defineProperty(dom.window.document, "visibilityState", { value: "visible", configurable: true });
    const { audio, ctx } = fixture(dom.window);
    ctx.gestureOpen = true;
    audio.unlockSync();
    ctx.gestureOpen = false;
    await sleep(150);
    assert.equal(audio.unlocked, true, "unlocked once, normally");
    ctx.interrupt();
    assert.equal(audio.unlocked, false, "'interrupted' behaves like 'suspended'");
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
    await sleep(150);
    assert.equal(audio.unlocked, true, "visibilitychange -> visible resumes again without a fresh gesture");
    assert.equal(await audio.play("ui-confirm"), true, "sounds play again after recovery");
  }

  // 5) A touchstart-only gesture (a joystick hold with no matching touchend for seconds) unlocks
  // on its own.
  {
    const dom = new JSDOM("");
    const { audio, ctx } = fixture(dom.window);
    ctx.gestureOpen = true;
    dom.window.dispatchEvent(new dom.window.Event("touchstart"));
    ctx.gestureOpen = false;
    await sleep(150);
    assert.equal(audio.unlocked, true, "touchstart alone unlocks -- no matching touchend needed");
  }

  // 6) A decode that fails before unlock (old iOS, decoding on a still-suspended context) is
  // retried -- from the bytes already fetched, never re-fetched -- right after unlockSync().
  {
    const { audio, ctx } = fixture();
    ctx.decodeBroken = true;
    await audio.preload();
    assert.equal(audio.cache.size, 0, "a failed decode leaves no resolved entry in the cache");
    assert.ok(audio.buffers.size > 0, "the fetched bytes are kept for a retry");
    let requests = 0;
    const originalFetch = audio.env.fetch;
    audio.env.fetch = (...args) => { requests++; return originalFetch(...args); };
    ctx.decodeBroken = false;
    ctx.gestureOpen = true;
    audio.unlockSync(); // retries any failed decode right after unlock
    ctx.gestureOpen = false;
    await sleep(60); // long enough for the 30ms decode retry, well short of the 120ms resume
    assert.equal(requests, 0, "the retry re-decodes the stored bytes -- it never re-fetches");
    assert.equal(audio.cache.has("sfx/ui-confirm"), true, "the retried decode is cached before the context even finishes resuming");
    assert.equal(await audio.play("ui-confirm"), true, "the previously-failed cue now plays (play() waits out the remaining resume lag)");
  }

  // PRB-159: exercise the actual default singleton, including document.createElement probe.
  // Any Ogg request is observable, whether WebKit would reject it or hang forever.
  for(const oggSupport of ["", "maybe", "probably"])for(const failure of ["reject", "stall"]){
    const dom = new JSDOM("", { runScripts: "outside-only", url: "http://game/index.html", pretendToBeVisual: true });
    const w = dom.window, requests = [], sessions = [];
    const session = {};
    Object.defineProperty(session, "type", { get: () => sessions.at(-1), set: value => sessions.push(value) });
    Object.defineProperty(w.navigator, "audioSession", { value: session });
    const create = w.document.createElement.bind(w.document);
    let probes = 0;
    w.document.createElement = tag => {
      const el = create(tag);
      if(tag === "audio"){ probes++; el.canPlayType = type => type.includes("mp4") ? "maybe" : oggSupport; }
      return el;
    };
    class WebKitContext extends SimpleIOSContext{
      decodeAudioData(bytes){
        if(bytes.byteLength === 1)return failure === "reject" ? Promise.reject(new Error("Ogg unsupported")) : new Promise(() => {});
        return Promise.resolve({ duration: 1 });
      }
    }
    w.AudioContext = WebKitContext;
    w.fetch = async url => { requests.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(url.endsWith(".ogg") ? 1 : 2) }; };
    w.eval(require("fs").readFileSync(path + "/data/audio.js", "utf8"));
    w.eval(require("fs").readFileSync(path + "/ui/audio.js", "utf8"));
    const audio = w.PR_AUDIO;
    assert.equal(probes, 1, "default construction creates a real capability probe");
    assert.equal(audio.format, "m4a");
    w.dispatchEvent(new w.Event("touchend"));
    assert.equal(await audio.play("ui-confirm"), true, "first SFX plays with AAC");
    assert.ok(requests.length > 0 && requests.every(url => url.endsWith(".m4a")), "no Ogg fetch even if advertised");
    assert.ok(sessions.length > 0 && sessions.every(type => type === "ambient"), "never requests playback session");
    w.close();
  }

  // Hidden/pagehide/freeze stop loops and suspend. All hidden entry paths remain silent;
  // visible/pageshow restore only a context that has previously been unlocked.
  {
    const dom = new JSDOM("", { pretendToBeVisual: true });
    const w = dom.window, doc = w.document;
    global.document = doc;
    let visibility = "visible", resumes = 0, suspends = 0;
    Object.defineProperty(doc, "visibilityState", { get: () => visibility });
    const ctx = new SimpleIOSContext();
    const resume = ctx.resume.bind(ctx), suspend = ctx.suspend.bind(ctx);
    ctx.resume = () => { resumes++; return resume(); };
    ctx.suspend = () => { suspends++; return suspend(); };
    const audio = new AudioManager(config, { AudioContext: function(){ return ctx; }, fetch: fetchOk });
    audio.installUnlock(w);
    try{
      w.dispatchEvent(new w.Event("pageshow"));
      assert.equal(resumes, 0, "never unlocked: pageshow does not resume");
      audio.unlockSync();
      audio.music("pulse");
      await sleep(10);
      const music = audio.loops.get("music").source;
      visibility = "hidden";
      doc.dispatchEvent(new w.Event("visibilitychange"));
      assert.equal(ctx.state, "suspended");
      assert.equal(music.stopped, true);
      assert.equal(audio.loops.size, 0);
      assert.equal(audio.desiredMusic, true);
      const before = resumes;
      for(const event of ["touchstart", "touchend", "click", "pageshow"])w.dispatchEvent(new w.Event(event));
      audio.unlockSync();
      await audio.unlock(); await audio.resume(); await audio.armUnlockWait(); await audio.drainPending();
      assert.equal(await audio.play("ui-confirm"), false);
      assert.equal(await audio.voice("core-restored"), false);
      await audio.loop("music", "pulse");
      assert.equal(resumes, before, "no hidden entry path resumes");
      assert.equal(audio.loops.size, 0, "no music restarts while hidden");
      visibility = "visible";
      doc.dispatchEvent(new w.Event("visibilitychange"));
      await sleep(20);
      assert.equal(ctx.state, "running");
      assert.equal(audio.loops.size, 1, "desired music restarts when visible");
      w.dispatchEvent(new w.Event("pagehide"));
      assert.equal(ctx.state, "suspended", "pagehide is a window event");
      w.dispatchEvent(new w.Event("pageshow"));
      await sleep(20);
      doc.dispatchEvent(new w.Event("freeze"));
      assert.equal(ctx.state, "suspended", "freeze suspends");
      assert.equal(suspends, 3);
    } finally { delete global.document; w.close(); }
  }

  // Older iOS may reject touchstart. After its unlock wait expires, touchend AND click
  // must still synchronously call resume and prime a new silent source in the gesture stack.
  for(const retryEvent of ["touchend", "click"]){
    const dom = new JSDOM("");
    const { audio, ctx } = fixture(dom.window);
    audio.config = { ...config, unlockWaitMs: 20 };
    let resumes = 0;
    const resume = ctx.resume.bind(ctx);
    ctx.resume = () => { resumes++; return resume(); };
    dom.window.dispatchEvent(new dom.window.Event("touchstart"));
    const [failed] = await Promise.all([audio.unlockPromise, sleep(30)]);
    assert.equal(failed, false, "failed touchstart wait expires");
    const attempts = resumes, sources = ctx.sources.length;
    ctx.gestureOpen = true;
    dom.window.dispatchEvent(new dom.window.Event(retryEvent));
    ctx.gestureOpen = false;
    assert.ok(resumes > attempts, retryEvent + " retries resume synchronously");
    assert.equal(ctx.sources.length, sources + 1, retryEvent + " primes a fresh silent buffer synchronously");
    assert.equal(ctx.sources.at(-1).started, true);
    assert.equal(await audio.play("ui-confirm"), true, "later gesture unlocks the first sound");
    dom.window.close();
  }

  console.log("iOS audio simulation tests PASSED");
})().catch(e => { console.error(e); process.exitCode = 1; });
