import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../../scripts/layout-check.mjs',import.meta.url),'utf8');
const named=name=>source.slice(source.indexOf(`function ${name}()`),source.indexOf('\n}',source.indexOf(`function ${name}()`))+2);
const start=source.indexOf('const labels=await page.evaluate(()=>{');
const inline='function inline(){'+source.slice(start+'const labels=await page.evaluate(()=>{'.length,source.indexOf('return out;});',start))+'return out;}';
function element(kind='enemy',mode='bar'){
 return {dataset:{mode},textContent:kind==='enemy'?'RUSHER · 1':'LOOT',id:'',className:kind==='enemy'?'node-label enemy-label':'node-label',hidden:false,
 getBoundingClientRect:()=>({left:100,top:100,right:144,bottom:105,width:44,height:5}),getClientRects:()=>[{}],
 matches:q=>q.includes('enemy-label')&&kind==='enemy'&&mode==='bar',closest:q=>q==='[hidden]'?null:q.includes('enemy-label')&&kind==='enemy'&&mode==='bar'?{}:null,contains:()=>false};
}
function collect(fn,labels,hud=[]){
 const document={querySelectorAll:q=>q.startsWith('#world-labels>')?labels:q.startsWith('.round-hud')?hud:[]};
 const out=runInNewContext(`(${fn})();`,{window:{},document,getComputedStyle:()=>({visibility:'visible',opacity:'1'}),performance:{now:()=>0}});
 return Array.from(out.overlaps??out);
}
for(const [name,fn] of [['walk sweep',named('sampleLabels')],['world overlays',named('worldOverlaps')],['static raid labels',inline]]){
 test(`${name}: coincident compact health bars stay allowed; captions and loot still collide`,()=>{
  assert.equal(collect(fn,[element(),element()]).length,0);
  assert.ok(collect(fn,[element(),element('enemy','full')]).length>0);
  assert.ok(collect(fn,[element('enemy','full'),element('enemy','full')]).length>0);
  assert.ok(collect(fn,[element(),element('loot')]).length>0);
 });
 if(name!=='walk sweep')test(`${name}: a compact bar overlapping HUD remains an error`,()=>{
  assert.ok(collect(fn,[element()],[element('hud')]).length>0);
 });
}
