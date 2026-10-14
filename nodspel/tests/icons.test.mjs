// v1.50.0: nodspel UI uses the bespoke SVG icon set (ui-icons.svg via svg-icons.js), never emoji / unicode symbol icons.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const dir=new URL('../',import.meta.url);
const BAD=/[\p{Extended_Pictographic}\u2022\u2039\u203A\u2190-\u21FF\u221E\u2300-\u23FF\u2460-\u24FF\u2500-\u259F\u25A0-\u25FF\u2600-\u27BF\u2900-\u297F\u2B00-\u2BFF\u3030\uFE0F\uFF00-\uFFEF]/u;
const files=fs.readdirSync(dir).filter(f=>/\.(m?js|html|css)$/.test(f));
test('no emoji or symbol icons in nodspel UI sources',()=>{
  assert.ok(files.length>10);
  for(const f of files)fs.readFileSync(new URL(f,dir),'utf8').split('\n').forEach((l,i)=>{const m=l.match(BAD);assert.ok(!m,`${f}:${i+1} uses '${m?.[0]}' - use svgIcon()/ui-icons.svg`);});
});
test('typography allowlist (× · – … −) is not flagged',()=>{assert.ok(!BAD.test('× · – … −'));assert.ok(BAD.test('🔒')&&BAD.test('✕')&&BAD.test('↻'));});
test('every referenced icon exists in the shipped sprite, same as the base set',()=>{
  const sprite=fs.readFileSync(new URL('ui-icons.svg',dir),'utf8');
  assert.equal(sprite,fs.readFileSync(new URL('../assets/icons/sprite.svg',dir),'utf8'),'nodspel sprite in sync with assets/icons');
  const ids=new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m=>m[1]));
  const src=fs.readFileSync(new URL('game.mjs',dir),'utf8')+fs.readFileSync(new URL('index.html',dir),'utf8');
  const used=new Set([...src.matchAll(/(?:svgIcon|setIconText)\([^'`]*'([a-z0-9-]+)'/g),...src.matchAll(/ui-icons\.svg#([a-z0-9-]+)/g)].map(m=>m[1]));
  assert.ok(used.size>=10,`icons used: ${used.size}`);
  for(const id of used)assert.ok(ids.has(id),`sprite has #${id}`);
});
