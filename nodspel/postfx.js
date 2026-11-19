// Selective gameplay-cue bloom and gentle per-world grading (Medium/High; Low renders directly).
// Non-cue meshes render black to retain depth occlusion; fog is disabled only for the bloom source.
import * as THREE from './vendor/three.module.js';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from './vendor/postprocessing/ShaderPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';

// Any Object3D (mesh or group) enabled on this layer is included in the bloom-only render; everything
// else stays on the default layer 0 and becomes a black occluder for that pass. Tagged objects
// keep layer 0 enabled too (THREE.Object3D defaults to it), so their normal appearance is unaffected.
export const BLOOM_LAYER=1;
// boost scales the emission colour fed to the bloom mask only - the real material (and therefore Low/Medium's
// non-bloom appearance) is untouched. Some cues (e.g. the fuel drum's dark warning-maroon emissive) are tuned
// to add a subtle self-illumination under direct view, not to drive a bloom pass on their own.
export function tagBloom(object,{unlit=false,boost=1}={}){object.traverse(n=>{n.layers.enable(BLOOM_LAYER);if(unlit)n.userData.bloomUnlit=true;if(boost!==1)n.userData.bloomBoost=boost;});return object;}

// Reuse mask materials, preserve alpha-tested occluders and restore all scene state even on failure.
// Standard materials contribute emission only; already-unlit cue shaders retain their own alpha/animation.
export function createBloomMask(scene){
  const cache=new Map(),seen=new Set(),saved=new Map(),hidden=new Set();
  function masked(source,emission,unlit=false,boost=1){
    seen.add(source);let pair=cache.get(source);if(!pair){pair={};cache.set(source,pair);}
    const key=emission?(unlit?'lamp':'emission:'+boost):'dark';
    let m=pair[key];
    if(!m){m=new THREE.MeshBasicMaterial({color:0,fog:false,toneMapped:false,side:source.side,
      transparent:source.transparent,alphaTest:source.alphaTest,depthTest:source.depthTest,depthWrite:source.depthWrite,
      forceSinglePass:true});pair[key]=m;}
    m.opacity=source.opacity;m.visible=source.visible;
    // Opaque black occluders do not need their colour atlas sampled. Keep cutout silhouettes.
    if(emission)m.map=unlit?source.map:source.emissiveMap;
    else m.map=source.alphaTest>0||source.transparent?source.map:null;
    m.alphaMap=source.alphaMap;
    if(emission)m.color.copy(unlit?source.color:source.emissive).multiplyScalar(unlit?1:source.emissiveIntensity*boost);
    return m;
  }
  // Masking a single material, kept out of the per-node traversal below so the bloom-active render loop
  // (every frame on Medium/High) never allocates a closure per scene node.
  function maskOne(n,cue,m){return cue?(m.emissive?masked(m,true,n.userData.bloomUnlit,n.userData.bloomBoost??1):m):masked(m,false);}
  return {
    render(draw){
      const background=scene.background,fog=scene.fog;
      try{
        scene.background=BLOOM_BG;scene.fog=null;
        scene.traverse(n=>{
          if(!n.visible||!n.material)return;
          const cue=n.layers.isEnabled(BLOOM_LAYER);
          if(!cue&&(!n.isMesh||n.material.transparent&&!n.material.depthWrite)){hidden.add(n);n.visible=false;return;}
          const original=n.material;
          saved.set(n,original);
          if(Array.isArray(original)){
            const next=[];for(let i=0;i<original.length;i++)next.push(maskOne(n,cue,original[i]));
            n.material=next;
          }else n.material=maskOne(n,cue,original);
        });
        draw();
      }finally{
        for(const [n,m] of saved)n.material=m;saved.clear();
        for(const n of hidden)n.visible=true;hidden.clear();
        scene.background=background;scene.fog=fog;
        // Retire masks from a previous level instead of keeping them until the next quality change.
        for(const [source,pair] of cache)if(!seen.has(source)){for(const m of Object.values(pair))m.dispose();cache.delete(source);}
        seen.clear();
      }
    },
    dispose(){for(const pair of cache.values())for(const m of Object.values(pair))m.dispose();cache.clear();},
  };
}


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
// on the weaker devices that pick Medium). High shares that same quarter-resolution source - bloom is
// blurred by design, so the extra sharpness of a full-res source was never visible - and only the
// strength/radius go up, which keeps the full look while cutting the highpass/blur/composite fill cost
// (the fixed-size draw calls of the mip chain) to a quarter of what a full-res source would cost.
const BLOOM_TIERS={cheap:{scale:.5,strength:.55,radius:.35},full:{scale:.5,strength:.85,radius:.4}};
const BLOOM_BG=new THREE.Color(0,0,0);

export function createPostFX({renderer,scene,camera,width,height,area='bunker',bloomTier='full',gradeOn=true}){
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const tier=BLOOM_TIERS[bloomTier];
  let bloomComposer=null,combinePass=null,bloom=null;
  const bloomMask=tier?createBloomMask(scene):null;
  if(tier){
    const bw=Math.max(1,Math.round(width*tier.scale)),bh=Math.max(1,Math.round(height*tier.scale));
    bloomComposer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(bw,bh,{type:THREE.HalfFloatType}));
    bloomComposer.renderToScreen=false;
    bloomComposer.addPass(new RenderPass(scene,camera));
    bloom=new UnrealBloomPass(new THREE.Vector2(bw,bh),tier.strength,tier.radius,0);
    bloomComposer.addPass(bloom);
    bloomComposer.setSize(bw,bh);
    combinePass=new ShaderPass(BLOOM_COMBINE_SHADER);
    composer.addPass(combinePass);
  }
  if(gradeOn)composer.addPass(new ShaderPass(buildGradeShader(gradePresetFor(area))));
  composer.addPass(new OutputPass());
  composer.setSize(width,height);
  return {
    render(){
      if(bloomComposer){
        const shadowAutoUpdate=renderer.shadowMap.autoUpdate;
        try{renderer.shadowMap.autoUpdate=false;bloomMask.render(()=>bloomComposer.render());}
        finally{renderer.shadowMap.autoUpdate=shadowAutoUpdate;}
        // UnrealBloomPass readBuffer includes the sharp source too. Add only its blurred composite.
        combinePass.uniforms.tBloom.value=bloom.renderTargetsHorizontal[0].texture;
      }
      composer.render();
    },
    setSize(w,h){
      composer.setSize(w,h);
      if(bloomComposer){bloomComposer.setSize(Math.max(1,Math.round(w*tier.scale)),Math.max(1,Math.round(h*tier.scale)));}
    },
    dispose(){
      // EffectComposer.dispose frees its targets/copy pass, but does not dispose added passes.
      for(const pass of composer.passes)pass.dispose();composer.dispose();
      if(bloomComposer){for(const pass of bloomComposer.passes)pass.dispose();bloomComposer.dispose();}
      bloomMask?.dispose();
    },
  };
}
