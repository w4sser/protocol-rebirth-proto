// v1.52 AD ad06: nodspel uses the base app's type (Archivo headings, IBM Plex Sans/Mono) and palette signals.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
test('fonts: Archivo + IBM Plex, no Barlow / DM Sans',()=>{
  assert.match(css,/family=Archivo/);assert.match(css,/family=IBM\+Plex\+Sans/);assert.match(css,/family=IBM\+Plex\+Mono/);
  assert.doesNotMatch(css,/Barlow|DM Sans/);assert.match(css,/font-family:'Archivo'/);assert.match(css,/font-family:'IBM Plex Sans'/);
});
test('palette: system cyan #3FE0D0 / #75CFCC, no old #15D6BE teal or #ff8175 red in the HUD',()=>{
  assert.doesNotMatch(css,/#15d6be|#ff8175|#ff5a3c/i);assert.match(css,/#3FE0D0|#75cfcc/i);
});
