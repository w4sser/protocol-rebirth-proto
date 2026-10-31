import {ENEMIES,ENEMY_TUNING} from './enemies.js?v=2.17.0';
import {traceTargets} from './physics.mjs?v=2.17.0';
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
