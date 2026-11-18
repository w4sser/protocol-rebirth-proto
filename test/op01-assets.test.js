// Validate actual GLB files are present in git and structurally compatible
// with the Three.js Deploy menu. This intentionally fails before binary assets
// are committed, so CI cannot green-light a procedural fallback as finished.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const models=[
  {name:'OP01_Mobile.glb',minBytes:3_000_000,triangles:[60_000,85_000]},
  {name:'OP01_Hero.glb',minBytes:13_000_000,triangles:[200_000,270_000]}
];
for(const model of models){
  const filename=path.join(root,'assets/operators',model.name);
  assert(fs.existsSync(filename),
    model.name+' is missing. Commit the real uploaded binary to assets/operators/ on the PR branch.');
  const binary=fs.readFileSync(filename);
  assert(binary.byteLength>=model.minBytes,model.name+' appears incomplete');
  assert.equal(binary.toString('ascii',0,4),'glTF',model.name+' must be GLB');
  assert.equal(binary.readUInt32LE(4),2,model.name+' must be glTF 2');
  assert.equal(binary.readUInt32LE(8),binary.length,model.name+' declared size mismatch');
  assert.equal(binary.toString('ascii',16,20),'JSON');
  const json=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)));
  const names=new Set((json.nodes||[]).map(n=>n.name||''));
  for(const suffix of ['Backpack','Body','Coat','Gear'])
    assert([...names].some(n=>n.includes(suffix)),
      model.name+' is missing '+suffix+' node');
  assert((json.images||[]).length>=2,model.name+' has missing embedded textures');
  assert((json.materials||[]).length>=4,model.name+' has missing PBR materials');
  assert((json.buffers||[]).every(b=>!b.uri),model.name+' must be self-contained');
  let tris=0,minY=Infinity,maxY=-Infinity;
  for(const mesh of json.meshes||[])for(const p of mesh.primitives||[]){
    const idx=json.accessors[p.indices];
    tris+=(idx?.count||0)/3;
    const v=json.accessors[p.attributes.POSITION];
    if(v?.min)minY=Math.min(minY,v.min[1]);
    if(v?.max)maxY=Math.max(maxY,v.max[1]);
  }
  assert(tris>=model.triangles[0]&&tris<=model.triangles[1],
    model.name+' triangle count is unexpected: '+tris);
  assert(Math.abs((maxY-minY)-1.78)<.025,
    model.name+' height must be about 1.78m (+Y up): '+(maxY-minY));
}
const scene=fs.readFileSync(path.join(root,'ui/raid-prep-scene.mjs'),'utf8');
const loader=fs.readFileSync(path.join(root,'ui/raid-prep-op01.mjs'),'utf8');
assert(scene.includes('await loadOP01Operator('),'Deploy must load authored OP01');
assert(loader.includes("new GLTFLoader().loadAsync("),'3D model must be parsed as GLB');
assert(scene.includes('createMenuBit()'),'BIT must remain a real 3D companion');
console.log('OP01 GLB ASSET VALIDATION PASSED');
