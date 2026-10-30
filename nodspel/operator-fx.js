import * as THREE from './vendor/three.module.js';

// Fixed pool: neither sustained fire nor repeated dashes allocate render objects.
export function createOperatorFX(scene,{sparkColor,dustColor,tracerColor}){
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,.16)]);
  const pool=Array.from({length:48},()=>{
    const material=new THREE.LineBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
    const line=new THREE.Line(geometry,material);line.visible=false;scene.add(line);
    return {line,left:0,life:0,vx:0,vy:0,vz:0};
  });let cursor=0,dustWait=0;
  const forward=new THREE.Vector3(0,0,1),direction=new THREE.Vector3();
  function emit(x,y,z,dx,dy,dz,life,color,length){
    const p=pool[cursor++%pool.length];Object.assign(p,{left:life,life,vx:dx,vy:dy,vz:dz});
    p.line.position.set(x,y,z);p.line.material.color.set(color);p.line.material.opacity=1;p.line.visible=true;
    p.line.scale.set(1,1,length/.16);p.line.quaternion.setFromUnitVectors(forward,direction.set(dx,dy,dz).normalize());
  }
  function sparks(x,z,low=false){for(let i=0;i<(low?2:7);i++){const a=Math.random()*Math.PI*2;emit(x,.7,z,Math.cos(a)*2,Math.random()*2,Math.sin(a)*2,.16,sparkColor,.12);}}
  function shot(x,z,dx,dz,low=false){emit(x+dx*.8,.66,z+dz*.8,dx*16,0,dz*16,low?.045:.075,tracerColor,low?.4:.8);}
  function update(dt,{dashing=false,x=0,z=0,low=false}={}){
    dustWait-=dt;
    if(dashing&&dt>0&&dustWait<=0){dustWait=low?.09:.035;for(let i=0;i<(low?1:3);i++)emit(x,.08,z,(Math.random()-.5)*1.5,.45,(Math.random()-.5)*1.5,.25,dustColor,.2);}
    for(const p of pool)if(p.left>0){p.left-=dt;p.line.visible=p.left>0;p.line.position.x+=p.vx*dt;p.line.position.y+=p.vy*dt;p.line.position.z+=p.vz*dt;p.line.material.opacity=Math.max(0,p.left/p.life);}
  }
  function reset(){for(const p of pool){p.left=0;p.line.visible=false;}dustWait=0;}
  return {sparks,shot,update,reset};
}
