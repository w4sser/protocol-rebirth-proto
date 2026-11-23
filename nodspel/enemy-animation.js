import * as THREE from './vendor/three.module.js';
import {ENEMIES,ENEMY_COLORS,ENEMY_TUNING,isShieldTurret,isCharger,visualFor} from './enemies.js?v=2.28.70';
import {loadEnemyModel} from './enemy-models.js?v=2.28.70';
import {pbrEnvironment} from './environment-look.js?v=2.28.70';

const LEG_PIVOTS=['leg_front_left_pivot','leg_front_right_pivot','leg_rear_left_pivot','leg_rear_right_pivot'];
const SWARM_LEG_PIVOTS=Array.from({length:8},(_,i)=>`leg_0${i+1}_pivot`); // eight-legged textured swarm_bot
const Y_AXIS=new THREE.Vector3(0,1,0);
const SWING_Q=new THREE.Quaternion();

// The rusher.glb authors its legs splayed ~40deg fore/aft and outward from the hip (art is
// off-limits to edit), so derive a rest orientation per pivot from the leg mesh's own geometry
// that points the foot mostly straight down with a small natural stance.
function restLegQuaternion(pivot,outwardDeg,foreAftDeg){
  pivot.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  const bounds=new THREE.Box3(),transform=new THREE.Matrix4();
  pivot.traverse(child=>{
    if(!child.isMesh||!child.geometry?.attributes?.position)return;
    child.geometry.computeBoundingBox();
    transform.multiplyMatrices(inverse,child.matrixWorld);
    bounds.union(child.geometry.boundingBox.clone().applyMatrix4(transform));
  });
  if(bounds.isEmpty())return null;
  // These legs extend from the hip origin: the bounds center lies on hip -> foot.
  // Using a corner instead mixes extremes from different vertices of the thick leg.
  // Pivot space cancels mesh translations (including -hip in this GLB).
  const current=bounds.getCenter(new THREE.Vector3());
  if(current.lengthSq()<1e-10)return null;
  current.normalize().applyQuaternion(pivot.quaternion);
  const outward=outwardDeg*Math.PI/180,foreAft=foreAftDeg*Math.PI/180;
  const down=-Math.sqrt(Math.max(0,1-Math.sin(outward)**2-Math.sin(foreAft)**2));
  const desired=new THREE.Vector3(Math.sin(foreAft)*Math.sign(pivot.position.x||1),Math.sin(outward)*Math.sign(pivot.position.y||1),down).normalize();
  return new THREE.Quaternion().setFromUnitVectors(current,desired).multiply(pivot.quaternion);
}
const WHEEL_PAIRS=[['wheel_front_left','hub_front_left'],['wheel_front_right','hub_front_right'],['wheel_rear_left','hub_rear_left'],['wheel_rear_right','hub_rear_right']];
// patrol_grunt.glb bakes each wheel/hub mesh's position straight into its vertex data (the node transform
// is identity, unlike the other archetypes' hinge "_pivot" nodes), so there is no authored point to spin
// around. Derive one from the mesh's own local bounding-box center and reparent wheel+hub under it,
// offsetting their local position by the same amount so nothing visibly moves until the pivot is rotated.
function wheelRollPivots(parts,worldScale){
  const pivots={};
  for(const [wheelName,hubName] of WHEEL_PAIRS){
    const wheel=parts[wheelName];
    if(!wheel?.geometry?.attributes?.position||!wheel.parent)continue;
    wheel.geometry.computeBoundingBox();
    const box=wheel.geometry.boundingBox,center=box.getCenter(new THREE.Vector3());
    const pivot=new THREE.Group();
    pivot.position.copy(center);wheel.parent.add(pivot);
    for(const mesh of [wheel,parts[hubName]]){
      if(!mesh)continue;
      pivot.add(mesh);mesh.position.sub(center);
    }
    pivots[wheelName]={pivot,radius:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2*worldScale};
  }
  return pivots;
}
function restRusherLegs(parts,legRest){
  const {outwardDeg=10,foreAftDeg=8}=legRest??{};
  for(const name of LEG_PIVOTS){
    const pivot=parts[name];
    if(!pivot)continue;
    const rest=restLegQuaternion(pivot,outwardDeg,foreAftDeg);
    if(rest){pivot.quaternion.copy(rest);pivot.userData.restQuaternion=rest;}
  }
}

