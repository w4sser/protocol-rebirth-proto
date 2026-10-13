import {townizeLevel} from './town-layout.js?v=1.39.0';
// Seeded level design: dimensions, connections, cover and placement live here.
export const RULES=Object.freeze({
  levels:[
    {rooms:1,nodes:1,enemies:1,enemyHealth:2,size:{w:[12,15],d:[10,14]},passage:0,partition:false,deadEnd:false,enemySpeed:.8,enemyCooldownMs:2400,enemyDamage:10,enemyWindupMs:500,firstGraceMs:5000,title:'Open Room'},
    {rooms:2,nodes:2,enemies:4,enemyHealth:2,size:{w:[10,12],d:[10,12]},passage:1.8,partition:true,nodesBeyondPassage:true,deadEnd:false,enemySpeed:1.2,enemyCooldownMs:1500,title:'Narrow Passage'},
    {rooms:3,nodes:3,enemies:6,size:{w:[10,12],d:[10,12]},passage:2.2,partition:false,deadEnd:true,enemySpeed:2.2,enemySpawnZ:-4.1,enemyCooldownMs:1500,title:'Dead End'},
  ],
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
  loot:{capacity:4,counts:[1,6,3],
    types:['scrap_alloy','power_cell','cable','fuse','medkit','polymer_plate','servo','optical_sensor','circuit_board','salvage_crate','data_core','hydraulic_component','memory_module','power_relay','ai_fragment','bio_sample','scout_rig','dampener_cloak','smg_vector','rifle_marksman','shotgun_breach','encrypted_drive','rebirth_shard','neural_core'],
    weights:[
      {cable:3,scrap_alloy:3,power_cell:3,polymer_plate:2,servo:2,salvage_crate:2},
      {fuse:3,scrap_alloy:2,power_cell:2,polymer_plate:3,servo:3,optical_sensor:2,circuit_board:2,salvage_crate:4,data_core:2,cable:1,scout_rig:1,smg_vector:1,shotgun_breach:1},
      {salvage_crate:4,data_core:3,circuit_board:2,hydraulic_component:2,memory_module:2,optical_sensor:1,power_relay:1,ai_fragment:1,servo:1,polymer_plate:1,bio_sample:1,scout_rig:1,dampener_cloak:1,rifle_marksman:1,shotgun_breach:1,encrypted_drive:1,rebirth_shard:1,neural_core:1}],
    pickupRadius:1.6},
  // Level variety (seeded from `${seed}:variety`, so base layouts are unchanged). Level 1 stays gentle: grunts only, no hazards.
  enemyTypes:{
    grunt:{speedMul:1,rangeMul:1,cooldownMul:1,standoff:3.5,color:'#a67072'},
    rusher:{speedMul:1.6,rangeMul:.6,cooldownMul:.8,standoff:1.2,color:'#e0904a'},
    sentry:{speedMul:0,rangeMul:1.35,cooldownMul:1.3,standoff:0,color:'#5d8fd6'}},
  variety:[
    {mix:{grunt:1},hazards:0,shieldedNodes:0,theme:{floor:'#444f59',trim:'#6c7882'}},
    {mix:{grunt:.65,sentry:.35},hazards:1,hazardDps:8,shieldedNodes:0,theme:{floor:'#4b4a3f',trim:'#8a8566'}},
    {mix:{grunt:.4,rusher:.35,sentry:.25},hazards:2,hazardDps:12,shieldedNodes:1,theme:{floor:'#3f3f52',trim:'#7c6fa8'}}],
  // Player stats. Meta computes them (skills + gear, data/progression.js) and passes ?stats=; core clamps again.
  // Without launch params (standalone) the new-player base applies: slower than before (3.6 vs 4.5 m/s).
  playerStats:{base:{speed:3.6,stealth:0,maxHealth:100,dashCooldownMs:4000},
    clamp:{speed:[2.5,6],stealth:[0,.6],maxHealth:[50,200],dashCooldownMs:[2000,6000]},
    gear:['scavenger_vest','scout_rig','dampener_cloak','smg_vector','rifle_marksman','shotgun_breach']},
  // Weapon launch params (?w=) are clamped to these ranges; missing keys fall back to RULES.weapon (Basic).
  weaponIds:['basic_carbine','smg_vector','rifle_marksman','shotgun_breach'],
  weaponClamp:{damage:[1,4],capacity:[1,12],reloadMs:[250,1600],shotIntervalMs:[80,1000],range:[3,12],coneHalfAngleDegrees:[3,25],assistAngleDegrees:[4,30],spreadDegrees:[0,12]},
  kitMax:{medkit:2},
  hazard:{size:1.8,onMs:1500,offMs:2500,warnMs:1200,damagePerSecond:12,clearance:2.2},
  feedback:{hitFlashMs:240,damageNumberMs:700},
  dash:{distance:4.8,durationSeconds:.22,cooldownMs:4000},
  bit:{healPerSecond:5,followDistance:1.6,followSpeed:7,radius:.18},
  killReward:{ammo:1,health:15},enemyHealth:3,combat:{detectRange:10,range:7,cooldownMs:1400,damage:20,bulletSpeed:9,graceMs:3000,standoff:3.5},
  aimControls:{deadZonePx:12,responseSeconds:.12,maxTurnRadiansPerSecond:6},
  weapon:{coneHalfAngleDegrees:8,range:7,damage:1,capacity:3,reloadMs:700,shotIntervalMs:180,bulletSpeed:19,shotRadius:.32,assistAngleDegrees:12,assistWidth:1.1,assistStrength:.65},
});
export function totalNodes(){return RULES.levels.reduce((sum,level)=>sum+level.nodes,0);}
function randomFromSeed(seed){
  let state=2166136261;
  for(const c of String(seed))state=Math.imul(state^c.charCodeAt(0),16777619);
  return ()=>{state+=0x6D2B79F5;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}
const opposite=d=>({x:-d.x,z:-d.z});
const equal=(a,b)=>a.x===b.x&&a.z===b.z;
export function pickWeighted(weights,roll){
  const entries=Object.entries(weights),total=entries.reduce((s,[,w])=>s+w,0);
  let r=roll*total;for(const [id,w] of entries){r-=w;if(r<0)return id;}
  return entries.at(-1)[0];
}
let AREA='bunker';
export const AREAS=['bunker','town'];
export function setArea(a){AREA=AREAS.includes(a)?a:'bunker';return AREA;}
export function generateLevel(number,roundSeed,area=AREA){
  const rule=RULES.levels[number-1];if(!rule)throw new RangeError('Level must be 1, 2 or 3.');
  const seed=`${roundSeed}:${number}`,rng=randomFromSeed(seed);
  const suffix=String(roundSeed).match(/-(\d+)$/),choiceRng=randomFromSeed(`${roundSeed}:choices`);
  const shortSide=suffix?(Number(suffix[1])%2?-1:1):(choiceRng()<.5?-1:1);
  const between=(a,b)=>Math.round((a+rng()*(b-a))*100)/100;
  const pick=items=>items[Math.floor(rng()*items.length)];
  const rooms=[],floors=[],walls=[],boxes=[],nodes=[],enemies=[],corridors=[],deadEnds=[];
  const t=RULES.wallThickness,door=rule.passage;
  for(let i=0;i<rule.rooms;i++){
    const room={x:between(...RULES.startRoomOffset),z:between(...RULES.startRoomOffset),w:between(...rule.size.w),d:between(...rule.size.d),name:RULES.roomNames[i],doors:[]};
    if(i){
      const prev=rooms[i-1];
      const choices=RULES.directions.filter(dir=>!equal(dir,prev.incoming??{x:0,z:1}));
      const dir=number===2?{x:-shortSide,z:0}:pick(choices),spacing=between(...RULES.spacing);
      room.x=prev.x+dir.x*spacing;room.z=prev.z+dir.z*spacing;
      prev.doors.push(dir);room.incoming=opposite(dir);room.doors.push(room.incoming);
      const a={x:prev.x+dir.x*prev.w/2,z:prev.z+dir.z*prev.d/2};
      const b={x:room.x-dir.x*room.w/2,z:room.z-dir.z*room.d/2};
      corridors.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:dir.x?Math.abs(b.x-a.x):door,d:dir.z?Math.abs(b.z-a.z):door,width:door,dir});
    }
    rooms.push(room);floors.push({...room});
  }
  if(rule.deadEnd||number===2){
    const room=rooms[0],dir=number===2?{x:shortSide,z:0}:pick(RULES.directions.filter(d=>d.z===0&&!room.doors.some(p=>equal(p,d))));
    const length=between(...(number===2?RULES.choices.shortLength:RULES.deadEndLength));
    room.doors.push(dir);
    const edge={x:room.x+dir.x*room.w/2,z:room.z+dir.z*room.d/2};
    const branch={x:edge.x+dir.x*length/2,z:edge.z+dir.z*length/2,w:dir.x?length:door,d:dir.z?length:door,width:door,length,connections:1,roomIndex:0,dir,end:{x:edge.x+dir.x*(length-.8),z:edge.z+dir.z*(length-.8)}};
    deadEnds.push(branch);
    walls.push({x:edge.x+dir.x*(length-t/2),z:edge.z+dir.z*(length-t/2),w:dir.x?t:door,d:dir.z?t:door,h:.9});
  }
  for(const corridor of [...corridors,...deadEnds]){
    // Overlap the seam slightly: rounded centers and dimensions must never
    // produce a floating-point crack between room and corridor footprints.
    floors.push({...corridor,w:corridor.w+(corridor.dir.x?.08:0),d:corridor.d+(corridor.dir.z?.08:0)});
    for(const sign of [-1,1])walls.push({x:corridor.x+(corridor.dir.z?sign*(door/2-t/2):0),z:corridor.z+(corridor.dir.x?sign*(door/2-t/2):0),w:corridor.dir.x?corridor.w:t,d:corridor.dir.z?corridor.d:t,h:.85});
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
      const gap=side*(w/2-1.5),gapWidth=1.8,left=-w/2,right=w/2;
      room.partition={x:x+gap,z:z-.8};
      for(const [lo,hi] of [[left,gap-gapWidth/2],[gap+gapWidth/2,right]])walls.push({x:x+(lo+hi)/2,z:z-.8,w:hi-lo,d:t,h:1.7});
    }
    if(!rule.nodesBeyondPassage||i===rooms.length-1){
      const count=rule.nodesBeyondPassage?rule.nodes:1;
      for(let j=0;j<count;j++)nodes.push({id:`node-${nodes.length+1}`,x:x+(number===1?2.5:rule.nodesBeyondPassage?(j===0?-2.3:2.3):side*2.5),z:z+(number===1?.7:rule.partition?-3.2:between(-1.1,1.1)),r:.8,active:false});
    }
    for(let j=0;j<rule.enemies/rule.rooms;j++)enemies.push({id:`enemy-${enemies.length+1}`,kind:'enemy',x:x+(j===0?-1:1)*(number===1?2.8:between(2.8,3.6)),z:z+(number===1?.7:rule.enemySpawnZ??(rule.partition?1.1:between(-4,-2.9))),r:.48,health:rule.enemyHealth??RULES.enemyHealth,speed:rule.enemySpeed});
    // Corner bands protect the center cross, every edge doorway, partition
    // approach and node branch. Crates cannot disconnect the walkable graph.
    for(const sign of [-1,1])boxes.push({x:x+sign*between(2.8,w/2-1.3),z:z+between(Math.max(3.5,d/2-2),d/2-1.3),w:1.1,d:1.1,h:1.1});
  }
  if(number===2){
    const room=rooms[1];
    for(let i=0;i<enemies.length;i++){
      enemies[i].x=room.x+(i%2===0?-3.3:3.3);enemies[i].z=room.z+(i<2?-4.1:1.1);enemies[i].active=i>=2;
    }
  }
  const last=rooms.at(-1),exit={x:last.x,z:last.z+RULES.exit.z,r:RULES.exit.r};
  if(number===1){exit.x=last.x;exit.z=last.z-2.9;}
  const start=rule.deadEnd?{x:rooms[0].x,z:rooms[0].z+.8}:{...RULES.start};
  const lootRng=randomFromSeed(`${seed}:loot`),lootBoxes=[];
  for(let i=0;i<RULES.loot.counts[number-1];i++){
    const marked=i===0,room=number===2?rooms[i<3?0:1]:rooms[i]??rooms[0];
    let point;
    if(marked&&deadEnds.length)point={x:deadEnds[0].end.x-deadEnds[0].dir.x*(number===2?.2:0),z:deadEnds[0].end.z-deadEnds[0].dir.z*(number===2?.2:0)};
    else if(marked&&number===1)point={x:room.x+shortSide*RULES.choices.markedX,z:room.z+RULES.choices.markedZ};
    else {
      // Nonblocking pickups occupy free seeded floor space, away from objectives
      // and one another. Room assignment spreads level two across both rooms.
      for(let attempt=0;attempt<1000;attempt++){
        point={x:room.x+(lootRng()-.5)*(room.w-2),z:room.z+(lootRng()-.5)*(room.d-2)};
        if([...walls,...boxes].some(o=>Math.abs(point.x-o.x)<o.w/2+.6&&Math.abs(point.z-o.z)<o.d/2+.6))continue;
        if([...nodes,exit,...lootBoxes].some(o=>Math.hypot(point.x-o.x,point.z-o.z)<1.8))continue;
        break;
      }
    }
    const item=number===2&&i===1?'medkit':pickWeighted(RULES.loot.weights[number-1],lootRng());
    lootBoxes.push({id:`loot-${i+1}`,...point,marked,item,collected:false});
  }
  const routeChoices=number===2?[
    {kind:'node',dir:corridors[0].dir,length:RULES.spacing[0],sign:{x:rooms[0].x+corridors[0].dir.x*RULES.choices.signDistance,z:rooms[0].z+1.5}},
    {kind:'loot',dir:deadEnds[0].dir,length:deadEnds[0].length,sign:{x:rooms[0].x+deadEnds[0].dir.x*RULES.choices.signDistance,z:rooms[0].z+1.5}}
  ]:[];
  const level=decorateLevel({number,seed,choiceSide:shortSide,title:rule.title,enemyCooldownMs:rule.enemyCooldownMs,enemyDamage:rule.enemyDamage,enemyWindupMs:rule.enemyWindupMs,firstGraceMs:rule.firstGraceMs,rooms,floors,walls,boxes,lootBoxes,nodes,enemies,corridors,deadEnds,routeChoices,start,exit});
  if(area==='town'){townizeLevel(level);level.title=`Town · ${level.title}`;}
  return level;
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
      const p={x:room.x+(rng()-.5)*(room.w-H.size-1),z:room.z+(rng()-.5)*(room.d-H.size-1)};
      if(solids.some(o=>Math.abs(p.x-o.x)<o.w/2+H.size/2+.3&&Math.abs(p.z-o.z)<o.d/2+H.size/2+.3))continue;
      if(keep.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<H.clearance))continue;
      if(level.hazards.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<H.size*2))continue;
      level.hazards.push({id:`hazard-${h+1}`,x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100,w:H.size,d:H.size,phaseMs:Math.floor(rng()*(H.onMs+H.offMs)),dps:v.hazardDps??H.damagePerSecond});
      placed=true;break;
    }}
  }
  return level;
}
// Pulsing shock pad: 'off' → 'warn' (telegraph) → 'on' (damages).
export function hazardTiming(hazard,now){
  const H=RULES.hazard,cycle=H.onMs+H.offMs,t=((now+hazard.phaseMs)%cycle+cycle)%cycle;
  if(t>=H.offMs)return {state:'on',msLeft:cycle-t};
  return {state:t>=H.offMs-H.warnMs?'warn':'off',msToOn:H.offMs-t};
}
export function hazardState(hazard,now){return hazardTiming(hazard,now).state;}
