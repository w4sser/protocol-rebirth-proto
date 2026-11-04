// Draft-only ground pass v2 preview: ?ground=2&groundProfile=high|low.
// No collision, camera, controls or gameplay changes. Without ?ground=2 this file is never imported.
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const DIR = new URL('../assets/env/terrain/', import.meta.url);
const LAYERS = {
  nature: ['granite', 'moss', 'gravel', 'pine_needles'],
  bunker: ['concrete', 'wet_concrete', 'concrete_worn', 'grime'],
};
const MASK = { nature: 'chunk_0_0_splat.png', bunker: 'chunk_0_0_bunker_splat.png' };
const DECALS = {
  nature: ['lichen', 'pine_needles', 'wheel_tracks', 'puddle', 'mud'],
  bunker: ['wear', 'wheel_tracks', 'puddle', 'mud'],
};
const TRAILS = ['trail_straight_2m', 'trail_straight_4m', 'trail_straight_8m'];
const allDecals = [...new Set(Object.values(DECALS).flat())];
const cache = new Map();

function texture(filename, {repeat = false, srgb = true} = {}) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(
    new URL(filename, DIR).href,
    t => {
      t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      resolve(t);
    },
    undefined, reject,
  ));
}
function model(filename) {
  return new Promise((resolve, reject) => new GLTFLoader().load(
    new URL(filename, DIR).href,
    gltf => {
      let mesh = null;
      gltf.scene.traverse(n => { if (n.isMesh && !mesh) mesh = n; });
      if (!mesh) reject(new Error('No mesh in ' + filename));
      else resolve(mesh);
    },
    undefined, reject,
  ));
}
function highMaterial(layers, mask, biome) {
  // PASS 4: reweight existing smooth macro splat, no extra texture lookups/no new noise.
  // Nature keeps the moss and the path legibility; bunker uses existing broad wet/worn/grime masks.
  const m = new THREE.MeshStandardMaterial({roughness: .94, metalness: 0});
  m.onBeforeCompile = shader => {
    for (let i = 0; i < 4; i++) shader.uniforms['groundLayer' + i] = {value: layers[i]};
    shader.uniforms.groundMask = {value: mask};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
    const weightTune = biome === 'nature'
      ? 'groundWeights *= vec4(0.93,1.44,0.80,0.90);'
      : 'groundWeights *= vec4(1.0,1.28,1.28,1.32);';
    const colorTune = biome === 'nature'
      // Moss-rich areas get a restrained cool green tint and depth; all derived from
      // the existing smooth splat weights (never high-frequency TV-static noise).
      ? 'float mossCoverage=smoothstep(0.32,0.70,groundWeights.g); float mossDepth=smoothstep(0.56,0.83,groundWeights.g); groundColor*=mix(vec3(1.0),vec3(0.92,1.015,0.89),mossCoverage); groundColor*=1.0-0.060*mossDepth;'
      // Darken existing broad wet/worn/grime regions slightly, not the entire floor.
      : 'float wetDepth=smoothstep(0.12,0.44,groundWeights.g); float wornDepth=smoothstep(0.15,0.40,groundWeights.b+groundWeights.a*0.6); groundColor*=1.0-0.055*wetDepth-0.048*wornDepth;';
    const fragment = [
      'vec4 groundWeights=texture2D(groundMask,vGroundXZ/16.0);',
      weightTune,
      'groundWeights/=max(dot(groundWeights,vec4(1.0)),0.001);',
      'vec2 groundUV=vGroundXZ/4.0;',
      'vec3 groundColor=texture2D(groundLayer0,groundUV).rgb*groundWeights.r+texture2D(groundLayer1,groundUV).rgb*groundWeights.g+texture2D(groundLayer2,groundUV).rgb*groundWeights.b+texture2D(groundLayer3,groundUV).rgb*groundWeights.a;',
      colorTune,
      'diffuseColor.rgb*=groundColor;'
    ].join(' ');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec2 vGroundXZ; uniform sampler2D groundLayer0,groundLayer1,groundLayer2,groundLayer3,groundMask;')
      .replace('#include <map_fragment>', fragment);
  };
  m.customProgramCacheKey = () => 'ground-v4-' + biome;
  return m;
}
function cutoutMaterial(tex) {
  return new THREE.MeshStandardMaterial({
    map: tex, vertexColors: true, side: THREE.DoubleSide,
    // Soft coverage, prefiltered mipmaps and blending avoid hard clip/speckle at the raid camera.
    alphaTest: .035, transparent: true, depthWrite: false,
    roughness: .95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
}
async function loadAssets(biome, profile) {
  const key = biome + ':' + profile;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const tileFiles = profile === 'high'
      ? [4, 8].map(size => 'terrain_tile_' + size + 'm_splat_' + biome + '.glb')
      : [4, 8].flatMap(size => ['a','b','c','d'].map(v =>
        'terrain_tile_' + size + 'm_mobile_' + biome + '_' + v + '.glb'));
    const [tileModels, trailModels, decalModels, trailTex, decalTex, surface] = await Promise.all([
      Promise.all(tileFiles.map(model)),
      Promise.all(TRAILS.map(f => model(f + '.glb'))),
      Promise.all(allDecals.map(f => model('decal_' + f + '.glb'))),
      texture('ground_trail_albedo.png'),
      texture('decal_atlas.png'),
      profile === 'high'
        ? Promise.all([
            Promise.all(LAYERS[biome].map(f => texture('ground_' + f + '_albedo.png', {repeat:true}))),
            texture(MASK[biome], {repeat:true, srgb:false}),
          ])
        : texture('ground_mobile_' + biome + '_atlas.png'),
    ]);
    const surfaceMaterial = profile === 'high'
      ? highMaterial(surface[0], surface[1], biome)
      : new THREE.MeshStandardMaterial({
          map:surface,roughness:.94,metalness:0,vertexColors:true,
          // Single atlas lookup remains unchanged. Subtle LOW-only green lift.
          color: biome === 'nature' ? new THREE.Color().setRGB(.975,1.035,.96) : new THREE.Color(0xffffff),
        });
    const tiles = new Map(tileFiles.map((f,i) => [f, tileModels[i].geometry]));
    return {
      surfaceMaterial, tiles,
      trails: new Map(TRAILS.map((f,i) => [f, trailModels[i].geometry])),
      decals: new Map(allDecals.map((f,i) => [f, decalModels[i].geometry])),
      trailMaterial: cutoutMaterial(trailTex), decalMaterial: cutoutMaterial(decalTex),
    };
  })().catch(e => { cache.delete(key); throw e; });
  cache.set(key, p);
  return p;
}
function hash(a, b, c) {
  let n = (a ^ Math.imul(b, 0x9e3779b1) ^ Math.imul(c, 0x85ebca6b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
function floorSeed(level) {
  let n = 2166136261;
  for (const ch of String(level.seed ?? 'ground-v2')) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
}
// Each floor is tiled with 8m modules where possible and 4m modules at edges.
// Partial edge tiles are scaled to floor bounds; never extend through walls.
function strips(length) {
  const s = [];
  for (let remaining = length; remaining > .0001;) {
    const width = remaining >= 7.999 ? 8 : remaining >= 3.999 ? 4 : remaining;
    s.push(width); remaining -= width;
  }
  return s;
}
function grid(floor, place) {
  const xs = strips(floor.w), zs = strips(floor.d);
  let x = floor.x - floor.w/2;
  for (const wx of xs) {
    let z = floor.z - floor.d/2;
    for (const wz of zs) {
      if (wx >= 7.999 && wz >= 7.999) place(x, z, 8, 8, 8);
      else {
        // A strip adjacent to an 8m tile uses 4m pieces, not a stretched 8m model.
        const nx = wx >= 7.999 ? 2 : 1, nz = wz >= 7.999 ? 2 : 1;
        const sx = wx/nx, sz = wz/nz;
        for (let i=0; i<nx; i++) for (let j=0; j<nz; j++)
          place(x+i*sx, z+j*sz, sx, sz, 4);
      }
      z += wz;
    }
    x += wx;
  }
}
function placeDecor(floors, group, assets, biome, profile, levelSeed, stats) {
  const y = profile === 'high' ? .09 : .027;
  const pathSet = DECALS[biome];
  for (let f=0; f<floors.length; f++) {
    const floor = floors[f], alongX = floor.w >= floor.d, len = alongX ? floor.w : floor.d;
    if (len >= 6 && (biome === 'nature' || floor.dir)) {
      const usable = len - 1;
      let cursor = -usable/2, remaining = usable;
      while (remaining >= 1.999) {
        const seg = remaining >= 8 ? 8 : remaining >= 4 ? 4 : 2;
        const mesh = new THREE.Mesh(assets.trails.get('trail_straight_' + seg + 'm'), assets.trailMaterial);
        mesh.position.set(alongX ? floor.x+cursor+seg/2 : floor.x, y,
                          alongX ? floor.z : floor.z+cursor+seg/2);
        mesh.rotation.y = alongX ? Math.PI/2 : 0;
        mesh.renderOrder = 3;
        group.add(mesh); stats.trails++;
        cursor += seg; remaining -= seg;
      }
    }
    const count = Math.min(6, Math.floor(floor.w*floor.d/55));
    for (let i=0; i<count; i++) {
      const h = hash(levelSeed ^ 0xcafe, f, i);
      const kind = pathSet[h % pathSet.length];
      const mesh = new THREE.Mesh(assets.decals.get(kind), assets.decalMaterial);
      const rx = ((hash(h, 1, 23) & 65535)/65535-.5);
      const rz = ((hash(h, 2, 37) & 65535)/65535-.5);
      // Keep enlarged 3-5m decals inside each floor as far as practical.
      const xRange = Math.max(0, floor.w-4.5), zRange = Math.max(0, floor.d-4.5);
      mesh.position.set(floor.x + rx*xRange, y+.003+i*.0003, floor.z + rz*zRange);
      mesh.rotation.y = (hash(h, 3, 11)%4)*Math.PI/2;
      mesh.renderOrder = 4;
      group.add(mesh); stats.decals++;
    }
  }
}
export function addGroundPreview(level, scene, {area = 'archipelago', profile = 'high'} = {}) {
  const biome = area === 'bunker' ? 'bunker' : 'nature';
  const mode = profile === 'low' ? 'low' : 'high';
  const group = new THREE.Group();
  group.name = 'ground-preview-v2';
  group.userData = {profile:mode, biome, assetVersion:2};
  scene.add(group);
  const stats = {profile:mode,biome,tiles4m:0,tiles8m:0,trails:0,decals:0,ready:false};
  const ready = loadAssets(biome, mode).then(assets => {
    if (!group.parent) return;
    const seed = floorSeed(level);
    for (let f=0; f<level.floors.length; f++) {
      const floor = level.floors[f];
      grid(floor, (x,z,sx,sz,size) => {
        const variant = 'abcd'[hash(seed,Math.floor(x*8),Math.floor(z*8))%4];
        const filename = 'terrain_tile_' + size + 'm_' +
          (mode === 'high' ? 'splat_' + biome : 'mobile_' + biome + '_' + variant) + '.glb';
        const geometry = assets.tiles.get(filename);
        if (!geometry) throw new Error('Missing ground prefab ' + filename);
        const tile = new THREE.Mesh(geometry, assets.surfaceMaterial);
        tile.scale.set(sx/size, 1, sz/size);
        tile.position.set(x+sx/2, .018, z+sz/2);
        tile.receiveShadow = true;
        tile.renderOrder = 2;
        group.add(tile);
        stats[size === 8 ? 'tiles8m' : 'tiles4m']++;
      });
    }
    placeDecor(level.floors, group, assets, biome, mode, seed, stats);
    stats.ready = true;
    console.log('[ground-preview-v2]', JSON.stringify(stats));
  }).catch(error => {
    stats.error = String(error);
    console.error('[ground-preview-v2] failed:', error);
  });
  return {group,stats,ready,dispose() { scene.remove(group); group.clear(); }};
}
