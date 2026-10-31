import * as THREE from './vendor/three.module.js';
import {ENEMIES,ENEMY_COLORS,ENEMY_TUNING,isShieldTurret,isCharger,visualFor} from './enemies.js?v=2.20.0';
import {loadEnemyModel} from './enemy-models.js?v=2.20.0';

const LEG_PIVOTS=['leg_front_left_pivot','leg_front_right_pivot','leg_rear_left_pivot','leg_rear_right_pivot'];
const SWARM_LEG_PIVOTS=Array.from({length:6},(_,i)=>`leg_0${i+1}_pivot`);
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
function restRusherLegs(parts,legRest){
  const {outwardDeg=10,foreAftDeg=8}=legRest??{};
  for(const name of LEG_PIVOTS){
    const pivot=parts[name];
    if(!pivot)continue;
    const rest=restLegQuaternion(pivot,outwardDeg,foreAftDeg);
    if(rest){pivot.quaternion.copy(rest);pivot.userData.restQuaternion=rest;}
  }
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
      restRusherLegs(model.parts,spec.legRest);
      // Rest-posing the legs moves the lowest point, so re-ground from the actual geometry
      // instead of trusting the authored groundOffset alone.
      mount.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(mount);
      mount.position.y=spec.groundOffset-(bounds.isEmpty()?0:bounds.min.y);
    }else mount.position.y=spec.groundOffset;
    // Health pips/labels sit just above whatever model actually mounted (docs/enemy-model-mapping.md),
    // not a one-size-fits-all constant: the 8 archetypes range from swarm_bot (~0.5m) to shield_turret (~1.5m).
    mount.updateMatrixWorld(true);
    const labelBounds=new THREE.Box3().setFromObject(mount);
    v.labelY=labelBounds.isEmpty()?1.7:Math.max(.6,labelBounds.max.y+.15);
    // Static geometry/materials stay shared between all clones and survive world disposal.
    model.root.traverse(n=>{
      if(n.geometry)n.geometry.userData.shared=true;
      if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!visual.tint)m.userData.shared=true;m.fog=false;
        // Vertex-colour GLBs default to a fully metallic material without an environment map.
        // Match the existing procedural enemies so bunker light reveals their authored colours.
        if(m.isMeshStandardMaterial){m.metalness=.12;m.roughness=.82;}}
    });
    const animatedMaterials=[];
    for(const name of ['shield_arc','back_battery']){
      model.parts[name]?.traverse(n=>{
        if(!n.material)return;
        const clone=m=>{const own=m.clone();own.userData={...own.userData,shared:false};animatedMaterials.push(own);return own;};
        n.material=Array.isArray(n.material)?n.material.map(clone):clone(n.material);
      });
    }
    // Temporary stand-ins (e.g. grunt on the rusher chassis) get a per-instance recolour so they never
    // read as the real archetype; the eye/optic stays its authored colour so it still reads as a sensor.
    if(visual.tint){
      const tint=new THREE.Color(visual.tint),skip=new Set([model.parts.shield_arc,model.parts.back_battery,model.parts.optic]);
      model.root.traverse(n=>{
        if(!n.isMesh||!n.material||skip.has(n))return;
        const retint=m=>{const own=m.userData.shared===false?m:m.clone();own.userData={...own.userData,shared:false};own.color?.multiply(tint);return own;};
        n.material=Array.isArray(n.material)?n.material.map(retint):retint(n.material);
      });
    }
    oldChildren.forEach(c=>{c.visible=false;});
    v.group.add(mount);v.enemyModel={...model,mount,animatedMaterials,archetype:id,hiddenParts:new Set(visual.hideParts??[])};
    if(v.eye)v.eye.visible=false;
    // Rendering switches from the procedural arc to the authored arc once loaded.
    // Both use the same facing and EMP shield-down deadline.
  }).catch(()=>{}); // Presentation failures never interrupt the raid.
}
// Shared by shield_turret/turret (both cabinets) and tank (guard stand-in): the head pivot tracks the
// player and the cannon kicks back on every shot of a burst. v.group already carries the body's facing
// rotation (nodspel/game.mjs), so only the head needs independent aim here.
function animateTurretHead(parts,e,clock){
  if(parts.turret_head_pivot)parts.turret_head_pivot.rotation.z=e.facing??0;
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
    case 'rusher':{ // the real charger, or the grunt stand-in sharing this chassis (never gets the lunge/stun tilt)
      const charger=isCharger(e),winding=charger&&e.windupAt!=null,stunned=charger&&clock<(e.wallStunUntil??0);
      const moving=charger?e.attackPhase==='charge'||e.attackPhase==='stalk':(e.speed??0)>0&&e.active!==false;
      mount.rotation.x=winding?.24:stunned?-.15:0;
      LEG_PIVOTS.forEach((name,i)=>{
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
    case 'swarm_bot':{ // swarm/hunter rushers: six-leg insect gait while actually closing in
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
