import '../data/raid-enemies.js?v=2.22.1';
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const ENEMY_TUNING=freeze(globalThis.DATA.raidEnemies);
export const ENEMY_COLORS=ENEMY_TUNING.colors; // Approved: coral damage, blue shield, green heal, yellow AoE.
// Ground offsets correct each GLB's authored origin to its own lowest vertex (measured per-model; most sit
// within a few cm of 0 already). shield_turret and scout are the two that visibly clip/float without it.
const GROUND_OFFSET={shield_turret:.45,scout:.37};
function archetype(id,parts,hint,tier,phase,scale=1){
  return {id,groundOffset:GROUND_OFFSET[id]??0,model:`../assets/enemies/${id}.glb?v=2.22.1`,scale,
    // Apply X rotation first, then Y: local +Z -> world +Y, local +X -> game +Z.
    forwardUpFix:{rotateX:-Math.PI/2,rotateY:-Math.PI/2},parts,stats:ENEMY_TUNING.stats[id],telegraphColors:ENEMY_COLORS,hint,tier,phase};
}
export const ENEMIES=freeze({
  // Separate variant; today's unshielded turret remains in encounter pools.
  shield_turret:archetype('shield_turret',['base','turret_head_pivot','turret_head','front_armor','cannon','optic','weakpoint','shield_arc'],'SHIELD TURRET · FLANK THE BACK',2,1),
  rusher:{...archetype('rusher',['core','wedge_head','back_battery','optic','leg_front_left_pivot','leg_front_right_pivot','leg_rear_left_pivot','leg_rear_right_pivot'],'RUSHER · SIDESTEP THE CHARGE',2,1),legRest:{outwardDeg:10,foreAftDeg:8}},
  // Tank crushes light cover (Phase 2).
  tank:archetype('tank',['hull','track_left','track_right','turret_head_pivot','turret_head','front_armor','cannon','optic','weakpoint'],'TANK · AVOID ITS FRONT',3,2),
  swarm_bot:archetype('swarm_bot',['shell','optic',...Array.from({length:6},(_,i)=>`leg_0${i+1}_pivot`)],'SWARM · FALL BACK',2,2),
  // Scout may pull enemies from other rooms in BIG MAP (Phase 2).
  scout:archetype('scout',['body','nose','duct_left','duct_right','rotor_left_pivot','rotor_right_pivot','scanner','optic'],'SCOUT · STOP THE ALERT',2,2),
  artillery:archetype('artillery',['base','armor','mortar_pivot','ammo_drum','weakpoint',...Array.from({length:4},(_,i)=>`stabilizer_0${i+1}`)],'ARTILLERY · LEAVE THE RING',3,3),
  // Repair heals only; it never revives dead enemies (Phase 3).
  repair:archetype('repair',['chassis','armor_panel','wheel_left','wheel_right','cable_spool','arm_base','repair_arm_pivot','tool_emitter'],'REPAIR · STOP THE HEALING',3,3),
  sniper:archetype('sniper',['core','armor_panel','optic','weakpoint','barrel_pivot','tripod_leg_01','tripod_leg_02','tripod_leg_03'],'SNIPER · BREAK SIGHT',3,3),
  // Basic infantry trooper: covers both bare grunt and the patrol encounter (same type:'grunt').
  patrol_grunt:archetype('patrol_grunt',['chassis','upper_frame','front_plate','side_panel_left','side_panel_right',
    'wheel_front_left','hub_front_left','wheel_front_right','hub_front_right','wheel_rear_left','hub_rear_left','wheel_rear_right','hub_rear_right',
    'battery_cage','weakpoint_battery','sensor_head_pivot','sensor_head','sensor_face','optic','short_machine_gun','head_turntable'],
    'PATROL GRUNT · FLANK THE BACK',1,2),
});
// Maps every gameplay type/encounter (nodspel/levels.js RULES.enemyTypes, nodspel/encounters.js,
// nodspel/stakes.js hunter waves) to the archetype model that best reads its behaviour. Keys are checked by
// encounter first (the more specific label), then by type, in visualFor() below. Stand-ins are temporary;
// see docs/enemy-model-mapping.md for the full table and specs for the types with no fitting model yet.
export const ENEMY_VISUALS=freeze({
  shield_turret:{archetype:'shield_turret'}, // stationary, shield up until EMP'd: the authored shield_arc stays visible
  turret:{archetype:'shield_turret',hideParts:['shield_arc']}, // same cabinet, no EMP-shield mechanic: hide the arc
  guard:{archetype:'tank',scale:.82}, // front_armor on the turret head reads as the guard's front shield
  patrol:{archetype:'patrol_grunt'}, // sight-cone walker; patrol is just a grunt with the patrol encounter
  grenadier:{archetype:'artillery',scale:.92},
  thrower:{archetype:'artillery',scale:.92}, // bare thrower (no encounter): identical silhouette to grenadier
  swarm:{archetype:'swarm_bot',scale:.85},
  sentry:{archetype:'sniper',scale:.88}, // bare sentry (no encounter): a stationary long-range shooter
  rusher:{archetype:'rusher'}, // bare/charging rusher (isCharger)
  grunt:{archetype:'patrol_grunt'}, // basic infantry trooper (bare, no encounter)
});
export function visualFor(e){
  if(!e||e.type==='generator')return null;
  if(e.encounter&&Object.hasOwn(ENEMY_VISUALS,e.encounter))return ENEMY_VISUALS[e.encounter];
  if(e.type==='rusher'&&e.swarm)return ENEMY_VISUALS.swarm; // hunter waves (nodspel/stakes.js): swarm:true, no encounter
  return e.type&&Object.hasOwn(ENEMY_VISUALS,e.type)?ENEMY_VISUALS[e.type]:null;
}
export const isShieldTurret=e=>e?.encounter==='shield_turret';
export const isCharger=e=>e?.type==='rusher'&&!e.swarm;
// Excludes guard (type:'grunt', encounter:'guard'): it stands in on the 'tank' archetype, which has no
// weakpoint_battery part, so it keeps only the generic flank/unaware bonus from weakSide.
export const isPatrolGrunt=e=>e?.type==='grunt'&&e.encounter!=='guard';
export function rusherLungeSpeed(e){return Math.max(0,e.speed??0)*ENEMY_TUNING.rusher.speedMul;}
export function rusherBackBonus(e,from,now){
  if(!isCharger(e)||!from||now>=(e.wallStunUntil??0))return null;
  const dx=from.x-e.x,dz=from.z-e.z;
  return dx*Math.sin(e.facing??0)+dz*Math.cos(e.facing??0)<-1e-9?{kind:'flank',multiplier:ENEMY_TUNING.rusher.backDamageMul}:null;
}
// Grunt/patrol's authored weakpoint_battery sits on the back of the chassis: a shot landing beyond 120 deg
// off facing always deals its own 1.75x, ahead of the generic flank/unaware bonus in weakSide (round.js hitEnemy).
export function patrolGruntBackBonus(e,from){
  if(!isPatrolGrunt(e)||!from)return null;
  const dx=from.x-e.x,dz=from.z-e.z,dist=Math.hypot(dx,dz);
  if(dist<1e-9)return null;
  const forwardDot=(dx*Math.sin(e.facing??0)+dz*Math.cos(e.facing??0))/dist;
  return forwardDot<-.5?{kind:'flank',multiplier:ENEMY_TUNING.patrolGrunt.backDamageMul}:null;
}
