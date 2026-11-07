import test from 'node:test';
import assert from 'node:assert/strict';
import {assignEnvironmentRegions,planProfiledDressing} from '../polyfork-profiles.mjs';
import {propReservations} from '../props-placement.mjs';

const base={
 archipelago:true,seed:'env-profile-test-12',
 floors:[
   {x:0,z:0,w:28,d:26},
   {x:46,z:0,w:28,d:26},
   {x:92,z:0,w:28,d:26},
   {x:23,z:0,w:18,d:4.1,dir:{x:1,z:0}},
   {x:69,z:0,w:18,d:4.1,dir:{x:1,z:0}}
 ],
 walls:[],rooms:[],nodes:[{x:0,z:5}],lootBoxes:[{x:4,z:4}],enemies:[{x:-5,z:3}],
 start:{x:-9,z:0},exit:{x:100,z:0}
};
test('seeded region assignment is repeatable and identities alternate for distinct islands',()=>{
 const a=assignEnvironmentRegions(base);
 assert.equal(a.length,3);
 assert.deepEqual(a,assignEnvironmentRegions(base));
 assert.ok(a.every(x=>['forest','granite'].includes(x.profile)));
 assert.notEqual(a[0].profile,a[1].profile);
 assert.notEqual(a[1].profile,a[2].profile);
 assert.equal(assignEnvironmentRegions({...base,archipelago:false}).length,0);
});
test('clustered placement is repeatable and safely avoids reserved areas and central clearings',()=>{
 const a=planProfiledDressing(base,{quality:'high'});
 assert.deepEqual(a,planProfiledDressing(base,{quality:'high'}));
 assert.ok(a.items.length>10);
 assert.ok(a.items.length<=125);
 const res=propReservations(base);
 for(const item of a.items){
   assert.equal(res.blocked(item.x,item.z,.55),false);
   const region=a.regions[item.region],cl=region.clearing;
   assert.ok(Math.hypot(item.x-cl.x,item.z-cl.z)>=cl.radius);
   assert.equal(item.profile,region.profile);
   const floor=base.floors[item.region];
   assert.ok(Math.abs(item.x-floor.x)<=floor.w/2 && Math.abs(item.z-floor.z)<=floor.d/2);
 }
});
test('LOW is bounded, is a subset of HIGH and preserves profile identity',()=>{
 const high=planProfiledDressing(base,{quality:'high'});
 const low=planProfiledDressing(base,{quality:'low'});
 assert.ok(low.items.length<=40);
 const key=p=>[p.id,p.x,p.z,p.h].join('/');
 const allowed=new Set(high.items.map(key));
 assert.ok(low.items.every(p=>allowed.has(key(p))));
 assert.deepEqual(low.regions,high.regions);
 assert.deepEqual(planProfiledDressing({...base,archipelago:false}).items,[]);
});
