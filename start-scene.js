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
import { PlanarReflection } from "./nodspel/vendor/ultra-water/src/engine/PlanarReflection.js";

// Dusk over the skerries: deep indigo zenith, through a blue-violet and lavender band, into a
// wide warm peach/orange glow hugging the horizon -- a soft gradient, not a thin line, with the
// sun low and glowing rather than a hard disc (v2.15.0 reference: /tmp/start-water-ref.png).
const SKY_ZENITH = new THREE.Color(0x1b1740);
const SKY_BLUE = new THREE.Color(0x3c3a7e);
const SKY_LAVENDER = new THREE.Color(0x8572a6);
const SKY_APRICOT = new THREE.Color(0xf3a76b);
const SEA_HORIZON = new THREE.Color(0x202c4e);
const SUN_COLOR = new THREE.Vector3(1, 0.6, 0.32);
const ROCK = 0x7d6b61, ROCK_DARK = 0x4c4038; // smooth granite skerries (kobbar), grey-pink
const PINE = 0x16302f; // near shoreline spruces
const PINE_FAR = 0x0b1a1d, LAND_FAR = 0x0d1922; // near-black blue-green horizon islands (silhouette only)
const BUNKER_WALL = 0x232e36, BUNKER_TOP = 0x2c3942; // matches nodspel's bunker palette (nodspel/art.js PALETTE)
const BUNKER_GLOW = 0xffa858; // warm lit doorway/window
const LOOP_SECONDS = 10; // idle flight loop length, within the 8-12s the design calls for
const REFLECT_LAYER = 1; // objects worth a planar reflection (bunker + near skerries, not the far horizon islands)

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
    uniforms: { top: { value: SKY_ZENITH }, blue: { value: SKY_BLUE }, lavender: { value: SKY_LAVENDER },
      horizon: { value: SKY_APRICOT }, sea: { value: SEA_HORIZON }, sunDir: { value: sunDir }, sunColor: { value: sunColor } },
    vertexShader: "varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying vec3 vDir; uniform vec3 top,blue,lavender,horizon,sea,sunDir,sunColor; void main(){" +
      "vec3 dir=normalize(vDir);float h=dir.y,hh=max(h,0.0);" +
      // wide, soft banding from the indigo zenith down through blue-violet and lavender into a
      // broad warm band hugging the horizon (not a thin line), then into the dark sea below it
      "vec3 col=top;" +
      "col=mix(col,blue,smoothstep(0.62,0.1,hh));" +
      "col=mix(col,lavender,smoothstep(0.26,0.05,hh));" +
      "col=mix(col,horizon,smoothstep(0.1,0.0,hh));" +
      "if(h<0.0)col=mix(horizon,sea,smoothstep(0.0,0.07,-h));" +
      "float c=max(dot(dir,sunDir),0.0);" +
      // soft glow only, no hard disc: a tight warm core fading into a wide halo
      "col += sunColor*pow(c,420.0)*1.1;" +
      "col += sunColor*pow(c,40.0)*0.3;" +
      "col += sunColor*pow(c,6.0)*0.05;" +
      "gl_FragColor=vec4(col,1.0); }",
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), mat));
  cam.update(renderer, scene);
  return rt.texture;
}

// Cheap "spruce forest on the horizon" dressing: a ring of low, flat islands (one larger
// forested headland, several low flat islets) around the flight loop, far enough out that the
// small camera path barely parallaxes them -- they read as a stable horizon skyline from
// anywhere on the loop. Flat silhouettes only (MeshBasicMaterial, no lighting cost): at this
// distance and backlighting they are solid near-black shapes, same as the reference photo.
// Tree canopies are wide and densely packed so a ridge reads as one continuous forest silhouette,
// not sparse individual spikes.
function buildOneIsland(rng, landGeo, landMat, pineGeo, pineMat, x, z, big){
  const group = new THREE.Group();
  const width = big ? 100 + rng() * 50 : 30 + rng() * 34;
  const depth = width * (0.32 + rng() * 0.2);
  const topY = big ? 11 + rng() * 8 : 2.8 + rng() * 4.5;
  const half = (topY + 60) / 2; // bottom sunk well below the waterline; only the top pokes up
  const land = new THREE.Mesh(landGeo, landMat);
  land.position.set(x, topY - half, z);
  land.scale.set(width, half, depth);
  land.rotation.y = rng() * Math.PI * 2;
  group.add(land);

  // dense enough, with wide overlapping canopies, that the ridge line reads as one solid
  // forest silhouette rather than individual sparse spikes.
  const treeCount = big ? 70 + Math.floor(rng() * 30) : 20 + Math.floor(rng() * 16);
  const trees = new THREE.InstancedMesh(pineGeo, pineMat, treeCount);
  const dummy = new THREE.Object3D();
  for(let t = 0; t < treeCount; t++){
    const h = big ? 12 + rng() * 10 : 5 + rng() * 6;
    dummy.position.set(x + (rng() - 0.5) * width * 0.95, topY + h * 0.4, z + (rng() - 0.5) * depth * 0.95);
    dummy.scale.set(2.8 + rng() * 2.2, h, 2.8 + rng() * 2.2);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trees.setMatrixAt(t, dummy.matrix);
  }
  trees.instanceMatrix.needsUpdate = true;
  group.add(trees);
  return group;
}

