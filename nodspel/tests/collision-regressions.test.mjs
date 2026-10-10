import test from 'node:test';
import assert from 'node:assert/strict';
import * as physics from '../physics.mjs';
import {createRound,activateNode} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {createWeapon,fireWeapon,stepWeapon} from '../weapon.js';
import {generateLevel} from '../levels.js';
const enemy=(x=0,z=0)=>({id:'foe',kind:'enemy',x,z,r:.48,health:2,active:true,speed:1});
const floor=[{x:0,z:0,w:12,d:12}];
test('overlapping circular actors can escape instead of freezing movement',()=>{
 const p=physics.movePlayer({x:.1,z:0},{x:0,z:1},[{x:0,z:0,r:.48}],floor,.36);
 assert.ok(p.z>.9);
});
test('player pushes an enemy in a narrow passage without either intersecting walls',()=>{
 assert.equal(typeof physics.moveWithActors,'function');
 const foes=[enemy()],walls=[{x:0,z:-.7,w:10,d:.4},{x:0,z:.7,w:10,d:.4}];
 let p={x:-1,z:0};for(let i=0;i<40;i++)p=physics.moveWithActors(p,{x:.08,z:0},foes,walls,floor,.36);
 assert.ok(p.x>1.9);assert.ok(foes[0].x>p.x+.83);assert.ok(Math.abs(p.z)<.14);
});
test('spawn overlap separates even during room grace, with an escape from a wall',()=>{
 const r=createRound('separation',0);r.level.enemies=[enemy()];r.level.floors=floor;
 const p={x:0,z:0},walls=[{x:-.65,z:0,w:.4,d:8}];
 stepCombat(r,createCombat(r.level,0),p,100,.04,walls);
 assert.ok(Math.hypot(p.x-r.level.enemies[0].x,p.z-r.level.enemies[0].z)>=.84-1e-6);
 assert.ok(p.x>=-.09);assert.ok(r.level.enemies[0].x>=.03);
});
test('level two reinforcements cannot pin a player standing on their spawn',()=>{
 const r=createRound('pin',0);r.level=generateLevel(2,'pin');const c=createCombat(r.level,0);
 const e=r.level.enemies.find(e=>e.active===false),p={x:e.x,z:e.z};activateNode(r,r.level.nodes[0].id,100);
 stepCombat(r,c,p,101,.04,[...r.level.walls,...r.level.boxes]);
 for(const foe of r.level.enemies)assert.ok(Math.hypot(p.x-foe.x,p.z-foe.z)>=.84-1e-6);
});
test('a shot grazing a clean corner follows its unobstructed aim line',()=>{
 const r=createRound('corner',0),w=createWeapon();r.level.nodes=[];r.level.enemies=[enemy(3,.26)];
 const walls=[{x:0,z:-1,w:2,d:2}],p={x:1.26,z:.26};
 assert.deepEqual(physics.aimEndpoint(p,{x:1,z:0},7,walls),{x:8.26,z:.26});
 fireWeapon(w,p,{x:1,z:0},0);stepWeapon(w,r,100,.2,walls);
 assert.equal(r.level.enemies[0].health,1);
});
test('a real wall still blocks a shot beside a corner',()=>{
 const r=createRound('blocked-corner',0),w=createWeapon();r.level.nodes=[];r.level.enemies=[enemy(-2,-.2)];
 fireWeapon(w,{x:1.36,z:-.2},{x:-1,z:0},0);stepWeapon(w,r,100,.3,[{x:0,z:-1,w:2,d:2}]);
 assert.equal(r.level.enemies[0].health,2);assert.equal(w.projectiles.length,0);
});

test('circular enemy body cannot be walked through',()=>{const p=physics.movePlayer({x:-2,z:0},{x:4,z:0},[{x:0,z:0,r:.48}],floor,.36);assert.ok(p.x<=-.84+1e-6);});

test('a wall-pinned enemy cannot imprison the player or shove either body through cover',()=>{
 const foes=[enemy(.5,0)],walls=[{x:1.2,z:0,w:.4,d:8}];let p={x:-.2,z:0};
 for(let i=0;i<20;i++){
   p=physics.moveWithActors(p,{x:.08,z:.05},foes,walls,floor,.36);
   assert.ok(Math.hypot(p.x-foes[0].x,p.z-foes[0].z)>=.84-1e-6);
   assert.ok(foes[0].x<=.52+1e-6);assert.ok(p.x<=.64+1e-6);assert.equal(foes[0].health,2);
 }
 const before={...p};p=physics.moveWithActors(p,{x:-1,z:0},foes,walls,floor,.36);assert.ok(p.x<before.x-.8);
});
test('near a clean corner, different clear angles hit but crossing angles remain blocked',()=>{
 const wall={x:0,z:-1,w:2,d:2},p={x:1.26,z:.26};
 for(const direction of [{x:1,z:0},{x:1,z:1},{x:0,z:1},{x:-1,z:1}]){
   const r=createRound('angles',0),w=createWeapon(),length=Math.hypot(direction.x,direction.z);
   r.level.nodes=[];r.level.enemies=[enemy(p.x+direction.x/length*3,p.z+direction.z/length*3)];
   fireWeapon(w,p,direction,0);stepWeapon(w,r,100,.3,[wall]);assert.equal(r.level.enemies[0].health,1);
 }
});

test('visible level two passages stay walkable even with an enemy in the doorway',()=>{
 for(let i=0;i<30;i++){
   const level=generateLevel(2,`doorway-${i}`),c=level.corridors[0],dir=c.dir;
   const from={x:c.x-dir.x*(c.w/2+1),z:c.z},to={x:c.x+dir.x*(c.w/2+1),z:c.z};
   const foes=[enemy(c.x,c.z)],solids=[...level.walls,...level.boxes];
   const p=physics.moveWithActors(from,{x:to.x-from.x,z:to.z-from.z},foes,solids,level.floors,.36);
   assert.ok(Math.hypot(p.x-to.x,p.z-to.z)<.01,level.seed);
   assert.ok(Math.hypot(p.x-foes[0].x,p.z-foes[0].z)>=.84-1e-6);
 }
});
