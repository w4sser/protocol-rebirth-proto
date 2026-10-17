// Protocol Rebirth prototype — module data.
window.DATA = window.DATA || {};
window.DATA.modules = [
  {
    id:"rebirth_core", name:"Rebirth Core", revealedAtCore:0, maxLevelByCore:{"0":1,"1":1,"2":2},
    blurb:"The facility's heart. Everything else waits for it.",
    benefit:"Power facility · Expose access doors",
    levels:[
      { level:1,
        cost:{ scrap:0, items:{ scrap_alloy:2 } },
        unlocks:["lights_on","reveal_modules"],
        unlockText:"Emergency power restored. The Core hall breathes again.",
        benefitText:"Facility powered — sealed room access can now be cleared in sequence.",
        preview:{ before:"A dead reactor ring. Severed cables. The whole facility is dark around it.",
                  after:["Lights and machinery come on in the Core hall","The Fabricator access door can now be cleared","The rebuild can begin"] },
        artBefore:"assets/production/core_dim.webp",
        artAfter:"assets/production/core_powered.webp",
        newGoal:"Bring the Fabricator online — secure Cable and Scrap Alloy for your Scavenger Vest." },
      { level:2,
        cost:{ scrap:120, items:{ power_relay:1, circuit_board:1, power_cell:1, ai_fragment:1 } },
        unlocks:["zone_transit","module_caps_2"],
        unlockText:"Sector B unlocked. BIT found a way into the Transit Hub.",
        benefitText:"New raid zone: Transit Hub. Higher module caps (BIT Bay L2, Fabricator L2).",
        preview:{ before:"The core runs at minimum output. Half the facility is still without power.",
                  after:["Power reaches a new bunker sector","Transit Hub raid zone unlocks","BIT Bay and Fabricator can reach L2"] },
        artBefore:"assets/production/core_dim.webp",
        artAfter:"assets/production/core_powered.webp",
        artAdd:"grid",
        newGoal:"A new zone is open. The good electronics are there." },
      // v1.44: Core L3 gives access to the Town (with a Town Survey scouting extract) and Storage L3.
      { level:3,
        cost:{ scrap:240, items:{ power_relay:2, memory_module:2, encrypted_drive:1 } },
        unlocks:["area_town_access","module_caps_3"],
        unlockText:"Full output. BIT can reach the long-range relay toward the Town.",
        benefitText:"Town access (scout it with a Town Survey from the Archipelago). Storage can reach L3.",
        preview:{ before:"Stable power, but the long-range relay is still dark.",
                  after:["Town area access on the world map","Storage can reach L3"] },
        artBefore:"assets/production/core_dim.webp",
        artAfter:"assets/production/core_powered.webp",
        artAdd:"grid",
        newGoal:"Scout the Town: extract a Town Survey from the Archipelago." }
    ]
  },
  {
    id:"fabricator", name:"Fabricator", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2,"3":2},
    blurb:"Turns junk into ammunition, meds and parts.",
    benefit:"Plan raids · Craft gear · Recycle junk",
    levels:[
      { level:1,
        cost:{ scrap:20, items:{ cable:2, scrap_alloy:2 } },
        commissioning:{scavenger_vest:1},
        unlocks:["recipes_basic","scrap_junk"],
        unlockText:"Fabricator online. Scavenger Vest assembled: +25 shield and +1 bag slot. Equipped on your next raid. Raid planning and crafting unlocked.",
        benefitText:"Scavenger Vest: +25 shield and +1 bag slot, ready for your next raid. Choose gear and craft supplies.",
        preview:{ before:"Broken assembly arms over a dead printer bed. No control panel.",
                  after:["Craft medkits and ammo packs","Recycle common junk into Scrap","Rebuild lost gear without the vendor markup"] },
        artBefore:"assets/production/fab_broken.webp",
        artAfter:"assets/production/fab_online.webp",
        newGoal:"Explore the Vault — its access is now available. Raid planning and field crafting are unlocked." },
      { level:2,
        cost:{ scrap:100, items:{ circuit_board:2, hydraulic_component:1 } },
        unlocks:["recipes_advanced"],
        unlockText:"Precision tooling online. Advanced recipes unlocked.",
        benefitText:"Advanced recipes: craft Power Relays and Purification Filters from parts.",
        preview:{ before:"The printer works, but precision assembly is still offline.",
                  after:["Precision arms come online","Craft Power Relays (needed for Core L2)","Craft Purification Filters"] },
        artAdd:"arm2",
        newGoal:"Craft a Power Relay for Core Level 2." }
    ]
  },
  {
    id:"bit_bay", name:"BIT Bay", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2,"3":2},
    blurb:"Where BIT lives, heals, and levels the bond.",
    benefit:"Loot intel · Recovery support",
    levels:[
      { level:1,
        cost:{ scrap:20, items:{ cable:2, polymer_plate:1 } },
        unlocks:["bit_online","loot_scan_1"],
        unlockText:"BIT is back online. One loot scan per raid. BIT is pleased. Statistically.",
        benefitText:"BIT adds one loot scan per raid and recommends where to search for tracked items.",
        preview:{ before:"A dark docking cradle. BIT sits in it, optics smashed, one LED blinking.",
                  after:["BIT comes online and follows you","+1 loot scan every raid","BIT recommends the best search route for tracked items"] },
        artBefore:"assets/production/bitbay_broken.webp",
        artAfter:"assets/production/bitbay_online.webp",
        newGoal:"Choose your path: Storage (less friction) or save for Core L2 (new zone)." },
      { level:2,
        cost:{ scrap:90, dataCores:6, items:{ memory_module:1, optical_sensor:1 } },
        unlocks:["bit_carry_1"],
        unlockText:"Cargo rack installed — BIT hauls one extra item home. Hardware, not sentiment.",
        benefitText:"BIT carries one extra item home from every successful extraction.",
        preview:{ before:"BIT flies fine but carries nothing. He finds this undignified.",
                  after:["Cargo rack appears on the dock","BIT hauls +1 item home per extraction"] },
        artAdd:"cargo",
        newGoal:"Keep feeding the bond. BIT remembers." }
    ]
  },
  {
    id:"storage", name:"Storage / Vault", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2,"3":3},
    blurb:"Stash space, loadout presets, one secure slot.",
    benefit:"+8 stash slots · Secure one item",
    levels:[
      { level:1,
        cost:{ scrap:50, items:{ polymer_plate:2, scrap_alloy:2 } },
        unlocks:["stash_plus_8","secure_slot"],
        unlockText:"Vault sealed. +8 stash slots and one secure slot — it survives your death.",
        benefitText:"+8 stash slots. One secure slot: that item survives your death.",
        preview:{ before:"A vault door hanging off its hinges. Containers looted and scattered.",
                  after:["Vault door seals","+8 stash slots","Secure slot: one chosen item survives death"] },
        artBefore:"assets/production/vault_broken.webp",
        artAfter:"assets/production/vault_sealed.webp",
        artAdd:"vault",
        newGoal:"Pick a secure item before your next raid. Choose like it matters." },
      { level:2,
        cost:{ scrap:120, items:{ polymer_plate:3, servo:2, hydraulic_component:1 } },
        unlocks:["raid_bag_plus_1"],
        unlockText:"Pack racks bolted in. You carry one more item out of every raid.",
        benefitText:"+1 raid bag slot.",
        preview:{ before:"Loose crates. You leave loot behind.", after:["Pack racks on the vault wall","+1 raid bag slot"] },
        artBefore:"assets/production/vault_sealed.webp", artAfter:"assets/production/vault_sealed.webp", artAdd:"vault",
        newGoal:"Fill the bigger bag. Then come home." },
      { level:3,
        cost:{ scrap:240, items:{ hydraulic_component:2, circuit_board:2, servo:2 } },
        unlocks:["raid_bag_plus_1"],
        unlockText:"Load-bearing harness rig. One more slot, every raid.",
        benefitText:"+1 raid bag slot.",
        preview:{ before:"The racks are full.", after:["Harness rig on the vault wall","+1 raid bag slot"] },
        artBefore:"assets/production/vault_sealed.webp", artAfter:"assets/production/vault_sealed.webp", artAdd:"vault",
        newGoal:"Bigger hauls. Bigger risks." }
    ]
  }
];