// Distance-driven gait (v2.28.68). The old walk swung legs on a clock (sin(clock/110)) regardless of how far
// the enemy moved, so feet slid over the floor ("moonwalking"). Here each leg's phase advances with the
// forward distance travelled, like the patrol_grunt wheels: during stance the planted foot moves backwards
// (relative to the body) exactly as far as the body moves forwards, then it lifts and swings forward.
// The legs are single rigid meshes, so how a leg sweeps depends on where its foot sits relative to the hip:
// - sideways legs (swarm_bot spider): yaw about a vertical axis through the hip. The foot travels purely
//   horizontally, so it stays exactly planted; lift is a small roll that raises the foot.
// - fore/aft legs (rusher): pitch about a lateral axis placed at hip height but shifted towards the foot
//   (gait.pivotShift). Pitching about the hip itself would raise and sink a forward-slanted foot by ~10 cm;
//   about this point the foot stays within ~1-2 cm of the floor and the hip bobs a little under the body.
//   Lift is a short vertical hop of the whole leg during the swing.
const X_AXIS=new THREE.Vector3(1,0,0),Y_AXIS_M=new THREE.Vector3(0,1,0),Z_AXIS=new THREE.Vector3(0,0,1);
const footCache=new Map(); // hip->foot per shared leg geometry: clones share geometry, so measure once
function footVector(pivot){
  const meshes=[];pivot.traverse(n=>{if(n.isMesh&&n.geometry?.attributes?.position)meshes.push(n);});
  if(!meshes.length||!pivot.parent)return null;
  const key=pivot.name+'|'+meshes.map(m=>m.geometry.uuid).join(',');
  if(footCache.has(key))return footCache.get(key).clone();
  pivot.parent.updateWorldMatrix(true,true);
  const toParent=new THREE.Matrix4().copy(pivot.parent.matrixWorld).invert(),m4=new THREE.Matrix4(),v=new THREE.Vector3();
  const pts=[];let minZ=Infinity;
  for(const mesh of meshes){
    m4.multiplyMatrices(toParent,mesh.matrixWorld);const pos=mesh.geometry.attributes.position;
    for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m4);pts.push(v.clone());if(v.z<minZ)minZ=v.z;}
  }
  const low=pts.filter(p=>p.z<minZ+.03);
  const foot=low.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/low.length).sub(pivot.position); // pivot.position is in parent space
  footCache.set(key,foot.clone());
  return foot;
}
export function legGait(parts,names,gait,worldScale=1){
  if(!gait)return null;
  const legs=[];
  for(const name of names){
    const pivot=parts[name],foot=pivot&&footVector(pivot);
    if(!foot)continue;
    const leg={pivot,rest:pivot.quaternion.clone(),restPos:pivot.position.clone(),offset:gait.offsets?.[name]??0};
    const yaw=gait.mode?gait.mode==='yaw':Math.abs(foot.y)>Math.abs(foot.x);
    if(yaw){ // sideways leg: yaw
      leg.mode='yaw';leg.axis=Z_AXIS.clone();leg.center=pivot.position.clone();
      leg.reach=Math.abs(foot.y); // X travel of the foot per radian of yaw
      leg.axis.multiplyScalar(foot.y>0?1:-1); // positive angle carries the foot towards -X (back)
      leg.liftAxis=new THREE.Vector3(foot.y>0?1:-1,0,0); // roll that raises a sideways foot
    }else{ // fore/aft leg: pitch about a point above the foot
      leg.mode='pitch';leg.axis=Y_AXIS_M.clone();
      leg.center=pivot.position.clone().add(new THREE.Vector3(foot.x,foot.y,0).multiplyScalar(gait.pivotShift??.75));
      leg.reach=Math.max(.05,-foot.z); // lever from the pitch centre (hip height) down to the foot
    }
    legs.push(leg);
  }
  if(!legs.length)return null;
  // One shared cycle length (world units per full step) so every foot's stance speed matches the body.
  const cycle=legs.reduce((a,l)=>a+2*gait.maxSweep*l.reach*worldScale/gait.stance,0)/legs.length;
  for(const l of legs)l.amp=gait.stance*cycle/(2*l.reach*worldScale);
  return {legs,cycle,stance:gait.stance,lift:gait.lift,liftHeight:gait.liftHeight??0,odo:0,activity:0};
}
const GAIT_QS=new THREE.Quaternion(),GAIT_QL=new THREE.Quaternion(),GAIT_V=new THREE.Vector3();
export function stepGait(g,forward){
  if(!g)return;
  g.odo+=forward;
  const moving=Math.abs(forward)>1e-5;g.activity+=((moving?1:0)-g.activity)*.25; // feet settle when stopped
  for(const l of g.legs){
    const p=((g.odo/g.cycle+l.offset)%1+1)%1;
    let sweep,up=0;
    if(p<g.stance)sweep=l.amp*(2*p/g.stance-1); // planted: forward -> back, in step with the body
    else{const t=(p-g.stance)/(1-g.stance),s=t*t*(3-2*t);sweep=l.amp*(1-2*s);up=Math.sin(Math.PI*t)*g.activity;}
    GAIT_QS.setFromAxisAngle(l.axis,sweep);
    // Rotate the hip about the sweep centre: position = centre + R * (restPos - centre).
    GAIT_V.copy(l.restPos).sub(l.center).applyQuaternion(GAIT_QS).add(l.center);
    if(l.mode==='yaw'){GAIT_QL.setFromAxisAngle(l.liftAxis,up*g.lift);l.pivot.quaternion.copy(GAIT_QL).multiply(GAIT_QS).multiply(l.rest);}
    else{GAIT_V.z+=up*g.liftHeight;l.pivot.quaternion.copy(GAIT_QS).multiply(l.rest);}
    l.pivot.position.copy(GAIT_V);
  }
}
function forwardStep(m,e){
  const dx=e.x-(m.odoX??e.x),dz=e.z-(m.odoZ??e.z);m.odoX=e.x;m.odoZ=e.z;
  const forward=Math.sin(e.facing??0)*dx+Math.cos(e.facing??0)*dz;
  return Number.isFinite(forward)?forward:0;
}

