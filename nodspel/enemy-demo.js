import {ENEMIES,ENEMY_TUNING} from './enemies.js?v=2.22.2';
import {RULES} from './levels.js?v=2.22.2';
import {traceTargets} from './physics.mjs?v=2.22.2';
// Explicitly gated: no extra enemies, randomness or tuning changes in a normal raid.
export function applyEnemyDemo(level,search,area='bunker'){
  const q=new URLSearchParams(search);
  if(q.get('debug')!=='1'||q.get('enemydemo')!=='1'||area!=='bunker'||level.number!==1||level.big||level.enemyDemo)return false;
  const S=level.start,room=level.rooms[0],solids=[...level.walls,...level.boxes,...level.nodes.map(n=>({...n,w:1.4,d:1.4}))];
  const positions=[];
  for(const side of [-1,1]){
    let best=null;
    for(const distance of [2.8,3.5,4.2,1.5,2.1,4.8])for(const spread of [2.4,1.7,3.2,.9,3.9,4.6]){
      const p={x:S.x+side*spread,z:S.z-distance};
      if(Math.abs(p.x-room.x)>room.w/2-1||Math.abs(p.z-room.z)>room.d/2-1)continue;
      if(solids.some(o=>Math.abs(p.x-o.x)<o.w/2+.65&&Math.abs(p.z-o.z)<o.d/2+.65)||level.enemies.some(e=>Math.hypot(e.x-p.x,e.z-p.z)<1.2)||positions.some(e=>Math.hypot(e.x-p.x,e.z-p.z)<1.2))continue;
      if(traceTargets(S,p,solids,[])?.kind==='wall')continue;
      best??=p;
    }
    if(!best)return false;
    positions.push(best);
  }
  const facing=p=>Math.atan2(S.x-p.x,S.z-p.z);
  level.enemies.push({id:'enemy-demo-shield',kind:'enemy',type:'sentry',archetype:'shield_turret',encounter:'shield_turret',...positions[0],r:.48,health:ENEMY_TUNING.shieldTurret.health,speed:0,rangeMul:ENEMIES.shield_turret.stats.rangeMul,frontShield:ENEMY_TUNING.shieldTurret.frontHalfAngleDeg,facing:facing(positions[0]),active:true},
    {id:'enemy-demo-rusher',kind:'enemy',type:'rusher',...positions[1],r:.48,health:ENEMY_TUNING.demo.rusherHealth,speed:ENEMY_TUNING.demo.rusherSpeed,rangeMul:ENEMIES.rusher.stats.rangeMul,facing:facing(positions[1]),active:true});
  level.enemyDemo=true;return true;
}
// All 8 raid enemy types/encounters (nodspel/levels.js RULES.enemyTypes, nodspel/encounters.js) placed
// near the start of bunker L1's first room so every archetype visual (docs/enemy-model-mapping.md) is
// visible in one screenshot: grunt, sentry, thrower, swarm, turret, guard, patrol, rusher.
const MIXED_KINDS=['grunt','sentry','thrower','swarm','turret','guard','patrol','rusher'];
export function applyEnemyDemoMixed(level,search,area='bunker'){
  const q=new URLSearchParams(search);
  if(q.get('debug')!=='1'||q.get('enemydemo')!=='mixed'||area!=='bunker'||level.number!==1||level.big||level.enemyDemo)return false;
  const S=level.start,room=level.rooms[0],solids=[...level.walls,...level.boxes,...level.nodes.map(n=>({...n,w:1.4,d:1.4}))];
  // A shared grid of candidate spots (closest-to-start first), greedily filled: far more robust across
  // seeds than reserving a fixed ring/side per enemy, since room shape and existing obstacles vary a lot.
  const grid=[];
  for(let distance=1.2;distance<=room.d/2-.8;distance+=.45)
    for(let spread=-room.w/2+.8;spread<=room.w/2-.8;spread+=.45)
      grid.push({x:S.x+spread,z:S.z-distance,d2:spread*spread+distance*distance});
  grid.sort((a,b)=>a.d2-b.d2);
  const positions=[];
  for(const p of grid){
    if(positions.length>=MIXED_KINDS.length)break;
    if(Math.abs(p.x-room.x)>room.w/2-1||Math.abs(p.z-room.z)>room.d/2-1)continue;
    if(solids.some(o=>Math.abs(p.x-o.x)<o.w/2+.6&&Math.abs(p.z-o.z)<o.d/2+.6)||level.enemies.some(e=>Math.hypot(e.x-p.x,e.z-p.z)<1.1)||positions.some(e=>Math.hypot(e.x-p.x,e.z-p.z)<1.1))continue;
    if(traceTargets(S,p,solids,[])?.kind==='wall')continue;
    positions.push(p);
  }
  if(positions.length<MIXED_KINDS.length)return false;
  const facing=p=>Math.atan2(S.x-p.x,S.z-p.z);
  const G=RULES.encounters.guard,T=RULES.encounters.turret,P=RULES.encounters.patrol,SW=RULES.encounters.swarm;
  const base=(i,over)=>({id:`enemy-demo-${MIXED_KINDS[i]}`,kind:'enemy',x:positions[i].x,z:positions[i].z,r:.48,active:true,facing:facing(positions[i]),...over});
  level.enemies.push(
    base(0,{type:'grunt',health:RULES.enemyHealth,speed:0}),
    base(1,{type:'sentry',health:RULES.enemyHealth,speed:0}),
    base(2,{type:'thrower',health:RULES.enemyHealth,speed:0}),
    base(3,{type:'rusher',health:SW.health,speed:0,encounter:'swarm',swarm:'demo-swarm'}),
    base(4,{type:'sentry',health:T.health,speed:0,encounter:'turret'}),
    base(5,{type:'grunt',health:G.health,speed:0,encounter:'guard',frontShield:G.frontHalfAngleDeg}),
    base(6,{type:'grunt',health:P.health,speed:0,encounter:'patrol',patrol:{points:[positions[6],positions[6]],i:1,speed:P.walkSpeed,turn:P.turnRadPerSec},aggro:false}),
    base(7,{type:'rusher',health:ENEMY_TUNING.demo.rusherHealth,speed:0}),
  );
  level.enemyDemo=true;return true;
}