function buildHorizonIslands(rng, center){
  const group = new THREE.Group();
  const landGeo = new THREE.IcosahedronGeometry(1, 1);
  const landMat = new THREE.MeshBasicMaterial({ color: LAND_FAR });
  const pineGeo = new THREE.ConeGeometry(0.55, 1, 6);
  const pineMat = new THREE.MeshBasicMaterial({ color: PINE_FAR });

  // The one big forested headland: pinned at a fixed world angle (not ring-index-based) so it
  // reliably lands near the left edge of the opening/idle view instead of landing wherever the
  // ring index happens to put it (which could be behind the camera and never seen at all).
  const headlandAngle = THREE.MathUtils.degToRad(254), headlandRadius = 440;
  group.add(buildOneIsland(rng, landGeo, landMat, pineGeo, pineMat,
    center.x + Math.cos(headlandAngle) * headlandRadius, center.z + Math.sin(headlandAngle) * headlandRadius, true));

  const COUNT = 10;
  for(let i = 0; i < COUNT; i++){
    const angle = (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const radius = 420 + rng() * 240;
    const x = center.x + Math.cos(angle) * radius, z = center.z + Math.sin(angle) * radius;
    group.add(buildOneIsland(rng, landGeo, landMat, pineGeo, pineMat, x, z, false));
  }
  return group;
}

function buildSkerry(rng, rockCount){
  const g = new THREE.Group();
  // smooth, rounded granite (icosahedron, not flat-shaded) so the sun picks out a soft warm
  // highlight on top rather than faceted flat-shaded planes. High roughness + a low envMapIntensity
  // keep the albedo in charge -- at low roughness the sky IBL washes the rock out to a pale blob.
  const rockMat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 0.9, envMapIntensity: 0.35 });
  const rockMatDark = new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 0.95, envMapIntensity: 0.35 });
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  for(let i = 0; i < rockCount; i++){
    const rock = new THREE.Mesh(rockGeo, i === 0 ? rockMat : (rng() < 0.5 ? rockMat : rockMatDark));
    // how far a rock pokes above the waterline scales with its own size, so big rocks read as
    // chunky boulders and small ones as low pebbles; poking more than half its height up (rather
    // than a thin sliver) gives the grazing camera angle an actual rounded dome to shade instead
    // of a flat lens, and an uneven xz footprint breaks the perfect-ellipse look.
    const r = 0.4 + rng() * 0.9, half = r * 0.55, top = r * (0.55 + rng() * 0.35);
    rock.position.set(((rng() + rng()) / 2 - 0.5) * 4, top - half, ((rng() + rng()) / 2 - 0.5) * 4);
    rock.scale.set(r * (0.75 + rng() * 0.5), half, r * (0.75 + rng() * 0.5));
    rock.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
    g.add(rock);
  }
  const pineMat = new THREE.MeshStandardMaterial({ color: PINE, roughness: 0.9, flatShading: true });
  const pineCount = 1 + Math.floor(rng() * 3); // every skerry carries at least one spruce, so a bare one never reads as a plain rock pile
  for(let i = 0; i < pineCount; i++){
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.3 + rng() * 0.18, 1.2 + rng() * 0.9, 6), pineMat);
    pine.position.set((rng() - 0.5) * 2.6, 0.9, (rng() - 0.5) * 2.6);
    g.add(pine);
  }
  return g;
}

