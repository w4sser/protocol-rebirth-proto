// Headless logic tests. Run: node test/logic.test.js (from prototype/)
global.window = {};
const P = __dirname + "/..";
for(const f of ["items","modules","bit","raid_zones","recipes","vendors","retention","progression"]) require(P+"/data/"+f+".js");
global.window.DATA = window.DATA;
const app = require(P+"/app.js");
const assert = require("assert");

let S = app.freshState(); app._setState(S);
assert.equal(S.cur.scrap, 20); assert.equal(S.v, 3);
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

// no economy values hardcoded in app.js
const src = require("fs").readFileSync(P+"/app.js","utf8");
for(const id of ["optical_sensor","power_cell","prewar_relic"])
  assert.equal((src.match(new RegExp('"'+id+'"',"g"))||[]).length, 0, id + " hardcoded");

console.log("ALL LOGIC TESTS PASSED");
