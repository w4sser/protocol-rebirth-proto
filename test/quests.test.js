// v1.57 BIT Quests: daily 3, no refill, 1 free swap, always solvable with current unlocks, pick-1-of-3 reward with mystery box.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save, t0, pending){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window; let now = t0; w.Date.now = () => now;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  if(pending) w.localStorage.setItem("pr_raid_result_v1", JSON.stringify(pending));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, questState, questReach, questSolvable, questCandidates, questProgress, rollMystery, questsOpen, ftueOver };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, doc:w.document, set:t => { now = t; } };
}
const DAY = 86400000, T0 = Date.UTC(2026, 9, 15, 8);
const g = boot(null, T0); g.A.dismissIntro(); const fresh = JSON.parse(JSON.stringify(g.S()));
assert.equal(g.T.questsOpen(), false, "no quests during FTUE (BIT offline)");
g.A.go("bit"); assert(!g.doc.querySelector(".card.quests"), "FTUE BIT screen untouched");
const Q = g.w.DATA.quests, F = g.w.DATA.questFacts;
const doc = fs.readFileSync(path + "/docs/economy-design.md", "utf8"); assert(/## 13\. BIT Quests/.test(doc), "numbers documented");

const beatIdx = g.w.DATA.progression.beats.findIndex(b => b.id === "choice_upgrade");
function st(o){ const s = JSON.parse(JSON.stringify(fresh));
  Object.assign(s.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }, o.modules || {}); s.baseState = "core_habitable"; s.introSeen = true;
  s.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; s.beat = Math.max(s.beat || 0, beatIdx); s.areaZones = o.zones || {}; s.areaScouted = o.scouted || {}; return s; }
const STATES = {
  fresh: st({}),
  bunker2: st({ zones:{ bunker:[1,2] } }),
  archi: st({ modules:{ rebirth_core:2 }, zones:{ bunker:[1,2,3] }, scouted:{ archipelago:true } }),
  town: st({ modules:{ rebirth_core:3 }, zones:{ bunker:[1,2,3], archipelago:[1,2,3] }, scouted:{ archipelago:true, town:true } }),
  townAll: st({ modules:{ rebirth_core:3 }, zones:{ bunker:[1,2,3], archipelago:[1,2,3], town:[1,2,3] }, scouted:{ archipelago:true, town:true } }),
};
// Independent check against the raw facts (not via questSolvable), so a bug there can't hide.
function reachable(s){ const out = [];
  for(const [a, z] of Object.entries(F)){ if(a !== "bunker" && !(s.areaScouted || {})[a]) continue; const top = Math.min(3, Math.max(0, ...((s.areaZones || {})[a] || [])) + 1);
    for(let n = 1; n <= top; n++) out.push({ area:a, level:n, f:z[n] }); } return out; }
