import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {coastlineProfile} from '../coastline.mjs';
import {registerWalkableCoast,isPointOnFloor,hasWalkableCoast} from '../archipelago-playable.mjs?v=2.28.25-organic-v2';
import {movePlayer} from '../physics.mjs';
import {generateLevel} from '../levels.js';
import {buildArchipelago} from '../archipelago.js';

const F={x:0,z:0,w:12,d:12};

test('v2 coast is deterministic, genuinely walkable outside the old rectangle',()=>{
  const a=coastlineProfile(F,'glacial-01',{style:'v2'});
  const b=coastlineProfile(F,'glacial-01',{style:'v2'});
  assert.deepEqual(a,b);
  assert.equal(a.style,'v2');
  assert.ok(a.points.every(p=>p.playableRadial>p.innerRadial+.15));
  assert.ok(a.points.some(p=>p.playableRadial>p.innerRadial+1.0));
  assert.ok(new Set(a.points.map(p=>Math.round((p.radial-p.innerRadial)*2))).size>=3,'not uniform circular or rectangular outline');
  registerWalkableCoast(F,a);
  assert.equal(hasWalkableCoast(F),true);
  assert.ok(isPointOnFloor(F,0,0));
  assert.ok(isPointOnFloor(F,6.5,0),'former rectangle boundary is no longer the walk limit');
  assert.ok(!isPointOnFloor(F,14,0),'the island still has a real boundary');
  const moved=movePlayer({x:5.1,z:0},{x:2,z:0},[],[F],.25);
  assert.ok(moved.x>6.45,'player moves beyond former rectangular floor into the organic island');
  assert.ok(moved.x<12,'player cannot move indefinitely onto water');
});

test('connected islands preserve a water gap and an authored bridge',()=>{
  const left={x:0,z:0,w:12,d:12},right={x:16,z:0,w:12,d:12};
  const profiles=[left,right].map(f=>coastlineProfile(f,'bridge-water',{style:'v2',neighbors:[left,right]}));
  const l=profiles[0].points[0],r=profiles[1].points[profiles[1].points.length/2];
  assert.ok(r.x>l.x+.75,'opposing shorelines leave visible water and bridge structure');
  assert.ok(l.playableRadial>l.innerRadial,'left playable extension remains organic');
  assert.ok(r.playableRadial>r.innerRadial,'right playable extension remains organic');
});

test('the real Archipelago build connects terrain, water and walkable coast without changing authored rooms',()=>{
  const original=globalThis.location;
  globalThis.location={search:'?area=archipelago&archVisual=v2&archTarget=1&ground=2'};
  const level=generateLevel(1,'archipelago-v2-target','archipelago');
  const authorFloors=JSON.stringify(level.floors);
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    o.position.set(x,y,z);parent.add(o);return o;
  };
  try{
    const out=buildArchipelago(level,group,box,{quality:{props:1}});
    assert.equal(out.visualV2,true);
    const islands=level.floors.filter(f=>!f.dir);
    assert.ok(islands.length>0);
    assert.ok(islands.every(hasWalkableCoast),'all islands use organic physical boundaries');
    assert.equal(JSON.stringify(level.floors),authorFloors,'authoring and spawn geometry unchanged');
    const coastal=group.children.filter(o=>o.name==='archipelago-coast-shell');
    const granite=group.children.filter(o=>o.name==='arch-v2-glacial-shelves');
    assert.equal(coastal.length,islands.length);
    assert.equal(granite.length,islands.length);
    assert.equal(group.children.filter(o=>o.name==='arch-v2-rock-cut-portal').length,1);
    assert.ok(group.children.some(o=>o.name==='arch-v2-distant-skerry'),'distant landscape adds a sense of scale');
    const water=group.children.find(o=>o.name==='water');
    assert.equal(water.material.uniforms.cSky.value.getHexString(),'9e879d');
    assert.ok(!level.walls.some(w=>w.shore),'obsolete rectangular shoreline collider removed');
    assert.ok(islands.every(f=>isPointOnFloor(f,f.x,f.z)));
  }finally{
    if(original===undefined)delete globalThis.location;else globalThis.location=original;
    group.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();
      if(o.material&&!o.material.userData.shared)o.material.dispose();});
  }
});

test('legacy Archipelago mode retains rectangle-based physics',()=>{
  const f={x:0,z:0,w:12,d:12};
  assert.equal(hasWalkableCoast(f),false);
  assert.ok(!isPointOnFloor(f,6.1,0));
  const moved=movePlayer({x:5.1,z:0},{x:2,z:0},[],[f],.25);
  assert.ok(moved.x<=5.9);
});
