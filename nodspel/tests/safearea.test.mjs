import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('safe area: viewport-fit=cover, body is the safe rect (min 12 px sides on touch), no fixed 100vw layers',()=>{
  for(const [html,css] of [[read('../index.html'),read('../style.css')],[read('../../index.html'),read('../../index.html')]]){
    assert.match(html,/viewport-fit=cover/);
    assert.match(css,/--sl:max\(env\(safe-area-inset-left,0px\),12px\)/);assert.match(css,/--sr:max\(env\(safe-area-inset-right,0px\),12px\)/);
    assert.match(css,/body\{position:fixed!important;top:var\(--st\);right:var\(--sr\);bottom:var\(--sb\);left:var\(--sl\)/);
    assert.match(css,/transform:translateZ\(0\)/,'fixed HUD/popups are contained by the safe rect');}
  assert.match(read('../style.css'),/#viewport\.landscape\{width:100%;height:100%\}/);assert.match(read('../../index.html'),/#phone\{width:100%!important/);});
