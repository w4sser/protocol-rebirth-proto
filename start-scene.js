// v2.11.0 START SCREEN: "Swedish summer night in the archipelago" flight-over
// (docs: /workspace/start-screen-design.md, PRB-131). Dynamically imported by app.js
// setupSplash() ONLY on Medium/High quality with a working WebGL2 (see start-quality.js) --
// never loaded on Low or when WebGL2/the float render targets it needs are unavailable, so
// raid/base load time never regresses for the common low-end-mobile case.
//
// Water is the vendored Ultra Water FFT ocean (nodspel/vendor/ultra-water, MIT): the real
// OceanSim/OceanSurface classes, used as designed (two-pass opaque-then-water render so the
// water's screen-space refraction/background sampling has something real to read, same shape
// as upstream's src/main.js). Everything else here (sky, skerries, bunker silhouette, camera
// flight) is a small hand-built scene -- Ultra Water's own terrain/sky/atmosphere/postfx/
// floaters/caustics/underwater pipeline is not vendored in; this only takes the ocean surface
// itself, since the camera never dips below it and nothing in this scene casts a shadow onto it.
//
// Every failure path here (shader compile, missing extension, OOM) is caught by the caller
// (app.js) and falls back to the pre-existing static splash image -- this module is a visual
// enhancement, never load-bearing.
import * as THREE from "./nodspel/vendor/three.module.js";
import { OceanSim, defaultOceanParams } from "./nodspel/vendor/ultra-water/src/water/OceanSim.js";
import { OceanSurface } from "./nodspel/vendor/ultra-water/src/water/OceanSurface.js";
import { bakeWaterTextures } from "./nodspel/vendor/ultra-water/src/water/bakeTextures.js";
import { bakeShoreMap } from "./nodspel/vendor/ultra-water/src/water/shoreMap.js";
import { FloaterShadow } from "./nodspel/vendor/ultra-water/src/scene/floaterShadow.js";
import { FullscreenQuad, rawPass } from "./nodspel/vendor/ultra-water/src/engine/fullscreen.js";

// Blue hour ~02:30: deep blue-violet zenith, warm apricot band on the horizon, dark glassy sea.
const SKY_ZENITH = new THREE.Color(0x1c2350);
const SKY_BLUE = new THREE.Color(0x3a3f7a);
const SKY_APRICOT = new THREE.Color(0xf3a76b);
const SEA_HORIZON = new THREE.Color(0x15284a);
const SUN_COLOR = new THREE.Vector3(1, 0.56, 0.3);
const ROCK = 0x8a7a74, ROCK_DARK = 0x5c524c; // granite grey-pink skerries (kobbar)
const PINE = 0x193c3b;
const BUNKER_WALL = 0x232e36, BUNKER_TOP = 0x2c3942; // matches nodspel's bunker palette (nodspel/art.js PALETTE)
const LOOP_SECONDS = 10; // idle flight loop length, within the 8-12s the design calls for

function seededRng(seed){ let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Cheap gradient "sky" cube, baked once (not an atmosphere sim): all OceanSurface needs from
// it is a cube texture + size for its reflection IBL, plus a sun direction/colour. A sharp disc
// plus a soft halo is baked in at sunDir (there's no directional light hitting a skybox, so
// without this the sun is just implied by the horizon-glow band, not actually visible).
function buildSky(renderer, cubeSize, sunDir, sunColor){
  const rt = new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.1, 10, rt);
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY_ZENITH }, blue: { value: SKY_BLUE }, horizon: { value: SKY_APRICOT }, sea: { value: SEA_HORIZON },
      sunDir: { value: sunDir }, sunColor: { value: sunColor } },
    vertexShader: "varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying vec3 vDir; uniform vec3 top,blue,horizon,sea,sunDir,sunColor; void main(){" +
      "vec3 dir=normalize(vDir);float h=dir.y;" +
      "vec3 col=mix(blue,top,smoothstep(0.03,0.55,max(h,0.0)));" +
      "col=mix(col,horizon,1.0-smoothstep(0.0,0.025,abs(h)));" +
      "if(h<0.0)col=mix(col,sea,smoothstep(0.0,0.03,-h));" +
      "float c=max(dot(dir,sunDir),0.0);" +
      "col += sunColor*smoothstep(0.99994,0.99998,c)*4.0;" + // small low sun disc
      "col += sunColor*pow(c,1800.0)*0.18;" + // local glow only
      "gl_FragColor=vec4(col,1.0); }",
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), mat));
  cam.update(renderer, scene);
  return rt.texture;
}

