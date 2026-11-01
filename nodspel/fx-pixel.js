import * as THREE from './vendor/three.module.js';
import {createFrame,clearFrame,createFx,composite} from './vendor/pixelfx/core/fx.js';
import * as respawn from './vendor/pixelfx/fx/spawn/respawn-beam.js';
import * as impact from './vendor/pixelfx/fx/impacts/bullet-impact.js';
import * as hit from './vendor/pixelfx/fx/impacts/hit-flash.js';
import * as explosion from './vendor/pixelfx/fx/explosions/barrel-explosion.js';
import * as emp from './vendor/pixelfx/fx/scifi/emp-blast.js';
import * as shield from './vendor/pixelfx/fx/scifi/force-field.js';
import * as chest from './vendor/pixelfx/fx/pickups/chest-open.js';
import * as collect from './vendor/pixelfx/fx/pickups/collect-burst.js';

const SIZE=128,FPS=20;
// Cold shadows, restrained mids, pale highlights. These are raster art ramps.
const CORAL=['#171f29','#3b2b35','#68404a','#a65d62','#e6817b','#f2b3a5','#e4ddd3'];
const BLUE=['#111e2c','#203750','#305778','#4889ab','#74b9d0','#b7dce0','#e0e9e4'];
const CYAN=['#101f28','#1d3944','#28606a','#3b8990','#68b8b3','#b1d9cc','#e0e9e0'];
const GREEN=['#142524','#243e34','#3a6248','#568465','#7cac82','#b0d1ad','#dce5d4'];
const YELLOW=['#242828','#443f32','#6b6041','#a08f59','#cbb66c','#dfd09b','#ece5ce'];
// Effects tint a contact disc, never PixelFX's sample human character.
const CONTACT_MASK={w:11,h:11,data:Uint8Array.from({length:121},(_,i)=>Math.hypot(i%11-5,Math.floor(i/11)-5)<=5?1:0)};
const CONTACT_ACTOR={mask:CONTACT_MASK,pixels:new Uint32Array(121).fill(0xffbbb9ae),x:-5,y:-13,chest:[0,-8]};
const BEAM_ACTOR={mask:{w:1,h:1,data:new Uint8Array([1])},pixels:new Uint32Array([0xffbbb9ae]),x:0,y:-1,chest:[0,-1]};
export const PIXEL_EFFECTS={
  respawn:{mod:respawn,palette:CYAN,size:4.6,loop:true,start:.33,end:1.35},
  impact:{mod:impact,palette:CORAL,size:2,height:24},
  hit:{mod:hit,palette:CORAL,size:1.8},
  explosion:{mod:explosion,palette:YELLOW,size:6,start:.8,end:3},
  emp:{mod:emp,palette:BLUE,size:5,start:.42},
  shield:{mod:shield,palette:BLUE,size:3.1,loop:true},
  chest:{mod:chest,palette:YELLOW,size:2.7,start:.6,end:3},
  collect:{mod:collect,palette:YELLOW,size:2.1,height:30},
  heal:{mod:collect,palette:GREEN,size:1.8,height:30},
};
export const pixelEffectsEnabled=quality=>quality==='medium'||quality==='high';

// Bake once on enabling graphics, never in update/spawn. PixelFX's simulations
// allocate internally; caching their RGBA frames keeps that work off the game loop.
export async function bakePixelEffects(document){
  const scratch=document.createElement('canvas'),small=document.createElement('canvas');
  small.width=small.height=SIZE;const out=small.getContext('2d',{willReadFrequently:true});out.imageSmoothingEnabled=false;
  const clips={};
  let sliceStart=performance.now();
  for(const name of Object.keys(PIXEL_EFFECTS)){
    const def=PIXEL_EFFECTS[name],mod=def.mod,[w,h]=mod.meta.size;
    scratch.width=w;scratch.height=h;const ctx=scratch.getContext('2d');
    const rgba=ctx.createImageData(w,h),frame=createFrame(w,h,-mod.meta.origin[0],-mod.meta.origin[1]);
    const fx=createFx(mod,{palette:def.palette,actor:name==='respawn'?BEAM_ACTOR:CONTACT_ACTOR,light:.35,sparks:BLUE,fringe:BLUE[4],stone:CORAL[1],barrel:CORAL,wood:CORAL});
    const start=def.start??0,duration=(def.end??mod.meta.duration)-start,count=Math.ceil(duration*FPS),frames=[];
    // Advance through the prop/fuse anticipation: the gameplay event already happened.
    for(let t=0;t<start;t+=1/FPS)fx.update(Math.min(1/FPS,start-t));
    for(let i=0;i<count;i++){
      clearFrame(frame);fx.draw(frame);composite(frame,rgba.data);ctx.putImageData(rgba,0,0);
      out.clearRect(0,0,SIZE,SIZE);out.drawImage(scratch,0,0,SIZE,SIZE);frames.push(out.getImageData(0,0,SIZE,SIZE));fx.update(1/FPS);
      // Yield during preparation so startup and live quality toggles stay usable.
      if(performance.now()-sliceStart>6){await new Promise(resolve=>setTimeout(resolve,0));sliceStart=performance.now();}
    }
    clips[name]={frames,duration,def,w,h};
  }
  return clips;
}

