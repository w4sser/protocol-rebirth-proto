// Cinematic World Events: saved state, safe scene play, and main-loop integration.
const assert=require("assert"),fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const root=path.join(__dirname,"..");
const api=require("../ui/cinematic-world.js");
const day=api.DAY_MS;
{
  const s={introSeen:false};
  assert.equal(api.seen(s,"CIN-001"),false);
  assert.equal(api.markSeen(s,"CIN-001",100),true);
  assert.equal(api.markSeen(s,"CIN-001",200),false);
  assert.equal(s.cinematicEvents.seen["CIN-001"],100);
  const other={introSeen:true};
  assert.equal(api.seen(other,"CIN-001"),true,"veteran cold open auto archived");
  assert.equal(api.seen(other,"CIN-002"),false,"no leak between profiles");
}
{
  const t=Date.UTC(2026,10,14),s={introSeen:true};
  assert.equal(api.worldReady(s,t+30*day),false,"cannot advance without archipelago reveal");
  api.markSeen(s,"CIN-002",t);
  assert.equal(api.worldReady(s,t+4*day),false,"no world event same day");
  assert.equal(api.worldReady(s,t+5*day),true,"world beat persists after five days");
  assert.equal(api.markSeen(s,"CIN-003",t+5*day),true);
  assert.equal(s.cinematicEvents.world.listeningStationAwake,true,"persistent world consequence");
  assert.equal(api.worldReady(s,t+20*day),false,"not repeated");
}
{
  const dom=new JSDOM('<div id="phone"></div>',{url:"http://localhost/"});
  global.window=dom.window;global.document=dom.window.document;
  delete require.cache[require.resolve("../ui/cinematic-world.js")];
  const UI=require("../ui/cinematic-world.js");
  let seen=0,done=0;
  assert.equal(UI.play("CIN-002",{onSeen:()=>seen++,onDone:()=>done++}),true);
  assert.equal(UI.isPlaying(),true);
  assert.equal(document.querySelectorAll(".cine-shot").length,3);
  assert.equal(UI.play("CIN-003",{onSeen:()=>seen++}),false,"second scene cannot stack");
  const skip=document.querySelector(".cine-skip");
  skip.click();skip.click();
  assert.equal(UI.isPlaying(),false);
  assert.equal(seen,1);assert.equal(done,1);
  assert.equal(document.querySelector("#pr-cinematic"),null);
  assert.equal(UI.play("CIN-002",{replay:true,onSeen:()=>seen++,onDone:()=>done++}),true);
  document.querySelector(".cine-skip").click();
  assert.equal(seen,1,"replay grants no state");
  assert.equal(done,2);
  dom.window.close();delete global.window;delete global.document;
}
{
  const app=fs.readFileSync(root+"/app.js","utf8");
  const deploy=app.indexOf("deployNodeRaid(opts){");
  const commit=app.indexOf("gear.forEach(id => removeItem(id, 1))",deploy);
  const gate=app.indexOf("CIN-002",deploy);
  assert(gate>deploy&&gate<commit,"cinematic gate is before inventory is committed");
  assert(app.indexOf("CIN-001",app.indexOf("dismissIntro(){"))>0,"cold open archived after dismissal");
  assert(app.includes("CIN-003")&&app.includes("worldReady"),"world event can play at safe home");
}
console.log("cinematic-world.test: ok");
