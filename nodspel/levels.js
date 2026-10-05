// Level design lives in these rules, not in a list of hand-built room layouts.
export const RULES = Object.freeze({
  levels: [
    {rooms:1, types:['store'],nodes:1,enemies:1,enemySpeed:.8,enemyCooldownMs:1800,title:'Första kontakten'},
    {rooms:2, types:['store','workshop'],nodes:2,enemies:4,enemySpeed:1.2,enemyCooldownMs:1500,title:'Förstärkningar'},
    {rooms:3, types:['store','workshop','hall'],nodes:3,enemies:6,enemySpeed:2.2,enemyCooldownMs:1500,title:'Snabb jakt'},
  ],
  roomTypes:{
    store:{name:'Förråd',w:12,d:12,boxes:2},
    workshop:{name:'Verkstad',w:12,d:10,boxes:2},
    hall:{name:'Hall',w:10,d:12,boxes:2},
  },
  slotSpacing:14.5,
  start:{x:0,z:2.9},
  exit:{z:-2.9,r:1},
  nodeAnchor:{sideOffset:2.5,z:1.1},
  enemyHealth:2,
  combat:{range:10,cooldownMs:1400,damage:25,bulletSpeed:9,graceMs:3000},
  corridorWidth:3.2,
  wallThickness:.4,
  reservedLaneWidth:2.6,
  nodeSize:1.4,
  playerRadius:.36,
});

function randomFromSeed(seed) {
  let state=2166136261;
  for(const char of String(seed)) state=Math.imul(state^char.charCodeAt(0),16777619);
  return ()=>{
    state+=0x6D2B79F5;
    let n=Math.imul(state^(state>>>15),1|state);
    n^=n+Math.imul(n^(n>>>7),61|n);
    return ((n^(n>>>14))>>>0)/4294967296;
  };
}

export function generateLevel(number,roundSeed) {
  const rule=RULES.levels[number-1];
  if(!rule)throw new RangeError('Banan måste vara 1, 2 eller 3.');
  const seed=`${roundSeed}:${number}`,rng=randomFromSeed(seed);
  const between=(lo,hi)=>lo+rng()*(hi-lo);
  const types=[...rule.types];
  const rooms=[],floors=[],walls=[],boxes=[],nodes=[],enemies=[];
  const t=RULES.wallThickness,door=RULES.corridorWidth;
  for(let i=0;i<rule.rooms;i++){
    const type=types[i],template=RULES.roomTypes[type],{w,d}=template;
    const prev=rooms.at(-1);
    const x=i*RULES.slotSpacing;
    const room={x,z:0,w,d,type,name:template.name};rooms.push(room);floors.push({...room});
    if(prev){
      const left=prev.x+prev.w/2,right=x-w/2;
      floors.push({x:(left+right)/2,z:0,w:right-left,d:door});
      for(const sign of [-1,1])walls.push({x:(left+right)/2,z:sign*(door/2-t/2),w:right-left,d:t,h:.8});
    }
    // Front and back walls, and side walls split by doors to connected rooms.
    for(const sign of [-1,1])walls.push({x,z:sign*(d/2-t/2),w,d:t,h:sign>0?.65:1.15});
    for(const side of [-1,1]){
      const linked=side===-1?i>0:i<rule.rooms-1;
      if(!linked)walls.push({x:x+side*(w/2-t/2),z:0,w:t,d,h:.85});
      else for(const sign of [-1,1])walls.push({x:x+side*(w/2-t/2),z:sign*(d+door)/4,w:t,d:(d-door)/2,h:.85});
    }
    // Every room gets a node on a branch off an always-clear central cross.
    const side=rng()<.5?1:-1;
    const node={id:`node-${i+1}`,x:x+side*RULES.nodeAnchor.sideOffset,z:between(-RULES.nodeAnchor.z,RULES.nodeAnchor.z),r:.8,active:false};
    nodes.push(node);
    for(let j=0;j<rule.enemies/rule.rooms;j++){
      const enemy={id:`enemy-${enemies.length+1}`,kind:'enemy',x:x+(j===0?-side:side)*between(2.8,3.8),z:between(-d/2+1.3,-2.8),r:.48,health:RULES.enemyHealth,speed:rule.enemySpeed};
      enemies.push(enemy);
    }
    // Two independent corner bands leave a continuous central cross and
    // the complete node branch clear. Sampling never changes the box count.
    for(let j=0;j<template.boxes;j++){
      boxes.push({x:x+(j===0?-1:1)*between(2.8,w/2-1.3),z:between(Math.max(3.5,d/2-2),d/2-1.3),w:1.1,d:1.1,h:1.1});
    }
  }
  const last=rooms.at(-1);
  return {number,seed,title:rule.title,enemyCooldownMs:rule.enemyCooldownMs,rooms,floors,walls,boxes,nodes,enemies,
    start:{...RULES.start},
    exit:{x:last.x,...RULES.exit},
  };
}
