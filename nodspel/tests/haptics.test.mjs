import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../../node_modules/jsdom/lib/api.js';
import {createHaptics,createVibrationUI,VIBRATION_KEY} from '../haptics.js';

const storage=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
test('unsupported navigator and iOS are no-ops',()=>{
  assert.equal(createHaptics({nav:{},storage:null}).hit(),false);
  assert.equal(createHaptics({nav:undefined,storage:null}).explosion(),false);
  let calls=0;
  for(const nav of [{userAgent:'iPhone',vibrate:()=>calls++},{platform:'MacIntel',maxTouchPoints:5,vibrate:()=>calls++}])createHaptics({nav,storage:null}).hit();
  assert.equal(calls,0);
});
test('default on, hit/explosion pulses and persisted opt-out',()=>{
  const calls=[],saved=storage(),nav={vibrate:ms=>calls.push(ms)};
  const h=createHaptics({nav,storage:saved});assert.equal(h.enabled,true);
  h.hit();h.explosion();assert.deepEqual(calls,[18,65]);
  h.setEnabled(false);assert.equal(saved.getItem(VIBRATION_KEY),'off');calls.length=0;h.hit();h.explosion();assert.deepEqual(calls,[]);
  const reloaded=createHaptics({nav,storage:saved});assert.equal(reloaded.enabled,false);
  reloaded.setEnabled(true);reloaded.hit();assert.deepEqual(calls,[18]);
});
test('backend swaps, cancels old backend, and still respects setting',()=>{
  const calls=[],h=createHaptics({storage:null,backend:{pulse:ms=>calls.push(['first',ms]),stop:()=>calls.push(['stop'])}});
  h.hit();h.setBackend({pulse:ms=>calls.push(['native',ms])});h.explosion();
  assert.deepEqual(calls,[['first',18],['stop'],['native',65]]);
  h.setEnabled(false);h.hit();assert.equal(calls.length,3);
  h.setBackend({pulse(){throw Error('unsupported');}});h.setEnabled(true);assert.doesNotThrow(()=>h.hit());
});
test('Vibration button updates aria state and persists across settings creation',()=>{
  const dom=new JSDOM('<main></main>'),document=dom.window.document,saved=storage(),calls=[];
  const h=createHaptics({storage:saved,backend:{pulse:ms=>calls.push(ms)}});
  const b=createVibrationUI({document,container:document.querySelector('main'),haptics:h});
  assert.equal(b.getAttribute('aria-label'),'Vibration on');b.click();assert.equal(b.getAttribute('aria-pressed'),'false');h.hit();assert.equal(calls.length,0);
  assert.equal(createHaptics({storage:saved}).enabled,false);b.click();h.hit();assert.deepEqual(calls,[18]);
  dom.window.close();
});
