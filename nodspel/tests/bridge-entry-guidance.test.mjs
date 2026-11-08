import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer,describeMoveBlock} from '../physics.mjs';
import {guideBridgeApproach} from '../bridge-flow.mjs';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {generateBigLevel} from '../big-level.js';
import {buildArchipelago} from '../archipelago.js';

const mk=(axis='x')=>{
  const vertical=axis==='z',roomA={x:0,z:0,w:12,d:12};
  const roomB=vertical?{x:0,z:19,w:12,d:12}:{x:19,z:0,w:12,d:12};
  const bridge=vertical
    ?{x:0,z:9.5,w:4,d:7,dir:{x:0,z:1},bridgeFunnel:true}
    :{x:9.5,z:0,w:7,d:4,dir:{x:1,z:0},bridgeFunnel:true};
  return {archipelago:true,floors:[roomA,bridge,roomB],bridge,rooms:[roomA,roomB]};
};

test('an off-center straight run no longer sticks on the taper, both directions and axes',()=>{
  for(const axis of ['x','z'])for(const bank of [0,1])for(const side of [-1,1])for(const radius of [.36,.48]){
    const level=mk(axis),across=axis==='x'?'z':'x',direction=bank===0?1:-1;
    const start={x:0,z:0};
    start[axis]=bank===0?5:14;
    start[across]=side*2.6;
    const raw={x:0,z:0};raw[axis]=direction*.10;
    // Before: even with a valid landfall, steady forward movement stuck as
    // the wide entrance narrowed down to the normal open-water lane.
    let old={...start};
    for(let i=0;i<95;i++)old=movePlayer(old,raw,[],level.floors,radius);
    assert.ok(direction*(old[axis]-start[axis])<3.6,'fixture must reproduce old stall');
    let pos={...start};
    for(let i=0;i<95;i++){
      const delta=guideBridgeApproach(level,pos,raw,radius,{x:0,z:0});
      pos=movePlayer(pos,delta,[],level.floors,radius);
    }
    assert.ok(direction*(pos[axis]-start[axis])>7.1,
      'bridge approach still snagged: '+JSON.stringify({axis,bank,side,radius,start,old,pos}));
    assert.ok(Math.abs(pos[across])<1.8,'guidance settles within actual bridge width');
  }
});

test('bridge guidance only affects forward entry near the landfall',()=>{
  const level=mk('x'),start={x:5,z:2.6};
  const sideways={x:0,z:.1},away={x:-.1,z:0},forward={x:.1,z:0};
  assert.deepEqual(guideBridgeApproach(level,start,sideways,.36,{x:0,z:0}),sideways);
  assert.deepEqual(guideBridgeApproach(level,start,away,.36,{x:0,z:0}),away);
  assert.ok(guideBridgeApproach(level,start,forward,.36,{x:0,z:0}).z<0);
  assert.deepEqual(guideBridgeApproach({...level,archipelago:false},start,forward,.36,{x:0,z:0}),forward);
});

test('diagnostics identify floor, shoreline, granite rock and rails',()=>{
  const floors=[{x:0,z:0,w:8,d:8}];
  const from={x:0,z:0};
  assert.equal(describeMoveBlock(from,{x:4,z:0},[],floors,.36).kind,'floor');
  assert.equal(describeMoveBlock(from,{x:1,z:0},[{x:1,z:0,w:.4,d:1,shore:true}],floors,.36).kind,'shore');
  assert.equal(describeMoveBlock(from,{x:1,z:0},[{x:1,z:0,r:.7,rock:true}],floors,.36).kind,'rock');
  assert.equal(describeMoveBlock(from,{x:1,z:0},[{x:1,z:0,w:.4,d:1,bridgeRail:true}],floors,.36).kind,'rail');
});

test('real seeded archipelago bridges allow an off-center run past the shoreline collider',()=>{
  for(const big of [false,true])for(let seed=0;seed<3;seed++){
    const level=big?generateBigLevel('guide-real-big-'+seed,'archipelago')
      :generateLevel(2,'guide-real-'+seed,'archipelago');
    const group=new THREE.Group();
    const box=(x,y,z,w,h,d,color,parent=group)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
      mesh.position.set(x,y,z);parent.add(mesh);return mesh;
    };
    buildArchipelago(level,group,box,{quality:{props:0}});
    for(const [i,c] of level.corridors.slice(0,4).entries()){
      const axis=c.dir.x?'x':'z',sideAxis=c.dir.x?'z':'x';
      const adjacent=c.roomIds?c.roomIds.map(id=>level.rooms.find(r=>r.id===id))
        :[level.rooms[i],level.rooms[i+1]];
      for(const room of adjacent.filter(Boolean)){
        const direction=Math.sign(c[axis]-room[axis])||1;
        const distanceToCenter=Math.abs(c[axis]-(room[axis]+direction*(room[c.dir.x?'w':'d']/2-1.4)));
        // When a bridge is very long, check only its first half; other room
        // geometry is not part of this landing test.
        const minProgress=Math.max(1.8,distanceToCenter-1);
        for(const radius of [.36,.48])for(const side of [-1,1]){
          const pos={x:room.x,z:room.z};
          pos[axis]+=direction*(room[c.dir.x?'w':'d']/2-1.4);
          pos[sideAxis]=c[sideAxis]+side*((c.dir.x?c.d:c.w)/2+.35);
          const start={...pos},raw={x:0,z:0};
          raw[axis]=direction*.1;
          for(let step=0;step<170;step++){
            const delta=guideBridgeApproach(level,pos,raw,radius,{x:0,z:0});
            const next=movePlayer(pos,delta,[...level.walls,...level.boxes],level.floors,radius);
            pos.x=next.x;pos.z=next.z;
            if(direction*(pos[axis]-start[axis])>=minProgress)break;
          }
          assert.ok(direction*(pos[axis]-start[axis])>=minProgress-.1,
            'real bridge entry blocked: '+JSON.stringify({big,seed,axis,side,radius,room:room.id,
              start,pos,bridge:c,progress:direction*(pos[axis]-start[axis]),minProgress}));
        }
      }
    }
  }
});