// Keep today's procedural mesh visible until an individual GLB clone is ready.
export function attachEnemyModel(v,isDisposed=()=>false,loader=loadEnemyModel){
  const visual=visualFor(v.enemy);
  if(!visual)return;
  const id=visual.archetype;
  const oldChildren=[...v.group.children].filter(c=>c!==v.shield&&c!==v.meshFlash&&c!==v.cone);
  return loader(id,{fallback:()=>null}).then(model=>{
    if(model.fallback||isDisposed())return;
    const mount=new THREE.Group(),yaw=new THREE.Group(),up=new THREE.Group(),spec=ENEMIES[id];
    yaw.rotation.y=spec.forwardUpFix.rotateY;up.rotation.x=spec.forwardUpFix.rotateX;
    mount.add(yaw);yaw.add(up);up.add(model.root);mount.scale.setScalar(spec.scale*(visual.scale??1));
    for(const name of visual.hideParts??[])if(model.parts[name])model.parts[name].visible=false;
    if(id==='rusher'){
      if(spec.legRest)restRusherLegs(model.parts,spec.legRest); // only for GLBs whose authored legs need a rest pose
      // Rest-posing the legs moves the lowest point, so re-ground from the actual geometry
      // instead of trusting the authored groundOffset alone.
      mount.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(mount);
      mount.position.y=spec.groundOffset-(bounds.isEmpty()?0:bounds.min.y);
    }else mount.position.y=spec.groundOffset;
    const wheelPivots=id==='patrol_grunt'?wheelRollPivots(model.parts,mount.scale.x):null;
    const gait=spec.gait?legGait(model.parts,spec.parts.filter(n=>Object.hasOwn(spec.gait.offsets??{},n)),spec.gait,mount.scale.x):null;
    // Health pips/labels sit just above whatever model actually mounted (docs/enemy-model-mapping.md),
    // not a one-size-fits-all constant: the 8 archetypes range from swarm_bot (~0.5m) to shield_turret (~1.5m).
    mount.updateMatrixWorld(true);
    const labelBounds=new THREE.Box3().setFromObject(mount);
    v.labelY=labelBounds.isEmpty()?1.7:Math.max(.6,labelBounds.max.y+.15);
    // Static geometry/materials stay shared between all clones and survive world disposal.
    model.root.traverse(n=>{
      if(n.geometry)n.geometry.userData.shared=true;
      if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material]){m.userData.shared=true;m.fog=false;
        // Vertex-colour GLBs default to a fully metallic material without an environment map.
        // Match the existing procedural enemies so bunker light reveals their authored colours.
        if(m.isMeshStandardMaterial){m.metalness=.12;m.roughness=.82;if(m.map)pbrEnvironment(m);}}
    });
    const animatedMaterials=[];
    for(const name of ['shield_arc','back_battery','weakpoint_battery']){
      model.parts[name]?.traverse(n=>{
        if(!n.material)return;
        const clone=m=>{const own=m.clone();own.userData={...own.userData,shared:false};animatedMaterials.push(own);return own;};
        n.material=Array.isArray(n.material)?n.material.map(clone):clone(n.material);
      });
    }
    oldChildren.forEach(c=>{c.visible=false;});
    v.group.add(mount);v.enemyModel={...model,mount,animatedMaterials,archetype:id,hiddenParts:new Set(visual.hideParts??[]),wheelPivots,gait,odoX:v.enemy.x,odoZ:v.enemy.z};
    if(v.eye)v.eye.visible=false;
    // Rendering switches from the procedural arc to the authored arc once loaded.
    // Both use the same facing and EMP shield-down deadline.
  }).catch(()=>{}); // Presentation failures never interrupt the raid.
}
// Shared by shield_turret/turret (both cabinets) and tank (guard stand-in): the head pivot tracks the
// player and the cannon kicks back on every shot of a burst. v.group already carries the body's facing
// rotation (nodspel/game.mjs), so only the head needs independent aim here.
function animateTurretHead(parts,e,clock){
  if(parts.turret_head_pivot)parts.turret_head_pivot.rotation.z=0; // body already faces e.facing; avoid double rotation
  if(parts.cannon){
    const cannon=parts.cannon;cannon.userData.restX??=cannon.position.x;
    const since=clock-(e.burstStartedAt??-Infinity),recoil=e.attackPhase==='burst'?Math.max(0,1-(since%ENEMY_TUNING.shieldTurret.burstIntervalMs)/150):0;
    cannon.position.x=cannon.userData.restX-.12*recoil;
  }
}
export function animateEnemyModel(v,clock){
  const e=v.enemy,m=v.enemyModel;
  if(!m){
    if(isCharger(e)&&e.windupAt!=null)v.group.rotation.x=.22;
    return;
  }
  const {parts,mount,archetype}=m;
  switch(archetype){
    case 'shield_turret':{
      animateTurretHead(parts,e,clock);
      const up=isShieldTurret(e)&&clock>=(e.shieldDownUntil??0)&&e.health>0&&!m.hiddenParts.has('shield_arc');
      if(parts.shield_arc){parts.shield_arc.visible=up;if(up)parts.shield_arc.traverse(n=>{if(n.material){n.material.color.set(ENEMY_COLORS.shield);n.material.vertexColors=false;n.material.transparent=true;n.material.depthWrite=false;n.material.side=THREE.DoubleSide;n.material.emissive?.set(ENEMY_COLORS.shield);n.material.emissiveIntensity=.65;n.material.opacity=clock-(e.blockedAt??-Infinity)<220?.95:.35+.12*Math.sin(clock/180);}});}
      break;
    }
    case 'tank': // guard stand-in: front_armor reads as its front shield, same head-track + recoil as a turret
      animateTurretHead(parts,e,clock);
      break;
    case 'rusher':{ // the charger (isCharger is always true for anything resolving to this archetype)
      const charger=isCharger(e),winding=charger&&e.windupAt!=null,stunned=charger&&clock<(e.wallStunUntil??0);
      const moving=charger?e.attackPhase==='charge'||e.attackPhase==='stalk':(e.speed??0)>0&&e.active!==false;
      mount.rotation.x=winding?.24:stunned?-.15:0;
      if(m.gait)stepGait(m.gait,forwardStep(m,e)); // footplanted, distance-driven (legGait)
      else LEG_PIVOTS.forEach((name,i)=>{ // legacy clock swing for a rusher GLB without a gait spec
        const pivot=parts[name];
        if(!pivot)return;
        const swingAngle=moving?Math.sin(clock/(winding||e.attackPhase==='charge'?55:110)+(i===0||i===3?0:Math.PI))*.35:0;
        const rest=pivot.userData.restQuaternion;
        if(rest)pivot.quaternion.copy(rest).multiply(SWING_Q.setFromAxisAngle(Y_AXIS,swingAngle));
        else pivot.rotation.y=swingAngle;
      });
      if(charger)parts.back_battery?.traverse(n=>{if(n.material?.emissive){n.material.emissive.set(ENEMY_COLORS.damage);n.material.emissiveIntensity=winding?1.5+.8*Math.sin(clock/65):.15;}});
      break;
    }
    case 'patrol_grunt':{ // grunt/patrol: the sensor head doubles as the gun mount, wheels roll with movement
      // The body (v.group) already turns to e.facing (nodspel/game.mjs), which combat.js keeps aimed at the
      // player while aggro — so "tracking" is just holding the head's own local offset at zero; only the
      // idle/patrolling case needs an independent side-to-side scan.
      if(parts.sensor_head_pivot)parts.sensor_head_pivot.rotation.z=e.aggro?0:Math.sin(clock/700)*.6;
      const gun=parts.short_machine_gun;
      if(gun){
        gun.userData.restX??=gun.position.x;
        const sinceShot=clock-(e.lastShotAt??-Infinity);
        gun.position.x=gun.userData.restX-(sinceShot>=0&&sinceShot<120?.1*(1-sinceShot/120):0);
      }
      if(m.wheelPivots){
        const forward=forwardStep(m,e);
        for(const {pivot,radius} of Object.values(m.wheelPivots))if(radius>1e-6)pivot.rotation.y+=forward/radius;
      }
      parts.weakpoint_battery?.traverse(n=>{if(n.material?.emissive){n.material.emissive.set(ENEMY_COLORS.damage);n.material.emissiveIntensity=.35+.3*Math.sin(clock/260);}});
      break;
    }
    case 'swarm_bot':{ // swarm/hunter rushers: eight-leg alternating gait, footplanted to the distance moved
      if(m.gait){stepGait(m.gait,forwardStep(m,e));break;}
      const moving=(e.speed??0)>0&&e.active!==false&&!(clock<(e.wallStunUntil??0));
      SWARM_LEG_PIVOTS.forEach((name,i)=>{
        const pivot=parts[name];if(!pivot)return;
        pivot.rotation.y=moving?Math.sin(clock/90+(i%2===0?0:Math.PI))*.3:0;
      });
      break;
    }
    case 'scout': // patrol stand-in: twin rotors spin continuously, counter-rotating like a drone
      if(parts.rotor_left_pivot)parts.rotor_left_pivot.rotation.z=clock*12;
      if(parts.rotor_right_pivot)parts.rotor_right_pivot.rotation.z=-clock*12;
      break;
    case 'artillery': // thrower/grenadier: the mortar pitches up through the throw's wind-up
      if(parts.mortar_pivot)parts.mortar_pivot.rotation.y=e.windupAt!=null?-.4:0;
      break;
    case 'sniper': // bare sentry stand-in: the tripod legs are static outrigger meshes (no pivots to
      // walk), so only a small idle scan on the one real pivot keeps it reading as alive, not dead weight.
      if(parts.barrel_pivot)parts.barrel_pivot.rotation.y=Math.sin(clock/400)*.02;
      break;
  }
}
