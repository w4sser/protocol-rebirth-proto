// Pure graph construction. BIG MAP expands the existing authored room pool.
import {RULES,randomFromSeed} from './levels.js?v=2.20.0';
import '../data/raid-big-layout.js?v=2.20.0';
const BIG=globalThis.DATA.raidBigLayout;

export function graphDistances(graph,from=graph.spawn.roomId){
  const distances={[from]:0},queue=[from];
  for(const id of queue)for(const edge of graph.edges){const next=edge.a===id?edge.b:edge.b===id?edge.a:null;if(next!=null&&distances[next]==null){distances[next]=distances[id]+1;queue.push(next);}}
  return distances;
}
export function cullingRooms(graph,active){
  const ids=new Set([active]);for(const e of graph.edges){if(e.a===active)ids.add(e.b);if(e.b===active)ids.add(e.a);}return ids;
}
export function graphRoomAt(graph,p,previous=graph.spawn.roomId){
  const room=graph.nodes.find(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2);if(room)return room.id;
  // In a corridor keep both endpoints awake by retaining the room just left.
  const edge=graph.edges.find(e=>Math.abs(p.x-e.corridor.x)<=e.corridor.w/2&&Math.abs(p.z-e.corridor.z)<=e.corridor.d/2);
  return edge?(edge.a===previous||edge.b===previous?previous:edge.a):previous;
}
export function generateZoneGraph(seed){
  const rng=randomFromSeed(`${seed}:big-graph`),count=6+Math.floor(rng()*7),spacing=BIG.spacing,width=RULES.levels[1].passage;
  const pool=RULES.layouts[2],nodes=[];
  for(let i=0;i<count;i++){
    const layout=pool[Math.floor(rng()*pool.length)],index=Math.floor(rng()*layout.rooms.length),room=i===0?RULES.startRoom:layout.rooms[index];
    const variant=BIG.shapes[i%BIG.shapes.length],shape=room.w>=room.d?variant:{w:variant.d,d:variant.w};
    nodes.push({id:i,x:(i%3)*spacing,z:-Math.floor(i/3)*spacing,w:room.w*shape.w,d:room.d*shape.d,name:i===0?RULES.startRoom.name:RULES.roomNames[index],layoutId:i===0?'start':layout.id,templateIndex:index,doors:[]});
  }
  const candidates=[];for(const a of nodes)for(const b of nodes)if(a.id<b.id&&Math.abs(a.x-b.x)+Math.abs(a.z-b.z)===spacing)candidates.push({a:a.id,b:b.id,roll:rng()});
  candidates.sort((a,b)=>a.roll-b.roll);const parent=nodes.map(n=>n.id),root=i=>parent[i]===i?i:(parent[i]=root(parent[i])),tree=[],loops=[];
  for(const edge of candidates){const a=root(edge.a),b=root(edge.b);if(a!==b){parent[a]=b;tree.push(edge);}else loops.push(edge);}
  const edges=[...tree,...loops.slice(0,1+Math.floor(rng()*Math.min(3,loops.length)))].map(({a,b},id)=>{
    const A=nodes[a],B=nodes[b],dx=Math.sign(B.x-A.x),dz=Math.sign(B.z-A.z),dir={x:dx,z:dz};
    A.doors.push(dir);B.doors.push({x:-dx,z:-dz});
    const start={x:A.x+dx*A.w/2,z:A.z+dz*A.d/2},end={x:B.x-dx*B.w/2,z:B.z-dz*B.d/2};
    return {id,a,b,start,end,corridor:{x:(start.x+end.x)/2,z:(start.z+end.z)/2,w:dx?Math.abs(end.x-start.x):width,d:dz?Math.abs(end.z-start.z):width,width,dir}};
  });
  const graph={seed:String(seed),nodes,edges,spawn:{roomId:0,x:0,z:RULES.start.z},pois:[],extracts:[]},dist=graphDistances(graph);
  const far=[...nodes.slice(1)].sort((a,b)=>dist[b.id]-dist[a.id]||b.id-a.id);
  const poiRooms=[...nodes.slice(1)]; // Shuffle without an engine-dependent random comparator.
  for(let i=poiRooms.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[poiRooms[i],poiRooms[j]]=[poiRooms[j],poiRooms[i]];}
  graph.pois=['vault','generator','bit-signal'].map((type,i)=>({type,roomId:poiRooms[i].id,x:poiRooms[i].x,z:poiRooms[i].z}));
  graph.extracts=['open','timed','key'].map((type,i)=>({id:`extract-${type}`,type,roomId:far[i].id,x:far[i].x,z:far[i].z+RULES.exit.z,r:RULES.exit.r,...type==='timed'?{opensAtMs:60000,closesAtMs:240000}:{},...type==='key'?{key:'big-vault-key'}:{}}));
  return graph;
}
