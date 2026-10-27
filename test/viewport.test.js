// The pre-paint fallback must update on toolbar-only resizes and late orientation settlement.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html></html>',{runScripts:'outside-only'});
const w=dom.window,vv=new w.EventTarget();let pending=null,settle=null;
vv.height=375;vv.scale=1;w.visualViewport=vv;w.innerHeight=390;
w.requestAnimationFrame=fn=>{pending=fn;return 1;};w.cancelAnimationFrame=()=>{};
w.setTimeout=fn=>{settle=fn;return 1;};w.clearTimeout=()=>{};
w.eval(fs.readFileSync(require('node:path').join(__dirname,'../ui/viewport.js'),'utf8'));
const height=()=>parseFloat(w.document.documentElement.style.getPropertyValue('--vh'))*100;
assert.equal(height(),375,'first-paint measurement uses the visible height');
vv.height=430;vv.dispatchEvent(new w.Event('resize'));assert.equal(height(),430,'toolbar-only resize updates immediately');
w.dispatchEvent(new w.Event('orientationchange'));vv.height=390;pending();assert.equal(height(),390,'next frame catches late orientation sizing');
vv.height=375;settle();assert.equal(height(),375,'settled orientation measurement is refreshed');
vv.scale=2;vv.height=180;vv.dispatchEvent(new w.Event('resize'));assert.equal(height(),390,'pinch zoom does not shrink the game layout');
w.visualViewport=null;w.innerHeight=720;w.dispatchEvent(new w.Event('resize'));assert.equal(height(),720,'innerHeight fallback handles older browsers');
dom.window.close();console.log('VIEWPORT METRICS TEST PASSED');
