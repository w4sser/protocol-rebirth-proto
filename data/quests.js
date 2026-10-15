// v1.57 BIT Quests. Generated world facts (sampled from nodspel/levels.js generateLevel, 300 seeds per area/level):
// per area and level, enemy types present in >= 60 pct of layouts and items dropping in >= 20 pct of layouts,
// plus searchable house containers (Town only). nodspel/tests/quest-facts.test.mjs keeps these in sync with
// the core; the quest generator only builds quests from facts the player can currently reach.
window.DATA = window.DATA || {};
window.DATA.questFacts = {"bunker":{"1":{"enemies":["grunt"],"items":["cable","power_cell"],"houses":0},"2":{"enemies":["grunt","sentry"],"items":["circuit_board","fuse","medkit","optical_sensor","polymer_plate","power_cell","power_relay","scrap_alloy","servo"],"houses":0},"3":{"enemies":["grunt","rusher","sentry"],"items":["power_relay"],"houses":0}},"archipelago":{"1":{"enemies":["grunt"],"items":[],"houses":0},"2":{"enemies":["grunt","rusher","sentry"],"items":["ai_fragment","circuit_board","fuse","medkit","optical_sensor","polymer_plate","power_cell","power_relay","servo"],"houses":0},"3":{"enemies":["grunt","rusher","sentry"],"items":["power_relay"],"houses":0}},"town":{"1":{"enemies":["grunt"],"items":["cable","medkit","polymer_plate","power_cell","scrap_alloy","servo"],"houses":3},"2":{"enemies":["grunt","sentry"],"items":["ai_fragment","cable","circuit_board","fuse","medkit","optical_sensor","polymer_plate","power_cell","power_relay","scrap_alloy","servo","smg_vector"],"houses":3},"3":{"enemies":["grunt","rusher","sentry"],"items":["ai_fragment","circuit_board","hydraulic_component","medkit","memory_module","power_relay"],"houses":3}}};
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