// Concrete bunker on a rounded-granite mound, a warm lit window facing the water, and a few
// shoreline spruces -- replaces the old dark dodecahedron "blob" (v2.15.0 reference bullet 4).
function buildBunkerIsland(rng){
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 0.88, envMapIntensity: 0.35 });
  const rockMatDark = new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 0.94, envMapIntensity: 0.35 });
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  for(let i = 0; i < 8; i++){
    const rock = new THREE.Mesh(rockGeo, i % 3 === 0 ? rockMatDark : rockMat);
    // scale how far a rock pokes above the water with its own size (big = chunky boulder, small
    // = low pebble) instead of a flat offset, which read as a thin floating disc; triangular
    // position distribution keeps the mound tight around the bunker instead of stray rocks.
    const r = 0.45 + rng() * 0.85, half = r * 0.62, top = r * (0.55 + rng() * 0.35);
    rock.position.set(((rng() + rng()) / 2 - 0.5) * 4.6, top - half, ((rng() + rng()) / 2 - 0.5) * 3.8);
    rock.scale.set(r * (0.75 + rng() * 0.5), half, r * (0.75 + rng() * 0.5));
    rock.rotation.y = rng() * Math.PI * 2;
    g.add(rock);
  }
  const wall = new THREE.MeshStandardMaterial({ color: BUNKER_WALL, roughness: 0.8, envMapIntensity: 0.5 });
  const top = new THREE.MeshStandardMaterial({ color: BUNKER_TOP, roughness: 0.75, envMapIntensity: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.7, 2.6), wall);
  body.position.set(0, 0.5, 0); g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.6, 10), top);
  roof.position.set(-0.3, 1.5, 0); g.add(roof);
  // warm lit doorway/window on the +Z face, towards the water the camera approaches from
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, emissive: BUNKER_GLOW, emissiveIntensity: 2.2, roughness: 0.6 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), winMat);
  win.position.set(0, 0.35, 1.31); g.add(win);
  const pineMat = new THREE.MeshStandardMaterial({ color: PINE, roughness: 0.9, flatShading: true });
  for(let i = 0; i < 5; i++){
    const h = 1.5 + rng() * 1.5;
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.34 + rng() * 0.2, h, 6), pineMat);
    pine.position.set(-1.7 - rng() * 1.9, h * 0.5 - 0.35, (rng() - 0.5) * 4.2);
    g.add(pine);
  }
  return g;
}

