import {rarityOf,RARITY_ORDER} from './rarity.js?v=2.11.1';
// Layout assembly only: all room footprints, cover and objective offsets come from existing rooms.
import {RULES,generateLevel,randomFromSeed} from './levels.js?v=2.11.1';
import {applyEncounters} from './encounters.js?v=2.11.1';
import {generateZoneGraph,cullingRooms,graphRoomAt} from './zone-graph.js?v=2.11.1';

export function generateBigLevel(seed){
  const graph=generateZoneGraph(seed),rooms=graph.nodes.map(n=>({...n,doors:n.doors.map(d=>({...d}))}));
  const level={number:1,seed:String(seed),big:true,graph,title:'Node Network',choiceSide:1,layoutId:'big',rooms,floors:rooms.map(r=>({...r})),walls:[],boxes:[],nodes:[],enemies:[],lootBoxes:[],hazards:[],encounters:[],spawners:[],doors:[],corridors:graph.edges.map(e=>({...e.corridor,roomIds:[e.a,e.b]})),deadEnds:[],routeChoices:[],start:{x:graph.spawn.x,z:graph.spawn.z},exit:graph.extracts[0],extracts:graph.extracts,theme:RULES.variety[0].theme};
  const t=RULES.wallThickness,width=RULES.levels[1].passage;
  for(const room of rooms){
    // Reuse the existing generator's authored cover, translated without scaling.
    const template=generateLevel(room.id===0?1:3,`${seed}:room:${room.id}`,'bunker',false,false,RULES.layouts[2].find(l=>l.id===room.layoutId)),source=template.rooms[room.id===0?0:room.templateIndex];
    const move=p=>({...p,x:room.x+p.x-source.x,z:room.z+p.z-source.z,roomId:room.id});
    for(const box of template.boxes)if(Math.abs(box.x-source.x)<source.w/2&&Math.abs(box.z-source.z)<source.d/2)level.boxes.push(move(box));
    const authored=RULES.layouts[2].find(l=>l.id===room.layoutId),offset=authored?.nodes[room.templateIndex]??RULES.layouts[0][0].nodes[0];
    const node={id:`big-node-${room.id}`,x:room.x+offset.x,z:room.z+offset.z,r:.8,active:false,roomId:room.id};level.nodes.push(node);
    const enemyOffset=authored?.enemies[room.templateIndex]??RULES.layouts[0][0].enemies[0];
    const enemy={id:`big-enemy-${room.id}`,kind:'enemy',x:room.x+enemyOffset.x,z:room.z+enemyOffset.z,r:.48,health:RULES.enemyHealth,speed:RULES.levels[0].enemySpeed,type:'grunt',active:true,roomId:room.id};level.enemies.push(enemy);
    const loot=template.lootBoxes.find(b=>!b.key&&Math.abs(b.x-source.x)<source.w/2-1&&Math.abs(b.z-source.z)<source.d/2-1);
    const spot=loot?move(loot):{x:room.x-3.4,z:room.z+1.4,roomId:room.id};
    level.lootBoxes.push({...spot,id:`big-loot-${room.id}`,item:loot?.item??'salvage_crate',collected:false});
    for(const dir of RULES.directions){
      const isX=!!dir.x,length=isX?room.d:room.w,edge={x:room.x+dir.x*(room.w/2-t/2),z:room.z+dir.z*(room.d/2-t/2)};
      if(!room.doors.some(d=>d.x===dir.x&&d.z===dir.z))level.walls.push({...edge,w:isX?t:room.w,d:isX?room.d:t,h:dir.z>0?.65:1.15,roomId:room.id});
      else for(const sign of [-1,1])level.walls.push({x:edge.x+(isX?0:sign*(length+width)/4),z:edge.z+(isX?sign*(length+width)/4:0),w:isX?t:(length-width)/2,d:isX?(length-width)/2:t,h:.85,roomId:room.id});
    }
  }
  for(const c of level.corridors){level.floors.push({...c,w:c.w+(c.dir.x?.08:0),d:c.d+(c.dir.z?.08:0)});for(const sign of [-1,1])level.walls.push({x:c.x+(c.dir.z?sign*(width/2-t/2):0),z:c.z+(c.dir.x?sign*(width/2-t/2):0),w:c.dir.x?c.w:t,d:c.dir.z?c.d:t,h:.85,roomIds:c.roomIds});}
  for(const poi of graph.pois){
    const room=rooms[poi.roomId],node=level.nodes[poi.roomId];
    if(poi.type==='bit-signal'){poi.description='BIT SIGNAL: clear this room to choose a perk';continue;}
    const sub={...level,number:poi.type==='vault'?2:3,rooms:[room],floors:[room],walls:level.walls.filter(w=>w.roomId===room.id),boxes:level.boxes.filter(b=>b.roomId===room.id),nodes:[node],enemies:[level.enemies[room.id]],lootBoxes:[],hazards:[],spawners:[],encounters:[],start:{x:room.x,z:room.z+room.d/2-1},exit:{x:room.x,z:room.z+2.9}};
    applyEncounters(sub,'bunker',randomFromSeed(`${seed}:${poi.type}`));
    // Prefix encounter references, retaining existing shield / guard / swarm behavior.
    const ids=new Map([...sub.enemies,...sub.spawners].map(o=>[o.id,o.id.startsWith('big-')?o.id:`poi-${room.id}-${o.id}`]));
    const remap=o=>{for(const key of ['id','node','nodeId','enemyId','generatorId','swarm','spawnerId'])if(ids.has(o[key]))o[key]=ids.get(o[key]);if(o.enemyIds)o.enemyIds=o.enemyIds.map(id=>ids.get(id)??id);o.roomId=room.id;return o;};
    sub.enemies.forEach(remap);sub.spawners.forEach(remap);sub.encounters.forEach(remap);remap(node);
    level.enemies.push(...sub.enemies.slice(1));level.spawners.push(...sub.spawners);level.encounters.push(...sub.encounters);
    if(poi.type==='vault'){
      poi.description='VAULT: activate the guarded terminal to unlock loot and the extract key';
      const box=level.lootBoxes.find(b=>b.roomId===room.id);box.item=Object.keys(RULES.loot.weights[2]).sort((a,b)=>RARITY_ORDER.indexOf(rarityOf(b))-RARITY_ORDER.indexOf(rarityOf(a)))[0];box.requiresNode=node.id;box.source='VAULT: ACTIVATE THIS ROOM TERMINAL';
      level.lootBoxes.push({id:'big-vault-key',key:'big-vault-key',item:'keycard',x:room.x,z:room.z-2,roomId:room.id,requiresNode:node.id,revealed:true,collected:false,source:'VAULT KEY: ACTIVATE THIS ROOM TERMINAL; OPENS KEY EXTRACT'});
    }else poi.description='GENERATOR: destroy the generator to drop the terminal shield';
  }
  return level;
}
export function extractAvailable(extract,round){
  const elapsed=round.durationMs-round.remainingMs;
  return extract.type==='open'||extract.type==='timed'&&elapsed>=extract.opensAtMs&&elapsed<extract.closesAtMs||extract.type==='key'&&!!round.keys?.includes(extract.key);
}
export function updateBigCulling(level,position,now=0,combat=null){
  if(!level.big)return null;
  level.activeRoom=graphRoomAt(level.graph,position,level.activeRoom??0);const awake=cullingRooms(level.graph,level.activeRoom);
  for(const e of [...level.enemies,...level.spawners,...(combat?.projectiles??[]),...(combat?.blasts??[])]){
    const sleeping=!awake.has(graphRoomAt(level.graph,e,e.roomId??0));
    if(e.sleeping&& !sleeping&&e.sleptAt!=null){const delta=now-e.sleptAt;for(const key of ['windupAt','aimLockAt','alertAt','recoverUntil','burstEndsAt','pauseUntil','spawnAt','spawnedAt','stunnedUntil','lureUntil','attackWakeAt','releaseAt','detonateAt','at'])if(e[key]!=null)e[key]+=delta;if(combat?.nextFire.has(e.id))combat.nextFire.set(e.id,combat.nextFire.get(e.id)+delta);}
    if(!e.sleeping&&sleeping)e.sleptAt=now;e.sleeping=sleeping;
  }
  level.awakeRooms=awake;return awake;
}
