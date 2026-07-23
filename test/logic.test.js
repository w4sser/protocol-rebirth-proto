// Headless logic tests. Run: node test/logic.test.js (from prototype/)
global.window = {};
const P = __dirname + "/..";
for(const f of ["items","modules","bit","raid_zones","recipes","vendors","retention","progression"]) require(P+"/data/"+f+".js");
global.window.DATA = window.DATA;
const app = require(P+"/app.js");
const assert = require("assert");

let S = app.freshState(); app._setState(S);
assert.equal(S.cur.scrap, 20); assert.equal(S.v, 5);
assert.equal(S.retentionMode, "core");

// scripted raid_1: forced extract + guaranteed drops
S.beat = 2;
for(let i=0;i<100;i++){
  const R = app.resolveRaid({zoneId:"industrial", riskId:"standard", insuranceId:"none", loadout:["basic_carbine"], trackedItemId:null});
  assert.equal(R.outcome, "extract"); assert(R.loot.includes("cable") && R.loot.includes("fuse"));
}
// aggressive risk can fail even in scripted beats
let died = 0;
for(let i=0;i<300;i++){ if(app.resolveRaid({zoneId:"industrial", riskId:"aggressive", insuranceId:"none", loadout:[], trackedItemId:null}).outcome==="death") died++; }
assert(died > 10, "aggressive can fail: " + died);

// tracked pity
S.beat = 6; S.trackedStreak = 1;
for(let i=0;i<50;i++) assert(app.resolveRaid({zoneId:"industrial", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:"optical_sensor"}).loot.includes("optical_sensor"), "pity");

// death economics: insurance, secure slot, never-regress
S = app.freshState(); app._setState(S);
S.beat = 6; S.modules.rebirth_core = 1; S.modules.storage = 1; S.secureItem = "medkit";
S.cur.salvage = 50; S.bondXp = 10; S.modules.bit_bay = 1;
const R = { cfg:{zoneId:"industrial", riskId:"standard", insuranceId:"basic",
  loadout:["basic_carbine","scavenger_vest","medkit"], trackedItemId:null},
  zone:"industrial", outcome:"death", loot:["cable","fuse"], salvage:20, dataCores:3, trackedFound:false };
app.applyRaidResult(R);
assert.equal(R.saved.insured.length, 1); assert.equal(R.saved.insured[0], "basic_carbine");
assert.equal(R.saved.secure, "medkit"); assert.equal(S.cur.salvage, 60); assert.equal(S.bondXp, 15);
assert(S.modules.rebirth_core === 1 && R.progress.length >= 2);

// --- routes shift the loot distribution without guaranteeing items ---
S = app.freshState(); app._setState(S); S.beat = 6;
function famCount(routeId, fam, n){
  let c = 0;
  for(let i=0;i<n;i++){
    const R = app.resolveRaid({zoneId:"industrial", routeId, riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null});
    for(const id of R.loot) if(window.DATA.items.find(x=>x.id===id).family === fam) c++;
  }
  return c;
}
const elControl = famCount("control", "electronics", 300);
const elTunnels = famCount("tunnels", "electronics", 300);
assert(elControl > elTunnels * 1.5, "control room must yield clearly more electronics ("+elControl+" vs "+elTunnels+")");

// best lead for optical sensor should be the control room
const lead = app.bestLead("optical_sensor");
assert.equal(lead.zone.id, "industrial"); assert.equal(lead.route.id, "control");
assert(["Low","Medium","High"].includes(lead.label), "qualitative label");

// decision never offered on forced FTUE beats
S.beat = 2;
for(let i=0;i<50;i++){
  const R = app.resolveRaid({zoneId:"industrial", routeId:"tunnels", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null});
  assert(!R.decision.eligible, "no decision during forced beats");
}
// decision offered on live raids when tracked item found
S.beat = 6;
let sawDecision = false;
for(let i=0;i<200 && !sawDecision;i++){
  const R = app.resolveRaid({zoneId:"industrial", routeId:"tunnels", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:"cable"});
  if(R.outcome === "extract" && R.trackedFound){ assert(R.decision.eligible, "tracked find must trigger decision"); sawDecision = true; }
}
assert(sawDecision, "never saw a tracked find in 200 raids?");

// push deeper: deterministic via stubbed rng
const origRnd = Math.random;
Math.random = () => 0.01;   // 0.01 < deathChanceAdd -> dies
let R2 = { cfg:{zoneId:"industrial", routeId:"reactor", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null},
  zone:"industrial", outcome:"extract", loot:["cable"], salvage:10, dataCores:2, trackedFound:false, decision:{eligible:true,resolved:false} };
let res = app.rollPushDeeper(R2);
assert(res.died && R2.outcome === "death" && R2.pushedAndDied, "push can kill");
Math.random = () => 0.5;    // survives -> extra rolls
let R3 = { cfg:{zoneId:"industrial", routeId:"reactor", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null},
  zone:"industrial", outcome:"extract", loot:["cable"], salvage:10, dataCores:2, trackedFound:false, decision:{eligible:true,resolved:false} };
res = app.rollPushDeeper(R3);
assert(!res.died && res.extra.length === window.DATA.raidConfig.pushDeeper.extraSlots && R3.loot.length === 3, "push adds loot");
Math.random = origRnd;

// no economy values hardcoded in app.js
const src = require("fs").readFileSync(P+"/app.js","utf8");
for(const id of ["optical_sensor","power_cell","prewar_relic"])
  assert.equal((src.match(new RegExp('"'+id+'"',"g"))||[]).length, 0, id + " hardcoded");

console.log("ALL LOGIC TESTS PASSED");
