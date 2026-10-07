import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('player-facing source uses English and the page declares English',()=>{
  for(const name of readdirSync(root).filter(n=>/\.(?:js|mjs|html|webmanifest|md|json)$/.test(n))){
    const source=readFileSync(root+name,'utf8');
    assert.doesNotMatch(source,/[\u00e5\u00e4\u00f6\u00c5\u00c4\u00d6]/,name);
  }
  assert.match(readFileSync(root+'index.html','utf8'),/lang="en"/);
});
