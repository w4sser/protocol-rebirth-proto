import {ENEMY_TUNING,ENEMIES} from './enemies.js?v=2.21.1';
import {generateBigLevel} from './big-level.js?v=2.21.1';
import '../data/items.js?v=2.21.1';
import {clearPassageProps} from './archipelago-passages.js?v=2.21.1';
import {townizeLevel} from './town-layout.js?v=2.21.1';
import {applyEncounters} from './encounters.js?v=2.21.1';
import '../data/raid-combat.js?v=2.21.1';
// Seeded level design: dimensions, connections, cover and placement live here.
export const RULES=Object.freeze({
  shooting:globalThis.DATA.raidCombat,
  intro:{tip:'BIT: Aim at the cache guard and fire. Then grab the supplies and extract.',warningMs:1000,burstShots:3,burstIntervalMs:180,recoveryMs:1600,counterOnHit:false,graceMs:0,lane:2,startZ:3.2,coverZ:.7,coverSize:1.2,guardZ:-1.8,nodeX:1.8,nodeZ:.7,supplyX:1.3,supplyZ:-2.2,supplySpacing:.85,optionalX:3.6,optionalZ:-3.4,optionalItems:['cable','scrap_alloy']},
  // v1.67 first-upgrade payoff (meta sends ?payoff=kind once). loot_cluster: >= bag capacity pickups on free floor near spawn
  // (centred offsetZ from start toward the room, `spacing` apart, `margin` from walls, `clear` from solids/objectives, pickupRadius+`startClear` from the spawn so nothing is auto-collected at t=0).
  payoff:{loot_cluster:{count:6,offsetZ:-2.4,spacing:1.4,margin:1.3,clear:1.4,startClear:0.3,items:['cable','scrap_alloy','polymer_plate','cable','scrap_alloy','salvage_crate','polymer_plate','cable','scrap_alloy','salvage_crate'],source:'BIT · BAG CACHE',notice:'Bigger bag. Grab it all.'},
    free_tool:{notice:'Fresh tool. Use it.'}},
  levels:[
    {rooms:1,nodes:1,enemies:1,enemyHealth:2,size:{w:[12,15],d:[10,14]},passage:0,partition:false,deadEnd:false,enemySpeed:.8,enemyCooldownMs:2400,enemyDamage:10,enemyWindupMs:500,firstGraceMs:5000,title:'Control Room'},
    {rooms:2,nodes:2,enemies:2,enemyHealth:2,size:{w:[10,12],d:[10,12]},passage:1.8,partition:true,nodesBeyondPassage:true,deadEnd:false,enemySpeed:1.2,enemyCooldownMs:1400,title:'Narrow Passage'},
    {rooms:3,nodes:3,enemies:3,size:{w:[10,12],d:[10,12]},passage:2.2,partition:false,deadEnd:true,enemySpeed:2.2,enemySpawnZ:-4.1,enemyCooldownMs:1350,title:'Dead End'},
  ],
  // Encounters (docs/design-encounters-toolkit.md §1): one named problem per level, placed by encounters.js.
  // Every problem telegraphs >= telegraphMs (coral sight line / "!"), no single hit takes more than maxHitFraction
  // of max HP, and each has a tool solution AND a movement/timing solution. damagePct = share of max HP (area dmgMul scales it).
  // Combat pass (v1.84): levels[].enemies is still the base 1 / 2 / 3 (one per room) but AREA_RULES.extraEnemies adds seeded
  // regular bodies on top, so L1 reads simple (patrol + 1), L2 is denser with one problem, L3 has two problems and the most bodies.
  // The front-shield guard is a L2+ problem: L1 teaches a patrol (or the intro guard), never a shield.
  encounters:{
    maxHitFraction:.3,telegraphMs:1000,hintRange:9,
    // problems per area, indexed by level (L1 one, L2 one + regular enemies, L3 two)
    plan:{bunker:[['patrol'],['guard'],['swarm','shield']],archipelago:[['patrol'],['grenadier'],['swarm','shield']],town:[['patrol'],['turret'],['door','shield']]},
    // Core guard: stands by the node behind a front shield and turns slowly. Shots only count from behind / the side.
    guard:{health:2,speed:1.4,distance:2.1,frontHalfAngleDeg:70,fireHalfAngleDeg:55,turnRadPerSec:.7,warningMs:1000,burstShots:3,burstIntervalMs:180,recoveryMs:1600,damagePct:.1,counterOnHit:false},
    // Grenade thrower: stops ~5 m out, shows a coral ring on the floor where it will lob (warningMs >= 1 s), then the blast
    // lands fuseMs later. Same ring / fuse / reach as the player's Grenade (RULES.tools.defs.tool_grenade; a test pins them).
    // Solutions: kill or flank it before the lob (2 hp), or step out of the ring (2.2 s from first sign to blast).
    grenadier:{health:2,warningMs:1200,fuseMs:1000,radius:2,damagePct:.22,cooldownMs:3200,distance:6},
    // Turret behind cover: a sentry with long reach; a visible salvo, then a long recovery window to move in.
    turret:{health:2,lane:4.4,side:2.2,fireHalfAngleDeg:180,turnRadPerSec:6,warningMs:1100,burstShots:3,burstIntervalMs:200,recoveryMs:2600,damagePct:.12,counterOnHit:false},
    shield_turret:ENEMY_TUNING.shieldTurret,
    // Patrol: a fixed back-and-forth loop with a visible sight cone. Seen = a 1 s "!" before it reacts.
    patrol:{health:2,length:5,walkSpeed:1,turnRadPerSec:3,pauseMs:700,coneRange:5.2,coneHalfAngleDeg:35,bumpRadius:.9,alertMs:1000,windupMs:1000,damagePct:.14},
    // Swarm: rushers burst out of a spawn point when the player gets close (telegraph, then a short emergence pause).
    swarm:{count:[4,5],health:2,speed:3,triggerRadius:6.5,warnMs:1000,emergeMs:2000,ring:.9,minEntry:6,damagePct:.06,cooldownMs:1400,windupMs:500},
    // Shielded node: a generator close to the node keeps the shield up until shot (or EMP'd for a few seconds).
    shield:{health:2,distance:2.5},
    // Locked door in a corridor + a keycard in a crate; the longer side passage is always open.
    door:{reach:1.7,height:1.6,thickness:.3,passageWidth:2,passageOffset:3},
    hints:{shield_turret:ENEMIES.shield_turret.hint,guard:'GUARD · FLANK IT',grenadier:'THROWER · LEAVE THE RING',turret:'TURRET · MOVE WHILE IT RECOVERS',patrol:'PATROL · STAY OUT OF ITS CONE',swarm:'SWARM · FALL BACK TO A CORRIDOR',shield:'SHIELD · BREAK THE GENERATOR',door:'LOCKED · FIND THE KEYCARD'},
    names:{shield_turret:'SHIELD TURRET',guard:'GUARD',grenadier:'THROWER',turret:'TURRET',patrol:'PATROL',swarm:'RUSHER',generator:'GENERATOR'},
    // Result-screen tip: the tool that solves the problem that killed the player.
    tips:{shield_turret:{tool:'tool_emp',text:'flank the back or use an EMP to drop its blue shield.'},grunt:{tool:null,text:'step sideways out of the coral aim line before the shot. Circle behind for Flank damage.'},
      rusher:{tool:null,text:'sidestep the charge line. Lure the charger into a wall, then attack while it is stunned.'},
      sentry:{tool:null,text:'the laser locks before firing. Move out of its line or use low cover.'},
      thrower:{tool:null,text:'leave the coral ring before the grenade lands.'},
      'Cache guard':{tool:null,text:'move out of the coral line before the burst, then fire during recovery.'},
      guard:{tool:'tool_decoy',text:'a Decoy pulls the guard off the node. Or circle behind it: the shield only covers its front.'},
      grenadier:{tool:null,text:'the coral ring shows where the blast lands. Step out of it, or take the thrower down before it lobs.'},
      turret:{tool:'tool_emp',text:'an EMP shuts the turret down for 4 s. Or run between cover while it recovers.'},
      patrol:{tool:'tool_decoy',text:'a Decoy draws the patrol away. Or sneak up behind it, outside its cone.'},
      swarm:{tool:'tool_grenade',text:'a Grenade clears a swarm. Or fall back into a corridor so they queue up.'},
      shield:{tool:'tool_emp',text:'an EMP drops the node shield for 4 s. Or shoot the generator.'},
      door:{tool:null,text:'the keycard is in a crate, or take the longer side passage.'}}},
  // Hard variants (docs/design-retention-quests.md section 5). Unlock lives in meta (S.unlocks.hard[area] + Core L3); a Hard deploy
  // sends ?hard=1. Same layout pool, remixed with the seed prefix `hard^`. Multiplies the area rules, never loosens the telegraph rules:
  // warnings stay >= 1 s and no hit exceeds encounters.maxHitFraction (encounterDamage caps it).
  // plan = encounters per level (always 2+, L3 carries the elite guard); extraEnemies add to AREA_RULES.extraEnemies.
  // lootShift blends the next tier table in; coreAsh is added to the world loot weights per level (Core Ash: Hard-only drop).
  hard:{hpMul:1.4,dmgMul:1.2,timerMul:.8,extraEnemies:[1,1,2],lootShift:true,coreAsh:[0,1.5,3],
    plan:{bunker:[['patrol','grenadier'],['guard','turret'],['swarm','shield','guard']],
      archipelago:[['patrol','grenadier'],['turret','grenadier'],['swarm','shield','guard']],
      town:[['patrol','grenadier'],['turret','guard'],['door','shield','guard']]}},
  // v1.73 start room + layout pools. Level 1 (bunker) opens in a fixed hand-built pre-war control room where BIT wakes:
  // same geometry every raid, only the loot crate (3 spots) and the closet door (lockChance, keycard at `key`) vary.
  // The closet always holds the second crate; a locked door is optional, nodes and extract never sit behind it.
  startRoom:{x:0,z:0,w:13,d:12,name:'Control Room',crateSpots:[{x:-5.2,z:-4.4},{x:5.2,z:-4.4},{x:-5.2,z:1.8}],
    lockChance:.35,key:{x:-5,z:-.4},closet:{dir:{x:1,z:0},length:3.5,width:2}},
  // Layout pools (4-6 per level, hand-authored; picked from the raid seed by layoutIdFor). Offsets are relative to the room centre.
  // rooms[i]:{w,d}; spacing/dirs (level 3) shape the route; nodes/enemies/exit/loot place the objects.
  // An authored loot spot that is blocked falls back to the seeded free-floor search.
  layouts:[
    [{id:'a',nodes:[{x:2.5,z:.7}],enemies:[{x:-2.8,z:.7}],exit:{x:0,z:-2.9}},
     {id:'b',nodes:[{x:-2.5,z:.7}],enemies:[{x:2.8,z:.7}],exit:{x:0,z:-2.9}},
     {id:'c',nodes:[{x:2,z:.7}],enemies:[{x:-2.8,z:.7}],exit:{x:-2.8,z:-3.4}},
     {id:'d',nodes:[{x:-2.5,z:.7}],enemies:[{x:2.8,z:.7}],exit:{x:2.8,z:-3.4}},
     {id:'e',nodes:[{x:2.5,z:.7}],enemies:[{x:-2.8,z:.7}],exit:{x:0,z:-4.2}}],
    [{id:'a',rooms:[{w:12,d:12},{w:11,d:11}],spacing:[16],enemies:[{x:-3.8,z:-3.9},{x:3.3,z:1.1}],exit:{x:0,z:2.9},loot:[null,{x:-4,z:1.4},{x:4,z:1.4},{x:-3.4,z:-3.4},{x:0,z:1.2},{x:3.8,z:-3.4}]},
     {id:'b',rooms:[{w:12,d:12},{w:10,d:12}],spacing:[15],enemies:[{x:3.8,z:-3.9},{x:-3.3,z:1.1}],exit:{x:-1,z:2.9},loot:[null,{x:4,z:1.4},{x:-4,z:1.4},{x:3.4,z:-3.4},{x:-2.4,z:1.2},{x:-3.8,z:-3.4}]},
     {id:'c',rooms:[{w:11,d:12},{w:12,d:11}],spacing:[16.5],enemies:[{x:-3.9,z:-3.8},{x:3.6,z:1.5}],exit:{x:1,z:2.9},loot:[null,{x:-3.6,z:2.2},{x:3.6,z:2.2},{x:-4.2,z:-3.6},{x:2.4,z:1.2},{x:4.2,z:-3.6}]},
     {id:'d',rooms:[{w:12,d:12},{w:11,d:10}],spacing:[17],enemies:[{x:3.9,z:-3.8},{x:-3.5,z:1.3}],exit:{x:0,z:2.9},loot:[null,{x:0,z:1.4},{x:-4.6,z:1.4},{x:4,z:-3.6},{x:-1.8,z:1.2},{x:-4.2,z:-3.4}]},
     {id:'e',rooms:[{w:12,d:12},{w:12,d:11}],spacing:[15.5],enemies:[{x:-3.8,z:-3.9},{x:3.2,z:1.2}],exit:{x:-1,z:2.8},loot:[null,{x:3.6,z:1.6},{x:-3.6,z:1.6},{x:-3.8,z:-3.4},{x:1.8,z:1.2},{x:3.8,z:-3.4}]}],
    [{id:'a',rooms:[{w:11,d:11},{w:11,d:11},{w:11,d:11}],dirs:[{x:1,z:0},{x:0,z:-1}],spacing:[16,16],deadEnd:{dir:{x:-1,z:0},length:5},
      nodes:[{x:2.5,z:.6},{x:-2.5,z:-.6},{x:2.5,z:.8}],enemies:[{x:-3.2,z:-4.1},{x:3.2,z:-4.1},{x:-3.2,z:-4.1}],exit:{x:0,z:2.9},loot:[null,{x:-3.6,z:3.4},{x:3.6,z:3.4}]},
     {id:'b',rooms:[{w:12,d:10},{w:10,d:12},{w:12,d:12}],dirs:[{x:0,z:-1},{x:1,z:0}],spacing:[15,17],deadEnd:{dir:{x:1,z:0},length:4.5},
      nodes:[{x:-2.5,z:.8},{x:2.5,z:-.8},{x:-2.5,z:.6}],enemies:[{x:3.4,z:-3.8},{x:-3.4,z:-4},{x:3.4,z:-4.1}],exit:{x:1.5,z:2.6},loot:[null,{x:3.8,z:3.2},{x:-3.8,z:3.2}]},
     {id:'c',rooms:[{w:12,d:11},{w:11,d:11},{w:11,d:12}],dirs:[{x:-1,z:0},{x:0,z:-1}],spacing:[17,16],deadEnd:{dir:{x:1,z:0},length:5.5},
      nodes:[{x:2.5,z:-.8},{x:2.5,z:.8},{x:-2.5,z:-.6}],enemies:[{x:-3.1,z:-3.9},{x:3.1,z:-4.1},{x:-3.1,z:-4.1}],exit:{x:-1.5,z:2.6},loot:[null,{x:-3.4,z:3.2},{x:3.4,z:3.2}]},
     {id:'d',rooms:[{w:12,d:12},{w:11,d:10},{w:10,d:10}],dirs:[{x:0,z:1},{x:1,z:0}],spacing:[18,16],deadEnd:{dir:{x:-1,z:0},length:6},
      nodes:[{x:-2.5,z:-.5},{x:-2.5,z:.9},{x:2.5,z:-.9}],enemies:[{x:3.3,z:-4},{x:3.5,z:-3.9},{x:-3.3,z:-3.9}],exit:{x:0,z:2.4},loot:[null,{x:3.6,z:3.2},{x:-3.2,z:3}]},
     {id:'e',rooms:[{w:11,d:12},{w:12,d:11},{w:12,d:10}],dirs:[{x:1,z:0},{x:0,z:1}],spacing:[15,16],deadEnd:{dir:{x:-1,z:0},length:4},
      nodes:[{x:2.5,z:.9},{x:-2.5,z:-.9},{x:2.5,z:-.5}],enemies:[{x:-3.5,z:-4},{x:3.5,z:-4},{x:-3.5,z:-3.9}],exit:{x:-1,z:2.8},loot:[null,{x:-3.8,z:3.4},{x:3.8,z:3.2}]}]],
  roomNames:['Storage','Workshop','Hall'],
  choices:{shortLength:[2.4,3.4],signDistance:2.6,markedX:2.2,markedZ:-1.4},
  loadout:{health:100,ammo:Infinity},
  resources:{scavengeMs:8000,scavengeCoverReach:2,scavengeMovementTolerance:.015,levelTwoAmmoCrateRounds:6,ammoCrateRounds:4,nodeHoldMs:2000,nodeReach:1.8},
  rewards:{medkitHealth:30},
  directions:[{x:1,z:0},{x:-1,z:0},{x:0,z:-1},{x:0,z:1}],
  spacing:[15,18],startRoomOffset:[-.8,.8],deadEndLength:[4,6],wallThickness:.4,boxesPerRoom:2,
  start:{x:0,z:2.9},exit:{z:2.9,r:1},nodeSize:1.4,playerRadius:.36,
  // Loot ids are the base (meta) item ids. Weighted per level so every base repair part drops:
  // early parts on level 1, mid parts on level 2, rare parts deeper. salvage_crate/data_core turn into
  // Salvage/Data Cores in the base (item-sourced currency). See docs/meta-core-integration.md §8.
  // v1.64: fixed Scrap per cleared level (L1, L2, L3), paid on extract only; mirrors DATA.progression.extractScrapBonus.
  extractScrapBonus:[5,10,15],
  loot:{capacity:4,maxCapacity:10,counts:[2,6,3],
    types:['scrap_alloy','power_cell','cable','fuse','medkit','polymer_plate','servo','optical_sensor','circuit_board','salvage_crate','data_core','hydraulic_component','memory_module','transmitter','power_relay','ai_fragment','bio_sample','scout_rig','dampener_cloak','smg_vector','rifle_marksman','shotgun_breach','encrypted_drive','rebirth_shard','neural_core','archipelago_chart','town_survey','contract_chip','tidal_coil','frost_glass','core_ash'],
    weights:[
      {cable:4,scrap_alloy:4,polymer_plate:3,salvage_crate:4},
      {fuse:3,scrap_alloy:2,power_cell:2,polymer_plate:3,servo:3,optical_sensor:2,circuit_board:2,salvage_crate:4,data_core:2,cable:1,scout_rig:1,smg_vector:1,shotgun_breach:1,power_relay:2,ai_fragment:1},
      {salvage_crate:4,data_core:3,circuit_board:2,hydraulic_component:2,memory_module:2,optical_sensor:1,power_relay:3,ai_fragment:2,servo:1,polymer_plate:1,bio_sample:1,scout_rig:1,dampener_cloak:1,rifle_marksman:1,shotgun_breach:1,encrypted_drive:1,rebirth_shard:1,neural_core:1,contract_chip:.5,core_ash:.4}],
    pickupRadius:1.6},
  // Level variety (seeded from `${seed}:variety`, so base layouts are unchanged). Level 1 stays gentle: grunts only, no hazards.
  enemyTypes:{
    grunt:{speedMul:1,rangeMul:1,cooldownMul:1,standoff:3.5,color:'#a67072'},
    rusher:{speedMul:1.6,rangeMul:.6,cooldownMul:.8,standoff:1.2,color:'#e0904a'},
    sentry:{speedMul:0,rangeMul:1.35,cooldownMul:1.3,standoff:0,color:'#5d8fd6'},
    thrower:{speedMul:.9,rangeMul:.85,cooldownMul:1,standoff:5,color:'#d8664f'}},
  variety:[
    {mix:{grunt:1},hazards:0,shieldedNodes:0,theme:{floor:'#444f59',trim:'#6c7882'}},
    {mix:{grunt:.55,sentry:.3,thrower:.15},hazards:1,hazardDps:8,shieldedNodes:0,theme:{floor:'#4b4a3f',trim:'#8a8566'}},
    {mix:{grunt:.35,rusher:.3,sentry:.2,thrower:.15},hazards:2,hazardDps:12,shieldedNodes:1,theme:{floor:'#3f3f52',trim:'#7c6fa8'}}],
  // Player stats. Meta computes them (skills + gear, data/progression.js) and passes ?stats=; core clamps again.
  // Without launch params (standalone) the new-player base applies: slower than before (3.6 vs 4.5 m/s).
  playerStats:{base:{speed:3.6,stealth:0,maxHealth:100,dashCooldownMs:2500,searchMult:1,shield:0},
    clamp:{speed:[2.5,6],stealth:[0,.6],maxHealth:[50,200],dashCooldownMs:[1500,6000],searchMult:[.6,1],shield:[0,100]},
    gear:['scavenger_vest','scout_rig','dampener_cloak','smg_vector','rifle_marksman','shotgun_breach']},
  // Weapon launch params (?w=) are clamped to these ranges; missing keys fall back to RULES.weapon (Basic).
  weaponIds:['basic_carbine','smg_vector','rifle_marksman','shotgun_breach'],
  weaponClamp:{damage:[1,4],capacity:[1,12],reloadMs:[250,1600],shotIntervalMs:[80,1000],range:[3,12],coneHalfAngleDegrees:[3,25],assistAngleDegrees:[4,30],spreadDegrees:[0,12],knockback:[0,2],pellets:[1,9],homingDegreesPerSecond:[0,240]},
  kitMax:{medkit:2},
  // v2.0 weapon backpack (docs/design-playtest-oct25.md §c): small fixed capacity, separate from the bag's
  // material slots and not affected by armor's bagSlots stat. Full capacity -> explicit swap-or-leave choice.
  backpack:{capacity:2},
  // Toolkit (?tool=id:n). ids/charges must match data/items.js (tool_*); a test cross-checks them.
  // throwRange: auto-aim radius and max arc distance; forward: where a tap lands with no target in range.
  tools:{throwRange:6,forward:4,lureStopDistance:.8,dragPx:90,
    defs:{
      tool_grenade:{kind:'grenade',label:'Grenade',charges:2,fuseMs:1000,radius:2,damage:3},
      tool_emp:{kind:'emp',label:'EMP',charges:1,radius:3,stunMs:4000,stunTypes:['sentry','turret']},
      tool_decoy:{kind:'decoy',label:'Decoy',charges:2,radius:6,lureMs:5000}}},
  hazard:{size:1.8,onMs:1500,offMs:2500,warnMs:1200,damagePerSecond:12,clearance:2.2},
  // v2.6.0 combat feel (docs/design-combat-feel-oct28.md §2.1/2.2/2.4.1): kill confirmation, hitstop and dodge i-frames.
  feedback:{hitFlashMs:240,damageNumberMs:700,meshFlashMs:80,deathAnimMs:350,killMarkerMs:300,muzzleFlashMs:50,muzzleOffset:.88,recoilMs:60,recoilDistance:.08,firePulseMs:120,hapticShotMs:12,hapticKillMs:25,roomClearMs:1000,
    burst:{particles:12,size:.08,speed:2.5,lifeSeconds:.5,lift:1.8,gravity:6},cameraShake:{hit:{distance:.05,ms:80},kill:{distance:.12,ms:150},playerDamage:{distance:.15,ms:200}}},
  // Perk picker waits killDelayMs after the last kill in the room, and safePick() must stay true for calmMs straight
  // before the picker opens (the raid timer keeps running during this wait; see perks.js pickReady()).
  perkPick:{killDelayMs:1000,calmMs:600},
  // Hitstop: a brief freeze of the paused game clock (perks.js hitstop()), not a second clock. Kill confirmation.
  hitstop:{hitMs:40,killMs:90,lastKillMs:140},
  dash:{distance:4.8,durationSeconds:.22,cooldownMs:2500,iframeMs:150},
  bit:{healPerSecond:5,followDistance:1.6,followSpeed:7,radius:.18},
  killReward:{ammo:1,health:12},enemyHealth:3,combat:{detectRange:10,range:7,cooldownMs:1400,damage:22,bulletSpeed:9,graceMs:3000,standoff:3.5},
  aimControls:{deadZonePx:20,responseSeconds:.06,maxTurnRadiansPerSecond:12,stickRadiusPx:48,tapMs:200,zoneFraction:.45},
  weapon:{coneHalfAngleDegrees:8,range:7,damage:1,capacity:3,reloadMs:700,shotIntervalMs:180,bulletSpeed:19,shotRadius:.32,enemyHitboxMargin:globalThis.DATA.raidCombat.enemyHitboxMargin,nearMissRadius:globalThis.DATA.raidCombat.nearMissRadius,assistAngleDegrees:12,assistWidth:1.1,assistStrength:.65,knockback:0,pellets:1,homingDegreesPerSecond:90,homingAngleDegrees:20},
});
// Pure function of (seed, level): which hand-authored layout of the level's pool a raid uses.
export function layoutFor(seed,number){const pool=RULES.layouts[number-1];return pool[Math.floor(randomFromSeed(`${seed}:layout:${number}`)()*pool.length)];}
export const layoutIdFor=(seed,number)=>layoutFor(seed,number).id;
const round2=v=>Math.round(v*100)/100;
export function totalNodes(){return RULES.levels.reduce((sum,level)=>sum+level.nodes,0);}
export function randomFromSeed(seed){
  let state=2166136261;
  for(const c of String(seed))state=Math.imul(state^c.charCodeAt(0),16777619);
  return ()=>{state+=0x6D2B79F5;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}
const opposite=d=>({x:-d.x,z:-d.z});
const equal=(a,b)=>a.x===b.x&&a.z===b.z;
export function extractScrapBonus(levelsCleared){const B=RULES.extractScrapBonus,n=Math.max(0,Math.min(B.length,Math.floor(Number(levelsCleared)||0)));return B.slice(0,n).reduce((a,b)=>a+b,0);}
export function pickWeighted(weights,roll){
  const entries=Object.entries(weights),total=entries.reduce((s,[,w])=>s+w,0);
  let r=roll*total;for(const [id,w] of entries){r-=w;if(r<0)return id;}
  return entries.at(-1)[0];
}
// House containers (Town): medicine cabinet = medkit; the crate is the guaranteed Core-upgrade path
// (level 3: always a power relay, level 2: 40 %), the rest roll from the level table.
export const HOUSE_LOOT={crateRelay:[0,.4,1]};
export function houseItem(kind,number,roll,area='town'){if(kind==='medicine_cabinet')return 'medkit';
  if(kind==='loot_crate'&&roll<HOUSE_LOOT.crateRelay[number-1])return 'power_relay';
  return pickWeighted(areaTable(area,number,'house'),kind==='loot_crate'?(roll-HOUSE_LOOT.crateRelay[number-1])/(1-HOUSE_LOOT.crateRelay[number-1]||1):roll);}
// v1.75 area materials: extra weights merged into the level table (index = level - 1). `world` = floor loot boxes,
// `house` = Town house containers. Frost Glass is house-only; Core Ash (level table, any area) waits for Hard variants.
export const AREA_LOOT={archipelago:{world:[{},{tidal_coil:5},{tidal_coil:10}]},town:{house:[{},{frost_glass:8},{frost_glass:10}]}};
export function areaTable(area,number,where){return{...RULES.loot.weights[number-1],...AREA_LOOT[area]?.[where]?.[number-1]};}
let QUEST_LOOT=null;
export function setQuestLoot(q){QUEST_LOOT=q&&RULES.loot.types.includes(q.item)&&Number.isInteger(q.level)?{item:q.item,level:q.level,source:globalThis.DATA.items.find(i=>i.id===q.item)?.raidSource}:null;}
let AREA='bunker';
export const AREAS=['bunker','archipelago','town'];
// v1.44 area progression (docs/meta-core-integration.md §12). Order Bunker -> Archipelago -> Town.
// hpMul/dmgMul scale enemies (rounded), extraEnemies adds seeded enemies per level, mix overrides the
// enemy-type mix, lootFrom blends the next level's table in (more T2), scout = guaranteed map item that
// unlocks the next area in meta when extracted. Level index = zone (1..3).
export const AREA_RULES={
  bunker:{hpMul:1,dmgMul:1,extraEnemies:[1,2,3],scout:{level:3,item:'archipelago_chart'}},
  archipelago:{hpMul:1.25,dmgMul:1.15,extraEnemies:[1,2,4],sizeMul:1.25,lootNext:true,
    mix:[{grunt:.7,rusher:.3},{rusher:.4,sentry:.4,thrower:.2},{grunt:.3,rusher:.3,sentry:.2,thrower:.2}],scout:{level:3,item:'town_survey'}},
  town:{hpMul:1.4,dmgMul:1.25,extraEnemies:[1,3,4]}};
export function setArea(a){AREA=AREAS.includes(a)?a:'bunker';return AREA;}
// Hard variant (RULES.hard): a module flag like the area, set once per raid from ?hard=1.
let HARD=false;
export function setHard(on){HARD=!!on;return HARD;}
export const isHard=()=>HARD;
// Area rules with the Hard multipliers on top (hp / damage multiply, extra enemies add).
export function ruleSet(area,hard){const AR=AREA_RULES[area]??AREA_RULES.bunker;if(!hard)return AR;const H=RULES.hard;
  return {...AR,hpMul:AR.hpMul*H.hpMul,dmgMul:AR.dmgMul*H.dmgMul,extraEnemies:(AR.extraEnemies??[0,0,0]).map((v,i)=>v+H.extraEnemies[i])};}
let BIG_LEVELS=false;
export function setLevelMode(mode){BIG_LEVELS=mode==='big';}
export function generateLevel(number,roundSeed,area=AREA,hard=HARD,big=BIG_LEVELS,layoutOverride=null){
  if(big)return generateBigLevel(roundSeed,area);
  const base=RULES.levels[number-1];if(!base)throw new RangeError('Level must be 1, 2 or 3.');
  const AR=ruleSet(area,hard),sm=AR.sizeMul??1;
  if(hard)roundSeed=`hard^${roundSeed}`;
  const rule=sm===1?base:{...base,size:{w:base.size.w.map(v=>v*sm),d:base.size.d.map(v=>v*sm)}},spacingR=RULES.spacing.map(v=>v*sm);
  const seed=`${roundSeed}:${number}`,rng=randomFromSeed(seed);
  const suffix=String(roundSeed).match(/-(\d+)$/),choiceRng=randomFromSeed(`${roundSeed}:choices`);
  const shortSide=suffix?(Number(suffix[1])%2?-1:1):(choiceRng()<.5?-1:1);
  const between=(a,b)=>Math.round((a+rng()*(b-a))*100)/100;
  const pick=items=>items[Math.floor(rng()*items.length)];
  const rooms=[],floors=[],walls=[],boxes=[],nodes=[],enemies=[],corridors=[],deadEnds=[];
  // v1.73: Level 1 of the bunker opens in the fixed control room; every level draws its layout from a seeded pool.
  const lay=layoutOverride??layoutFor(roundSeed,number),SR=number===1&&area==='bunker'?RULES.startRoom:null,srRng=randomFromSeed(`${roundSeed}:startroom`);
  // v2.1.2: archipelago passage openings read .6 wider than their base rule.passage so the
  // chunky boulder clusters either side have room to sit clear of the walkable gap.
  const t=RULES.wallThickness,door=(SR?SR.closet.width:rule.passage)+(area==='archipelago'?.6:0),closets=[];
  for(let i=0;i<rule.rooms;i++){
    const ar=lay.rooms?.[i],room={x:between(...RULES.startRoomOffset),z:between(...RULES.startRoomOffset),w:ar?ar.w*sm:between(...rule.size.w),d:ar?ar.d*sm:between(...rule.size.d),name:RULES.roomNames[i],doors:[]};
    if(SR&&i===0)Object.assign(room,{x:SR.x,z:SR.z,w:SR.w,d:SR.d,name:SR.name});
    if(i){
      const prev=rooms[i-1];
      const choices=RULES.directions.filter(dir=>!equal(dir,prev.incoming??{x:0,z:1}));
      const dir=number===2?{x:-shortSide,z:0}:lay.dirs?.[i-1]??pick(choices),spacing=lay.spacing?.[i-1]!=null?lay.spacing[i-1]*sm:between(...spacingR);
      room.x=prev.x+dir.x*spacing;room.z=prev.z+dir.z*spacing;
      prev.doors.push(dir);room.incoming=opposite(dir);room.doors.push(room.incoming);
      const a={x:prev.x+dir.x*prev.w/2,z:prev.z+dir.z*prev.d/2};
      const b={x:room.x-dir.x*room.w/2,z:room.z-dir.z*room.d/2};
      corridors.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:dir.x?Math.abs(b.x-a.x):door,d:dir.z?Math.abs(b.z-a.z):door,width:door,dir});
    }
    rooms.push(room);floors.push({...room});
  }
  // A branch off room 0 that ends in a wall: the level-3 wrong turn, the level-2 side route and the control room closet.
  const addBranch=(room,dir,length,list)=>{
    room.doors.push(dir);
    const edge={x:room.x+dir.x*room.w/2,z:room.z+dir.z*room.d/2};
    const branch={x:edge.x+dir.x*length/2,z:edge.z+dir.z*length/2,w:dir.x?length:door,d:dir.z?length:door,width:door,length,connections:1,roomIndex:0,dir,end:{x:edge.x+dir.x*(length-.8),z:edge.z+dir.z*(length-.8)}};
    list.push(branch);
    walls.push({x:edge.x+dir.x*(length-t/2),z:edge.z+dir.z*(length-t/2),w:dir.x?t:door,d:dir.z?t:door,h:.9});
    return branch;
  };
  if(rule.deadEnd||number===2){
    const room=rooms[0],free=d=>d.z===0&&!room.doors.some(p=>equal(p,d)),authored=lay.deadEnd&&free(lay.deadEnd.dir)?lay.deadEnd:null;
    const dir=number===2?{x:shortSide,z:0}:authored?authored.dir:pick(RULES.directions.filter(free));
    addBranch(room,dir,authored?.length??between(...(number===2?RULES.choices.shortLength:RULES.deadEndLength)),deadEnds);
  }
  if(SR)addBranch(rooms[0],SR.closet.dir,SR.closet.length,closets);
  for(const corridor of [...corridors,...deadEnds,...closets]){
    // Overlap the seam slightly: rounded centers and dimensions must never
    // produce a floating-point crack between room and corridor footprints.
    floors.push({...corridor,w:corridor.w+(corridor.dir.x?.08:0),d:corridor.d+(corridor.dir.z?.08:0)});
    // Side walls run exactly room-edge to room-edge, flush with the room's own doorway walls but
    // not overlapping them, which leaves a wallThickness-square gap at each corner (the room wall
    // ends at the edge; the corridor wall starts there but never covers the room-side sliver).
    // Extend the room end(s) by `t` to close it. A corridor joins a room at both ends; a branch
    // (dead end / closet, identified by its `end` field) only at its room end - the far end is
    // already sealed by its own cap wall in addBranch, so padding it further would poke past the cap.
    const pad=corridor.end?t:2*t,shift=corridor.end?t/2:0;
    const cx=corridor.x-corridor.dir.x*shift,cz=corridor.z-corridor.dir.z*shift;
    for(const sign of [-1,1])walls.push({x:cx+(corridor.dir.z?sign*(door/2-t/2):0),z:cz+(corridor.dir.x?sign*(door/2-t/2):0),w:corridor.dir.x?corridor.w+pad:t,d:corridor.dir.z?corridor.d+pad:t,h:.85});
  }
  for(let i=0;i<rooms.length;i++){
    const room=rooms[i],{x,z,w,d}=room;
    for(const dir of RULES.directions){
      const isX=dir.x!==0,length=isX?d:w;
      const edge={x:x+dir.x*(w/2-t/2),z:z+dir.z*(d/2-t/2)};
      const opening=room.doors.some(p=>equal(p,dir));
      if(!opening)walls.push({...edge,w:isX?t:w,d:isX?d:t,h:dir.z>0?.65:1.15});
      else for(const sign of [-1,1])walls.push({x:edge.x+(isX?0:sign*(length+door)/4),z:edge.z+(isX?sign*(length+door)/4:0),w:isX?t:(length-door)/2,d:isX?(length-door)/2:t,h:.85});
    }
    const side=rng()<.5?1:-1;
    if(rule.partition){
      // The doorway is on one side; the node is behind the solid opposite side.
      const gap=side*(w/2-1.5),gapWidth=1.8+(area==='archipelago'?.6:0),left=-w/2,right=w/2;
      room.partition={x:x+gap,z:z-.8};
      for(const [lo,hi] of [[left,gap-gapWidth/2],[gap+gapWidth/2,right]])walls.push({x:x+(lo+hi)/2,z:z-.8,w:hi-lo,d:t,h:1.7});
    }
    if(!rule.nodesBeyondPassage||i===rooms.length-1){
      const count=rule.nodesBeyondPassage?rule.nodes:1;
      const no=number!==2&&lay.nodes?.[i];
      for(let j=0;j<count;j++)nodes.push({id:`node-${nodes.length+1}`,...no?{x:x+no.x,z:z+no.z}:{x:x+(number===1?2.5:rule.nodesBeyondPassage?(j===0?-2.3:2.3):side*2.5),z:z+(number===1?.7:rule.partition?-3.2:between(-1.1,1.1))},r:.8,active:false});
    }
    for(let j=0;j<rule.enemies/rule.rooms;j++){const eo=number!==2&&lay.enemies?.[enemies.length];enemies.push({id:`enemy-${enemies.length+1}`,kind:'enemy',...eo?{x:x+eo.x,z:z+eo.z}:{x:x+(j===0?-1:1)*(number===1?2.8:between(2.8,3.6)),z:z+(number===1?.7:rule.enemySpawnZ??(rule.partition?1.1:between(-4,-2.9)))},r:.48,health:rule.enemyHealth??RULES.enemyHealth,speed:rule.enemySpeed});}
    // Corner bands protect the center cross, every edge doorway, partition
    // approach and node branch. Crates cannot disconnect the walkable graph.
    for(const sign of [-1,1])boxes.push({x:x+sign*between(2.8,w/2-1.3),z:z+between(Math.max(3.5,d/2-2),d/2-1.3),w:1.1,d:1.1,h:1.1});
  }
  if(number===2){
    const room=rooms[1];
    for(let i=0;i<enemies.length;i++){
      const eo=lay.enemies?.[i];
      enemies[i].x=room.x+(eo?eo.x:i%2===0?-3.3:3.3);enemies[i].z=room.z+(eo?eo.z:i<enemies.length/2?-4.1:1.1);enemies[i].active=i>=enemies.length/2;
    }
  }
  const last=rooms.at(-1),exit={x:last.x,z:last.z+RULES.exit.z,r:RULES.exit.r};
  if(number===1){exit.x=last.x;exit.z=last.z-2.9;}
  if(lay.exit){exit.x=last.x+lay.exit.x;exit.z=last.z+lay.exit.z;}
  const start=rule.deadEnd?{x:rooms[0].x,z:rooms[0].z+.8}:{...RULES.start};
  const lootRng=randomFromSeed(`${seed}:loot`),lootBoxes=[],crateIdx=Math.floor(srRng()*(SR?.crateSpots.length??1)),locked=SR&&srRng()<SR.lockChance;
  // an authored crate spot must be clear of walls, crates, objectives and other pickups
  const lootBlocked=p=>[...walls,...boxes].some(o=>Math.abs(p.x-o.x)<o.w/2+.6&&Math.abs(p.z-o.z)<o.d/2+.6)||[...nodes,exit,...lootBoxes].some(o=>Math.hypot(p.x-o.x,p.z-o.z)<1.8);
  for(let i=0;i<RULES.loot.counts[number-1];i++){
    const marked=i===0,room=number===2?rooms[i<3?0:1]:rooms[i]??rooms[0];
    let point;
    if(marked&&deadEnds.length)point={x:deadEnds[0].end.x-deadEnds[0].dir.x*(number===2?.2:0),z:deadEnds[0].end.z-deadEnds[0].dir.z*(number===2?.2:0)};
    else if(SR&&marked)point={...SR.crateSpots[crateIdx]};
    else if(SR&&i===1)point={x:closets[0].end.x,z:closets[0].end.z};
    else if(marked&&number===1)point={x:room.x+shortSide*RULES.choices.markedX,z:room.z+RULES.choices.markedZ};
    else {
      const ao=lay.loot?.[i],spot=ao&&{x:room.x+ao.x,z:room.z+ao.z};
      if(spot&&!lootBlocked(spot))point=spot;
    }
    if(!point){
      // Nonblocking pickups occupy free seeded floor space, away from objectives
      // and one another. Room assignment spreads level two across both rooms.
      for(let attempt=0;attempt<1000;attempt++){
        point={x:room.x+(lootRng()-.5)*(room.w-2),z:room.z+(lootRng()-.5)*(room.d-2)};
        if([...walls,...boxes].some(o=>Math.abs(point.x-o.x)<o.w/2+.6&&Math.abs(point.z-o.z)<o.d/2+.6))continue;
        if([...nodes,exit,...lootBoxes].some(o=>Math.hypot(point.x-o.x,point.z-o.z)<1.8))continue;
        break;
      }
    }
    const table=AR.lootNext||hard&&RULES.hard.lootShift?{...areaTable(area,number,'world'),...Object.fromEntries(Object.entries(RULES.loot.weights[Math.min(number,2)]).filter(([k])=>k!=='core_ash').map(([k,w])=>[k,(areaTable(area,number,'world')[k]??0)+w]))}:areaTable(area,number,'world');
    if(hard&&RULES.hard.coreAsh[number-1])table.core_ash=(table.core_ash??0)+RULES.hard.coreAsh[number-1];
    const item=number===2&&i===1?'medkit':pickWeighted(table,lootRng());
    lootBoxes.push({id:`loot-${i+1}`,...point,marked,item,collected:false});
  }
  // A locked closet door is optional: nodes and extract stay in the room. The keycard crate lies in the room at a fixed spot.
  const doors=[];
  if(locked){
    const c=closets[0],th=RULES.encounters.door.thickness;
    doors.push({id:'door-1',x:round2(c.x-c.dir.x*c.length/2+c.dir.x*.3),z:c.z,w:th,d:c.width,h:RULES.encounters.door.height,locked:true,key:'key-1'});
    lootBoxes.push({id:'key-1',...SR.key,item:'keycard',key:'key-1',marked:false,revealed:true,collected:false,source:'KEYCARD · OPENS THE LOCKED DOOR'});
  }
  const routeChoices=number===2?[
    {kind:'node',dir:corridors[0].dir,length:spacingR[0],sign:{x:rooms[0].x+corridors[0].dir.x*RULES.choices.signDistance,z:rooms[0].z+1.5}},
    {kind:'loot',dir:deadEnds[0].dir,length:deadEnds[0].length,sign:{x:rooms[0].x+deadEnds[0].dir.x*RULES.choices.signDistance,z:rooms[0].z+1.5}}
  ]:[];
  const level=decorateLevel({number,seed,choiceSide:shortSide,title:rule.title,enemyCooldownMs:rule.enemyCooldownMs,enemyDamage:rule.enemyDamage,enemyWindupMs:rule.enemyWindupMs,firstGraceMs:rule.firstGraceMs,rooms,floors,walls,boxes,lootBoxes,nodes,enemies,corridors,deadEnds,routeChoices,start,exit,layoutId:lay.id,...SR?{startRoom:true,closet:closets[0],...doors.length?{doors}:{}}:{}});
  // Encounters shape the layout BEFORE the town re-skin, so a town side passage gets proper ground tiles.
  applyEncounters(level,area,randomFromSeed(`${seed}:encounters`),hard);
  if(hard)level.hard=true;
  if(area!=='bunker')level.area=area;
  if(area==='town'){townizeLevel(level);level.title=`Town · ${level.title}`;
    // house containers roll from this level's loot table (seeded); the medicine cabinet holds a medkit
    if(level.house){const hr=randomFromSeed(`${seed}:house`);for(const c of level.house.containers)c.item=houseItem(c.kind,number,hr(),area);}}
  if(area==='archipelago'){level.archipelago=true;level.title=`Archipelago · ${level.title}`;clearPassageProps(level);}
  applyAreaRules(level,AR);
  return level;
}

