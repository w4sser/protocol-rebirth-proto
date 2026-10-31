const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const setup = app.slice(app.indexOf("function setupSplash("), app.indexOf("/* ---------- init ---------- */"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function boot({seen=false, introSeen=true, reduced=false, blockedStorage=false}={}){
  const dom = new JSDOM(html, {url:"https://game.example/"});
  const { window } = dom, { document } = window;
  if(seen) window.sessionStorage.setItem("pr_splash_seen", seen === "stale" ? "1" : String(Date.now()));
  const storage = blockedStorage ? {getItem(){throw Error("denied");}} : window.sessionStorage;
  window.matchMedia = () => ({matches:reduced});
  let now=0, id=0;
  const tasks=new Map(), images=[];
  const later=(fn,delay) => {const key=++id;tasks.set(key,{fn,at:now+delay});return key;};
  class Picture{ constructor(){this.complete=false;images.push(this);} }
  new Function("document","window","sessionStorage","S","D","bunkerStage","Image","setTimeout","clearTimeout","lockLandscape","APP_VERSION",
    setup + ";setupSplash();")(
    document, window, storage, {introSeen}, {baseMap:{plates:[{art:"saved-stage.webp"}]}}, () => 0,
    Picture, later, key=>tasks.delete(key), ()=>{}, JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version);
  const tick = ms => {
    const until=now+ms;
    while(true){
      const next=[...tasks].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      now=next[1].at;tasks.delete(next[0]);next[1].fn();
    }
    now=until;
  };
  return {dom,document,window,images,tick,splash:()=>document.getElementById("splash"),
    ready:()=>images.forEach(i=>i.onload?.()),click:()=>document.getElementById("splash")?.click()};
}
{
  const t=boot();
  assert(t.document.body.classList.contains("splash-active"));
  t.click();t.tick(100);
  assert(!t.splash().classList.contains("descending"),"early tap waits for artwork");
  t.ready();
  assert(t.splash().classList.contains("descending"));
  t.tick(1450);
  assert(!t.splash(),"fallback unblocks play even without animationend");
  assert(!t.document.body.classList.contains("startup-descending"));
  assert(!t.document.body.classList.contains("splash-active"));
  t.dom.window.close();
}
{
  const t=boot({introSeen:false});t.ready();t.tick(1400);
  assert(t.splash().classList.contains("descending"),"automatic entry");
  assert(t.document.body.classList.contains("startup-bunker-intro"),"new player keeps BIT intro");
  t.click();assert(!t.splash(),"second tap skips movement immediately");
  t.tick(10000);assert(!t.document.body.classList.contains("splash-active"));
  t.dom.window.close();
}
{
  const t=boot({reduced:true});t.ready();t.click();
  assert(t.splash().classList.contains("out"));
  assert(!t.document.body.classList.contains("startup-descending"),"no camera movement for reduced motion");
  t.tick(200);assert(!t.splash());t.dom.window.close();
}
{
  const t=boot({seen:true});assert(!t.splash());
  assert.equal(t.images.length,0,"returning from raid never replays opening");t.dom.window.close();
}
{
  // v2.12.0: a legacy/stale mark (not a recent timestamp) no longer hides the start screen.
  const t=boot({seen:"stale"});assert(t.splash(),"stale seen mark still shows the start screen");t.dom.window.close();
}
{
  const t=boot({blockedStorage:true});
  t.document.getElementById("splash").dispatchEvent(new t.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  t.tick(2500);assert(t.splash().classList.contains("descending"),"missing image events time out and keyboard starts entry");
  t.tick(1450);assert(!t.splash());t.dom.window.close();
}
{
  const t=boot();t.ready();t.click();
  const ev=new t.window.Event("animationend");Object.defineProperty(ev,"animationName",{value:"surfaceDeparture"});
  t.document.querySelector(".splash-track").dispatchEvent(ev);
  assert(!t.splash(),"animation completion hands control to real screen");t.dom.window.close();
}
{
  const t=boot();Object.defineProperty(t.document,"hidden",{value:true});
  t.document.dispatchEvent(new t.window.Event("visibilitychange"));
  assert(!t.splash(),"backgrounding during loading cannot leave an input-blocking layer");
  t.tick(10000);assert(!t.document.body.classList.contains("splash-active"));t.dom.window.close();
}
console.log("SPLASH ENTRY PASSED (loading, automatic entry, tap/keyboard skip, reduced motion, repeat sessions, backgrounding)");
