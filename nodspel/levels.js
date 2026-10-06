// Seeded level design: dimensions, connections, cover and placement live here.
export const RULES=Object.freeze({
  levels:[
    {rooms:1,nodes:1,enemies:1,enemyHealth:2,size:{w:[12,15],d:[10,14]},passage:0,partition:false,deadEnd:false,enemySpeed:.8,enemyCooldownMs:1800,title:'Öppet rum'},
    {rooms:2,nodes:2,enemies:4,enemyHealth:2,size:{w:[10,12],d:[10,12]},passage:1.8,partition:true,nodesBeyondPassage:true,deadEnd:false,enemySpeed:1.2,enemyCooldownMs:1500,title:'Trång passage'},
    {rooms:3,nodes:3,enemies:6,size:{w:[10,12],d:[10,12]},passage:2.2,partition:false,deadEnd:true,enemySpeed:2.2,enemySpawnZ:-4.1,enemyCooldownMs:1500,title:'Återvändsgränd'},
  ],
  roomNames:['Förråd','Verkstad','Hall'],
  directions:[{x:1,z:0},{x:-1,z:0},{x:0,z:-1},{x:0,z:1}],
  spacing:[15,18],startRoomOffset:[-.8,.8],deadEndLength:[4,6],wallThickness:.4,boxesPerRoom:2,
  start:{x:0,z:2.9},exit:{z:2.9,r:1},nodeSize:1.4,playerRadius:.36,
  loot:{counts:[1,2,3],types:['scrap_alloy','power_cell','cable','fuse'],pools:[['cable','scrap_alloy','power_cell'],['fuse','scrap_alloy','power_cell'],['scrap_alloy','power_cell']],pickupRadius:1.25},
  killReward:{ammo:1,health:15},enemyHealth:3,combat:{range:7,cooldownMs:1400,damage:20,bulletSpeed:9,graceMs:3000},
  weapon:{range:7,damage:1,capacity:3,reloadMs:700,shotIntervalMs:180,bulletSpeed:19,shotRadius:.32,assistAngleDegrees:12,assistWidth:1.1,assistStrength:.65},
});
function randomFromSeed(seed){
  let state=2166136261;
  for(const c of String(seed))state=Math.imul(state^c.charCodeAt(0),16777619);
  return ()=>{state+=0x6D2B79F5;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}
const opposite=d=>({x:-d.x,z:-d.z});
const equal=(a,b)=>a.x===b.x&&a.z===b.z;
export function generateLevel(number,roundSeed){
  const rule=RULES.levels[number-1];if(!rule)throw new RangeError('Banan måste vara 1, 2 eller 3.');
  const seed=`${roundSeed}:${number}`,rng=randomFromSeed(seed);
  const between=(a,b)=>Math.round((a+rng()*(b-a))*100)/100;
  const pick=items=>items[Math.floor(rng()*items.length)];
  const rooms=[],floors=[],walls=[],boxes=[],nodes=[],enemies=[],corridors=[],deadEnds=[];
  const t=RULES.wallThickness,door=rule.passage;
  for(let i=0;i<rule.rooms;i++){
    const room={x:between(...RULES.startRoomOffset),z:between(...RULES.startRoomOffset),w:between(...rule.size.w),d:between(...rule.size.d),name:RULES.roomNames[i],doors:[]};
    if(i){
      const prev=rooms[i-1];
      const choices=RULES.directions.filter(dir=>!equal(dir,prev.incoming??{x:0,z:1}));
      const dir=pick(choices),spacing=between(...RULES.spacing);
      room.x=prev.x+dir.x*spacing;room.z=prev.z+dir.z*spacing;
      prev.doors.push(dir);room.incoming=opposite(dir);room.doors.push(room.incoming);
      const a={x:prev.x+dir.x*prev.w/2,z:prev.z+dir.z*prev.d/2};
      const b={x:room.x-dir.x*room.w/2,z:room.z-dir.z*room.d/2};
      corridors.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:dir.x?Math.abs(b.x-a.x):door,d:dir.z?Math.abs(b.z-a.z):door,width:door,dir});
    }
    rooms.push(room);floors.push({...room});
  }
  if(rule.deadEnd){
    const room=rooms[0],dir=pick(RULES.directions.filter(d=>d.z===0&&!room.doors.some(p=>equal(p,d))));
    const length=between(...RULES.deadEndLength);
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
    const room=number===2?rooms[1]:rooms[i]??rooms[0];
    const pool=number===2&&i>0?RULES.loot.pools[2]:RULES.loot.pools[number-1];
    lootBoxes.push({id:`loot-${i+1}`,x:room.x+(number===2?(i===0?-3.3:3.3):-1.3),z:room.z+(number===2?2.6:1.5),item:pool[Math.floor(lootRng()*pool.length)],collected:false});
  }
  return {number,seed,title:rule.title,enemyCooldownMs:rule.enemyCooldownMs,rooms,floors,walls,boxes,lootBoxes,nodes,enemies,corridors,deadEnds,start,exit};
}
