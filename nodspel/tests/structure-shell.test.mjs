import test from 'node:test';
import assert from 'node:assert/strict';
import {shellFaces,shellMesh,wallSolids} from '../structure-shell.js';
import {generateLevel} from '../levels.js';
const area=f=>(f.rect[1]-f.rect[0])*(f.rect[3]-f.rect[2]);
const inside=(p,b)=>Math.abs(p[0]-b.x)<b.w/2-1e-8&&Math.abs(p[1]-b.y)<b.h/2-1e-8&&Math.abs(p[2]-b.z)<b.d/2-1e-8;
function check(boxes){
  const faces=shellFaces(boxes),planes=new Map();
  for(const f of faces){
    assert.ok(area(f)>0);
    const p=[0,0,0];p[f.axis]=f.at+f.sign*1e-5;p[f.u]=(f.rect[0]+f.rect[1])/2;p[f.v]=(f.rect[2]+f.rect[3])/2;
    assert.ok(!boxes.some(b=>inside(p,b)),'no face inside a neighbouring wall');
    p[f.axis]=f.at-f.sign*1e-5;assert.ok(boxes.some(b=>inside(p,b)),'every face bounds a solid');
    const key=`${f.axis}:${f.at.toFixed(6)}`,prev=planes.get(key)??[];
    for(const g of prev){const overlap=Math.min(f.rect[1],g.rect[1])-Math.max(f.rect[0],g.rect[0])>1e-6&&Math.min(f.rect[3],g.rect[3])-Math.max(f.rect[2],g.rect[2])>1e-6;assert.ok(!overlap,'no coplanar duplicate or opposing faces');}
    prev.push(f);planes.set(key,prev);
  }return faces;
}
test('touching, overlapping and duplicate blocks have exactly the exposed union surface',()=>{
  const b={x:0,y:0,z:0,w:2,h:2,d:2};
  for(const dx of [0,1,2]){const f=check([b,{...b,x:dx}]);assert.equal(f.reduce((n,f)=>n+area(f),0),24+8*dx);}
  const mesh=shellMesh([b],[0xffffff]);assert.equal(mesh.geometry.groups.length,1);assert.ok(mesh.geometry.index.count>0);
});
test('L/T corners, unequal heights and separate elevations keep their exact boundaries',()=>{
  check(wallSolids([{x:0,z:0,w:8,d:.4,h:1.2},{x:3.8,z:3,w:.4,d:6.4,h:.65},{x:0,z:2,w:.4,d:4,h:1.7},{x:0,z:0,w:8,d:.4,h:1.2,y:3.2}]));
});
test('normal and BIG MAP L1-L3 wall surfaces have no interior or coplanar overlaps',()=>{
  for(const big of [false,true])for(const seed of ['seams','art','a'])for(const n of [1,2,3]){
    const level=generateLevel(n,seed,'bunker',false,big);
    check(wallSolids(level.walls));
    check(level.floors.map(f=>({x:f.x,z:f.z,y:(f.y??0)-.4005,w:f.w+1.2,d:f.d+1.2,h:.699})));
  }
});