// Base stash capacity before Storage upgrades.
window.DATA.baseStashCapacity = 12;
window.DATA.storageBonus = 8;

// Facility layout (rows of rooms, top to bottom) and per-module art style.
window.DATA.baseLayout = [["rebirth_core"], ["fabricator", "bit_bay"], ["storage"]];
window.DATA.moduleArt = { rebirth_core:"core", fabricator:"fab", bit_bay:"bit", storage:"vault" };

// Panoramic bunker progression. Every coordinate is normalized against the full
// 1536×1024 plate, so artwork and controls share one camera transform.
window.DATA.baseMap = {
  world: { width:1536, height:1024, initialFocus:{ x:50, y:43 }, zoom:{min:1,max:2.4,wheel:.0015} },
  plates: [
    { stage:0, id:"found", art:"assets/production/bunker_plate_00_found.webp" },
    { stage:1, id:"fabricator", art:"assets/production/bunker_plate_01_fabricator.webp" },
    { stage:2, id:"vault", art:"assets/production/bunker_plate_02_vault.webp" },
    { stage:3, id:"bit_bay", art:"assets/production/bunker_plate_03_bit_bay.webp" },
    { stage:4, id:"living_quarters", art:"assets/production/bunker_plate_04_living_quarters.webp" }
  ],
  core: { x:50, y:39, label:"Rebirth Core / BIT", destination:"rebirth_core" },
  raidGate: { x:52, y:8, label:"Raid Exit" },
  rooms: [
    { id:"fabricator", label:"Fabricator", x:20, y:27, stage:1, destination:"fabricator",
      requirement:{ baseState:"core_habitable", text:"Restore power to the Rebirth Core" } },
    { id:"storage", label:"Vault", x:81, y:25, stage:2, destination:"storage",
      requirement:{ module:"fabricator", level:1, text:"Bring the Fabricator online" } },
    { id:"bit_bay", label:"BIT Bay", x:20, y:68, stage:3, destination:"bit_bay",
      requirement:{ module:"fabricator", level:1, text:"Bring the Fabricator online" } },
    { id:"living_quarters", label:"Living Quarters", x:80, y:69, stage:4,
      requirement:{ module:"bit_bay", level:1, text:"Bring BIT Bay online" } }
  ]
};

