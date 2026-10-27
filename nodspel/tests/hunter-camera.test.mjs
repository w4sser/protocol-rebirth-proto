import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createRound,tickRound} from '../round.js';
import {generateLevel} from '../levels.js';
import {traceTargets} from '../physics.mjs';
import {STAKES,RAID_CAMERA,stepStakes} from '../stakes.js';

const viewports=[[932,430],[844,390],[667,375]];
function cameraAt(target,width,height){
  const c=RAID_CAMERA,h=c.halfHeight,aspect=width/height;
  const camera=new THREE.OrthographicCamera(-h*aspect,h*aspect,h,-h,c.near,c.far);
  camera.position.copy(target).add(new THREE.Vector3(c.offset.x,c.offset.y,c.offset.z));
  camera.lookAt(target);camera.updateMatrixWorld();return camera;
}
function settled(player){return new THREE.Vector3(player.x,0,player.z+RAID_CAMERA.targetOffsetZ);}
function firstWave(round,player,room,cameraTarget){
  tickRound(round,STAKES.alarmDelayMs);
  stepStakes(round,STAKES.alarmDelayMs,player,room,cameraTarget);
  const due=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(round,due);return stepStakes(round,due,player,room,cameraTarget).spawned;
}
function assertOutside(hunter,target){
  for(const [width,height] of viewports){
    const camera=cameraAt(target,width,height),v=STAKES.hunterCamera;
    const centre=new THREE.Vector3(hunter.x,v.centreHeight,hunter.z).project(camera);
    const rx=v.radius/(RAID_CAMERA.halfHeight*width/height),ry=v.radius/RAID_CAMERA.halfHeight;
    assert.ok(Math.abs(centre.x)>v.frustumMargin+rx || Math.abs(centre.y)>v.frustumMargin+ry,
      `hunter ${hunter.x},${hunter.z} intersects expanded camera view at ${width}x${height}`);
  }
}

test('visibility-0: a low wall blocks the player ray while the camera sees the reported spawn',()=>{
  const r=createRound('visibility-0',0);r.level=generateLevel(3,r.seed);
  const player={x:-14.07,z:-.71},reported={x:-.1145,z:-4.1135};
  const solids=[...r.level.walls,...r.level.boxes,...(r.level.doors??[]).filter(d=>d.locked)];
  assert.ok(traceTargets(player,reported,solids,[]),'old ground sightline accepts this point');
  const camera=cameraAt(settled(player),932,430);
  const point=new THREE.Vector3(reported.x,1,reported.z).project(camera);
  assert.ok(Math.abs((point.x+1)*932/2-880.5)<1);
  assert.ok(Math.abs((1-point.y)*430/2-391.4)<1);
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(new THREE.Vector2(point.x,point.y),camera);
  const distance=raycaster.ray.origin.distanceTo(new THREE.Vector3(reported.x,1,reported.z));
  for(const solid of solids){
    if(!Number.isFinite(solid.h))continue;
    const box=new THREE.Box3(new THREE.Vector3(solid.x-solid.w/2,0,solid.z-solid.d/2),
      new THREE.Vector3(solid.x+solid.w/2,solid.h,solid.z+solid.d/2));
    const hit=raycaster.ray.intersectBox(box,new THREE.Vector3());
    assert.ok(!hit || hit.distanceTo(raycaster.ray.origin)>distance,'reported camera ray is unobstructed');
  }
  const hunters=firstWave(r,player,-1);
  for(const hunter of hunters)assertOutside(hunter,settled(player));
  assert.ok(hunters.length>0 || r.stakes.waveNumber===0,'unsafe waves must defer');
});

test('hunter waves stay outside supported camera views, including camera follow interpolation',()=>{
  let spawned=0;
  for(let seed=0;seed<20;seed++){
    const r=createRound(`visibility-${seed}`,0);r.level=generateLevel(3,r.seed);
    const player=r.level.start,target=settled(player).add(new THREE.Vector3(4,0,-3));
    for(const hunter of firstWave(r,player,0,target)){
      spawned++;
      for(const fraction of [0,.25,.5,.75,1])assertOutside(hunter,target.clone().lerp(settled(player),fraction));
    }
  }
  assert.ok(spawned>0,'visibility checks still permit distant waves');
});
