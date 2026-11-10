import {animationState} from './operator.js?v=2.28.14';

// Procedural presentation for the box-rig robot skin (M38: perceived animation/behavior parity with the
// human rig, without a shared mesh/rig - "a procedural character may use a different implementation, but
// cannot lack perceptible run/aim/fire/hit/death readability or behave differently mechanically"). This
// module only poses the already-built robot meshes every frame; it never touches gameplay position,
// collision or fire validation (those stay in round.js/combat.js, unchanged by any skin).
//
// `gun`'s local .position.z is deliberately left alone: game.mjs still drives the muzzle recoil kick on
// that single axis every frame (existing behavior), so this module only ever sets gun.position.x/.y and
// gun.rotation - never a full position reset that would fight the recoil offset.
export function createRobotPresence({root,body,head,visor,gun,antenna,legL,legR}){
  const posed=[body,head,visor,antenna,legL,legR].filter(Boolean);
  const basePos=new Map(posed.map(p=>[p,p.position.clone()]));
  const baseRot=new Map([...posed,gun].filter(Boolean).map(p=>[p,p.rotation.clone()]));
  const gunBase={x:gun.position.x,y:gun.position.y};
  const rootBaseY=root.position.y;
  let shotLeft=0,hitLeft=0,phase=0;
  function shoot(){shotLeft=.12;}
  function hit(){hitLeft=.32;}
  function reset(){
    shotLeft=0;hitLeft=0;phase=0;
    for(const p of posed){p.position.copy(basePos.get(p));p.rotation.copy(baseRot.get(p));}
    gun.position.x=gunBase.x;gun.position.y=gunBase.y;gun.rotation.copy(baseRot.get(gun));
    root.rotation.set(0,0,0);root.position.y=rootBaseY;
  }
  function update(dt,{moving=false,dashing=false,dead=false,aiming=false,interacting=false}={}){
    shotLeft=Math.max(0,shotLeft-dt);hitLeft=Math.max(0,hitLeft-dt);
    const state=animationState({dead,hit:hitLeft>0,dashing,moving,shooting:shotLeft>0,interacting});
    for(const p of posed){p.position.copy(basePos.get(p));p.rotation.copy(baseRot.get(p));}
    gun.position.x=gunBase.x;gun.position.y=gunBase.y;gun.rotation.copy(baseRot.get(gun));
    root.rotation.set(0,0,0);root.position.y=rootBaseY;
    phase+=dt*(moving?8.4:2.2);
    // Mirrors the human rig's own per-layer priority (dash/death own the whole pose outright, ranked
    // above hit here, even though the reported `state` above ranks hit first) rather than the vocabulary
    // priority: a dash is a canned, fixed-duration roll that should not be interrupted by a hit flinch.
    if(dead){
      // Death may freeze the body (M39): tip the whole rig over and settle, same as the human clamp-on-finish clip.
      root.rotation.x=Math.PI/2.1;root.position.y=rootBaseY-.32;
      return state;
    }
    if(dashing){
      // A canned, fixed-duration roll on the human rig; mirror it here as a forward crouch-lean.
      root.position.y=rootBaseY-.1;root.rotation.x=.5;legL.rotation.x=.55;legR.rotation.x=-.3;
      return state;
    }
    const bob=moving?Math.abs(Math.sin(phase))*.055:Math.sin(phase*.6)*.012;
    body.position.y+=bob;head.position.y+=bob;visor.position.y+=bob;antenna.position.y+=bob;
    const swing=moving?Math.sin(phase)*.42:0;
    legL.rotation.x+=swing;legR.rotation.x-=swing;
    const engaged=aiming||shotLeft>0;
    if(engaged){gun.rotation.x=-.14;body.rotation.x-=.05;}
    else if(interacting)head.rotation.x=.3;
    if(shotLeft>0)gun.position.y+=.015;
    // Hit stays visible without freezing legs that are actually moving: an additive torso/head flinch
    // layered on top of whatever locomotion pose already applied above (same fix as the human rig).
    if(hitLeft>0){const k=Math.min(1,hitLeft/.32);body.rotation.z=-.3*k;head.position.x-=.08*k;}
    return state;
  }
  return {update,shoot,hit,reset};
}