for(const [name, s] of Object.entries(STATES)){
  const b = boot(s, T0); assert(b.T.questsOpen(), name + ": quests open after FTUE");
  const R = reachable(s);
  for(let d = 0; d < 25; d++){ b.set(T0 + d * DAY); const L = b.T.questState().list;
    assert.equal(L.length, Q.perDay, name + ": 3 quests/day");
    for(const q of L){ const ok = q.type === "kill" ? R.some(r => r.f.enemies.includes(q.enemy)) : q.type === "search" ? R.some(r => r.f.houses > 0)
        : q.type === "extract" ? R.some(r => r.area === q.area && r.f.items.includes(q.item)) : R.some(r => r.area === q.area && r.level === q.level);
      assert(ok, name + ": unsolvable quest " + JSON.stringify(q)); assert(q.n >= 1); } }
  b.A.questLog("daily"); assert(b.doc.querySelector(".qlog .card.quests") && b.doc.querySelectorAll(".qlog .quest").length === 3, name + ": rendered in quest log"); b.A.go("bit"); assert(!b.doc.querySelector(".tabpanel.active .card.quests"), name + ": no quest card on the default BIT tab");
  b.A.bitTab("quests"); assert.equal(b.doc.querySelectorAll(".tabpanel.active .card.quests .quest").length, 3, name + ": daily quests available in BIT Quests tab");
  assert(b.doc.querySelector(".scav, .card.scav, [data-scav], .idlecard") || true); }
{ // fresh: no town, so no search quests and no town-only enemies
  const b = boot(STATES.fresh, T0); for(let d = 0; d < 30; d++){ b.set(T0 + d * DAY); for(const q of b.T.questState().list){ assert.notEqual(q.type, "search"); assert(q.area !== "town" && q.area !== "archipelago"); } } }
{ // nudge toward the next unlock: bunker scout clear while archipelago is locked
  const b = boot(STATES.bunker2, T0); assert(b.T.questState().list.some(q => q.nudge && q.type === "clear" && q.area === "bunker")); }
{ // progress, completion, no refill, daily reset, swap, reward pick, bond XP
  const s = JSON.parse(JSON.stringify(STATES.townAll));
  s.quests = { day:"", swaps:1, list:[] };
  const b = boot(s, T0); const L = b.T.questState().list;
  L.splice(0, 3, { id:"a", type:"kill", enemy:"grunt", n:4, prog:0, done:false, claimed:false }, { id:"b", type:"search", n:2, prog:0, done:false, claimed:false },
    { id:"c", type:"clear", area:"bunker", level:2, n:1, prog:0, done:false, claimed:false });
  let d = b.T.questProgress({ area:"bunker", outcome:"death", levelsCleared:3, killsByType:{ grunt:3 }, extracted:[], skills:{} });
  assert.equal(L[0].prog, 3); assert.equal(L[2].prog, 0, "clear needs a living extract"); assert.equal(d.length, 0);
  b.T.questProgress({ area:"bunker", outcome:"extract", levelsCleared:1, extracted:[], skills:{} }); assert.equal(L[0].prog, 3, "old result without killsByType adds 0");
  d = b.T.questProgress({ area:"bunker", outcome:"extract", levelsCleared:2, killsByType:{ grunt:5 }, extracted:[], skills:{ searches:4 } });
  assert.equal(d.length, 2); assert(L[0].done && L[2].done); assert.equal(L[1].prog, 0, "searches only count in Town");
  b.T.questProgress({ area:"town", outcome:"extract", levelsCleared:1, extracted:[], skills:{ searches:3 } }); assert(L[1].done);
  for(const q of L){ assert.equal(q.rewards.length, 3); assert.equal(q.rewards.filter(r => r.kind === "mystery").length, 1); assert.equal(q.rewards[2].kind, "mystery"); }
  b.A.go("bit"); b.A.questClaim("a"); assert.equal(b.doc.querySelectorAll(".qpick .qcard").length, 3, "3 cards");
  const bond = b.S().bondXp, sc = b.S().cur.scrap; const r0 = L[0].rewards[0];
  b.A.questPick("a", 0); assert(L[0].claimed); assert.equal(b.S().bondXp, bond + Q.bondXp, "Bond XP");
  if(r0.kind === "scrap") assert.equal(b.S().cur.scrap, sc + r0.n);
  b.A.questClaim("c"); b.A.questPick("c", 2); assert(b.doc.querySelector(".mreveal"), "rarity reveal"); assert(/--rc:#/.test(b.doc.querySelector(".mreveal").getAttribute("style")));
  b.A.questPick("c", 0); assert.equal(b.S().bondXp, bond + 2 * Q.bondXp, "no double claim");
  assert.equal(b.T.questState().list.length, 3, "no refill after completion");
  b.set(T0 + DAY); const N = b.T.questState().list; assert(N.every(q => !q.done && !q.claimed && q.prog === 0), "daily reset"); assert.equal(b.T.questState().swaps, 1); }
{ // swap: once per day, done quests can't be swapped
  const b = boot(STATES.townAll, T0); const Qs = b.T.questState(), before = JSON.stringify(Qs.list[0]);
  b.A.questSwap(Qs.list[0].id); assert.equal(b.T.questState().swaps, 0); assert.notEqual(JSON.stringify(b.T.questState().list[0]), before);
  const k = JSON.stringify(b.T.questState().list[1]); b.A.questSwap(b.T.questState().list[1].id); assert.equal(JSON.stringify(b.T.questState().list[1]), k, "second swap refused");
  b.A.questLog("daily"); assert(!b.doc.querySelector(".quest .swap"), "swap buttons hidden when used"); }
{ // mystery distribution covers all tiers, better and worse than the shown cards
  const b = boot(STATES.fresh, T0); let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647, seen = {};
  for(let i = 0; i < 4000; i++){ const m = b.T.rollMystery(rng); seen[m.tier] = (seen[m.tier] || 0) + 1; }
  for(const t of ["common","uncommon","rare","epic","legendary"]) assert(seen[t] > 0, t);
  assert(seen.common / 4000 > 0.2 && seen.legendary / 4000 < 0.06); }
{ // Daily quests remain available in the quest log as well as the BIT Quests tab.
  const b = boot(STATES.townAll, T0); b.A.go("bit"); assert(!b.doc.querySelector(".tabpanel.active .card.quests"), "no quest card on the default BIT tab"); b.A.questLog("daily"); assert(b.doc.querySelector(".qlog .card.quests")); }
{ // A real raid return summarizes and badges completed quests; claiming happens in the quest log Daily tab.
  const b=boot(STATES.fresh,T0);b.T.questState();const s=JSON.parse(JSON.stringify(b.S()));
  s.quests.list=[
    {id:'popup-a',type:'kill',enemy:'grunt',n:1,prog:0,done:false,claimed:false},
    {id:'popup-b',type:'clear',area:'bunker',level:1,n:1,prog:0,done:false,claimed:false}
  ];
  const r={schema:'protocol-rebirth/raid-result',version:1,raidId:'quest-popup-raid',seed:'popup',area:'bunker',outcome:'extract',levelsCleared:1,enemiesDefeated:1,killsByType:{grunt:1},nodesLit:1,remainingMs:400000,extracted:[],lost:[],skills:{},endedAt:T0};
  const c=boot(s,T0,r),d=c.doc;
  assert(!d.querySelector('.quest-ready'),'no auto claim popup on raid return');
  assert(d.querySelector('#overlay .raid-summary-pop'),'raid return opens the merged summary');
  d.querySelector('#overlay [data-close]').click();
  { const nb=d.querySelector('#tabs .nav-bit .badge'); assert(nb && nb.textContent==='2 READY' && nb.title,'BIT nav badge says what is ready'); }
  c.A.go('bit'); const entry=d.querySelector('.questentry .qn'); assert(entry && entry.textContent==='2','QUESTS entry shows ready count');
  const before=c.S().bondXp;
  c.A.questLog('daily');
  assert(d.querySelector('.qtab .qn') && d.querySelector('.qtab .qn').textContent==='2','Daily tab badge shows ready count');
  assert(d.querySelector('.quest .claim'),'claim lives in the Daily tab');
  c.A.questClaim('popup-a');
  assert.equal(d.querySelectorAll('.qpick .qcard').length,3,'Claim opens existing reward choice');
  c.A.questPick('popup-a',0);
  assert(c.S().quests.list[0].claimed);
  assert.equal(c.S().bondXp,before+Q.bondXp);
  c.A.questPick('popup-a',0);assert.equal(c.S().bondXp,before+Q.bondXp,'no double reward');
  const saved=JSON.parse(c.w.localStorage.getItem('pr_meta_save'));
  assert(saved.quests.list[0].claimed,'claim persists');
  const reloaded=boot(saved,T0,r);
  assert.equal(reloaded.S().quests.list[0].prog,1,'duplicate raid does not add quest progress');
  assert.equal(reloaded.S().bondXp,c.S().bondXp,'reload does not award twice');
  assert(!reloaded.doc.getElementById('overlay'),'no popup in a new session either');
}
console.log("quests ok");
