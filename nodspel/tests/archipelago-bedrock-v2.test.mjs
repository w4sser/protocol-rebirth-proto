import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import * as art from '../archipelago-visual-v2.mjs';
import {coastlineProfile,coastRingData,authorHeroIslandCoast,archipelagoGroundColor} from '../coastline.mjs';
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
  assert.ok(mesh.geometry.getAttribute('position').count>=120
    &&mesh.geometry.getAttribute('position').count<=180,
    'shelf uses a few broad, low-poly geological faces, not hundreds of spherical bands');
  assert.equal(mesh.geometry.userData.continuousGlacialMass,true,
    'one continuous granite mesh avoids intersecting tier shells and z-fighting');
  assert.equal(mesh.geometry.userData.fracturedShelf,true,
    'v2 uses a glacial granite shelf instead of the old spherical/concentric boulder');
  assert.ok(mesh.geometry.userData.radialRings<=7&&mesh.geometry.userData.angularSegments<=20,
    'broad faceted rock avoids closely spaced terrace-ring silhouettes');
  const edge=mesh.geometry.getAttribute('position'),seg=mesh.geometry.userData.angularSegments+1;
  const radial=[];
  for(let ring=0;ring<mesh.geometry.userData.radialRings;ring++)
    radial.push(Math.hypot(edge.getX(ring*seg),edge.getZ(ring*seg)));
  assert.ok(radial.every((r,i)=>i===0||radial[i-1]-r>.045),
    'all shoreline shelf rings narrow steadily, with no stacked radius plateaus');
  assert.equal(mesh.material.flatShading,true,'sculpted granite uses broad, readable planes');
  const vertices=mesh.geometry.getAttribute('position'),peak=vertices.getY(vertices.count-1);
  assert.ok(peak>.55&&peak<.68,'closed low slate-granite cap without a rounded dome');
  const xs=new Set(Array.from({length:vertices.count},(_,i)=>Math.round(vertices.getX(i)*100)));
  assert.ok(xs.size>35,'ice-worn granite needs a broad irregular silhouette');
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
    assert.ok(r>profile.points[i].innerRadial+.2,'coherent ground extends beyond the old rectangular game floor');
    assert.ok(r<profile.points[i].playableRadial,'shore lip remains outside walkable ground mesh');
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

