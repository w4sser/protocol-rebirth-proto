import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
import {generateBigLevel} from '../big-level.js';
import {movePlayer} from '../physics.mjs';
import {BRIDGE_LAND_MOUTH_EXTRA,BRIDGE_LAND_RAIL_RECESS,bridgeMouthWidth} from '../bridge-flow.mjs';

// Tests the actual 9-sample, collision-aware player movement, not a loose
// rectangle-overlap approximation. Before the change, angled approaches
// contacted invisible corridor rails at the island boundary.
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function diagonalApproach(level,room,c,side,radius){
  const xAxis=!!c.dir.x,along=xAxis?'x':'z',across=xAxis?'z':'x';
  const direction=Math.sign(c[along]-room[along])||Math.sign(c.dir[along])||1;
  const edge=room[along]+direction*room[xAxis?'w':'d']/2;
  const bridgeWidth=c[xAxis?'d':'w'];
  const start={x:0,z:0},target={x:0,z:0};
  start[along]=edge-direction*2.5;
  target[along]=edge+direction*1;
  start[across]=c[across]+side*(bridgeWidth/2+.85);
  // Aim for the middle third, not the very edge, while cutting the corner.
  target[across]=c[across]+side*Math.max(0,bridgeWidth/2-1.3);
  const delta={x:target.x-start.x,z:target.z-start.z};
  const result=movePlayer(start,delta,[...level.walls,...level.boxes],level.floors,radius);
  return {start,target,result,miss:dist(result,target)};
}
test('wider land mouths, unchanged bridge over water',()=>{
  assert.equal(bridgeMouthWidth(4,12),4+BRIDGE_LAND_MOUTH_EXTRA);
  assert.ok(BRIDGE_LAND_RAIL_RECESS>.4);
  assert.ok(bridgeMouthWidth(4,6)<6-.8);
  const floor={x:9.5,z:0,w:7.08,d:4,dir:{x:1,z:0}};
  const room={x:0,z:0,w:12,d:12};
  const sideWalls=[-1,1].map(s=>({x:9.5,z:s*2.2,w:7.08-2*BRIDGE_LAND_RAIL_RECESS,d:.4}));
  const roomWalls=[-1,1].map(s=>({x:5.8,z:s*(12+bridgeMouthWidth(4,12))*.25,w:.4,d:(12-bridgeMouthWidth(4,12))/2}));
  const sample={archipelago:true,floors:[room,{x:19,z:0,w:12,d:12},floor],walls:[...sideWalls,...roomWalls],boxes:[]};
  const a=diagonalApproach(sample,room,{x:9.5,z:0,w:7.08,d:4,dir:floor.dir},1,.36);
  assert.ok(a.miss<.25,`land-side diagonal can cut onto timber bridge: ${JSON.stringify(a)}`);
  const water=movePlayer({x:9,z:0},{x:0,z:6},sample.walls,sample.floors,.36);
  assert.ok(water.z<2,`water corridor remains strictly limited: ${JSON.stringify(water)}`);
});
test('generated standard archipelago bridge landings allow diagonal entry in both orientations',()=>{
  const failures=[];
  let sampled=0;
  for(const n of [2,3])for(let seed=0;seed<12;seed++){
    const level=generateLevel(n,`bridge-angle-${seed}`,'archipelago');
    for(const [i,c] of level.corridors.entries()){
      const room=level.rooms[i];
      for(const radius of [.36,.48])for(const side of [-1,1]){
        const result=diagonalApproach(level,room,c,side,radius);sampled++;
        if(result.miss>.45)failures.push({level:n,seed,corridor:i,radius,side,miss:result.miss});
      }
    }
  }
  assert.ok(sampled>100);
  assert.deepEqual(failures,[]);
});
test('large seeded layouts retain a forgiving land-side approach without widening water corridors',()=>{
  const failures=[];
  let sampled=0;
  for(let seed=0;seed<8;seed++){
    const level=generateBigLevel(`bridge-angle-big-${seed}`,'archipelago');
    for(const c of level.corridors.slice(0,4)){
      const room=level.rooms[c.roomIds[0]];
      if(!room)continue;
      const width=c.dir.x?c.d:c.w;
      for(const radius of [.36,.48])for(const side of [-1,1]){
        const result=diagonalApproach(level,room,c,side,radius);sampled++;
        if(result.miss>.45)failures.push({seed,room:room.id,radius,side,width,miss:result.miss});
      }
    }
  }
  assert.ok(sampled>60);
  assert.deepEqual(failures,[]);
});
