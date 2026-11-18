// OP-01 binary asset and shared-skeleton contract.
// The old still-pose source GLBs remain for art comparison; the four NEW
// rigged assets are required for Deploy and gameplay. CI must fail rather
// than silently accept the procedural V4 if the assets are not committed.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const folder=path.join(root,'assets/operators');
const clips=['idle','run','aim','shoot','hit','dash','death','hero_pose'];

function readGLB(filename){
  const filepath=path.join(folder,filename);
  assert(fs.existsSync(filepath),filename+' missing; upload the rigged GLB to assets/operators/');
  const binary=fs.readFileSync(filepath);
  assert.equal(binary.toString('ascii',0,4),'glTF',filename+' magic');
  assert.equal(binary.readUInt32LE(4),2,filename+' version');
  assert.equal(binary.readUInt32LE(8),binary.length,filename+' declared size');
  assert.equal(binary.toString('ascii',16,20),'JSON',filename+' JSON chunk');
  const len=binary.readUInt32LE(12);
  const json=JSON.parse(binary.toString('utf8',20,20+len));
  assert((json.buffers||[]).every(x=>!x.uri),filename+' must be self-contained');
  return {binary,json,jsonLength:len,filename};
}
function getTriangles(json){
  return (json.meshes||[]).reduce((sum,m)=>sum+(m.primitives||[]).reduce((n,p)=>{
    const a=json.accessors[p.indices];
    return n+(a?.count||0)/3;
  },0),0);
}
function getBindBytes(glb){
  const {binary,json,jsonLength}=glb;
  const acc=json.accessors[json.skins[0].inverseBindMatrices];
  const view=json.bufferViews[acc.bufferView];
  const binaryChunkOffset=20+jsonLength+8;
  const offset=binaryChunkOffset+(view.byteOffset||0)+(acc.byteOffset||0);
  return binary.subarray(offset,offset+acc.count*16*4);
}

for(const [filename,expected] of [
  ['OP01_Mobile.glb',68072],['OP01_Hero.glb',247895]
]){
  const {binary,json}=readGLB(filename);
  const names=(json.nodes||[]).map(n=>n.name||'');
  assert(binary.length>1_000_000,filename+' looks truncated');
  for(const part of ['Backpack','Body','Coat','Gear'])
    assert(names.some(n=>n.includes(part)),filename+' missing '+part);
  assert((json.materials||[]).length>=4,filename+' missing materials');
  assert((json.images||[]).length>=2,filename+' missing textures');
  assert.equal(getTriangles(json),expected,filename+' triangle count');
}

let firstRig=null,firstBind=null;
for(const [filename,triangles] of [
  ['OP01_Menu.glb',68417],
  ['OP01_Game_LOD0.glb',25637],
  ['OP01_Game_LOD1.glb',12106],
  ['OP01_Game_LOD2.glb',6156]
]){
  const glb=readGLB(filename),{json,binary}=glb;
  assert(binary.length>700_000,filename+' truncated');
  assert.equal(getTriangles(json),triangles,filename+' triangle count');
  assert.equal(json.skins?.length,1,filename+' should contain one shared rig');
  const skin=json.skins[0];
  assert.equal(skin.joints?.length,41,filename+' requires 41 Mixamo bones');
  const bones=skin.joints.map(i=>json.nodes[i].name);
  const bind=getBindBytes(glb);
  if(firstRig){
    assert.deepEqual(bones,firstRig,filename+' skeleton order differs');
    assert(bind.equals(firstBind),filename+' bind matrices differ');
  }else{
    firstRig=bones;firstBind=bind;
  }
  assert.equal((json.meshes||[]).length,2,filename+' expects character and attached rifle');
  assert.equal(json.meshes[0].primitives.length,4,filename+' character mesh layout changed');
  assert.equal(json.meshes[1].primitives.length,3,filename+' gun material layout changed');
  assert(json.nodes.some(n=>n.name==='OP01_Rig'),filename+' has no armature');
  assert(json.nodes.some(n=>n.name==='OP01_Carbine'),filename+' has no carbine');
  assert(json.nodes.some(n=>n.name==='mixamorig:RightHand'),filename+' missing right hand');
  const animationNames=new Set((json.animations||[]).map(a=>a.name));
  for(const clip of clips)assert(animationNames.has(clip),filename+' missing '+clip+' animation');
  assert((json.images||[]).length>=2,filename+' missing embedded atlases');
  assert((json.materials||[]).length>=6,filename+' missing PBR channels');
  for(const prim of json.meshes[0].primitives)
    assert(prim.attributes.JOINTS_0!==undefined&&prim.attributes.WEIGHTS_0!==undefined,
      filename+' character primitive is not skinned');
}
const viewer=fs.readFileSync(path.join(root,'ui/raid-prep-scene.mjs'),'utf8');
const menu=fs.readFileSync(path.join(root,'ui/raid-prep-op01.mjs'),'utf8');
const gameplay=fs.readFileSync(path.join(root,'nodspel/op01-gameplay.js'),'utf8');
const game=fs.readFileSync(path.join(root,'nodspel/game.mjs'),'utf8');
assert(viewer.includes('await loadOP01Operator('),'Deploy must load OP01');
assert(menu.includes("new GLTFLoader().loadAsync("),'menu must parse GLB');
assert(menu.includes('OP01_Menu.glb')&&menu.includes("'hero_pose'"),
  'menu must use rigged OP01 with low-ready pose');
assert(viewer.includes('createMenuBit()'),'BIT remains a separate 3D companion');
assert(gameplay.includes('OP01_Game_LOD2.glb')&&gameplay.includes('new THREE.AnimationMixer(model)'),
  'gameplay must use all three LODs and one mixer');
assert(gameplay.includes('skinnedParts.forEach')&&gameplay.includes('compatibleRig('),
  'all four character meshes must switch together with a shared rig');
assert(game.includes("requestedSkin==='op01'")&&game.includes('human.updateLOD?.('),
  'OP01 gameplay must be selectable with projected-screen LODs');
console.log('OP01 RIGGED MENU + GAMEPLAY ASSET VALIDATION PASSED');
