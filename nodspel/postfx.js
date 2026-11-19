// v2.9.0 mood pass, v2.28.53 selective-bloom pass: subtle post pipeline, Medium/High only (Low renders
// straight to the canvas, no composer). Bloom used to be emissive-threshold (UnrealBloomPass reading the
// whole composited frame): the scene's dark Cold-War palette meant only already-bright accents crossed the
// threshold, so it read as "selective" by accident. v2.28.53 makes that explicit: gameplay cue meshes (BIT's
// lamp, fuel-drum red bands, live power pads/junctions, the extraction zone, the shelf telegraph strap) are
// tagged onto BLOOM_LAYER; the bloom source is a second camera pass that only sees that layer (scene.background
// swapped to black for that pass), so walls/floors/props never bloom regardless of how brightly they're lit.
import * as THREE from './vendor/three.module.js';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from './vendor/postprocessing/ShaderPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';

// Any Object3D (mesh or group) enabled on this layer is included in the bloom-only render; everything
// else stays on the default layer 0 and is invisible to that pass, so it never blooms. Tagged objects
// keep layer 0 enabled too (THREE.Object3D defaults to it), so their normal appearance is unaffected.
export const BLOOM_LAYER=1;
export function tagBloom(object){object.traverse(n=>n.layers.enable(BLOOM_LAYER));return object;}

// Cold Nordic colour grade + vignette in one pass: desaturate a little, multiply by a cool blue-grey tint
// (brightness-preserving - this is what actually reads as "cold" at a glance, not just the fog), then darken
// the corners. Combined into a single ShaderPass so the grade isn't a second full-screen pass on top of bloom.
// v2.28.53: parameterised per world/area (GRADE_PRESETS) instead of one fixed look for every area - bunker
// keeps the original cold-blue values verbatim; town/archipelago fall back to a neutral (no tint) grade,
// since neither has a defined "look" of its own yet and stacking the bunker cool push on top of their own
// lighting/fog (environment-look.js / the per-area blocks in game.mjs) read as washed out, not moody.
export const GRADE_PRESETS={
  bunker:{desaturate:.08,tint:[.94,.97,1.05],gradeStrength:.08,vignetteStrength:.16,vignetteRadius:.78},
  town:{desaturate:0,tint:[1,1,1],gradeStrength:0,vignetteStrength:.16,vignetteRadius:.78},
  archipelago:{desaturate:0,tint:[1,1,1],gradeStrength:0,vignetteStrength:.16,vignetteRadius:.78},
};
export function gradePresetFor(area){return GRADE_PRESETS[area]??GRADE_PRESETS.bunker;}
const GRADE_VERTEX='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const GRADE_FRAGMENT=`uniform sampler2D tDiffuse;uniform float desaturate;uniform vec3 tint;uniform float gradeStrength;
  uniform float vignetteStrength;uniform float vignetteRadius;varying vec2 vUv;
  void main(){
    vec4 c=texture2D(tDiffuse,vUv);
    float luma=dot(c.rgb,vec3(.299,.587,.114));
    vec3 cool=mix(c.rgb,vec3(luma),desaturate)*tint;
    vec3 graded=mix(c.rgb,cool,gradeStrength);
    vec2 d=(vUv-0.5)*vec2(1.0,0.82);
    float v=1.0-smoothstep(vignetteRadius-0.5,vignetteRadius,length(d));
    graded*=mix(1.0-vignetteStrength,1.0,v);
    gl_FragColor=vec4(graded,c.a);
  }`;
function buildGradeShader(preset){
  return {vertexShader:GRADE_VERTEX,fragmentShader:GRADE_FRAGMENT,uniforms:{tDiffuse:{value:null},
    desaturate:{value:preset.desaturate},tint:{value:new THREE.Vector3(...preset.tint)},
    gradeStrength:{value:preset.gradeStrength},vignetteStrength:{value:preset.vignetteStrength},vignetteRadius:{value:preset.vignetteRadius}}};
}

// Plain additive combine: the bloom-only render is already isolated/blurred HDR light, so adding it
// straight onto the base frame (before tone mapping, same as UnrealBloomPass always did internally).
const BLOOM_COMBINE_SHADER={vertexShader:GRADE_VERTEX,uniforms:{tDiffuse:{value:null},tBloom:{value:null}},
  fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D tBloom;varying vec2 vUv;
    void main(){vec4 base=texture2D(tDiffuse,vUv);vec3 bloom=texture2D(tBloom,vUv).rgb;gl_FragColor=vec4(base.rgb+bloom,base.a);}`};

// Medium gets a quarter-resolution bloom source and a gentler strength (cheaper to blur, less GPU-visible
// on the weaker devices that pick Medium); High gets the full-resolution, full-strength pass.
const BLOOM_TIERS={cheap:{scale:.5,strength:.55,radius:.35},full:{scale:1,strength:.85,radius:.4}};
const BLOOM_BG=new THREE.Color(0,0,0);

export function createPostFX({renderer,scene,camera,width,height,area='bunker',bloomTier='full',gradeOn=true}){
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const tier=BLOOM_TIERS[bloomTier];
  let bloomComposer=null,combinePass=null;
  if(tier){
    const bw=Math.max(1,Math.round(width*tier.scale)),bh=Math.max(1,Math.round(height*tier.scale));
    bloomComposer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(bw,bh,{type:THREE.HalfFloatType}));
    bloomComposer.renderToScreen=false;
    bloomComposer.addPass(new RenderPass(scene,camera));
    bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(bw,bh),tier.strength,tier.radius,0));
    combinePass=new ShaderPass(BLOOM_COMBINE_SHADER);
    composer.addPass(combinePass);
  }
  if(gradeOn)composer.addPass(new ShaderPass(buildGradeShader(gradePresetFor(area))));
  composer.addPass(new OutputPass());
  composer.setSize(width,height);
  return {
    render(){
      if(bloomComposer){
        const mask=camera.layers.mask,background=scene.background;
        camera.layers.set(BLOOM_LAYER);scene.background=BLOOM_BG;
        bloomComposer.render();
        camera.layers.mask=mask;scene.background=background;
        combinePass.uniforms.tBloom.value=bloomComposer.readBuffer.texture;
      }
      composer.render();
    },
    setSize(w,h){
      composer.setSize(w,h);
      if(bloomComposer){bloomComposer.setSize(Math.max(1,Math.round(w*tier.scale)),Math.max(1,Math.round(h*tier.scale)));}
    },
    dispose(){composer.dispose();bloomComposer?.dispose();},
  };
}
