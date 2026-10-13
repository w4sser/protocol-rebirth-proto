import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('safe area: full-bleed canvas/art, only UI inset (min 12 px sides on touch), viewport-fit=cover',()=>{
  const nh=read('../index.html'),nc=read('../style.css'),bh=read('../../index.html');
  for(const h of [nh,bh])assert.match(h,/viewport-fit=cover/);
  for(const c of [nc,bh]){assert.match(c,/--sl:max\(env\(safe-area-inset-left,0px\),12px\)/);assert.match(c,/--sr:max\(env\(safe-area-inset-right,0px\),12px\)/);
    assert.doesNotMatch(c,/body\{position:fixed!important;top:var\(--st\)/,'the page itself is never cropped');}
  assert.match(nc,/#viewport\.landscape\{position:fixed!important;top:var\(--st\);right:var\(--sr\);bottom:var\(--sb\);left:var\(--sl\)/);
  assert.match(nc,/#viewport #game,#viewport #world-labels\{position:fixed!important;inset:auto;top:calc\(-1\*var\(--st\)\)/,'3D canvas bleeds edge to edge');
  for(const sel of ['#topbar','#tabs','#overlay'])assert.match(bh,new RegExp(sel+'\\{padding-left:[^}]*var\\(--sl\\)'),sel+' inset');});
