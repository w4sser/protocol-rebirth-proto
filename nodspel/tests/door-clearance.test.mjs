// v2.28.6 playtest 2026-11-08 "enemies and I get stuck around corridors": a Bunker L2 partition ran wall to wall at z-.8
// and its end jutted into the east/west doorway mouth. These tests lock the root fix with invariants, not one seed.
import test from 'node:test';import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';import {movePlayer} from '../physics.mjs';
const near=(p,o)=>{const cx=Math.max(o.x-o.w/2,Math.min(p.x,o.x+o.w/2)),cz=Math.max(o.z-o.d/2,Math.min(p.z,o.z+o.d/2));return Math.hypot(p.x-cx,p.z-cz);};
const free=(p,r,L,solids)=>[[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([a,b])=>L.floors.some(f=>Math.abs(p.x+a-f.x)<=f.w/2&&Math.abs(p.z+b-f.z)<=f.d/2))&&!solids.some(o=>near(p,o)<r+.02);
const levels=function*(){for(let s=0;s<40;s++)for(let n=1;n<=3;n++)for(const hard of [false,true])yield [n,`dc-${s}`,hard,generateLevel(n,`dc-${s}`,'bunker',hard)];};
test('no partition wall reaches into a doorway mouth (bunker, all levels, hard too)',()=>{
  for(const [n,s,h,L] of levels())for(const room of L.rooms.filter(r=>r.partition))for(const dir of room.doors.filter(d=>d.x!==0)){
    const mouth={x:room.x+dir.x*room.w/2,z:room.z};const door=L.corridors[0]?.width??1.8;
    const parts=L.walls.filter(w=>Math.abs(w.z-room.partition.z)<.01&&w.h===1.7);
    for(const w of parts){const top=w.z+w.d/2,bot=w.z-w.d/2;const reaches=Math.abs(w.x+Math.sign(dir.x)*w.w/2-mouth.x)<.5;
      if(reaches)assert.ok(top<=mouth.z-door/2+1e-6||bot>=mouth.z+door/2-1e-6,`${n}/${s}/${h}: partition overlaps the doorway span`);}}
});
test('player (.36) and enemy (.48) bodies walk into every corridor from walkable starts on both sides',()=>{
  let tried=0;
  for(const [n,s,h,L] of levels()){const solids=[...L.walls,...L.boxes];
    for(const c of L.corridors){const ax=c.dir.x?'x':'z',ox=ax==='x'?'z':'x',len=ax==='x'?c.w:c.d;
      for(const end of [-1,1])for(const r of [.36,.48])for(const off of [-1.2,-.8,-.4,0,.4,.8,1.2])for(const d of [1.6,2.4]){
        const p0={[ax]:c[ax]+end*(len/2+d),[ox]:c[ox]+off};if(!free(p0,r,L,solids))continue;tried++;
        const goal={[ax]:c[ax],[ox]:c[ox]};let p=p0,ok=false;
        for(let t=0;t<300;t++){const dx=goal.x-p.x,dz=goal.z-p.z,dd=Math.hypot(dx,dz);if(dd<.3){ok=true;break;}p=movePlayer(p,{x:dx/dd*.06,z:dz/dd*.06},solids,L.floors,r);}
        assert.ok(ok,`${n}/${s}/${h} r${r} from ${JSON.stringify(p0)} stuck at ${JSON.stringify(p)}`);}}}
  assert.ok(tried>5000,`enough approaches sampled (${tried})`);
});
