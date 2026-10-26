import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurretWarning,updateTurretWarning} from '../turret-warning.mjs';

test('turret lanes span range at ground height, with wide fills and narrow edges',()=>{
  const group=createTurretWarning('#E4705F');
  const dirs=[{x:1,z:0},{x:Math.cos(.2),z:Math.sin(.2)},{x:Math.cos(-.2),z:Math.sin(-.2)}];
  updateTurretWarning(group,dirs,12,.7,100,1000,900);
  const fill=group.children[0],edges=group.children[1],p=fill.geometry.attributes.position;
  assert.equal(fill.geometry.drawRange.count,18);assert.equal(edges.geometry.drawRange.count,36);
  assert.equal(group.rotation.y,-.7);
  for(let i=0;i<3;i++){
    const n=i*4;
    assert.ok(Math.abs(Math.hypot(p.getX(n+1)-p.getX(n),p.getZ(n+1)-p.getZ(n))-.45)<1e-6);
    assert.ok(Math.abs(Math.hypot(p.getX(n+3)-p.getX(n),p.getZ(n+3)-p.getZ(n))-12)<1e-6);
    assert.ok(p.getY(n)>0&&p.getY(n)<.1);
  }
  assert.ok(edges.material.opacity>fill.material.opacity);
  assert.equal(fill.material.depthWrite,false);
  const buffers=[fill.geometry,edges.geometry,p.array,edges.geometry.attributes.position.array,fill.material,edges.material];
  const opacity=fill.material.opacity;
  // Same pulse phase, later in windup: both intensities must increase.
  const later=100+Math.PI*130;
  updateTurretWarning(group,dirs,12,.7,later,1000,900);
  assert.ok(fill.material.opacity>opacity);
  [fill.geometry,edges.geometry,p.array,edges.geometry.attributes.position.array,fill.material,edges.material].forEach((value,i)=>assert.equal(value,buffers[i]));
  const ramped=fill.material.opacity;
  updateTurretWarning(group,dirs,12,.7,later+Math.PI*65/2,later+Math.PI*65/2,900);
  assert.notEqual(fill.material.opacity,ramped);
});
