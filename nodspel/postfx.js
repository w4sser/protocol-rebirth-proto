// v2.9.0 mood pass: subtle post pipeline, High quality only (Low renders straight to the canvas, no composer).
// Bloom is emissive-threshold (UnrealBloomPass), not a layer mask: the scene's dark Cold-War palette means
// only the already-bright self-lit accents (BIT, lamps, loot glow, active nodes, open extract) cross the
// threshold, so it reads as selective without having to tag every emissive mesh across world/town/bunker.
import * as THREE from './vendor/three.module.js';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from './vendor/postprocessing/ShaderPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';

// Cold Nordic colour grade + vignette in one pass: desaturate a little, multiply by a cool blue-grey tint
// (brightness-preserving - this is what actually reads as "cold" at a glance, not just the fog), then darken
// the corners. Combined into a single ShaderPass so the grade isn't a second full-screen pass on top of bloom.
const GRADE_VIGNETTE_SHADER={
  // Fog + ambient-light cooling (game.mjs, both quality tiers) already do most of the "cold" work; this pass
  // is a light top-up on High, not a second coat - stacking two strong cools reads as washed out, not moody.
  uniforms:{tDiffuse:{value:null},desaturate:{value:.16},tint:{value:new THREE.Vector3(.91,.96,1.08)},
    gradeStrength:{value:.32},vignetteStrength:{value:.32},vignetteRadius:{value:.68}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float desaturate;uniform vec3 tint;uniform float gradeStrength;
    uniform float vignetteStrength;uniform float vignetteRadius;varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      float luma=dot(c.rgb,vec3(.299,.587,.114));
      vec3 cool=mix(c.rgb,vec3(luma),desaturate)*tint;
      vec3 graded=mix(c.rgb,cool,gradeStrength);
      vec2 d=(vUv-0.5)*vec2(1.0,0.82);
      float v=smoothstep(vignetteRadius,vignetteRadius-0.5,length(d));
      graded*=mix(1.0-vignetteStrength,1.0,v);
      gl_FragColor=vec4(graded,c.a);
    }`
};

export function createPostFX({renderer,scene,camera,width,height}){
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(width,height),.7,.5,.65);
  composer.addPass(bloom);
  const grade=new ShaderPass(GRADE_VIGNETTE_SHADER);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  composer.setSize(width,height);
  return {
    render(){composer.render();},
    setSize(w,h){composer.setSize(w,h);},
    dispose(){composer.dispose();},
  };
}