// Persistent power profile remains independent from which panoramic rooms have
// been excavated. Powering Core never substitutes an already-open plate.
window.DATA.baseStates = [
  { id:"core_found", label:"CORE FOUND", lighting:"emergency", audioProfile:"dormant_core",
    interactions:["rebirth_core"], navigation:["base"],
    transitions:[{ module:"rebirth_core", level:1, target:"core_habitable" }] },
  { id:"core_habitable", label:"CORE HABITABLE", lighting:"habitable", audioProfile:"powered_hub",
    interactions:["rebirth_core","fabricator","bit_bay","storage"],
    navigation:["base","stash","vendor","prep","end"],
    transitions:[{ target:"core_refined", modules:{ rebirth_core:1, fabricator:1, bit_bay:1, storage:1 } }] },
  { id:"core_refined", label:"REFINED", lighting:"refined", audioProfile:"refined_hub",
    interactions:["rebirth_core","fabricator","bit_bay","storage"],
    navigation:["base","stash","vendor","prep","end"], transitions:[] }
];

// Curated self-expression (cosmetic only, one room for now): pick a look for the BIT Bay.
window.DATA.styleOptions = {
  bit_bay: [
    { id:"warm",     name:"Cozy Tech",   desc:"Soft light, a rug, a kettle. BIT pretends not to like it.", art:"assets/production/bitbay_warm.webp" },
    { id:"military", name:"Disciplined", desc:"Everything labeled. Everything in rows. BIT salutes.",       art:"assets/production/bitbay_military.webp" },
    { id:"retro",    name:"Retro-Tech",  desc:"CRT glow and tape decks. BIT feels seen.",                   art:"assets/production/bitbay_retro.webp" }
  ]
};
// Where each room's chosen-style overlay sits on the hub image (% box: left,top,width).
window.DATA.styleOverlay = {
  bit_bay: { x:66, y:34, w:30 }
};

