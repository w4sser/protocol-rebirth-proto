import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planOrganicTrail} from '../ground-organic-trail.mjs';

const floor={x:6,z:-3,w:12,d:11};
test('footpath is a single, inset, winding ribbon with a width between 0.6m and 1.4m',()=>{
  const result=planOrganicTrail(floor,4831);
  assert.ok(result);
  assert.ok(result.length <= Math.max(floor.w,floor.d)*.70);
  assert.equal(result.positions.length,result.colors.length/4*3);
  assert.equal(result.indices.length,result.steps*(9-1)*6);
  assert.ok(result.samples.length>=25);
  const widths=result.samples.map(s=>s.width);
  assert.ok(Math.min(...widths)>=.6-1e-9);
  assert.ok(Math.max(...widths)<=1.4+1e-9);
  assert.ok(Math.max(...widths)-Math.min(...widths)>.17,'width varies visibly');
  const lateral=result.samples.map(s=>s.z);
  assert.ok(Math.max(...lateral)-Math.min(...lateral)>.18,'path meanders');
  for(let i=0;i<result.positions.length;i+=3){
    const x=result.positions[i],y=result.positions[i+1],z=result.positions[i+2];
    assert.ok(x>floor.x-floor.w/2+.49 && x<floor.x+floor.w/2-.49,'keeps away from X edges');
    assert.ok(z>floor.z-floor.d/2+.49 && z<floor.z+floor.d/2-.49,'keeps away from Z edges');
    assert.ok(Math.abs(y-.010)<1e-6,'under node halo at y=.018');
  }
});
test('winding faces up whether a floor runs along X or Z',()=>{
  for(const bounds of [{...floor},{...floor,w:9,d:14}]){
    const p=planOrganicTrail(bounds,987);
    // Cross product of a first non-degenerate triangle's horizontal vectors.
    const [a,b,c]=p.indices;
    const x=i=>p.positions[i*3],z=i=>p.positions[i*3+2];
    const ay=(x(b)-x(a))*(z(c)-z(a))-(z(b)-z(a))*(x(c)-x(a));
    assert.ok(ay<0,'upward cross product Y = dz*dx - dx*dz');
  }
});

test('frayed sides and faded interruptions are soft and never hard-walled',()=>{
  const result=planOrganicTrail(floor,49);
  const cols=9;
  const alpha=(i,k)=>result.colors[i*cols*4+k*4+3];
  const mid=Math.floor(result.steps/2);
  assert.equal(alpha(mid,0),0);
  assert.equal(alpha(mid,8),0);
  assert.ok(alpha(mid,1)<alpha(mid,2));
  assert.ok(alpha(mid,2)<alpha(mid,4));
  assert.equal(alpha(0,4),0,'starts faded');
  assert.equal(alpha(result.steps,4),0,'ends faded');
  const central=result.samples.map((s,i)=>alpha(i,4));
  const gap=result.samples.reduce((best,s,i)=>s.t>.38&&s.t<.53&&central[i]<central[best]?i:best, Math.floor(result.steps*.45));
  assert.ok(central[gap]<Math.max(...central)*.4,'first near-disappearance');
  assert.ok(Math.max(...central)>.4,'still readable between gaps');
});
test('seed stable, area sensitive and no paths on piers or tiny islands',()=>{
  const a=planOrganicTrail(floor,100);
  const b=planOrganicTrail(floor,100);
  const c=planOrganicTrail(floor,101);
  assert.deepEqual(a.positions,b.positions);
  assert.deepEqual(a.colors,b.colors);
  assert.notDeepEqual(a.positions,c.positions);
  assert.equal(planOrganicTrail({...floor,dir:{x:1,z:0}},100),null);
  assert.equal(planOrganicTrail({...floor,w:4},100),null);
  assert.equal(planOrganicTrail({...floor,d:3},100),null);
});
test('scene overlay is below gameplay ring elevations and renders first',async()=>{
  const source=await readFile(new URL('../ground-preview.js',import.meta.url),'utf8');
  assert.match(source,/tile\.position\.set\(x\+sx\/2, \.004, z\+sz\/2\)/);
  assert.match(source,/tile\.renderOrder = -2/);
  assert.match(source,/mesh\.renderOrder=-1/);
  assert.match(source,/position\.setY\(i,0\)/);
  assert.match(source,/polygonOffsetFactor=1/);
  assert.doesNotMatch(source,/TRAILS\.map/);
});
