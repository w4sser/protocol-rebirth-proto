// v1.70 quest chains: data validity, progress + auto turn-in, hand-in, tracking, v7 save migration.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, chainState, chainActive, trackedQuest, chainProgress, ingestRaidResult, ftueOver };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T };
}
const g = boot(null), C = g.w.DATA.questChains, ITEMS = g.w.DATA.items;
const ids = new Set();
for(const [cid, ch] of Object.entries(C)){
  assert.equal(ch.steps.length, 8, cid + ": 8 steps");
  for(const s of ch.steps){
    assert(typeof s.brief === 'string' && s.brief.length > 0 && s.brief.length <= 48 && !/[^\x20-\x7e]/.test(s.brief), cid + ' ' + s.id + ': plain brief <= 48 chars');
    assert(!ids.has(s.id), "unique id " + s.id); ids.add(s.id);
    assert(s.title && s.area && s.objective.n > 0 && ["extract","kill","clear","handin"].includes(s.objective.type), s.id + ": shape");
    const o = s.objective, all = [o.item].concat(Object.keys(o.items || {}), Object.keys(s.reward.items || {}), Object.keys(s.reward.tools || {})).filter(Boolean);
    for(const id of all) assert(ITEMS.some(i => i.id === id), s.id + ": item exists " + id);
  }
}
assert.equal(ids.size, 16);

// v7 save loads and migrates without losing anything
g.A.dismissIntro(); const fresh = JSON.parse(JSON.stringify(g.S()));
const v7 = JSON.parse(JSON.stringify(fresh)); v7.v = 7; delete v7.chains; delete v7.trackedQuest; delete v7.cur.chips; v7.cur.scrap = 77;
const m = boot(v7), s7 = m.S();
assert.equal(s7.v, 9); assert.deepEqual(s7.chains, {}); assert.equal(s7.trackedQuest, null); assert.equal(s7.cur.chips, 0); assert.equal(s7.cur.scrap, 77, "old data kept");

// state: after FTUE, bunker open, archipelago locked
const open = JSON.parse(JSON.stringify(fresh)); open.v = 8; open.cur.scrap = 0;
Object.assign(open.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); open.baseState = "core_habitable"; open.introSeen = true;
open.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; open.beat = g.w.DATA.progression.beats.findIndex(b => b.id === "choice_upgrade");
const b = boot(open), T = b.T, S = b.S;
assert(T.ftueOver(), "ftue over"); assert.equal(T.chainActive("bunker").id, "B1"); assert.equal(T.chainActive("archipelago"), null, "archipelago locked");
assert.equal(T.trackedQuest().chain, "bunker", "auto-tracks the first available chain"); assert.equal(T.trackedQuest().n, 3);
let n = 0; const raid = o => Object.assign({ schema:"protocol-rebirth/raid-result", version:1, raidId:"r" + (n++), outcome:"extract", area:"bunker", levelsCleared:1, extracted:[], lost:[], killsByType:{} }, o);
T.ingestRaidResult(raid({ extracted:["cable"] }));
assert.equal(T.trackedQuest().prog, 1); assert.equal(T.chainState("bunker").step, 0);
assert.equal(T.ingestRaidResult(raid({ outcome:"death", extracted:[], lost:["cable"] })).chainsDone.length, 0, "death never counts");
const sc = S().cur.scrap, r1 = T.ingestRaidResult(raid({ extracted:["cable","cable"] }));
assert.deepEqual(r1.chainsDone.map(c => c.id), ["B1"], "B1 turned in automatically");
assert.equal(T.chainState("bunker").step, 1); assert.equal(T.chainState("bunker").prog, 0);
assert(S().cur.scrap >= sc + 40, "B1 scrap granted"); assert.equal(T.trackedQuest().step.id, "B2", "keeps tracking the chain");
T.ingestRaidResult(raid({ levelsCleared:0, area:"bunker" })); assert.equal(T.chainActive("bunker").id, "B2", "uncleared level does not count");
T.ingestRaidResult(raid({})); assert.equal(S().stash.tool_decoy, 2, "B2 decoys granted"); assert.equal(T.chainActive("bunker").id, "B3");

// hand-in: needs the items, removes them, completes the step
assert.equal(T.trackedQuest().prog, 2, "start stash scrap alloy counts"); b.A.QUEST_HANDIN({ chain:"bunker" }); assert.equal(T.chainActive("bunker").id, "B3", "missing items: nothing happens");
S().stash.scrap_alloy = 5; S().stash.polymer_plate = 1;
assert.equal(T.trackedQuest().prog, 3); b.A.QUEST_HANDIN({ chain:"bunker" });
assert.equal(S().stash.scrap_alloy, 3, "2 removed"); assert(!S().stash.polymer_plate, "items removed"); assert.equal(S().cur.chips, 1); assert.equal(T.chainActive("bunker").id, "B4");

// tracking: archipelago opens, explicit track, finishing a chain moves on
S().debugAreas = true; assert.equal(T.chainActive("archipelago").id, "A1");
b.A.QUEST_TRACK({ chain:"archipelago" }); assert.equal(T.trackedQuest().chain, "archipelago");
b.A.QUEST_TRACK({ chain:"nope" }); assert.equal(T.trackedQuest().chain, "archipelago", "invalid track ignored");
S().chains.archipelago.step = 8; assert.equal(T.chainActive("archipelago"), null, "finished chain has no active step");
assert.equal(T.trackedQuest().chain, "bunker", "auto-tracks the next available chain");
S().chains.bunker.step = 8; assert.equal(T.trackedQuest(), null);
console.log("QUEST CHAINS TEST PASSED");
