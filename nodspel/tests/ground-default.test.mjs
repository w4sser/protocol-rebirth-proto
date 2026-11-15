import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {useTexturedGround} from '../archipelago-dressing-policy.mjs';
test('v2.28.0: ground pass is default-on, ?ground=0 disables, profile follows quality',async()=>{
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(game,/const GROUND_V2=useTexturedGround\(AREA_SEL,location.search\);/);
  for(const area of ['bunker','town','archipelago']){
    assert.equal(useTexturedGround(area,''),true);
    assert.equal(useTexturedGround(area,'?ground=0'),false);
    assert.equal(useTexturedGround(area,'?groundProfile=low'),true);
    assert.equal(useTexturedGround(area,'?archVisual=v2'),area!=='archipelago');
  }
  assert.match(game,/QUALITY==='low'\?'low':'high'/);
  const arch=await readFile(new URL('../archipelago.js',import.meta.url),'utf8');
  assert.match(arch,/get\('ground'\)!=='0'/);
  assert.doesNotMatch(game+arch,/get\('ground'\)==='2'/);
});
