const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const fs = require('node:fs');
const beat = {id:'core_restored',from:'start.webp',to:'end.webp',line:'Power is back.',bust:{from:'happy.webp'},fallback:'safe.webp'};
function fixture(t){
  const w = new JSDOM('<body data-screen="base"></body>',{runScripts:'outside-only',url:'http://localhost'}).window;
  t.after(() => w.close());
  let now=0, serial=0, decodes=0;
  const timers=new Map(), images=[];
  w.setTimeout=(fn,ms) => {timers.set(++serial,{at:now+ms,fn});return serial;};
  w.clearTimeout=id => timers.delete(id);
  w.requestAnimationFrame=fn => w.setTimeout(fn,16);
  w.matchMedia=() => ({matches:false});
  w.Image=class {
    constructor(){images.push(this);}
    set src(src){this.url=src;}
    decode(){decodes++;return new Promise(resolve => {this.resolveDecode=resolve;});}
  };
  w.eval(fs.readFileSync(__dirname+'/../ui/bit-cutscene.js','utf8'));
  return {w,api:w.PRBitCutscene,images,get decodes(){return decodes;},tick(ms){
    const end=now+ms;
    while(true){const next=[...timers].filter(([,j]) => j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
      timers.delete(next[0]);now=next[1].at;next[1].fn();}
    now=end;
  }};
}
test('decoded cache warms backdrops, bust and fallback; warm play presents in the same tick',async t => {
  const f=fixture(t), ready=f.api.preload(beat);
  assert.equal(f.images.length,4);
  f.images.forEach(img=>img.onload());
  assert.equal(f.decodes,4);
  let finished=false; ready.then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false,'warm awaits decode');
  f.images.forEach(img=>img.resolveDecode());await ready;
  f.api.play(beat);
  assert.ok(f.w.document.querySelector('.bit-cutscene'));
  assert.equal(f.images.length,4,'no new warm image allocations');
  assert.ok(!f.w.document.querySelector('.bit-cutscene-from').classList.contains('art-pending'));
});
test('cold images and active voice never delay frame or readable copy',t => {
  const f=fixture(t); f.w.PR_AUDIO={voiceBusy:true}; f.api.play(beat);
  const el=f.w.document.querySelector('.bit-cutscene');
  assert.ok(el);assert.ok(el.classList.contains('line-visible'));assert.equal(el.querySelector('p').textContent,beat.line);
  assert.ok(el.querySelector('.bit-cutscene-from').src.endsWith('start.webp'),'dedicated art loads in place');
});
for(const event of [true,false]) test('overlay close resumes '+(event?'synchronously by event':'within one fallback frame'),t => {
  const f=fixture(t), overlay=f.w.document.createElement('div');overlay.id='overlay';f.w.document.body.append(overlay);
  f.api.play(beat);assert.equal(f.w.document.querySelector('.bit-cutscene'),null);
  overlay.remove();
  if(event) f.w.dispatchEvent(new f.w.Event('pr:ui-clear'));else f.tick(16);
  assert.ok(f.w.document.querySelector('.bit-cutscene'));
});
test('release evicts seen-only images and retains shared unseen busts',async t => {
  const f=fixture(t), second={...beat,id:'first_death',from:'sad.webp',to:'alive.webp'};
  const p=f.api.preload(beat), q=f.api.preload(second);
  f.images.forEach(img=>{img.onload();img.resolveDecode();});await Promise.all([p,q]);
  f.api.release(beat);const count=f.images.length;
  await f.api.preload(second);assert.equal(f.images.length,count);
  f.api.preload(beat);assert.equal(f.images.length,count+2,'only seen-exclusive backdrops were evicted');
});
