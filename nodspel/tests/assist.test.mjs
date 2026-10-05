import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound} from '../round.js';
import {createWeapon,fireWeapon,stepWeapon} from '../weapon.js';
const weapon=await import('../weapon.js');
test('weak aim locks the nearest visible enemy close to the direction, but leaves free aim otherwise',()=>{
  assert.equal(typeof weapon.assistAim,'function');
  const near={id:'near',kind:'enemy',x:3,z:.4,r:.48,health:2},far={...near,id:'far',x:5};
  const result=weapon.assistAim({x:0,z:0},{x:1,z:0},[far,near],[]);
  assert.equal(result.target.id,'near');assert.ok(result.direction.z>0&&result.direction.z<.4/Math.hypot(3,.4));
  for(const enemy of [{...near,x:9},{...near,x:0,z:3},{...near,health:0}])assert.equal(weapon.assistAim({x:0,z:0},{x:1,z:0},[enemy],[]).target,null);
  assert.deepEqual(weapon.assistAim({x:0,z:0},{x:1,z:0},[],[]).direction,{x:1,z:0});
  assert.equal(weapon.assistAim({x:0,z:0},{x:1,z:0},[near],[{x:1.5,z:0,w:.2,d:2}]).target,null);
});
test('a near miss counts as a wide shot hit, but cover still blocks it',()=>{
  for(const covered of [false,true]){
    const r=createRound('wide',0),w=createWeapon();r.level.nodes=[];
    const foe={id:'foe',kind:'enemy',x:3,z:.7,r:.48,health:2};r.level.enemies=[foe];
    fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
    stepWeapon(w,r,100,.3,covered?[{x:1.5,z:0,w:.2,d:3}]:[]);
    assert.equal(foe.health,covered?2:1);
  }
});
test('wide shots cannot graze a target hidden around a wall corner',()=>{
  const r=createRound('corner',0),w=createWeapon();r.level.nodes=[];
  const foe={id:'foe',kind:'enemy',x:3,z:.7,r:.48,health:2};r.level.enemies=[foe];
  fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
  stepWeapon(w,r,100,.3,[{x:2,z:.7,w:.2,d:.5}]);assert.equal(foe.health,2);
});
test('one miss plus two forgiving hits defeats level one and still leaves reload available',()=>{
  const r=createRound('forgiving',0),w=createWeapon();r.level.nodes=[];
  const foe=r.level.enemies[0];foe.x=3;foe.z=.7;
  fireWeapon(w,{x:0,z:0},{x:-1,z:0},0);stepWeapon(w,r,100,.4,[]);
  for(let i=1;i<=2;i++){fireWeapon(w,{x:0,z:0},{x:1,z:0},i*200);stepWeapon(w,r,i*200+100,.3,[]);}
  assert.equal(foe.health,0);assert.equal(r.enemiesDefeated,1);assert.equal(r.over,false);
  weapon.tickWeapon(w,700);assert.ok(w.ammo>=1);
});
