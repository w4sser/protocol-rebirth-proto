const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const root = __dirname + "/..";
function fixture({ reduced = false, fail = false, stall = false } = {}){
  const w = new JSDOM('<body data-screen="base"><button id="before">Before</button></body>', {runScripts:"outside-only",url:"http://localhost/"}).window;
  let now = 0, id = 0; const jobs = new Map(), requests = [];
  w.setTimeout = (fn, ms) => { jobs.set(++id, { at:now + ms, fn }); return id; };
  w.clearTimeout = id => jobs.delete(id);
  w.matchMedia = query => ({matches:query.includes("reduced-motion") ? reduced : false});
  w.Image = class { set src(src){ requests.push(src); if(!stall) (fail ? this.onerror : this.onload)(); } };
  w.eval(fs.readFileSync(root + "/ui/bit-cutscene.js", "utf8"));
  async function tick(ms = 0){
    const end = now + ms;
    for(;;){
      const next = [...jobs].filter(([,j]) => j.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
      if(!next) break;
      const [id,j] = next; now = j.at; jobs.delete(id); j.fn();
      await Promise.resolve(); await Promise.resolve();
    }
    now = end; await Promise.resolve(); await Promise.resolve();
  }
  return {w, doc:w.document, api:w.PRBitCutscene, requests, tick};
}
const beat = {id:"core_restored",from:"start.webp",to:"end.webp",line:"Power is back."};
(async function(){
  {
    const {api,doc,tick,requests,w} = fixture(); let done = 0;
    doc.querySelector("#before").focus();
    assert.equal(requests.length,0,"no boot preloads");
    api.preload(beat); api.play({...beat,onDone:()=>done++}); api.play(beat);
    await tick();
    const el = doc.querySelector(".bit-cutscene");
    assert(el); assert.equal(requests.length,2,"preload pair reused");
    assert.equal(el.getAttribute("role"),"dialog");
    assert.equal(doc.activeElement,el.querySelector("button"),"continue receives focus");
    assert(!el.classList.contains("line-visible"));
    await tick(1499); assert(!el.classList.contains("hint-visible"));
    await tick(1); assert(el.classList.contains("hint-visible"));
    await tick(1649); assert(!el.classList.contains("crossfaded"));
    await tick(1); assert(el.classList.contains("crossfaded")); assert(el.classList.contains("line-visible"));
    await tick(3849); assert(!el.classList.contains("leaving"));
    await tick(1); assert(el.classList.contains("leaving"));
    await tick(350); assert(!api.isOpen()); assert.equal(done,1); assert.equal(doc.activeElement.id,"before");
    w.close();
  }
  for(const method of ["tap","escape","button"]){
    const {api,doc,tick,w} = fixture(); let done = 0;
    api.play({...beat,onDone:()=>done++}); await tick();
    const el = doc.querySelector(".bit-cutscene");
    if(method === "escape") el.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    else (method === "button" ? el.querySelector("button") : el).click();
    api.dismiss(); await tick(8000); assert.equal(done,1,"skip completes once"); assert(!api.isOpen()); w.close();
  }
  {
    const {api,doc,tick,w} = fixture({reduced:true});
    api.play(beat); await tick();
    const el = doc.querySelector(".bit-cutscene");
    assert(el.classList.contains("reduced")); assert(el.classList.contains("line-visible"));
    await tick(3150); assert(el.classList.contains("crossfaded"));
    api.dismiss(); assert(!api.isOpen(),"no closing animation for reduced motion"); w.close();
  }
  for(const options of [{fail:true},{stall:true}]){
    const {api,doc,tick,w} = fixture(options);
    api.play(beat); await tick(options.stall ? 3000 : 0);
    const el = doc.querySelector(".bit-cutscene");
    assert(el.classList.contains("line-visible"),"load failure immediately shows readable line");
    assert([...el.querySelectorAll("img")].every(i=>i.hidden),"no broken image icons");
    await tick(7350); assert(!api.isOpen(),"failed load still auto-ends"); w.close();
  }
  for(const block of ["intro","splash","overlay","homecoming","screen","voice","card","startup","settings","portrait"]){
    const {api,doc,tick,w} = fixture();
    const el = doc.createElement("div");
    if(block === "portrait") w.matchMedia = query => ({matches:query.includes("orientation")});
    if(block === "settings") el.id = "settings-menu";
    if(block === "intro") el.className = "intro";
    if(block === "splash") el.id = "splash";
    if(block === "overlay" || block === "homecoming") el.id = "overlay";
    if(block === "screen") doc.body.dataset.screen = "prep";
    if(block === "voice") w.PR_AUDIO = {voiceBusy:true};
    if(block === "card") w.PRBitCard = {isOpen:()=>true};
    if(block === "startup") doc.body.classList.add("startup-bunker-intro");
    doc.body.append(el); api.play(beat); await tick(500);
    assert(!doc.querySelector(".bit-cutscene"),"blocked by " + block);
    w.matchMedia = () => ({matches:false});
    el.remove(); doc.body.dataset.screen = "base"; doc.body.className = "";
    w.PR_AUDIO = {voiceBusy:false}; w.PRBitCard = {isOpen:()=>false};
    await tick(250); assert(doc.querySelector(".bit-cutscene"),"plays after " + block); w.close();
  }
  {
    const {api,doc,tick,w} = fixture(); let done = 0;
    api.play({...beat,onDone:()=>done++}); api.play({...beat,id:"second"}); await tick();
    api.dismiss(); await tick(350);
    assert.equal(doc.querySelector(".bit-cutscene").dataset.id,"second");
    assert.equal(done,1); w.close();
  }
  // A popup opened during slow loading must still defer presentation until it closes.
  {
    const {api,doc,tick,w} = fixture({stall:true});
    api.play(beat);
    const popup = doc.createElement("div"); popup.id = "overlay"; doc.body.append(popup);
    await tick(3000); assert(!doc.querySelector(".bit-cutscene"));
    popup.remove(); await tick(250); assert(doc.querySelector(".bit-cutscene")); w.close();
  }
  const app = fs.readFileSync(root + "/app.js","utf8");
  for(const file of app.matchAll(/assets\/production\/bit-narrator\/[^"']+\.webp/g)) assert(fs.existsSync(root + "/" + file[0]),file[0]);
  const css = fs.readFileSync(root + "/ui/bit-cutscene.css","utf8");
  assert(/z-index:80/.test(css),"rotation prompt and splash stay above cutscenes");
  assert(/object-fit:cover/.test(css)); assert(/inset:0/.test(css));
  assert(/reduced \.bit-cutscene-to[^}]+transition:none/.test(css),"reduced motion instant cut");
  assert(/reduced \.bit-cutscene-stage\{animation:none/.test(css));
  assert(!/PRBitCard\?\.show\(\{ id:"(?:core_restored|first_death)"/.test(app),"cutscene moments never also show cards");
  console.log("BIT CUTSCENE TESTS PASSED");
})().catch(e=>{console.error(e);process.exitCode=1;});
