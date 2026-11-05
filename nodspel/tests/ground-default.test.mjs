import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('v2.28.0: ground pass is default-on, ?ground=0 disables, profile follows quality',async()=>{
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(game,/const GROUND_V2=GROUND_V2_PARAMS\.get\('ground'\)!=='0';/);
  assert.match(game,/QUALITY==='low'\?'low':'high'/);
  const arch=await readFile(new URL('../archipelago.js',import.meta.url),'utf8');
  assert.match(arch,/get\('ground'\)!=='0'/);
  assert.doesNotMatch(game+arch,/get\('ground'\)==='2'/);
});
