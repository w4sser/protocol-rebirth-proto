// v2.28.75 (Robert 24 Nov 2026 Depth Raid playtest, t451u item 2): "walls in corners don't
// align" -- every Depth doorway jamb had a one-wall-thickness notch where the render-only wall
// shell (bunker.js shellMesh(wallSolids(level.walls))) actually has no geometry at all. The
// notch is between the room's own flanking wall (punchOpening/recutOpening, which reaches the
// room's exterior corner) and the corridor's side wall from addLinkSegment, which is
// deliberately trimmed short of that same corner so the player capsule never snags on it
// (v2.28.66). The fix adds level.wallDecor: a render-only, untrimmed copy of each addLinkSegment
// side wall, merged into the wall shell's input in bunker.js but never into collision.
//
// This test re-derives the jamb geometry independently (room corner + the corridor side wall's
// own lateral offset, both plain geometry from RULES/LINK_WIDTH) rather than calling any
// production helper, so it would fail if wallDecor regressed or stopped reaching the corner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateDepthLevel,LINK_WIDTH} from '../depth-raid.js';
import {RULES} from '../levels.js';

const WALL_T=RULES.wallThickness;
const TOLERANCE=0.03; // 3 cm, per the playtest note

const SEEDS=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf','layout',
  'gear-on-pad','clear-prompts','go-deeper-walk','push-without-clear','seed0','seed7','seed19','repro-depth'];

function covered(walls,x,z){
  return walls.some(w=>Math.abs(x-w.x)<w.w/2+1e-6&&Math.abs(z-w.z)<w.d/2+1e-6);
}
// Marching outward from the room's exterior corner along the doorway's travel direction, at the
// lateral offset where the corridor's own side wall sits: how far before wall coverage begins?
// Flush construction means this is ~0; the pre-fix notch made it jump straight to the corridor's
// trim setback (LINK_WIDTH/2+WALL_T stepped back from the floor's padded ends -- about 0.4 m in
// the common case).
function firstCoverageDistance(walls,edge,dir,lateralOffset){
  const perp={x:-dir.z,z:dir.x};
  const step=0.005,max=2.5;
  for(let t=0;t<=max;t+=step){
    const x=edge.x+dir.x*t+perp.x*lateralOffset,z=edge.z+dir.z*t+perp.z*lateralOffset;
    if(covered(walls,x,z))return t;
  }
  return Infinity;
}
function roomDoorDirs(room){
  const seen=new Set(),out=[];
  for(const d of room.doors??[]){
    if(!d||typeof d.x!=='number'||Math.abs(d.x)+Math.abs(d.z??0)>1.01||'w' in d||'id' in d)continue;
    const key=`${d.x},${d.z}`;if(seen.has(key))continue;seen.add(key);out.push(d);
  }
  return out;
}

test('every Depth room doorway jamb is flush: the render wall shell has no gap at the corner (<=3cm)', () => {
  const failures=[];
  for(const seed of SEEDS){
    const L=generateDepthLevel(seed);
    const renderWalls=[...L.walls,...(L.wallDecor??[])];
    for(const room of L.rooms??[]){
      for(const dir of roomDoorDirs(room)){
        const edge={x:room.x+dir.x*room.w/2,z:room.z+dir.z*room.d/2};
        const lateral=LINK_WIDTH/2-WALL_T/2;
        for(const sign of [-1,1]){
          const gap=firstCoverageDistance(renderWalls,edge,dir,sign*lateral);
          if(gap===Infinity)continue; // this side of the doorway has no corridor wall to connect to at all
          if(gap>TOLERANCE)failures.push(`${seed} room(${room.x},${room.z}) dir(${dir.x},${dir.z}) side ${sign}: wall coverage starts ${gap.toFixed(3)}m from the room corner`);
        }
      }
    }
  }
  assert.equal(failures.length,0,failures.slice(0,20).join('\n'));
});

test('level.wallDecor is render-only: it never changes the collision list a Depth round uses', () => {
  for(const seed of SEEDS.slice(0,4)){
    const L=generateDepthLevel(seed);
    assert.ok((L.wallDecor??[]).length>0,`${seed} expected wallDecor entries from addLinkSegment`);
    // Every wallDecor entry must have an exact collision counterpart at the same (x,z) that is
    // no longer than it (wallDecor only ever widens the render footprint, never the collider).
    for(const decor of L.wallDecor){
      const partner=L.walls.find(w=>Math.abs(w.x-decor.x)<1e-6&&Math.abs(w.z-decor.z)<1e-6&&Math.abs(w.h-decor.h)<1e-6);
      assert.ok(partner,`${seed} wallDecor at ${decor.x},${decor.z} has no matching collision wall`);
      assert.ok(partner.w<=decor.w+1e-6&&partner.d<=decor.d+1e-6,`${seed} wallDecor at ${decor.x},${decor.z} is not >= its collision counterpart`);
    }
  }
});
