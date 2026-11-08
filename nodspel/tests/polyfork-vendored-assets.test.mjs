import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {polyforkLocalUrl} from '../polyfork-local-url.mjs';

const prefix=new URL('../assets/polyfork/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',prefix),'utf8'));
const content=await readFile(new URL('../polyfork-dressing.mjs',import.meta.url),'utf8');

test('all 19 required gameplay meshes are vendored with CC BY credits and checksums',async()=>{
  assert.equal(manifest.license,'CC-BY-4.0');
  assert.equal(manifest.files.length,19);
  const notice=await readFile(new URL('ATTRIBUTION.md',prefix),'utf8');
  assert.match(notice,/CC BY 4\.0/);
  for(const entry of manifest.files){
    assert.match(entry.id,/^[a-z][a-z0-9-]*-[a-f0-9]{6}$/);
    assert.equal(entry.file,entry.id+'.glb');
    assert.equal(entry.source,'https://polyfork.dev/cdn/'+entry.file);
    assert.ok(notice.includes('https://polyfork.dev/asset/'+entry.id),'missing credit '+entry.id);
    const buf=await readFile(new URL(entry.file,prefix));
    assert.equal(buf.toString('ascii',0,4),'glTF',entry.id);
    assert.equal(buf.readUInt32LE(4),2,entry.id);
    assert.equal(buf.readUInt32LE(8),buf.length,entry.id);
    assert.equal(buf.length,entry.bytes,entry.id);
    assert.equal(createHash('sha256').update(buf).digest('hex'),entry.sha256,entry.id);
  }
});

test('production loader always resolves a same-origin URL, not Polyfork CDN',()=>{
  const example='young-pine-0d7695';
  assert.equal(polyforkLocalUrl(example,'https://protocolrebirth.com/nodspel/polyfork-dressing.mjs?v=123'),
    'https://protocolrebirth.com/nodspel/assets/polyfork/'+example+'.glb');
  assert.equal(polyforkLocalUrl(example).startsWith('file:'),true);
  assert.ok(!/loader\.loadAsync\(byId\.get\(id\)\.url\)/.test(content));
  assert.match(content,/polyforkLocalUrl\(id\)/);
  assert.throws(()=>polyforkLocalUrl('../escape'),TypeError);
  assert.ok(fileURLToPath(polyforkLocalUrl(example)).endsWith('/nodspel/assets/polyfork/'+example+'.glb'));
});

test('every referenced Polyfork asset has a vendored model',async()=>{
  const sources=['../polyfork-dressing.mjs','../polyfork-profiles.mjs','../polyfork-coastal-life.mjs'];
  const found=new Set();
  for(const path of sources){
    const data=await readFile(new URL(path,import.meta.url),'utf8');
    for(const match of data.matchAll(/\b[a-z][a-z0-9-]*-[a-f0-9]{6}\b/g))found.add(match[0]);
  }
  assert.deepEqual([...found].sort(),manifest.files.map(item=>item.id).sort());
});