test('quiet v2 adds a bounded coastal-life layer instead of a barren green plate',()=>{
  const hi=archipelagoDressingConfig({area:'archipelago',search:'?archVisual=v2&archTarget=1',quality:'high'});
  const lo=archipelagoDressingConfig({area:'archipelago',search:'?archVisual=v2&archTarget=1',quality:'low'});
  assert.equal(hi.enabled,true);
  assert.equal(hi.mode,'military');
  assert.ok(hi.density>.2&&hi.density<.5,'sparse coastal dressing, no big military landmarks');
  assert.ok(lo.density<hi.density,'low stays mobile safe');
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?archVisual=v2&polyfork=0'}).enabled,false);
  assert.equal(archipelagoDressingConfig({area:'archipelago'}).density,1,'default remains unchanged');
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?archVisual=v2&polyfork=1'}).density,1,'explicit full layer comparison');
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

test('the geological ground joins the same organic coast and varies from moss to granite',()=>{
  const group=new THREE.Group(),bedrock=art.addArchipelagoGraniteV2(profile,group);
  const ground=art.addArchipelagoGroundV2(profile,group,{bedrockPlan:bedrock.userData.bedrockPlan});
  const p=ground.geometry.getAttribute('position'),c=ground.geometry.getAttribute('color'),coast=coastRingData(profile,{bedrockPlan:bedrock.userData.bedrockPlan}),n=profile.points.length;
  let tonalRange=0,greenCenter=0;
  for(let i=0;i<n;i++){
    const outer=p.count-n+i;
    assert.ok(Math.abs(p.getX(outer)-coast.positions[i*3])<1e-5);
    assert.ok(Math.abs(p.getZ(outer)-coast.positions[i*3+2])<1e-5);
    for(let axis=0;axis<3;axis++)assert.ok(Math.abs(c.array[outer*3+axis]-coast.colors[i*3+axis])<1e-5,'ground and coast must use identical geological colors at the seam');
    greenCenter+=(c.getY(i+n*4)>c.getX(i+n*4));
    tonalRange=Math.max(tonalRange,Math.abs(c.getX(i+n*13)-c.getX(i+n*5)));
  }
  assert.ok(greenCenter>n*.6,'the central playfield remains mossy and readable');
  assert.ok(tonalRange>.01,'bedrock should produce nonuniform mineral variation');
});

test('target island has a visual-only shoreline shed, embedded in rock beyond the actor limit',()=>{
  const group=new THREE.Group(),shed=art.addArchipelagoTargetShed(profile,group);
  assert.equal(shed?.name,'arch-v2-coastal-shed');
  assert.equal(shed?.userData.visualOnly,true);
  assert.equal(group.children.length,1);
  const rock=art.planArchipelagoBedrock(profile).masses[1],r=Math.hypot(shed.position.x-floor.x,shed.position.z-floor.z);
  const idx=Math.round(((rock.angle+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*profile.points.length)%profile.points.length;
  assert.ok(r>profile.points[idx].playableRadial,'no added object on playable terrain');
});

test('the same coastal shell develops glacial shoulders without changing walkable seams or sea-level edge',()=>{
  const mass=art.planArchipelagoBedrock(profile),base=coastRingData(profile),raised=coastRingData(profile,{bedrockPlan:mass}),n=profile.points.length;
  assert.equal(base.positions.length,raised.positions.length);
  let maxLift=0;
  for(let i=0;i<n;i++){
    const first=i*3+1,last=(5*n+i)*3+1;
    assert.ok(Math.abs(raised.positions[first]-base.positions[first])<1e-6,'first actor seam unchanged');
    assert.ok(Math.abs(raised.positions[last]-base.positions[last])<1e-6,'outer waterline unchanged');
    maxLift=Math.max(maxLift,raised.positions[(3*n+i)*3+1]-base.positions[(3*n+i)*3+1]);
  }
  assert.ok(maxLift>.30,'a convincing coastal granite root rises as part of the same coast mesh');
});

test('the playable mineral veins join the cliff with exact linear colors',()=>{
  const group=new THREE.Group(),mass=art.addArchipelagoGraniteV2(profile,group);
  const plan=mass.userData.bedrockPlan,ground=art.addArchipelagoGroundV2(profile,group,{bedrockPlan:plan});
  const coast=coastRingData(profile,{bedrockPlan:plan}),positions=ground.geometry.getAttribute('position'),colors=ground.geometry.getAttribute('color'),n=profile.points.length;
  let visibleStone=0,interiorMoss=0;
  for(let i=0;i<n;i++){
    const j=positions.count-n+i;
    for(let k=0;k<3;k++)assert.ok(Math.abs(colors.array[j*3+k]-coast.colors[i*3+k])<1e-5,
      'the ground and rock coast must use the same material at their shared seam');
    const edge=colors.getX(j)+colors.getZ(j);
    if(edge>colors.getY(j)*1.6)visibleStone++;
    if(colors.getY(i+n*2)>colors.getX(i+n*2)&&colors.getY(i+n*2)>colors.getZ(i+n*2))interiorMoss++;
  }
  assert.ok(visibleStone>n*.05,'some visible granite has to reach the real walkable coast');
  assert.ok(interiorMoss>n*.70,'the central combat clearing stays natural green');
  const lowGroup=new THREE.Group(),low=art.addArchipelagoGroundV2(profile,lowGroup,{high:false,bedrockPlan:plan});
  assert.deepEqual([...low.geometry.getAttribute('color').array],[...colors.array],'LOW preserves the same island geology');
});

test('v2 groundcover is coastal, collision-free, and LOW is a deterministic HIGH subset',()=>{
  const reserved=[{x:2,z:0,w:4,d:5},{x:-4,z:-3,w:3,d:4}];
  const high=art.planArchipelagoGroundcover(profile,{high:true,reservations:reserved});
  const low=art.planArchipelagoGroundcover(profile,{high:false,reservations:reserved});
  const highCoords=new Set(high.map(p=>p.x.toFixed(5)+','+p.z.toFixed(5)));
  assert.ok(high.length>low.length&&low.length>20,'HIGH contains more coastal vegetation, LOW remains populated');
  for(const p of low)assert.ok(highCoords.has(p.x.toFixed(5)+','+p.z.toFixed(5)),'LOW must retain HIGH cluster sites');
  for(const p of high){
    const a=(Math.atan2(p.z-floor.z,p.x-floor.x)+Math.PI*2)%(Math.PI*2),t=a/(Math.PI*2)*profile.points.length,j=Math.floor(t),f=t-j;
    const edge=profile.points[j].playableRadial*(1-f)+profile.points[(j+1)%profile.points.length].playableRadial*f;
    assert.ok(Math.hypot(p.x-floor.x,p.z-floor.z)<edge-.42,'cover must not spill into water or onto raised rocks');
    assert.ok(!reserved.some(r=>overlaps({x:p.x,z:p.z,w:.4,d:.4},r)),'groundcover must clear gameplay reservations');
    assert.ok(p.h<.46,'plants must never visually block the Operator');
  }
  assert.deepEqual(high,art.planArchipelagoGroundcover(profile,{high:true,reservations:reserved}),'groundcover deterministic');
  const group=new THREE.Group();
  art.addArchipelagoGroundV2(profile,group,{high:false,reservations:reserved});
  const foliage=group.children.find(c=>c.name==='arch-v2-coastal-groundcover');
  assert.ok(foliage?.geometry.getAttribute('position').count>=low.length*9);
  assert.equal(foliage.userData.visualOnly,true);
});

test('shore relief is authored into one coast mesh and the old grey ring is broken up',()=>{
  const bedrock=art.planArchipelagoBedrock(profile),coast=coastRingData(profile,{bedrockPlan:bedrock});
  const n=profile.points.length,nearColors=[],rise=[];
  for(let i=0;i<n;i++){
    const y0=coast.positions[i*3+1],y5=coast.positions[(5*n+i)*3+1];
    assert.ok(Math.abs(y0-.010)<1e-5,'the actor-ground seam stays perfectly flat');
    assert.ok(y5<-.50,'the rock slopes below the waterline');
    const y3=coast.positions[(3*n+i)*3+1];
    rise.push(y3);
    const a=(2*n+i)*3,red=coast.colors[a],green=coast.colors[a+1],blue=coast.colors[a+2];
    nearColors.push(red+blue-green);
    for(const c of [red,green,blue])assert.ok(Number.isFinite(c)&&c>=0&&c<=1,'finite coastal colors');
  }
  assert.ok(Math.max(...rise)-Math.min(...rise)>.18,'sculpted rock terraces should have discernible relief');
  assert.ok(Math.max(...nearColors)-Math.min(...nearColors)>.025,'moss bays and granite headlands must not share one uniform grey tint');
  const group=new THREE.Group(),mesh=art.addArchipelagoGroundV2(profile,group,{bedrockPlan:bedrock});
  assert.ok(!group.children.some(o=>o.name==='arch-v2-bedrock-roots'),'avoid an overlapping granite apron on mobile');
  assert.ok(mesh.geometry.getAttribute('position').array.every((_,i)=>i%3!==1||Math.abs(mesh.geometry.getAttribute('position').array[i]-.01)<1e-5),'traversable land remains flat');
});


test('authored hero headlands grow from the SAME coastal surface without changing actor reach',()=>{
  const floor={x:0,z:0,w:18,d:16};
  const hero=coastlineProfile(floor,'archipelago-v2-target',{style:'v2'});
  const base=hero.points.map(p=>({radial:p.radial,playable:p.playableRadial}));
  const left=hero.points.find(p=>p.t>.12&&p.t<.40&&p.beach<.16);
  const right=hero.points.find(p=>p.t>.60&&p.t<.9&&p.beach<.16);
  assert.ok(left&&right,'the representative island has rocky headland positions');
  authorHeroIslandCoast(hero,{rockAngles:[left.angle,right.angle]});
  assert.equal(hero.heroCoast,true);
  assert.ok(hero.heroHeadlands.length>=2,'two broad authored granite headlands');
  const raised=hero.points.filter((p,i)=>p.radial>base[i].radial+.35);
  assert.ok(raised.length>5,'broad headlands grow the real island coastline');
  assert.ok(hero.points.every((p,i)=>p.playableRadial<=base[i].playable+1e-7),
    'hero cliffs never expand logical traversal into elevated granite');
  assert.ok(hero.points.every((p,i)=>
    p.playableRadial>=Math.min(base[i].playable,p.innerRadial+1.10)-1e-6),
    'never shrink an existing narrow passage; otherwise keep 1.10m spare beyond authored floor');
  assert.ok(hero.points.some((p,i)=>p.playableRadial<base[i].playable-.25),
    'a large granitic landform needs a visibly broad coastal root');
  const shore=coastRingData(hero),n=hero.points.length;
  assert.equal(shore.rings,14,'one hero coast mesh with multiple broad irregular rock shoulders');
  assert.equal(shore.positions.length,n*shore.rings*3,'all 14 radial cliff strips share one indexed coastline');
  const elevated=Array.from({length:n},(_,i)=>shore.positions[(6*n+i)*3+1]);
  assert.ok(Math.max(...elevated)>1.20,'dramatic cliffs rise above the narrow existing coast');
  assert.ok(Math.max(...elevated)-Math.min(...elevated)>.65,'coastal cliff has varied height, not a uniform grey wall');
  for(let i=0;i<n;i++){
    assert.ok(Math.abs(shore.positions[i*3+1]-.01)<1e-5,'the operator seam remains flat');
    assert.ok(shore.positions[(13*n+i)*3+1]<-.50,'same cliff returns below water level');
  }
  const group=new THREE.Group();
  const plan={masses:hero.heroHeadlands.map(h=>({angle:h.angle})),shelves:[]};
  const ground=art.addArchipelagoGroundV2(hero,group,{bedrockPlan:plan});
  const coords=ground.geometry.getAttribute('position'),colors=ground.geometry.getAttribute('color');
  for(let i=0;i<n;i++){
    const j=coords.count-n+i;
    for(let k=0;k<3;k++){
      assert.ok(Math.abs(coords.array[j*3+k]-shore.positions[i*3+k])<1e-5,
        'hero ground and raised coast share exactly one geometric seam');
      assert.ok(Math.abs(colors.array[j*3+k]-shore.colors[i*3+k])<1e-5,
        'hero ground and raised coast have identical linear vertex colors at their seam');
    }
  }
  const flat=Array.from({length:coords.count},(_,i)=>coords.getY(i));
  assert.ok(flat.every(y=>Math.abs(y-.01)<1e-5),'no false traversable mountains');
});


test('hero cliff elevation survives neighbors limiting offshore headland expansion',()=>{
  const floor={x:0,z:0,w:18,d:16},hero=coastlineProfile(floor,'cliff-independent-width',{style:'v2'});
  const target=hero.points.find(p=>p.t>.10&&p.t<.28&&p.beach<.15);
  assert.ok(target,'exposed rock point should exist');
  const baseline=target.radial,angle=target.angle;
  const blockingNeighbor={floor:{x:Math.cos(angle)*12,z:Math.sin(angle)*12}};
  authorHeroIslandCoast(hero,{rockAngles:[angle],neighborProfiles:[blockingNeighbor]});
  const p=hero.points.find(x=>x.angle===angle);
  assert.ok(Math.abs(p.radial-baseline)<.02,'neighbor prevents offshore cliff footprint expansion');
  assert.ok(p.heroRelief>.15,'cliff elevation remains visible despite width constraint');
  const shore=coastRingData(hero),i=hero.points.indexOf(p),n=hero.points.length;
  // A constrained coast must NOT invent a steep retaining wall. A recognizable
  // headland may rise only where its root has sufficient horizontal width.
  const narrowHeight=shore.positions[(6*n+i)*3+1];
  assert.ok(narrowHeight<.34,'compressed coast stays a low tide-worn granite shelf');
  const fullRadial=p.radial;
  p.radial=p.playableRadial+3.0;
  const spacious=coastRingData(hero).positions[(6*n+i)*3+1];
  p.radial=fullRadial;
  assert.ok(spacious>narrowHeight+.35,'same headland rises naturally when offshore space is available');
  assert.ok(Math.abs(shore.positions[i*3+1]-.01)<1e-5,'traversable floor seam stays flat');
});


test('Pass K has localized granite headlands, not a continuous coastal retaining wall',()=>{
  const floor={x:0,z:0,w:18,d:16};
  const hero=coastlineProfile(floor,'archipelago-v2-target',{style:'v2'});
  authorHeroIslandCoast(hero,{rockAngles:[.25,2.80,4.65]});
  const shore=coastRingData(hero),n=hero.points.length,ring=6;
  const masks=hero.points.map(p=>p.heroRockMask??0);
  const high=masks.indexOf(Math.max(...masks));
  const low=masks.indexOf(Math.min(...masks));
  assert.ok(masks[high]>.55&&masks[low]<.10,'the test island needs distinct headlands and open bays');
  // Flat traversable ground and shared water toe never change with rock sculpting.
  for(let i=0;i<n;i++){
    assert.ok(Math.abs(shore.positions[i*3+1]-.010)<1e-6,
      'no fake mountain elevation on the walkable gameplay seam');
    assert.ok(shore.positions[((shore.rings-1)*n+i)*3+1]<-.5,
      'the same connected coast returns under the sea');
  }
  const stoneBias=(i)=>{
    const k=(ring*n+i)*3;
    return (shore.colors[k]+shore.colors[k+2])*.5-shore.colors[k+1];
  };
  // Compare the actual rendered shoreline palette, not the difference from
  // the adjacent ground. Headland seams are already granite-colored, so the
  // old "difference from ground" metric falsely penalized correct continuity.
  assert.ok(stoneBias(high)>stoneBias(low)+.035,
    'headlands should be lavender-grey stone while quiet bays read olive');
  const y=i=>shore.positions[(ring*n+i)*3+1];
  assert.ok(y(high)>y(low)+1,'headlands must rise materially above low sheltered bays');
  assert.ok(shore.positions.every(Number.isFinite),'continuous mesh contains finite geometry');
  assert.ok(shore.colors.every(c=>Number.isFinite(c)&&c>=0&&c<=1),
    'weathered stone material has valid linear vertex colors');
});

test('Pass M sculpted knuckles are distinct across shore while the actor seam remains planar',()=>{
  const f={x:0,z:0,w:28,d:24};
  const profile=coastlineProfile(f,'archipelago-v2-target',{style:'v2'});
  authorHeroIslandCoast(profile,{rockAngles:[.15,2.52,4.85]});
  const coast=coastRingData(profile),n=profile.points.length;
  const h=Array.from({length:n},(_,i)=>coast.positions[(7*n+i)*3+1]);
  const high=h.filter(v=>v>1.1).length,low=h.filter(v=>v<.40).length;
  assert.ok(high>=6,'several broad granite crown sections must rise above the water');
  assert.ok(low>=Math.ceil(n*.34),'at least a third of the coastal perimeter should remain low');
  const peak=Math.max(...h),min=Math.min(...h);
  assert.ok(peak-min>1.5,'separated high and low coastal forms are legible from the gameplay camera');
  for(let i=0;i<n;i++){
    assert.ok(Math.abs(coast.positions[i*3+1]-.01)<1e-5,'no raised playable interior');
    const toe=(13*n+i)*3+1;
    assert.ok(Math.abs(coast.positions[toe]+.65)<1e-5,'no disconnected seawall or new water seam');
  }
  assert.equal(coast.indices.length,n*(coast.rings-1)*6,'each shoreline remains a single indexed manifold');
});


test('Pass N leaves the traversable center green and authors two distinct cliffs',()=>{
  const f={x:0,z:0,w:28,d:24};
  const hero=coastlineProfile(f,'archipelago-v2-target',{style:'v2'});
  authorHeroIslandCoast(hero,{rockAngles:[.15,2.52,4.85]});
  assert.equal(hero.heroHeadlands.length,2,'two memorable granite headlands, not a ring of mountain peaks');
  const group=new THREE.Group();
  const plan={masses:hero.heroHeadlands.map(h=>({angle:h.angle})),shelves:[]};
  const mesh=art.addArchipelagoGroundV2(hero,group,{bedrockPlan:plan});
  const n=hero.points.length,c=mesh.geometry.getAttribute('color'),p=mesh.geometry.getAttribute('position');
  let green=0,total=0;
  // Ring 0 is the identical center vertex repeated for all radial wedges;
  // including it 72 times gives one brown worn-earth point a false 1/7 vote.
  // Count distinct spatial rings of the actual planar clearing instead.
  for(let k=1;k<7;k++)for(let i=0;i<n;i++){
    const j=k*n+i;total++;
    if(c.getY(j)>c.getX(j)&&c.getY(j)>c.getZ(j))green++;
    assert.ok(Math.abs(p.getY(j)-.01)<1e-5,'flat gameplay remains physically flat');
  }
  assert.ok(green/total>.72,
    'the first third of the playable map should be mostly moss and vegetation, not faux mountain');
});


test('Pass P/Q keeps rounded glacial crowns offshore and avoids intruding into planar meadow',()=>{
  const f={x:0,z:0,w:28,d:24};
  const hero=coastlineProfile(f,'archipelago-v2-target',{style:'v2'});
  const before=hero.points.map(p=>p.playableRadial);
  authorHeroIslandCoast(hero,{rockAngles:[.15,2.52,4.85]});
  assert.equal(hero.heroHeadlands.length,2);
  let active=0,low=0;
  for(let i=0;i<hero.points.length;i++){
    const p=hero.points[i];
    const root=before[i]-p.playableRadial;
    assert.ok(root<=1.6,'large granite roots must not consume the flat vegetation edge');
    assert.ok(p.playableRadial>=Math.min(before[i],p.innerRadial+1.10)-1e-6,
      'preserve original gameplay and every existing narrow passage without claiming extra width');
    if((p.heroRockMask??0)<.045)low++;
    if((p.heroRockMask??0)>.55)active++;
  }
  assert.ok(low>=hero.points.length*.45,'at least 45% of the shoreline should be low, natural bays');
  assert.ok(active>=4,'a few readable but compact rock domes remain');
  const coast=coastRingData(hero),n=hero.points.length;
  let tall=0;
  for(let i=0;i<n;i++){
    if(coast.positions[(7*n+i)*3+1]>1.1)tall++;
    assert.ok(Math.abs(coast.positions[i*3+1]-.01)<1e-6,'flat actor edge remains exactly unchanged');
    assert.ok(Math.abs(coast.positions[(13*n+i)*3+1]+.65)<1e-5,
      'seaward cliff toe remains identical, preventing shoreline gaps');
  }
  assert.ok(tall>=2,'glacial domes still visually rise above the coast');
});


test('Pass R height follows the available offshore width instead of building cliffs in narrow channels',()=>{
  const f={x:0,z:0,w:22,d:20},p=coastlineProfile(f,'hero-width-review',{style:'v2'});
  authorHeroIslandCoast(p,{rockAngles:[.45,3.15]});
  const i=p.points.reduce((best,q,j)=>q.heroRelief>p.points[best].heroRelief?j:best,0);
  assert.ok(p.points[i].heroRelief>.2,'test needs a live granitic headland');
  const point=p.points[i],original=point.radial;
  point.radial=point.playableRadial+3.3;
  const broad=coastRingData(p),n=p.points.length;
  const broadPeak=broad.positions[(7*n+i)*3+1];
  point.radial=point.playableRadial+.70;
  const narrow=coastRingData(p),narrowPeak=narrow.positions[(7*n+i)*3+1];
  point.radial=original;
  const greenBias=(data)=>{
    const k=(7*n+i)*3;
    return data.colors[k+1]-(data.colors[k]+data.colors[k+2])*.5;
  };
  assert.ok(greenBias(narrow)>greenBias(broad)+.012,
    'a narrow-channel shelf should be visibly more olive than the exposed granite headland');
  assert.ok(narrowPeak<broadPeak*.62,
    'tall cliffs must collapse into low granite shelves where the coastline is compressed');
  assert.ok(Math.abs(narrow.positions[i*3+1]-.01)<1e-6,'player seam never rises');
  assert.ok(Math.abs(narrow.positions[((narrow.rings-1)*n+i)*3+1]+.65)<1e-6,
    'narrow coast still returns to the same water toe');
});


test('Pass S seeded earth-path color is visible on the flat hero ground and deterministic',()=>{
  const floor={x:0,z:0,w:25,d:24},hero=coastlineProfile(floor,'trail-target',{style:'v2'});
  authorHeroIslandCoast(hero,{rockAngles:[.15,3.12]});
  const a=hero.heroHeadlands[0].angle,along=4.4;
  const bend=.42*Math.sin(along*.29+hero.seed*.00012)+.18*Math.sin(along*.63-.8);
  const sample=side=>archipelagoGroundColor(hero,
    floor.x+Math.cos(a)*along-Math.sin(a)*side,
    floor.z+Math.sin(a)*along+Math.cos(a)*side);
  const worn=sample(bend),grass=sample(bend+3.6);
  assert.deepEqual(worn,sample(bend),'trail colors must be seed-stable');
  assert.ok(worn[0]-worn[1]>grass[0]-grass[1]+.015,
    'flat dirt path must read warmer and browner than adjoining healthy vegetation');
  const ground=art.addArchipelagoGroundV2(hero,new THREE.Group(),{
    bedrockPlan:{masses:hero.heroHeadlands.map(h=>({angle:h.angle})),shelves:[]}});
  assert.equal(ground.geometry.getAttribute('position').count,(30+1)*hero.points.length,
    'hero path sampling stays detailed enough in both graphics qualities');
  const y=ground.geometry.getAttribute('position');
  for(let i=0;i<y.count;i++)assert.ok(Math.abs(y.getY(i)-.01)<1e-5,'the worn trail cannot add traversable height');
});
