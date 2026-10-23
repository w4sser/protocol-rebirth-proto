// v1.79 T1-A: hand-in / quest-complete shows UNLOCKAR: payoff (Wake the Core B1–B8).
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, questUnlocksText, unlockBits, maybeShowHandIn, handInShow, chainActive, chainReady, HANDIN_MS, session };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document };
}
const g = boot(null); g.A.dismissIntro();
const fresh = JSON.parse(JSON.stringify(g.S()));
const open = JSON.parse(JSON.stringify(fresh));
Object.assign(open.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 });
open.baseState = "core_habitable"; open.introSeen = true;
open.roomUnlocks = { fabricator:true, storage:true, bit_bay:true };
open.beat = g.w.DATA.progression.beats.findIndex(b => b.id === "choice_upgrade");

// data: every Wake the Core step has unlocksText
const bunker = g.w.DATA.questChains.bunker.steps;
assert.equal(bunker.length, 8);
for(const s of bunker){
  assert(s.reward && typeof s.reward.unlocksText === "string" && s.reward.unlocksText.length > 4, s.id + " unlocksText");
  assert(!/\p{Extended_Pictographic}/u.test(s.reward.unlocksText), s.id + " no emoji in unlocksText");
}

// helper prefers unlocksText; fallback composes unlock + next title
{
  const T = boot(open).T;
  const b3 = bunker.find(s => s.id === "B3");
  assert.equal(T.questUnlocksText("bunker", b3), b3.reward.unlocksText);
  const bare = { id:"X", title:"X", reward:{ unlock:{ hard:"bunker", cosmetic:"bit_bunker" } } };
  // no next step in chain for fake id → only unlock bits
  const line = T.questUnlocksText("bunker", bare);
  assert(line.includes("Hard") && line.includes("BIT"), "fallback unlock bits: " + line);
  const a8 = g.w.DATA.questChains.archipelago.steps.find(s => s.id === "A8");
  const a8line = T.questUnlocksText("archipelago", a8);
  assert(a8line.includes("Hard") || a8line.includes("recipe") || a8line.includes("next"), "A8 composed: " + a8line);
}

// hand-in popup (B3): shared overlay, X top-left, UNLOCKAR primary, chips secondary, no emoji
{
  const b = boot(open), { A, T, d, S } = b;
  S().chains.bunker.step = 2; S().stash = { scrap_alloy:2, polymer_plate:1 }; S().fir = { scrap_alloy:2, polymer_plate:1 };
  A.go("base"); T.session.handInShown = {};
  assert(T.maybeShowHandIn());
  const ov = d.getElementById("overlay");
  const pop = d.querySelector("#overlay .handin");
  assert(pop && (pop.classList.contains("pop-card") || pop.closest(".pop-card, .bpop")), "shared popup");
  const x = d.querySelector("#overlay .pop-x[data-close]");
  assert(x, "close X");
  assert.equal(pop.firstElementChild.classList.contains("pop-x") || x === pop.querySelector(".pop-x") || ov.querySelector(".pop-frame > .pop-x"), true);
  const unlock = pop.querySelector(".hi-unlock");
  assert(unlock, "UNLOCKAR row");
  assert(unlock.textContent.startsWith("UNLOCKAR:"), unlock.textContent);
  assert(unlock.textContent.includes("Contract Chip") && unlock.textContent.includes("Fuse Box"), unlock.textContent);
  assert(pop.querySelector(".hi-rw"), "chips/XP secondary tiles still present");
  assert.equal(pop.querySelector("h1").textContent, "Spare Parts");
  assert(!/\p{Extended_Pictographic}/u.test(pop.textContent), "no emoji in hand-in popup");
  // extract-ready B1 also shows UNLOCKAR
  d.querySelector("#overlay .pop-x").click();
  S().chains.bunker.step = 0; S().chains.bunker.prog = 3; T.session.handInShown = {};
  assert(T.maybeShowHandIn());
  const u1 = d.querySelector("#overlay .hi-unlock");
  assert(u1 && u1.textContent.includes("Guard Duty"), u1 && u1.textContent);
  assert(d.querySelector("#overlay .handin[data-step='B1']"));
}

// handInDemo still works and shows UNLOCKAR
{
  const b = boot(open); b.A.handInDemo();
  const u = b.d.querySelector("#overlay .hi-unlock");
  assert(u && /UNLOCKAR:/.test(u.textContent) && /Fuse Box|Contract Chip/.test(u.textContent), u && u.textContent);
  b.d.querySelector("#overlay .pop-x").click();
  b.A.handInDemo("extract");
  assert(b.d.querySelector("#overlay .hi-unlock").textContent.includes("Guard Duty"));
}

console.log("T1-A UNLOCK PAYOFF PASSED");
