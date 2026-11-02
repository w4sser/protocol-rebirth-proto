// v2.22.4: the hot-path allocation lint flags allocations inside @hot per-frame functions and honours hot-ok.
import assert from 'node:assert/strict';import {lintSource} from '../scripts/hot-alloc-lint.mjs';
const src=`// @hot tick
const scratch={x:0};
function cold(){return {a:[1,2],b:new Map()};}
function tick(p,list){
  const o={x:p.x};
  const a=[1];
  const v=new Vec(1,2,3);
  list.forEach(x=>x);
  const c={...p};
  const s=\`n=\${p.x}\`;
  const t=\`static\`;
  const m=list.map(f);
  const ok={y:1}; // hot-ok: test allowlist
  // hot-ok-begin: block
  const b1=[p];const b2={p};
  // hot-ok-end
  scratch.x=p.x;
}`;
const found=lintSource(src,'fixture.js');
const kinds=found.map(f=>f.line+':'+f.what);
for(const want of ['5:object literal','6:array literal','7:new Vec','8:closure (arrow fn)','9:spread','10:template string','12:.map() allocates'])assert(kinds.includes(want),`missing ${want} in ${kinds}`);
assert(!found.some(f=>f.line===3),'cold function is not linted');
assert(!found.some(f=>f.line===11),'template without expressions is fine');
assert(!found.some(f=>f.line>=13&&f.line<=16),'hot-ok and hot-ok-begin/end allowlist');
assert.equal(lintSource('function tick(){return {};}','x.js'),null,'no @hot header = not linted');
assert(lintSource('// @hot missing\nfunction other(){}','x.js').some(f=>/not found/.test(f.what)),'unknown @hot names are reported');
console.log('hot-alloc-lint test: ok');