function buildSkerry(rng, rockCount){
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 0.95 });
  const rockMatDark = new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 1 });
  for(let i = 0; i < rockCount; i++){
    const geo = new THREE.DodecahedronGeometry(0.6 + rng() * 1.6, 2);
    const rock = new THREE.Mesh(geo, i === 0 ? rockMat : (rng() < 0.5 ? rockMat : rockMatDark));
    rock.position.set((rng() - 0.5) * 4, -0.3 + rng() * 0.3, (rng() - 0.5) * 4);
    rock.scale.y *= 0.55;
    rock.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
    g.add(rock);
  }
  if(rng() < 0.7){
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.35 + rng() * 0.2, 1.4 + rng(), 6), new THREE.MeshStandardMaterial({ color: PINE, roughness: 0.9, flatShading: true }));
    pine.position.set((rng() - 0.5) * 2, 1, (rng() - 0.5) * 2);
    g.add(pine);
  }
  return g;
}

function buildBunker(){
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: BUNKER_WALL, roughness: 0.85 });
  const top = new THREE.MeshStandardMaterial({ color: BUNKER_TOP, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(4, 0), new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 1, flatShading: true }));
  base.position.y = -0.6; base.scale.y = 0.4; g.add(base);
  const bunk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.4), wall);
  bunk.position.y = 0.6; g.add(bunk);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.7, 10), top);
  dome.position.set(-0.4, 1.5, 0); g.add(dome);
  return g;
}