// Upgrade reward tiles (v1.66.0). Pure and data-driven: every tile is derived from what the level really grants
// (unlocks, commissioning gear + its stats, recipes gated on the level, tools unlocked by it, module cap raises).
// Each tile carries `source` so tests can prove nothing is promised that the data does not grant.
// Tile: { kind:"gear"|"stat"|"unlock", icon, value, label, source }. Returns [] for an unknown module/level.
window.DATA.upgradeRewardTiles = function(moduleId, level){
  var D = window.DATA, mod = (D.modules || []).filter(function(m){ return m.id === moduleId; })[0];
  var def = mod && mod.levels.filter(function(l){ return l.level === level; })[0];
  if(!def) return [];
  var items = {}; (D.items || []).forEach(function(i){ items[i.id] = i; });
  var tiles = [], has = function(u){ return (def.unlocks || []).indexOf(u) >= 0; };
  var add = function(kind, icon, value, label, source){ tiles.push({ kind:kind, icon:icon, value:value, label:label, source:source }); };
  Object.keys(def.commissioning || {}).forEach(function(id){
    var it = items[id]; if(!it) return;
    add("gear", it.icon, String(it.name).toUpperCase(), "ADDED TO STASH", "commissioning:" + id);
    if(it.stats && it.stats.shield) add("stat", "stat-shield", "+" + it.stats.shield, "SHIELD", "item:" + id + ":stats.shield");
    if(it.stats && it.stats.speed) add("stat", "stat-speed", "+" + it.stats.speed, "SPEED", "item:" + id + ":stats.speed");
    if(it.bagSlots) add("stat", "stat-bag", "+" + it.bagSlots + " SLOT" + (it.bagSlots > 1 ? "S" : ""), "BAG", "item:" + id + ":bagSlots");
  });
  if(has("lights_on")) add("unlock", "power", "POWER", "RESTORED", "unlock:lights_on");
  if(has("reveal_modules")) add("unlock", "unlock", "ROOMS", "ACCESS OPENED", "unlock:reveal_modules");
  if(has("zone_transit")){
    var z = (D.raidZones || []).filter(function(x){ return x.unlockedAtCore === level; })[0];
    if(z) add("unlock", "route", String(z.name).toUpperCase(), "NEW RAID ZONE", "unlock:zone_transit");
  }
  if(has("area_town_access")){
    var a = ((D.worldMap && D.worldMap.areas) || []).filter(function(x){ return x.requires && x.requires.core === level; })[0];
    if(a) add("unlock", a.iconId || "area-town", String(a.name).toUpperCase(), "AREA ACCESS", "unlock:area_town_access");
  }
  var capKey = (def.unlocks || []).map(function(u){ return /^module_caps_(\d+)$/.exec(u); }).filter(Boolean)[0];
  if(capKey){
    var n = (D.modules || []).filter(function(m){ var c = m.maxLevelByCore || {}; return (c[String(level)] || 0) > (c[String(level - 1)] || 0); }).length;
    if(n) add("unlock", "build", n + " ROOM" + (n > 1 ? "S" : ""), "HIGHER LEVEL CAP", "unlock:" + capKey[0]);
  }
  if(mod.id === "fabricator"){
    var rc = (D.recipes || []).filter(function(r){ return r.fabricatorLevel === level; }).length;
    if(rc) add("unlock", "build", rc + " RECIPE" + (rc > 1 ? "S" : ""), "CRAFTING", "recipes:" + level);
  }
  if(has("scrap_junk")) add("unlock", "restart", "SCRAP IT", "RECYCLE JUNK", "unlock:scrap_junk");
  (D.items || []).forEach(function(it){
    var u = it.tool && it.tool.unlock;
    if(u && u.module === moduleId && u.level === level) add("unlock", it.icon, String(it.name).toUpperCase(), "TOOL · 1 FREE", "tool:" + it.id);
  });
  if(has("bit_online")) add("unlock", "bit-face", "BIT", "ONLINE", "unlock:bit_online");
  if(has("loot_scan_1")) add("stat", "aim", "+1", "LOOT SCAN / RAID", "unlock:loot_scan_1");
  if(has("bit_carry_1")) add("stat", "item-crate", "+1", "BIT CARRY ITEM", "unlock:bit_carry_1");
  if(has("stash_plus_8")) add("stat", "item-crate", "+" + D.storageBonus, "STASH SLOTS", "unlock:stash_plus_8");
  if(has("secure_slot")) add("unlock", "lock", "1 SLOT", "SURVIVES DEATH", "unlock:secure_slot");
  if(has("raid_bag_plus_1")) add("stat", "stat-bag", "+1 SLOT", "RAID BAG", "unlock:raid_bag_plus_1");
  return tiles;
};
