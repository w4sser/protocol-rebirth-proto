import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {generateBigLevel} from '../big-level.js';
import {buildArchipelago} from '../archipelago.js';
import {movePlayer,traceTargets,aimEndpoint,aimConePoints} from '../physics.mjs';
import {BRIDGE_ENTRY_FLARE_DEPTH,bridgeEntrySupports,bridgeWaypoint} from '../bridge-flow.mjs';
import {planBridgeDeck} from '../bridge-deck.mjs';
import {artilleryFlight} from '../artillery-flight.mjs';

function render(level){
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  buildArchipelago(level,group,box);
  return group;
}

test('bridge funnel is supported only under visibly widened landfall planks',()=>{
  const f={x:5,z:0,w:10,d:4,dir:{x:1,z:0},bridgeFunnel:true};
  assert.equal(bridgeEntrySupports(f,.1,2.18),true);
  assert.equal(bridgeEntrySupports(f,5,2.18),false);
  assert.equal(bridgeEntrySupports(f,5+4,2.18),false);
  assert.equal(bridgeEntrySupports({...f,bridgeFunnel:false},.1,2.18),false);
  const plan=planBridgeDeck(f,'funnel',{quality:'high'});
  const edge=plan.planks.filter(p=>!p.landing&&Math.abs(p.t)>plan.length/2-BRIDGE_ENTRY_FLARE_DEPTH);
  const middle=plan.planks.filter(p=>!p.landing&&Math.abs(p.t)<1);
  assert.ok(edge.some(p=>p.width>4.15),'land-side boards flare outward');
  assert.ok(middle.every(p=>p.width<4),'open-water boards remain narrow');
  const ground=[{x:-6,z:0,w:12,d:12},f,{x:16,z:0,w:12,d:12}];
  for(const radius of [.36,.48]){
    const start={x:-1.2,z:2.4},target={x:.3,z:1.78};
    const result=movePlayer(start,{x:target.x-start.x,z:target.z-start.z},[],ground,radius);
    assert.ok(Math.hypot(result.x-target.x,result.z-target.z)<.12,
      'diagonal bridge entry at the supported apron: '+JSON.stringify({radius,result}));
  }
  const overWater=movePlayer({x:5,z:0},{x:0,z:4},[],ground,.36);
  assert.ok(overWater.z<1.7,'the open-water bridge lane does not gain width');
});

test('generated, rendered bridge approaches remain open to players and bots',()=>{
  for(const big of [false,true])for(let seed=0;seed<4;seed++){
    const level=big?generateBigLevel('video-collision-big-'+seed,'archipelago')
      :generateLevel(2,'video-collision-'+seed,'archipelago');
    const group=render(level);
    try{
      for(const c of level.corridors.slice(0,4)){
        const ids=c.roomIds,rooms=ids?ids.map(id=>level.rooms.find(r=>r.id===id)):[level.rooms[level.corridors.indexOf(c)],level.rooms[level.corridors.indexOf(c)+1]];
        const along=c.dir.x?'x':'z',across=c.dir.x?'z':'x',width=c.dir.x?c.d:c.w;
        for(const room of rooms.filter(Boolean))for(const radius of [.36,.48])for(const side of [-1,1]){
          const direction=Math.sign(c[along]-room[along])||1;
          const edge=room[along]+direction*room[c.dir.x?'w':'d']/2;
          const from={x:0,z:0},to={x:0,z:0};
          from[along]=edge-direction*1.2;to[along]=edge+direction*.3;
          from[across]=c[across]+side*(width/2+.4);to[across]=c[across]+side*(width/2-.22);
          const end=movePlayer(from,{x:to.x-from.x,z:to.z-from.z},
            [...level.walls,...level.boxes],level.floors,radius);
          assert.ok(Math.hypot(end.x-to.x,end.z-to.z)<.35,
            'rendered bridge entry blocked: '+JSON.stringify({big,seed,radius,side,from,to,end}));
        }
      }
    }finally{group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}
  }
});

test('round boulder footsteps lose invisible box corners but retain solid cover',()=>{
  const rock={x:0,z:0,w:2,d:2,r:.7,rock:true};
  const p=movePlayer({x:-3,z:1.1},{x:6,z:0},[rock],20,.36);
  assert.ok(p.x>2.9,'the player can pass a non-existent AABB corner');
  const nose=movePlayer({x:-3,z:0},{x:6,z:0},[rock],20,.36);
  assert.ok(nose.x<=-1.06+1e-4,'the rock remains physically solid at its base');
  const clear=aimEndpoint({x:-3,z:1.1},{x:1,z:0},6,[rock]);
  assert.ok(clear.x>2.9,'aim ray does not hit an invisible AABB corner');
  assert.equal(traceTargets({x:-3,z:0},{x:3,z:0},[rock],[])?.kind,'wall');
  assert.equal(traceTargets({x:-3,z:1.1},{x:3,z:1.1},[rock],[]),null);
  assert.ok(aimConePoints({x:-3,z:0},{x:1,z:0},6,.5,[rock]).length>40);
});

test('rendered granite footprints have a narrower ground collision than their rotated bounds',()=>{
  const level=generateLevel(2,'round-rock-visual','archipelago'),group=render(level);
  try{
    const rocks=group.children.filter(m=>m.name==='archipelago-rock');
    assert.ok(rocks.length>0);
    for(const mesh of rocks){
      const c=mesh.userData.collider;
      assert.equal(c.rock,true);
      assert.ok(c.r>0&&c.r<Math.min(c.w,c.d)/2);
      assert.ok(level.walls.includes(c));
    }
    assert.ok(level.walls.some(c=>c.shore),'invisible shoreline edges stay solid');
  }finally{group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}
});

test('bots follow roomIds across shuffled Big Map islands rather than index order',()=>{
  const level={archipelago:true,rooms:[
    {id:5,x:34,z:0,w:10,d:10},
    {id:0,x:0,z:0,w:10,d:10},
    {id:2,x:17,z:0,w:10,d:10},
  ],corridors:[
    {x:8.5,z:0,w:7,d:4,dir:{x:1,z:0},roomIds:[0,2]},
    {x:25.5,z:0,w:7,d:4,dir:{x:1,z:0},roomIds:[2,5]},
  ]};
  const from={x:34,z:1},target={x:0,z:0};
  const entry=bridgeWaypoint(level,from,target);
  assert.ok(entry&&entry.x>28&&entry.x<31&&entry.z===0,JSON.stringify(entry));
  const crossing=bridgeWaypoint(level,entry,target);
  assert.ok(crossing&&crossing.x<23&&crossing.z===0,JSON.stringify(crossing));
});

test('incoming artillery draws a pooled visible tail, without touching fuse or damage',async()=>{
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(game,/new THREE\.InstancedMesh\(artilleryGlowGeometry/);
  assert.match(game,/artilleryFlight\(blast,Math\.max\(blast\.at/);
  const blast={x:3,z:1,fromX:-5,fromZ:-2,at:100,detonateAt:1100};
  const head=artilleryFlight(blast,650),tail=artilleryFlight(blast,650-192);
  assert.ok(head.x>tail.x&&head.y>0&&tail.y>0);
  assert.equal(artilleryFlight(blast,1100).t,1);
});
