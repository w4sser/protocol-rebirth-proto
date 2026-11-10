// Per-player adaptive difficulty hook (docs/difficulty-bots.md §3). Pure function: scales a
// generated level's enemies in place, applied once at raid generation (never mid-fight). Every
// default is neutral -- a no-op -- matching the knob table in docs/difficulty-bots.md §3.
// The live game does not call this yet (it lands with the DDA PR, docs/difficulty-bots.md §5.4);
// today it is the hook tools/difficulty-bots/tune.mjs sweeps to measure the baseline curve.
import {RULES,randomFromSeed} from './levels.js?v=2.28.12';
import {walkMap} from './encounters.js?v=2.28.12';

export const NEUTRAL_KNOBS=Object.freeze({hp:1,dmg:1,count:0,aggro:1,cadence:1});

// hp/dmg/aggro/cadence bounds from docs/difficulty-bots.md §3; count is a per-room delta, not a
// multiplier. cadence multiplies enemyCooldownMs directly, so above 1 is SLOWER fire (easier) and
// below 1 is FASTER fire (harder) -- the opposite sense of hp/dmg/aggro/count, where above 1 is harder.
export const KNOB_BOUNDS=Object.freeze({hp:[.85,1.8],dmg:[.8,1.3],count:[-1,2],aggro:[.85,1.3],cadence:[.85,1.15]});

export function applyDifficulty(level,knobs={}){
  const k={...NEUTRAL_KNOBS,...knobs};
  if(k.hp!==1)for(const e of level.enemies)if(e.type!=='generator')e.health=Math.max(1,Math.round(e.health*k.hp));
  if(k.dmg!==1){
    level.enemyDamage=Math.round((level.enemyDamage??RULES.combat.damage)*k.dmg);
    level.dmgMul=(level.dmgMul??1)*k.dmg;
  }
  // aggro: multiplies the detection/sight range stepCombat's seen-check and patrolSight's cone use
  // (encounters.js inSightCone, combat.js's detectRange check both read level.aggroMul); a neutral
  // aggro is still a true no-op since both default the multiplier to 1 when unset.
  if(k.aggro!==1)level.aggroMul=k.aggro;
  // cadence: scales the fallback fire-rate cooldown the same way k.dmg scales the fallback damage
  // (combat.js reads enemy.cooldownMs ?? level.enemyCooldownMs ?? RULES.combat.cooldownMs); enemies
  // with their own per-type cooldownMs/encounter recovery timer are outside this knob's reach, same
  // scope limitation k.dmg already has against encounter-specific damagePct values.
  if(k.cadence!==1)level.enemyCooldownMs=Math.round((level.enemyCooldownMs??RULES.combat.cooldownMs)*k.cadence);
  if(k.count)adjustEnemyCount(level,k.count);
  return level;
}

// +1..n: clone a nearby non-generator enemy per room, offset a seeded short distance away (a few
// placement attempts clear of walls/boxes; a room with no clear spot simply skips that room).
// -1..n: drop extras first (AREA_RULES.extraEnemies bodies, nodspel/levels.js), then any enemy,
// cheapest (lowest health) first, never leaving a room with its shielded-node generator orphaned.
function adjustEnemyCount(level,count){
  const rng=randomFromSeed(`${level.seed}:difficulty:count`);
  // v2.28.6: an extra must stand fully on real floor (its whole footprint), clear of walls/boxes/locked doors and
  // other bodies, and be walkable from the start -- before this, a clone 1.4-2.8 m from its source could land
  // behind an exterior wall (playtest 2026-11-08 "spawn outside the level").
  const solids=[...level.walls,...level.boxes,...(level.doors??[]).filter(d=>d.locked)];
  const R=.48,onFloor=(x,z)=>level.floors.some(f=>Math.abs(x-f.x)<=f.w/2+.02&&Math.abs(z-f.z)<=f.d/2+.02);
  const walk=walkMap(level,'__dda');
  const clear=p=>[[0,0],[R,R],[-R,R],[R,-R],[-R,-R]].every(([dx,dz])=>onFloor(p.x+dx,p.z+dz))
    &&!solids.some(o=>Math.abs(p.x-o.x)<o.w/2+.6&&Math.abs(p.z-o.z)<o.d/2+.6)
    &&!level.enemies.some(e=>Math.hypot(p.x-e.x,p.z-e.z)<(e.r??R)+R+.1)&&walk(p);
  // Clone a plain body, never an encounter actor: a cloned guard/shield turret kept its front shield with no
  // flank guarantee. With no plain body in the level, no extra is added.
  const plain=e=>e.type!=='generator'&&!e.encounter&&!e.frontShield&&!e.introGuard&&!e.node;
  if(count>0){
    for(let n=0;n<count;n++){
      const pool=level.enemies.filter(plain);
      const source=pool.sort((a,b)=>a.health-b.health)[0]; // no plain body -> no extra (never a shieldless shield actor)
      if(!source)break;
      let placed=null;
      for(let attempt=0;attempt<50&&!placed;attempt++){
        const angle=rng()*2*Math.PI,radius=1.4+rng()*1.4;
        const p={x:Math.round((source.x+Math.cos(angle)*radius)*100)/100,z:Math.round((source.z+Math.sin(angle)*radius)*100)/100};
        if(clear(p))placed=p;
      }
      if(!placed)continue;
      level.enemies.push({...source,id:`enemy-${level.enemies.length+1}`,x:placed.x,z:placed.z,health:source.health,active:true,extra:true,encounter:undefined});
    }
  }else{
    const removable=()=>[...level.enemies].filter(e=>e.type!=='generator'&&!(e.node||level.nodes.some(nd=>nd.generatorId===e.id)));
    for(let n=0;n<-count;n++){
      const pool=removable().filter(e=>e.extra).length?removable().filter(e=>e.extra):removable();
      const drop=pool.sort((a,b)=>a.health-b.health)[0];
      if(!drop)break;
      level.enemies.splice(level.enemies.indexOf(drop),1);
    }
  }
}
