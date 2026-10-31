const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('Nordic scene keeps camera fixed through water updates, resize and PLAY, then disposes',async()=>{
  const THREE=await import('../nodspel/vendor/three.module.js');
  let nextFrame,lastScene,lastCamera,removed=false,disposed=false,ratio;
  class Renderer{
    constructor(){this.domElement={addEventListener(){},removeEventListener(){},remove(){removed=true;}};}
    setPixelRatio(value){ratio=value;}setSize(){}
    render(scene,camera){lastScene=scene;lastCamera=camera;}
    dispose(){disposed=true;}
  }
  const source=fs.readFileSync(require.resolve('../start-scene.js'),'utf8').replace(/^import .*;$/m,'').replace('export function','function');
  const listeners={};
  const win={devicePixelRatio:3,matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
  const mount=new Function('THREE','window','performance','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight',source+';return mountStartFlight;')({...THREE,WebGLRenderer:Renderer},win,{now:()=>0},fn=>{nextFrame=fn;return 1;},()=>{},932,430);
  const host={clientWidth:932,clientHeight:430,appendChild(){}};
  const ctl=mount(host,{name:'medium',pixelRatioCap:1.25});
  assert.equal(ratio,1.25);
  const position=lastCamera.position.toArray(),orientation=lastCamera.quaternion.toArray();
  nextFrame(10000);host.clientWidth=844;listeners.resize();nextFrame(20000);
  let landed=false;ctl.land(()=>landed=true);assert.equal(landed,true);
  assert.deepEqual(lastCamera.position.toArray(),position);assert.deepEqual(lastCamera.quaternion.toArray(),orientation);
  const moving=lastScene.children.filter(x=>x.material?.uniforms?.time);
  assert.equal(moving.length,2);assert.equal(moving[0].material.uniforms.time.value,20);
  assert.ok(lastScene.children.some(x=>x.isInstancedMesh),'pebbles use one instanced draw');
  ctl.dispose();assert.equal(removed,true);assert.equal(disposed,true);assert.equal(listeners.resize,undefined);
});

async function sceneFixture(profile='medium',still=false){
  const THREE=await import('../nodspel/vendor/three.module.js');
  const canvasListeners={},windowListeners={},frames=new Map();
  const state={renders:[],disposed:0,removed:0,cancelled:0,pebblesDisposed:0,failures:[]};
  let frameId=0;
  class Renderer{
    constructor(){this.domElement={addEventListener:(name,fn)=>canvasListeners[name]=fn,removeEventListener:name=>delete canvasListeners[name],remove:()=>state.removed++};}
    setPixelRatio(){}setSize(){}
    render(scene,camera){state.scene=scene;state.camera=camera;state.renders.push(scene.children.find(x=>x.material?.uniforms?.time).material.uniforms.time.value);}
    dispose(){state.disposed++;}
  }
  class Pebbles extends THREE.InstancedMesh{dispose(){state.pebblesDisposed++;super.dispose();}}
  const win={devicePixelRatio:1,matchMedia:()=>({matches:still}),addEventListener:(name,fn)=>windowListeners[name]=fn,removeEventListener:name=>delete windowListeners[name]};
  const source=fs.readFileSync(require.resolve('../start-scene.js'),'utf8').replace(/^import .*;$/m,'').replace('export function','function');
  const mount=new Function('THREE','window','performance','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight',source+';return mountStartFlight;')(
    {...THREE,WebGLRenderer:Renderer,InstancedMesh:Pebbles},win,{now:()=>0},fn=>{frames.set(++frameId,fn);return frameId;},id=>{frames.delete(id);state.cancelled++;},932,430);
  const ctl=mount({clientWidth:932,clientHeight:430,appendChild(){}},{name:profile},{onFail:error=>state.failures.push(error)});
  function step(time){assert.equal(frames.size,1);const [id,fn]=frames.entries().next().value;frames.delete(id);fn(time);}
  return {state,ctl,step,canvasListeners,windowListeners,frames};
}
test('medium and low render at about 30fps while water advances and camera stays fixed',async()=>{
  for(const profile of ['medium','low'])for(const hz of [60,120,144]){
    const f=await sceneFixture(profile),{state}=f;
    const position=state.camera.position.toArray(),rotation=state.camera.quaternion.toArray();
    for(let i=1;i<=hz;i++)f.step(i*1000/hz);
    assert.ok(state.renders.length>=30&&state.renders.length<=32,`${profile}: ${state.renders.length} renders`);
    assert.ok(state.renders.at(-1)>.95,'water uses elapsed time, not rendered frame count');
    const water=state.scene.children.filter(x=>x.material?.uniforms?.time);
    assert.equal(water.length,2);assert.equal(water[0].material.uniforms.time.value,water[1].material.uniforms.time.value);
    assert.deepEqual(state.camera.position.toArray(),position);assert.deepEqual(state.camera.quaternion.toArray(),rotation);
    f.ctl.dispose();assert.equal(state.pebblesDisposed,1);
  }
});
test('high renders every frame and reduced motion renders once',async()=>{
  const high=await sceneFixture('high');for(let i=1;i<=10;i++)high.step(i*1000/120);
  assert.equal(high.state.renders.length,11);high.ctl.dispose();
  const still=await sceneFixture('medium',true);
  assert.deepEqual(still.state.renders,[0]);assert.equal(still.frames.size,0);still.ctl.dispose();
});
test('context loss disposes all resources before requesting CSS fallback and is idempotent',async()=>{
  const f=await sceneFixture();let prevented=0;
  const lost=f.canvasListeners.webglcontextlost;
  assert.equal(typeof lost,'function');
  const geometries=new Set(),materials=new Set();
  f.state.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  let freed=0;for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>freed++);
  lost({preventDefault(){prevented++;}});
  assert.equal(prevented,1);assert.equal(f.state.failures.length,1);assert.match(f.state.failures[0].message,/context lost/i);
  assert.equal(f.state.disposed,1);assert.equal(f.state.pebblesDisposed,1);assert.equal(f.state.removed,1);
  assert.equal(freed,geometries.size+materials.size);assert.equal(f.frames.size,0);
  assert.equal(f.canvasListeners.webglcontextlost,undefined);assert.equal(f.windowListeners.resize,undefined);
  f.ctl.dispose();lost({preventDefault(){}});assert.equal(f.state.disposed,1);assert.equal(f.state.failures.length,1);
});
