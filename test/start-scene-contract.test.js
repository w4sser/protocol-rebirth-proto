const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('Nordic scene keeps camera fixed through water updates, resize and PLAY, then disposes',async()=>{
  const THREE=await import('../nodspel/vendor/three.module.js');
  let nextFrame,lastScene,lastCamera,removed=false,disposed=false,ratio;
  class Renderer{
    constructor(){this.domElement={remove(){removed=true;}};}
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
