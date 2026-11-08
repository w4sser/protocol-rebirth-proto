import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,RULES} from '../levels.js';
import {generateBigLevel} from '../big-level.js';
import {bridgeMouthWidth} from '../bridge-flow.mjs';

// Bunker/town corridor corners must be closed at the original doorway width.
// Archipelago deliberately has a wider land-side mouth; the old probe inside that
// opening must remain free. Probe instead at the OUTSIDE edge of the new mouth
// to catch genuine missing room-wall segments without rejecting diagonal entry.
const covers=(walls,p)=>walls.some(w=>Math.abs(p.x-w.x)<w.w/2+1e-9&&Math.abs(p.z-w.z)<w.d/2+1e-9);

function cornerProbes(level){
  const t=RULES.wallThickness,items=[...level.corridors,...level.deadEnds,...(level.closet?[level.closet]:[])],probes=[];
  for(const c of items){
    const axisLen=c.dir.x?c.w:c.d,center=c.dir.x?c.x:c.z;
    // a branch (dead end / closet) joins a room only at its near end - the far end is already
    // sealed by its own cap wall in addBranch, so it never had this gap to begin with
    const nearEnd=c.end?center-(c.dir.x?c.dir.x:c.dir.z)*axisLen/2:null;
    for(const endVal of [center-axisLen/2,center+axisLen/2]){
      if(c.end&&Math.abs(endVal-nearEnd)>1e-6)continue;
      const away=endVal<center?-1:1;
      const room=level.archipelago&&level.rooms.find(r=>c.dir.x
        ?Math.abs(Math.abs(endVal-r.x)-r.w/2)<.02&&Math.abs(c.z-r.z)<.02
        :Math.abs(Math.abs(endVal-r.z)-r.d/2)<.02&&Math.abs(c.x-r.x)<.02);
      const mouth=room?bridgeMouthWidth(c.width,c.dir.x?room.d:room.w,t):c.width;
      const cross=room?mouth/2+t/2:c.width/2-t/2;
      // The outward corridor end is the near side of the adjoining room.
      // Check the surviving room wall beyond the widened mouth, not the
      // deliberately empty space inside that mouth.
      const axis=endVal+away*t/2;
      for(const sign of [-1,1])probes.push(c.dir.x
        ?{x:axis,z:c.z+sign*cross}
        :{x:c.x+sign*cross,z:axis});
    }
  }
  return probes;
}

test('generated corridor and branch walls fully close every room-connection corner (no gap/wrong-end)',()=>{
  let total=0;
  for(const seed of ['seams','art','a','corner-evidence','xyz123'])
    for(const n of [1,2,3])
      for(const area of ['bunker','archipelago','town']){
        const level=generateLevel(n,seed,area,false,false),probes=cornerProbes(level);
        total+=probes.length;
        for(const p of probes)assert.ok(covers(level.walls,p),`${area} L${n} seed=${seed}: gap at corridor/branch-room corner ${JSON.stringify(p)}`);
      }
  assert.ok(total>50,'test exercised a meaningful number of corners');
});

test('big-level corridor walls meet room walls across each shared boundary',()=>{
  const t=RULES.wallThickness,width=RULES.levels[1].passage;
  for(const seed of ['seams','art','a','corner-evidence','xyz123']){
    const level=generateBigLevel(seed);
    for(const c of level.corridors){
      const alongX=!!c.dir.x,center=alongX?c.x:c.z,length=alongX?c.w:c.d;
      for(const end of [-1,1])for(const side of [-1,1])for(const offset of [-t/2,t/2]){
        const axis=center+end*length/2+offset,cross=side*(width/2+t/2);
        const p=alongX?{x:axis,z:c.z+cross}:{x:c.x+cross,z:axis};
        assert.ok(covers(level.walls,p),`${seed}: big-level corner gap at ${JSON.stringify(p)}`);
      }
    }
  }
});
