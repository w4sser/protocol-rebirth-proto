import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shoreFadeAt,shoreBounds,SHORE_FADE_START,SHORE_FADE_END,SHORE_SAND_COLOR} from '../shore-fade.mjs';

const island={x:5,z:-3,w:16,d:12};
test('opaque shore fade is narrow and retains a fully colored island interior',()=>{
  assert.equal(SHORE_FADE_END,.75);
  assert.ok(SHORE_FADE_START>=0);
  assert.equal(SHORE_SAND_COLOR,'#7a6d52');
  for(const low of [false,true]){
    assert.ok(shoreFadeAt(island,-3,-3,low)<.08,'shoreline is sand-toned');
    assert.ok(shoreFadeAt(island,5,-3,low)>.99,'island center stays unchanged');
    assert.ok(shoreFadeAt(island,-2.6,-3,low)>.1,'partial transition');
    assert.ok(shoreFadeAt(island,-2.6,-3,low)<1,'transition does not jump directly');
  }
});
test('shared bounds create no artificial fade at internal 4m or 8m tile seams',()=>{
  const bounds=shoreBounds(island);
  assert.deepEqual(bounds,[-3,-9,13,3]);
  for(const low of [false,true]){
    const before=shoreFadeAt(island,4-.0001,-3,low);
    const after=shoreFadeAt(island,4+.0001,-3,low);
    assert.ok(Math.abs(before-after)<.003,'fade continuous across internal tile seam');
    assert.ok(before>.99 && after>.99);
  }
});
test('shoreline fade is deterministic and does not affect piers',()=>{
  for(const low of [false,true]){
    assert.equal(shoreFadeAt(island,-2.8,1.4,low),shoreFadeAt(island,-2.8,1.4,low));
    assert.equal(shoreFadeAt({...island,dir:{x:1,z:0}},-3,-9,low),1);
  }
});
test('both rendering profiles use opaque world-space shader blend, not global alpha',async()=>{
  const src=await readFile(new URL('../ground-preview.js',import.meta.url),'utf8');
  assert.match(src,/function addShoreFade\(shader, profile\)/);
  assert.match(src,/shader\.vertexShader=.*shader\.vertexShader/);
  assert.match(src,/attribute vec4 shoreBounds, shoreCoveA, shoreCoveB/);
  assert.match(src,/diffuseColor\.rgb=mix\(coastColor,diffuseColor\.rgb,shoreFactor\)/);
  assert.match(src,/if\(biome==='nature'\)addShoreFade\(shader,'high'\)/);
  assert.match(src,/surfaceMaterial\.onBeforeCompile=shader=>addShoreFade\(shader,'low'\)/);
  assert.match(src,/tileGeometry = biome==='nature' \? attachShoreBounds\(geometry,floor,level.seed\) : geometry/);
  assert.match(src,/shoreGeometry\)node\.geometry\.dispose/);
  assert.doesNotMatch(src,/surfaceMaterial\.transparent\s*=\s*true/);
});
