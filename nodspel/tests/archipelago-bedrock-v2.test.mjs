import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import * as art from '../archipelago-visual-v2.mjs';
import {coastlineProfile,coastRingData} from '../coastline.mjs';
import {archipelagoDressingConfig} from '../archipelago-dressing-policy.mjs';
import {generateLevel} from '../levels.js';
import {archipelagoPassages} from '../archipelago-passages.js';
import {bridgeClearances} from '../bridge-flow.mjs';

const floor={x:0,z:0,w:18,d:16};
const profile=coastlineProfile(floor,'archipelago-v2-target',{style:'v2'});
const overlaps=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2;

test('v2 uses a few broad sculpted masses, deterministic across quality tiers',()=>{
  const before=JSON.stringify(profile);
  const high=art.planArchipelagoBedrock(profile,{high:true});
  const low=art.planArchipelagoBedrock(profile,{high:false});
  assert.deepEqual(high,low,'quality must not move primary landforms');
  assert.deepEqual(high,art.planArchipelagoBedrock(profile));
  assert.ok(high.masses.length>=2&&high.masses.length<=3);
  assert.ok(high.masses.every(m=>m.length>=3.5&&m.height>=1.2));
  assert.equal(JSON.stringify(profile),before,'planning cannot change collision coastline');
});