// Area difficulty + scouting item on top of the seeded layout (bunker = identity apart from the scout item).
export function applyAreaRules(level,AR){
  const n=level.number,rng=randomFromSeed(`${level.seed}:area`);
  // Extra bodies first (plain seeded grunts), so the area mix below types them like the base enemies.
  const solids=[...level.walls,...level.boxes],keep=[level.start,level.exit,...level.nodes],G=RULES.enemyTypes.grunt;
  // Tier 0 is the comfortable spot; tiers 1-2 accept tighter gaps when a crowded room has no better one.
  for(let k=0;k<(AR.extraEnemies?.[n-1]??0);k++){const room=level.rooms[(k+1)%level.rooms.length];let placed=false;
    for(let tier=0;tier<3&&!placed;tier++)for(let a=0;a<300&&!placed;a++){const p={x:room.x+(rng()-.5)*(room.w-3),z:room.z+(rng()-.5)*(room.d-3)};
      if(solids.some(o=>Math.abs(p.x-o.x)<o.w/2+.8-tier*.15&&Math.abs(p.z-o.z)<o.d/2+.8-tier*.15))continue;
      if(keep.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<(o===level.start?5.5:4)-tier*1.1)||level.enemies.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<1.5-tier*.2))continue;
      level.enemies.push({id:`enemy-${level.enemies.length+1}`,kind:'enemy',x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100,r:.48,health:RULES.levels[n-1].enemyHealth??RULES.enemyHealth,speed:RULES.levels[n-1].enemySpeed*G.speedMul,
        type:'grunt',rangeMul:G.rangeMul,cooldownMul:G.cooldownMul,standoff:G.standoff,active:!(n===2&&k%2===1),extra:true});placed=true;}} // L2: every other extra is a reserve that wakes when the node lights
  // Encounter enemies keep the type/stats encounters.js gave them.
  // Areas without their own mix (bunker) only re-type the extras, from the level's variety mix.
  for(const [i,e] of level.enemies.entries())if(!e.encounter&&(AR.mix?i>0:e.extra)){const t=RULES.enemyTypes[pickWeighted(AR.mix?AR.mix[n-1]:RULES.variety[n-1].mix,rng())];
    e.speed=(e.speed??0)/(RULES.enemyTypes[e.type]?.speedMul||1)*(t.speedMul||0);e.type=Object.keys(RULES.enemyTypes).find(k=>RULES.enemyTypes[k]===t);e.rangeMul=t.rangeMul;e.cooldownMul=t.cooldownMul;e.standoff=t.standoff;}
  for(const e of level.enemies)e.health=Math.max(1,Math.round((e.health??RULES.enemyHealth)*AR.hpMul));
  level.enemyDamage=Math.round((level.enemyDamage??RULES.combat.damage)*AR.dmgMul);level.dmgMul=AR.dmgMul;
  if(AR.scout&&AR.scout.level===n&&level.lootBoxes.length){const b=level.lootBoxes.at(-1);b.item=AR.scout.item;b.scout=true;}
  // v1.87 tracked extract quest (e.g. Fuse Box: 2 Fuse from Bunker L2): its level always holds at least one of the item, so the step
  // takes ~1-2 raids instead of a ~10 % roll. Never replaces the scout item. Off unless the meta launch tracks such a quest.
  if(QUEST_LOOT&&QUEST_LOOT.level===n&&(!QUEST_LOOT.source||QUEST_LOOT.source.area===level.area)){
    const b=level.lootBoxes.find(x=>x.item===QUEST_LOOT.item)||level.lootBoxes.find(x=>!x.scout&&!x.key);
    if(b){b.item=QUEST_LOOT.item;b.quest=true;if(QUEST_LOOT.source){b.source=QUEST_LOOT.source.label;b.revealed=true;b.marked=true;}}
  }
}
// Seeded variety on top of the base layout: enemy types, hazards, shielded nodes and a colour theme.
function decorateLevel(level){
  const v=RULES.variety[level.number-1],rng=randomFromSeed(`${level.seed}:variety`);
  level.theme=v.theme;
  // The first enemy of every level stays a grunt: a readable anchor that keeps per-level speed tuning.
  for(const [i,enemy] of level.enemies.entries()){
    const roll=rng(),type=i===0?'grunt':pickWeighted(v.mix,roll),t=RULES.enemyTypes[type];
    enemy.type=type;enemy.speed=(enemy.speed??0)*t.speedMul;enemy.rangeMul=t.rangeMul;enemy.cooldownMul=t.cooldownMul;enemy.standoff=t.standoff;
  }
  // Shielded nodes: seeded pick, they ignore shots and must be charged by standing close (hold).
  const shielded=[...level.nodes];
  for(let k=0;k<v.shieldedNodes&&shielded.length;k++)shielded.splice(Math.floor(rng()*shielded.length),1)[0].shielded=true;
  level.hazards=[];
  const H=RULES.hazard,solids=[...level.walls,...level.boxes],keep=[level.start,level.exit,...level.nodes,...level.lootBoxes];
  // Prefer later rooms; fall back to any room (start stays protected by the clearance check).
  const rooms=[...level.rooms.slice(1),level.rooms[0]];
  for(let h=0;h<v.hazards;h++){
    let placed=false;
    for(let k=0;k<rooms.length&&!placed;k++){const room=rooms[(h+k)%rooms.length];
    for(let attempt=0;attempt<200;attempt++){
      const p={x:round2(room.x+(rng()-.5)*(room.w-H.size-1)),z:round2(room.z+(rng()-.5)*(room.d-H.size-1))};
      if(solids.some(o=>Math.abs(p.x-o.x)<o.w/2+H.size/2+.3&&Math.abs(p.z-o.z)<o.d/2+H.size/2+.3))continue;
      if(keep.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<H.clearance))continue;
      if(level.hazards.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<H.size*2))continue;
      level.hazards.push({id:`hazard-${h+1}`,x:p.x,z:p.z,w:H.size,d:H.size,phaseMs:Math.floor(rng()*(H.onMs+H.offMs)),dps:v.hazardDps??H.damagePerSecond});
      placed=true;break;
    }}
  }
  return level;
}
// Pulsing shock pad: 'off' -> 'warn' (telegraph) -> 'on' (damages).
export function hazardTiming(hazard,now){
  const H=RULES.hazard,cycle=H.onMs+H.offMs,t=((now+hazard.phaseMs)%cycle+cycle)%cycle;
  if(t>=H.offMs)return {state:'on',msLeft:cycle-t};
  return {state:t>=H.offMs-H.warnMs?'warn':'off',msToOn:H.offMs-t};
}
export function hazardState(hazard,now){return hazardTiming(hazard,now).state;}
