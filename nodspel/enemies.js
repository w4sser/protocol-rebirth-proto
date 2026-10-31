import '../data/raid-enemies.js?v=2.15.0';
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const ENEMY_TUNING=freeze(globalThis.DATA.raidEnemies);
export const ENEMY_COLORS=ENEMY_TUNING.colors; // Approved: coral damage, blue shield, green heal, yellow AoE.
function archetype(id,parts,hint,tier,phase,scale=1){
  return {id,groundOffset:id==='shield_turret'?.45:0,model:`../assets/enemies/${id}.glb?v=2.15.0`,scale,
    // Apply X rotation first, then Y: local +Z -> world +Y, local +X -> game +Z.
    forwardUpFix:{rotateX:-Math.PI/2,rotateY:-Math.PI/2},parts,stats:ENEMY_TUNING.stats[id],telegraphColors:ENEMY_COLORS,hint,tier,phase};
}
export const ENEMIES=freeze({
  // Separate variant; today's unshielded turret remains in encounter pools.
  shield_turret:archetype('shield_turret',['base','turret_head_pivot','turret_head','front_armor','cannon','optic','weakpoint','shield_arc'],'SHIELD TURRET · FLANK THE BACK',2,1),
  rusher:archetype('rusher',['core','wedge_head','back_battery','optic','leg_front_left_pivot','leg_front_right_pivot','leg_rear_left_pivot','leg_rear_right_pivot'],'RUSHER · SIDESTEP THE CHARGE',2,1),
  // Tank crushes light cover (Phase 2).
  tank:archetype('tank',['hull','track_left','track_right','turret_head_pivot','turret_head','front_armor','cannon','optic','weakpoint'],'TANK · AVOID ITS FRONT',3,2),
  swarm_bot:archetype('swarm_bot',['shell','optic',...Array.from({length:6},(_,i)=>`leg_0${i+1}_pivot`)],'SWARM · FALL BACK',2,2),
  // Scout may pull enemies from other rooms in BIG MAP (Phase 2).
  scout:archetype('scout',['body','nose','duct_left','duct_right','rotor_left_pivot','rotor_right_pivot','scanner','optic'],'SCOUT · STOP THE ALERT',2,2),
  artillery:archetype('artillery',['base','armor','mortar_pivot','ammo_drum','weakpoint',...Array.from({length:4},(_,i)=>`stabilizer_0${i+1}`)],'ARTILLERY · LEAVE THE RING',3,3),
  // Repair heals only; it never revives dead enemies (Phase 3).
  repair:archetype('repair',['chassis','armor_panel','wheel_left','wheel_right','cable_spool','arm_base','repair_arm_pivot','tool_emitter'],'REPAIR · STOP THE HEALING',3,3),
  sniper:archetype('sniper',['core','armor_panel','optic','weakpoint','barrel_pivot','tripod_leg_01','tripod_leg_02','tripod_leg_03'],'SNIPER · BREAK SIGHT',3,3),
});
export const isShieldTurret=e=>e?.encounter==='shield_turret';
export const isCharger=e=>e?.type==='rusher'&&!e.swarm;
export function rusherLungeSpeed(e){return Math.max(0,e.speed??0)*ENEMY_TUNING.rusher.speedMul;}
export function rusherBackBonus(e,from,now){
  if(!isCharger(e)||!from||now>=(e.wallStunUntil??0))return null;
  const dx=from.x-e.x,dz=from.z-e.z;
  return dx*Math.sin(e.facing??0)+dz*Math.cos(e.facing??0)<-1e-9?{kind:'flank',multiplier:ENEMY_TUNING.rusher.backDamageMul}:null;
}