// Large rounded granite boulders close to the camera's opening position, entering the
// bottom-right corner of the frame (reference bullet 4) -- distinct from, and in front of, the
// bunker's own mid-distance shore mound.
function buildForegroundBoulders(rng){
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 0.55, envMapIntensity: 1 });
  const rockMatDark = new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 0.65, envMapIntensity: 1 });
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  // one dominant boulder plus a few smaller, clearly separated ones (gaps of open water between
  // them) rather than six similarly-sized rocks fused into a single featureless mound.
  const sizes = [2.6, 1.6, 1.1, 0.75];
  const offsets = [[0, -1], [5.2, 1.5], [2.5, 5.5], [-1.5, 3]];
  for(let i = 0; i < sizes.length; i++){
    const rock = new THREE.Mesh(rockGeo, i % 2 === 0 ? rockMat : rockMatDark);
    const r = sizes[i] * (0.85 + rng() * 0.3), half = r * 0.6, top = r * (0.6 + rng() * 0.3);
    rock.position.set(offsets[i][0] + (rng() - 0.5) * 1.2, top - half, offsets[i][1] + (rng() - 0.5) * 1.2);
    rock.scale.set(r * (0.8 + rng() * 0.4), half, r * (0.8 + rng() * 0.4));
    rock.rotation.y = rng() * Math.PI * 2;
    g.add(rock);
  }
  const pineMat = new THREE.MeshStandardMaterial({ color: PINE, roughness: 0.9, flatShading: true });
  for(let i = 0; i < 3; i++){
    const h = 2 + rng() * 1.6;
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rng() * 0.22, h, 6), pineMat);
    pine.position.set(-1 + rng() * 6, h * 0.5 - 0.3, -2 + rng() * 6);
    g.add(pine);
  }
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
  // Soft dusk fill keeps the shaded granite readable against the blue sea without washing the
  // warm sunlit tops out pale -- the directional sun below does the "lit warm on top" work.
  // A dim warm bounce from roughly the camera's own direction (the sun sits almost dead ahead on
  // the opening approach, so anything in front of the camera shows its shadowed side) -- stands
  // in for light scattered back off the water, so the near rocks/bunker read as dark warm granite
  // instead of a flat black silhouette.
  const bounce = new THREE.DirectionalLight(0xffb98a, 0.55);
  bounce.position.copy(sky.sunDir).multiplyScalar(-40);
  scene.add(sun, bounce, new THREE.HemisphereLight(0xb5b9d1, SEA_HORIZON, 0.5));

  // Open water (no coastline data of our own to feed it): an all-deep-water shore bake is a
  // safe, inert "no shore interaction" field -- shore waves/breakers stay off everywhere.
  const shore = bakeShoreMap(() => -50, 2000, 64);
  const tex = profile.foam ? bakeWaterTextures(renderer) : null;
  // Sheltered summer archipelago ripples, rather than the demo's open-ocean swell -- calmer and
  // glassier than the v2.14 pass so the sky gradient and sun path reflect cleanly (bullet 3).
  const ocean = new OceanSim(renderer, {
    ...defaultOceanParams(), windSpeed: 2.6, fetchKm: 9,
    waveScale: 0.28, swellScale: 0.05, choppiness: 0.3,
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
  // dark northern sea reflecting the dusk sky (with sun glitter) rather than lagoon water.
  surface.uniforms.uScatterColor.value.set(0.03, 0.06, 0.16);
  surface.uniforms.uAbsorption.value.set(0.55, 0.16, 0.07);
  // Glassier surface: lower base roughness and less reflection distortion so the sky gradient,
  // sun glitter path and the bunker's planar reflection all read clean rather than broken up.
  surface.uniforms.uOptics.value.set(0.014, 0.04, 0.03, 1 / 60000);
  // Less noisy sparkle across the whole sea -- the glitter lobe stays concentrated near the sun
  // path (it already scales with distance-from-camera in the shader).
  surface.uniforms.uGlint.value = 0.4;
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
  // Kept out of the 0-0.33 stretch of the loop entirely: that's the opening/idle establishing
  // shot (bunker + foreground boulders below), and a generic skerry landing in the same screen
  // area doubled up with that dedicated composition into a cluttered pile of rocks.
  [0.38, 0.5, 0.62, 0.74, 0.86, 0.96].forEach((t, i) => {
    const p = curve.getPointAt(t), side = i % 2 === 0 ? 1 : -1;
    const skerry = buildSkerry(rng, 3 + Math.floor(rng() * 3));
    skerry.scale.set(1.15, 1.05, 1.15);
    skerry.position.set(p.x + side * (6 + rng() * 5), -0.1, p.z + side * (3 + rng() * 4));
    skerries.add(skerry);
  });
  scene.add(skerries);
  // Own seeded RNG stream, independent of the shared one above: buildBunkerIsland's layout must
  // stay stable on its own tuned seed, not silently reshuffle every time the skerry loop's rng()
  // call count changes (it's a fixed deterministic scene, the same for every player).
  const bunker = buildBunkerIsland(seededRng(4242));
  // Keep the destination visible ahead during the opening flight, well over towards the right
  // third of frame (reference bullet 4) rather than dead centre.
  const bunkerAt = curve.getPointAt(0.18);
  bunker.position.set(bunkerAt.x + 44, -0.4, bunkerAt.z + 10);
  scene.add(bunker);

  // Large foreground granite boulders entering the bottom-right corner, close to the camera's
  // opening position -- distinct from (and in front of) the mid-distance bunker shore above.
  const foreground = buildForegroundBoulders(seededRng(9191));
  foreground.position.set(points[0].x + 16.5, 0, points[0].z - 8.5);
  scene.add(foreground);

  // Far horizon skyline (bullet 2): a stable ring of forested islands around the whole loop, so
  // there's always land on the horizon regardless of where the camera sits along the flight path.
  const islandCenter = points.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
  scene.add(buildHorizonIslands(seededRng(7777), islandCenter));

  // Reflection layer: only the near objects worth a planar reflection (the bunker and its warm
  // window, the nearby granite) -- the far horizon islands stay off it, they're too far out for
  // the reflection to read and it would just cost an extra draw call per island for nothing.
  skerries.traverse(o => o.layers.enable(REFLECT_LAYER));
  bunker.traverse(o => o.layers.enable(REFLECT_LAYER));
  foreground.traverse(o => o.layers.enable(REFLECT_LAYER));
  const reflection = profile.reflections ? new PlanarReflection(REFLECT_LAYER) : null;
  if(reflection){
    reflection.scale = profile.name === "high" ? 0.5 : 0.35;
    surface.uniforms.uReflMatrix.value = reflection.textureMatrix;
  }

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
    reflection?.setSize(size.x, size.y);
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
    reflection?.target.dispose();
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

      if(reflection){
        reflection.render(renderer, scene, camera);
        surface.uniforms.uReflection.value = reflection.target.texture;
      }

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
