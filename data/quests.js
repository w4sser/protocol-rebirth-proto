// v1.57 BIT Quests. Generated world facts (sampled from nodspel/levels.js generateLevel, 300 seeds per area/level):
// per area and level, enemy types present in >= 60 pct of layouts and items dropping in >= 20 pct of layouts,
// plus searchable house containers (Town only). nodspel/tests/quest-facts.test.mjs keeps these in sync with
// the core; the quest generator only builds quests from facts the player can currently reach.
window.DATA = window.DATA || {};
window.DATA.questFacts = {"bunker":{"1":{"enemies":["grunt"],"items":["cable","scrap_alloy"],"houses":0},"2":{"enemies":["grunt","sentry"],"items":["circuit_board","fuse","medkit","optical_sensor","polymer_plate","power_cell","power_relay","scrap_alloy","servo"],"houses":0},"3":{"enemies":["grunt","rusher","sentry"],"items":["power_relay"],"houses":0}},"archipelago":{"1":{"enemies":["grunt"],"items":[],"houses":0},"2":{"enemies":["grunt","rusher","sentry"],"items":["ai_fragment","circuit_board","fuse","medkit","optical_sensor","polymer_plate","power_cell","power_relay","servo"],"houses":0},"3":{"enemies":["grunt","rusher","sentry"],"items":["power_relay"],"houses":0}},"town":{"1":{"enemies":["grunt"],"items":["cable","medkit","polymer_plate","scrap_alloy"],"houses":3},"2":{"enemies":["grunt","sentry"],"items":["ai_fragment","cable","circuit_board","fuse","medkit","optical_sensor","polymer_plate","power_cell","power_relay","scrap_alloy","servo","smg_vector"],"houses":3},"3":{"enemies":["grunt","rusher","sentry"],"items":["ai_fragment","circuit_board","hydraulic_component","medkit","memory_module","power_relay"],"houses":3}}};
window.DATA.quests = {
  perDay: 3, freeSwapsPerDay: 1, bondXp: 12,
  // n ranges by difficulty tier (0 = just after FTUE, 1 = Core L2 or Archipelago open, 2 = Town open or Core L3)
  kill: { grunt: [[3,4],[4,6],[6,8]], sentry: [[1,1],[1,2],[2,3]], rusher: [[1,2],[2,3],[2,4]] },
  search: [[2,2],[2,3],[3,4]],
  extract: [[1,1],[1,1],[1,2]],
  // reward cards: pick 1 of 3. Two visible (scrap / component / operator XP), the third is the mystery box.
  reward: { scrap: [30,45,60], xp: [20,30,40],
    mystery: [ { tier:"common", w:30, scrap:15 }, { tier:"uncommon", w:35, scrap:30, items:1 },
               { tier:"rare", w:22, scrap:50, items:1, t2:true }, { tier:"epic", w:10, scrap:70, items:2, t2:true },
               { tier:"legendary", w:3, scrap:120, items:2, t2:true, dataCores:2 } ] },
  components: { t1: ["scrap_alloy","cable","fuse","polymer_plate","med_gel"], t2: ["servo","circuit_board","power_cell","optical_sensor"] },
  lines: {
    kill: "Those {type}s keep scratching at my sensors. {n}, please. Politely.",
    search: "Houses hide things. Search {n} containers in Town. I will hold the flashlight.",
    extract: "Bring me {n}x {item} from {area}. It is for science. And for us.",
    clear: "Clear {area} zone {level} and walk out alive. Alive is the important word.",
    done: "Quest done. Pick a reward. Choose wisely. Or randomly. I respect both.",
    swap: "Fine. New quest. I was bored of that one too.",
    none: "That is all for today. Rest. I will count the ceiling tiles."
  }
};
// v1.70 Quest chains (docs/design-retention-quests.md 1.3-1.4). Permanent, ordered, one active step per chain.
// Objectives only use raid result fields: area, outcome, levelsCleared, killsByType, extracted.
//  extract: extract in `area` (levelsCleared >= level - 1) with n of `item` (counts accumulate over raids)
//  clear:   extract from `area` with levelsCleared >= level, n times;  kill: n of `enemy` killed in `area`
//  handin:  deliver `items` from the stash through QUEST_HANDIN (n = total count)
// Rewards: scrap, xp (operator), items {id:n}, tools {id:n} (stash), dataCores, chips (Contract Chips, silent until the chip UI).
// `unlock` is data only for now (hard variant, recipe, cosmetic): nothing grants it yet.
// Proxies: shield guard -> clear Bunker L1; EMP on turret -> kill 1 sentry in Bunker; swarm L3 -> clear Bunker L3;
// patrol -> clear Archipelago L1 twice; Tidal Coil does not exist yet -> memory_module stands in for it (A5, A7).
window.DATA.questChains = {
  bunker: { name: "Wake the Core", steps: [
    { id:"B1", title:"Power Trace", area:"bunker", objective:{ type:"extract", item:"cable", level:1, n:3 }, reward:{ scrap:40, xp:20 } },
    { id:"B2", title:"Guard Duty", area:"bunker", objective:{ type:"clear", level:1, n:1 }, reward:{ tools:{ tool_decoy:2 } } },
    { id:"B3", title:"Spare Parts", area:"bunker", objective:{ type:"handin", items:{ scrap_alloy:2, polymer_plate:1 }, n:3 }, reward:{ chips:1 } },
    { id:"B4", title:"Fuse Box", area:"bunker", objective:{ type:"extract", item:"fuse", level:2, n:2 }, reward:{ scrap:60, unlock:{ recipe:"tool_emp" } } },
    { id:"B5", title:"Lights Out", area:"bunker", objective:{ type:"kill", enemy:"sentry", level:2, n:1 }, reward:{ items:{ power_cell:1 }, chips:1 } },
    { id:"B6", title:"Sentry Sweep", area:"bunker", objective:{ type:"kill", enemy:"sentry", n:3 }, reward:{ items:{ circuit_board:1 } } },
    { id:"B7", title:"Deep Relay", area:"bunker", objective:{ type:"extract", item:"power_relay", level:3, n:1 }, reward:{ chips:2, xp:30 } },
    { id:"B8", title:"Swarm Protocol", area:"bunker", objective:{ type:"clear", level:3, n:1 }, reward:{ unlock:{ hard:"bunker", cosmetic:"bit_bunker" } } }
  ] },
  archipelago: { name: "Signals at Sea", steps: [
    { id:"A1", title:"Landfall", area:"archipelago", objective:{ type:"clear", level:1, n:1 }, reward:{ scrap:50 } },
    { id:"A2", title:"Patrol Route", area:"archipelago", objective:{ type:"clear", level:1, n:2 }, reward:{ items:{ optical_sensor:1 } } },
    { id:"A3", title:"Salt Damage", area:"archipelago", objective:{ type:"extract", item:"servo", level:2, n:2 }, reward:{ chips:1, xp:30 } },
    { id:"A4", title:"Buoy Network", area:"archipelago", objective:{ type:"handin", items:{ transmitter:1 }, n:1 }, reward:{ chips:2 } },
    { id:"A5", title:"Ghost Signal", area:"archipelago", objective:{ type:"extract", item:"ai_fragment", n:1 }, reward:{ items:{ memory_module:1 } } },
    { id:"A6", title:"Rush Hour", area:"archipelago", objective:{ type:"kill", enemy:"rusher", n:4 }, reward:{ tools:{ tool_grenade:2 } } },
    { id:"A7", title:"Lighthouse", area:"archipelago", objective:{ type:"extract", level:3, n:1, item:"power_relay" }, reward:{ items:{ memory_module:2 }, dataCores:1 } },
    { id:"A8", title:"Storm Front", area:"archipelago", objective:{ type:"clear", level:3, n:1 }, reward:{ chips:3, unlock:{ recipe:"gull_drone", hard:"archipelago" } } }
  ] }
};