function easeInOutCubic(x){ return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

export function mountStartFlight(host, profile, opts={}){
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: "high-performance" });
  renderer.autoClear = false;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 2000);
  const scene = new THREE.Scene();
  const waterScene = new THREE.Scene();

  const sunDir = new THREE.Vector3(0.62, 0.025, -0.78).normalize();
  const sky = { cube: buildSky(renderer, 512, sunDir, SUN_COLOR), cubeSize: 512, sunDir, sunColor: SUN_COLOR };
  scene.background = sky.cube;
  scene.environment = sky.cube;
  // Low density + a dark-sea tint: distant shapes dim towards the sea colour instead of
  // washing out towards a bright haze.
  scene.fog = new THREE.FogExp2(SEA_HORIZON.getHex(), 0.0003);

  const sun = new THREE.DirectionalLight(0xffc9b0, 1.3);
  sun.position.copy(sky.sunDir).multiplyScalar(60);
  // Soft dusk fill keeps the shaded granite readable against the blue sea;
  // the darker bunker materials still read as a silhouette.
  scene.add(sun, new THREE.HemisphereLight(0xb5b9d1, SEA_HORIZON, 0.85));

  // Open water (no coastline data of our own to feed it): an all-deep-water shore bake is a
  // safe, inert "no shore interaction" field -- shore waves/breakers stay off everywhere.
  const shore = bakeShoreMap(() => -50, 2000, 64);
  const tex = profile.foam ? bakeWaterTextures(renderer) : null;
  // Sheltered summer archipelago ripples, rather than the demo's open-ocean swell.
  const ocean = new OceanSim(renderer, {
    ...defaultOceanParams(), windSpeed: 3.5, fetchKm: 12,
    waveScale: 0.45, swellScale: 0.08, choppiness: 0.45,
  });
  const floatShadow = new FloaterShadow(4); // never updated (no casters) -- just a valid, correctly-typed depth texture
  // Allocate the depth attachment and its comparison sampler before the first
  // water draw; an uninitialized sampler2DShadow silently rejects that draw.
  floatShadow.clear(renderer);
  const emptyReflection = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  emptyReflection.needsUpdate = true;
  const surface = new OceanSurface(ocean, shore, sky, floatShadow.uniforms);
  surface.uniforms.uReflection.value = emptyReflection;
  if(tex) surface.uniforms.uFoamTex.value = tex.foam;
  surface.uniforms.uShadowMap.value = floatShadow.target.depthTexture; // identity uShadowMatrix below keeps this term unsampled
  // Darker, bluer water than the vendor demo's tropical-turquoise defaults, so it reads as a
  // dark northern sea reflecting the blue-hour sky (with sun glitter) rather than lagoon water.
  surface.uniforms.uScatterColor.value.set(0.025, 0.065, 0.18);
  surface.uniforms.uAbsorption.value.set(0.55, 0.16, 0.07);
  surface.uniforms.uOptics.value.w = 1 / 60000;
  waterScene.add(surface.mesh);

  // Weave past 4-6 low granite skerries, then the bunker island, then loop (design: camera
  // flight ~8-12s, 3-6m above water). Catmull-Rom, closed, so the idle loop has no seam.
  const rng = seededRng(2110);
  const points = [
    new THREE.Vector3(0, 4.2, 0), new THREE.Vector3(26, 4.6, -34), new THREE.Vector3(58, 3.8, -46),
    new THREE.Vector3(92, 4.4, -22), new THREE.Vector3(100, 4.8, 14), new THREE.Vector3(72, 4, 52),
    new THREE.Vector3(30, 4.6, 66), new THREE.Vector3(-8, 4.2, 40),
  ];
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.3);
  const skerries = new THREE.Group();
  [0.12, 0.28, 0.42, 0.58, 0.74, 0.9].forEach((t, i) => {
    const p = curve.getPointAt(t), side = i % 2 === 0 ? 1 : -1;
    const skerry = buildSkerry(rng, 2 + Math.floor(rng() * 3));
    skerry.scale.set(1.6, 1.3, 1.6);
    skerry.position.set(p.x + side * (6 + rng() * 5), -0.1, p.z + side * (3 + rng() * 4));
    skerries.add(skerry);
  });
  scene.add(skerries);
  const bunker = buildBunker();
  // Keep the destination visible ahead during the opening flight.
  const bunkerAt = curve.getPointAt(0.18);
  bunker.position.set(bunkerAt.x + 14, -0.4, bunkerAt.z + 6);
  scene.add(bunker);

  let hdrRT = null;
  function makeTargets(){
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    hdrRT?.dispose();
    hdrRT = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType, samples: profile.name === "high" ? 4 : 2, generateMipmaps: false,
      depthTexture: new THREE.DepthTexture(Math.max(1, size.x), Math.max(1, size.y), THREE.FloatType),
    });
    surface.uniforms.uSceneColor.value = hdrRT.texture;
    surface.uniforms.uSceneDepth.value = hdrRT.depthTexture;
    surface.uniforms.uResolution.value.copy(size);
    blit.material.uniforms.uTex.value = hdrRT.texture;
  }
  // Luminance-based Reinhard (scale the whole colour by one factor), not per-channel: per-channel
  // Reinhard compresses a saturated bright channel (the apricot horizon/sun, which pushes red
  // past 1.0) much harder than its other channels, which desaturates it towards a flat beige --
  // exactly the "beige haze" this scene must not have. Scaling uniformly keeps the hue intact.
  const blit = new FullscreenQuad(rawPass(
    "precision highp float;uniform sampler2D uTex;in vec2 vUv;out vec4 outColor;" +
    "void main(){vec3 c=texture(uTex,vUv).rgb;float l=dot(c,vec3(0.2126,0.7152,0.0722));" +
    "c*=1.0/(1.0+l);c=pow(max(c,0.0),vec3(1.0/2.2));outColor=vec4(c,1.0);}",
    { uTex: { value: null } }));

  let raf = 0, elapsed = 0, last = null, disposed = false;
  function dispose(){
    if(disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    hdrRT?.dispose();
    floatShadow.target.dispose();
    emptyReflection.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  // Runtime GL/shader failures on a device this wasn't tested against (missing extension,
  // driver quirk) must never surface as an uncaught error -- this whole scene is a visual
  // enhancement; on any failure, tear down and let the static splash image show instead.
  // opts.onFail lets the caller (app.js) know so it can fall back to its own old auto-advance
  // instead of waiting forever for a tap-driven land() that will now never finish.
  function onRuntimeError(err){
    console.warn("start screen flight: disabled after a runtime error", err);
    const already = disposed;
    dispose();
    if(!already) opts.onFail?.(err);
  }

  // Player tapped: ease the idle loop camera down onto the bunker island over LAND_SECONDS,
  // then hand back to the caller (app.js), which continues the existing descending/finish flow.
  const LAND_SECONDS = 1.2;
  // Aim slightly above a level horizon: water occupies the lower 45% at any
  // point on the curve, independent of the path's small altitude changes.
  function flightLook(t){
    const p = curve.getPointAt(t);
    const ahead = curve.getPointAt((t + 0.025) % 1);
    const distance = Math.hypot(ahead.x - p.x, ahead.z - p.z);
    ahead.y = camera.position.y + distance * Math.tan(THREE.MathUtils.degToRad(3.2));
    return ahead;
  }
  let landing = false, landT = 0, landFromPos = null, landFromLook = null, landCallback = null;
  const landToPos = bunker.position.clone().add(new THREE.Vector3(0, 2.6, 8.5));
  const landToLook = bunker.position.clone().add(new THREE.Vector3(0, 0.6, 0));
  function land(onDone){
    if(disposed || landing){ onDone(); return; }
    landing = true; landT = 0; landCallback = onDone;
    landFromPos = camera.position.clone();
    const t = (elapsed % LOOP_SECONDS) / LOOP_SECONDS;
    landFromLook = flightLook(t);
  }

  function resize(){
    try{
      const w = Math.max(1, host.clientWidth || window.innerWidth), h = Math.max(1, host.clientHeight || window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      makeTargets();
    }catch(err){ onRuntimeError(err); }
  }
  window.addEventListener("resize", resize);
  resize();

  function frame(now){
    if(disposed) return;
    raf = requestAnimationFrame(frame);
    try{
      if(document.hidden) { last = null; return; }
      if(last === null) last = now;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      elapsed += dt;
      if(landing){
        landT = Math.min(1, landT + dt / LAND_SECONDS);
        const e = easeInOutCubic(landT);
        camera.position.lerpVectors(landFromPos, landToPos, e);
        camera.up.set(0, 1, 0);
        camera.lookAt(landFromLook.clone().lerp(landToLook, e));
        if(landT >= 1){ const cb = landCallback; landCallback = null; cb?.(); }
      } else {
        const t = (elapsed % LOOP_SECONDS) / LOOP_SECONDS;
        const p = curve.getPointAt(t);
        camera.position.copy(p);
        camera.position.y += Math.sin(elapsed * 0.5) * 0.35;
        camera.lookAt(flightLook(t));
        camera.rotateZ(Math.sin(elapsed * 0.25) * 0.03); // gentle bank
      }

      ocean.update(dt);
      surface.update(camera, elapsed % 3600);

      renderer.setRenderTarget(hdrRT);
      renderer.setClearColor(SEA_HORIZON.getHex(), 1);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      renderer.render(waterScene, camera);
      renderer.setRenderTarget(null);
      blit.render(renderer, null);
    }catch(err){ onRuntimeError(err); }
  }
  raf = requestAnimationFrame(frame);

  return { dispose, land };
}