test('bedrock footprints clear bridge approaches and neighboring islands',()=>{
  const reservations=[{x:11,z:0,w:14,d:6},{x:-8,z:-9,w:6,d:7}];
  const neighbors=[floor,{x:24,z:0,w:12,d:16}];
  const plan=art.planArchipelagoBedrock(profile,{reservations,neighbors});
  assert.ok(plan.masses.length>0);
  for(const m of [...plan.masses,...plan.shelves]){
    assert.ok(!reservations.some(r=>overlaps(m.bounds,r)),'blocked bridge or approach');
    assert.ok(!overlaps(m.bounds,neighbors[1]),'rock entered neighboring island');
    const radial=Math.hypot(m.x-floor.x,m.z-floor.z);
    const index=Math.round(((m.angle+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*profile.points.length)%profile.points.length;
    assert.ok(radial-m.depth*.52>profile.points[index].playableRadial,'raised rocks stay beyond traversable coast');
  }
});

test('rendered bedrock has sculpted vertex-colored geometry and bounded draw budget',()=>{
  const group=new THREE.Group();
  const mesh=art.addArchipelagoGraniteV2(profile,group);
  assert.equal(mesh.name,'arch-v2-glacial-shelves');
  assert.ok(mesh.geometry.getAttribute('color'),'geological color variation');
  assert.ok(mesh.geometry.getAttribute('position').count>80,'rounded multi-ring bedrock, not a scaled platonic solid');
  assert.ok(group.children.length<=3,'instanced major masses and shelves');
  assert.equal(mesh.geometry.userData.shared,true,'sculpted geometry survives world rebuilds');
  assert.ok(group.children.every(m=>m.material.userData.shared));
  assert.ok(group.children.filter(m=>m!==mesh).every(m=>!m.geometry.userData.shared),'per-island apron geometry is disposable');
});

test('native v2 ground covers the coast, preserves flat actor height and healthy vegetation color',()=>{
  const group=new THREE.Group();
  const ground=art.addArchipelagoGroundV2(profile,group);
  const positions=ground.geometry.getAttribute('position');
  const colors=ground.geometry.getAttribute('color');
  const normals=ground.geometry.getAttribute('normal');
  assert.ok(positions.count>profile.points.length*3);
  for(let i=0;i<positions.count;i++)assert.ok(positions.getY(i)>=0&&positions.getY(i)<.018,'never bury gameplay rings or float actors');
  const green=Array.from({length:colors.count},(_,i)=>colors.getY(i)>colors.getX(i)&&colors.getY(i)>colors.getZ(i)).filter(Boolean).length;
  assert.ok(green/colors.count>.5,'most interior vertices read as olive/moss, not purple rock');
  assert.ok(normals.getY(profile.points.length*3)>.95,'ground faces the gameplay camera, not the seabed');
});

test('coast has one shared seam without coplanar fill or granite root planes',()=>{
  const group=new THREE.Group();
  const ground=art.addArchipelagoGroundV2(profile,group);
  const pts=ground.geometry.getAttribute('position'),n=profile.points.length;
  const coast=coastRingData(profile);
  assert.equal(coast.positions.length/3,n*6);
  for(let i=0;i<n;i++){
    const a=pts.count-n+i,b=i*3;
    // Ground's final ring and coastline's first ring must be the SAME edge.
    for(const [actual,expected] of [[pts.getX(a),coast.positions[b]],[pts.getY(a),coast.positions[b+1]],[pts.getZ(a),coast.positions[b+2]]])
      assert.ok(Math.abs(actual-expected)<1e-5,'identical world-space join, not 2-mm coplanar overlap');
    const r=Math.hypot(pts.getX(a)-floor.x,pts.getZ(a)-floor.z);
    assert.ok(r<profile.points[i].innerRadial,'ground ends before shore transition begins');
  }
  const rocks=new THREE.Group();
  art.addArchipelagoGraniteV2(profile,rocks);
  assert.ok(!rocks.children.some(x=>x.name==='arch-v2-bedrock-roots'),'planar root polygons intersected coast on mobile');
});

test('every raised bedrock vertex stays beyond the actual organic actor boundary',()=>{
  for(const seed of ['archipelago-v2-target','cove-02','bridge-water']){
    const p=coastlineProfile(floor,seed,{style:'v2'}),group=new THREE.Group();
    const mesh=art.addArchipelagoGraniteV2(p,group),positions=mesh.geometry.getAttribute('position'),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    for(let instance=0;instance<mesh.count;instance++){
      mesh.getMatrixAt(instance,matrix);
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(matrix);if(point.y<.02)continue;
        const a=(Math.atan2(point.z-floor.z,point.x-floor.x)+Math.PI*2)%(Math.PI*2),t=a/(Math.PI*2)*p.points.length,j=Math.floor(t),f=t-j;
        const edge=p.points[j].playableRadial*(1-f)+p.points[(j+1)%p.points.length].playableRadial*f;
        assert.ok(Math.hypot(point.x-floor.x,point.z-floor.z)>edge,seed+' has false cover inside walkable land');
      }
    }
  }
});

test('quiet v2 composition prevents the legacy scatter layer from competing with bedrock',()=>{
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?archVisual=v2&archTarget=1'}).enabled,false);
  assert.equal(archipelagoDressingConfig({area:'archipelago'}).enabled,true,'default military composition is preserved');
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?archVisual=v2&polyfork=1'}).enabled,true,'explicit comparison remains available');
});

test('actual multi-island rocks, roots and portal clear organic neighbors and actor limits',()=>{
  const radiusAt=(p,x,z,key)=>{
    const t=((Math.atan2(z-p.floor.z,x-p.floor.x)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*p.points.length,j=Math.floor(t),f=t-j;
    return p.points[j][key]*(1-f)+p.points[(j+1)%p.points.length][key]*f;
  };
  for(const seed of ['review-1','review-21','archipelago-v2-target'])for(const number of [1,2,3]){
    const level=generateLevel(number,seed,'archipelago'),profiles=level.floors.filter(f=>!f.dir).map(f=>coastlineProfile(f,level.seed,{style:'v2',neighbors:level.floors}));
    const reservations=[...archipelagoPassages(level),...bridgeClearances(level),...level.floors.filter(f=>f.dir)];
    for(const p of profiles){
      const group=new THREE.Group(),options={reservations,neighbors:level.floors,neighborProfiles:profiles};
      art.addArchipelagoGraniteV2(p,group,options);art.addArchipelagoTargetPortal(p,group,options);group.updateMatrixWorld(true);
      group.traverse(mesh=>{
        if(!mesh.isMesh)return;const vertices=mesh.geometry.getAttribute('position'),instance=new THREE.Matrix4(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
        for(let k=0;k<(mesh.isInstancedMesh?mesh.count:1);k++){
          if(mesh.isInstancedMesh){mesh.getMatrixAt(k,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);}else matrix.copy(mesh.matrixWorld);
          for(let i=0;i<vertices.count;i++){
            point.fromBufferAttribute(vertices,i).applyMatrix4(matrix);
            if(point.y>.02)assert.ok(Math.hypot(point.x-p.floor.x,point.z-p.floor.z)>radiusAt(p,point.x,point.z,'playableRadial'),seed+'/'+number+' '+mesh.name+' penetrates own actor boundary');
            for(const other of profiles.filter(q=>q!==p))assert.ok(Math.hypot(point.x-other.floor.x,point.z-other.floor.z)>radiusAt(other,point.x,point.z,'radial'),seed+'/'+number+' '+mesh.name+' crosses neighboring visible coast');
          }
        }
      });
    }
  }
});