// Every slot owns one texture and material; clips share immutable CPU frames.
// The injectable bake/canvas seams also permit real pool tests without WebGL.
export function createPixelFX(scene,{quality='high',document=globalThis.document,capacity=32,bake=bakePixelEffects}={}){
  let enabled=pixelEffectsEnabled(quality),clips=null,disposed=false,serial=0,preparing=false,ready=Promise.resolve();
  const slots=[];
  function prepare(){
    if(clips||preparing||disposed)return;
    preparing=true;
    const baked=bake(document);
    if(baked?.then)ready=baked.then(finish);else finish(baked);
  }
  function finish(baked){
    if(disposed)return;
    clips=baked;
    for(let i=0;i<capacity;i++){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
      const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,fog:false,opacity:.78});
      const sprite=new THREE.Sprite(material);sprite.visible=false;scene.add(sprite);
      slots.push({sprite,texture,ctx:canvas.getContext('2d'),active:false,clip:null,age:0,frame:-1,loop:false,serial:0});
    }
    preparing=false;
  }
  if(enabled)prepare();
  function stop(slot){if(slot){slot.active=false;slot.sprite.visible=false;}}
  function clear(){for(const slot of slots)stop(slot);}
  function spawn(name,x,z,{y=0,scale=1,loop=PIXEL_EFFECTS[name]?.loop??false}={}){
    if(!enabled||disposed||!clips?.[name])return null;
    let slot=null;
    for(const candidate of slots)if(!candidate.active){slot=candidate;break;}
    // Drop excess transients; never allocate or evict a persistent extract/shield.
    if(!slot)return null;
    const clip=clips[name],def=clip.def;
    slot.active=true;slot.clip=clip;slot.age=0;slot.frame=-1;slot.loop=loop;slot.serial=++serial;
    // Keep the effect's local origin at the supplied world location.
    slot.sprite.center.set(clip.def.mod.meta.origin[0]/clip.w,1-(clip.def.mod.meta.origin[1]-(def.height??0))/clip.h);
    slot.sprite.position.set(x,y,z);slot.sprite.scale.set(def.size*scale,def.size*scale*clip.h/clip.w,1);slot.sprite.visible=true;
    return slot;
  }
  function update(dt){
    if(!enabled||disposed)return;
    for(const slot of slots){
      if(!slot.active)continue;
      const clip=slot.clip;slot.age+=Math.max(0,dt);
      if(slot.age>=clip.duration){if(slot.loop)slot.age%=clip.duration;else{stop(slot);continue;}}
      const frame=Math.min(clip.frames.length-1,Math.floor(slot.age*FPS));
      if(frame!==slot.frame){slot.ctx.putImageData(clip.frames[frame],0,0);slot.texture.needsUpdate=true;slot.frame=frame;}
    }
  }
  return {spawn,stop,clear,update,
    get enabled(){return enabled&&clips!==null&&!disposed;},get slots(){return slots;},get ready(){return ready;},
    setQuality(next){enabled=pixelEffectsEnabled(next);if(!enabled)clear();else prepare();},
    dispose(){clear();for(const s of slots){scene.remove(s.sprite);s.sprite.material.dispose();s.texture.dispose();}clips=null;disposed=true;},
  };
}
