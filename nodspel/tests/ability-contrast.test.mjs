import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createDashAbility,mountAbility,renderAbilitySlot} from '../abilities.js';
const require=createRequire(import.meta.url);
const {JSDOM}=require('../../node_modules/jsdom');

function setup(t){
  const dom=new JSDOM('<button id="dash"></button>');
  const previous=globalThis.document;globalThis.document=dom.window.document;
  t.after(()=>{globalThis.document=previous;dom.window.close();});
  return dom.window.document.querySelector('button');
}

test('ability restores dark outlined circle, text and meter without solid fill or cooldown ring',async()=>{
  const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
  const style=css.match(/#dash\{([^}]+)\}/)[1];
  assert.match(style,/border:2px solid var\(--ad-cyan\)/);
  assert.match(style,/border-radius:50%/);
  assert.match(style,/background:color-mix\(in srgb,var\(--ad-bit\) 12%,var\(--ad-ink\)\)/);
  assert.doesNotMatch(css,/#dash:disabled:before/);
  assert.doesNotMatch(css.match(/#dash:disabled\{([^}]+)\}/)[1],/conic-gradient/);
  assert.match(css,/#dash-meter\{[^}]*overflow:hidden/);
});

test('DASH mounts arrow, definition label, READY and charge meter; cooldown and unavailable preserve readiness',t=>{
  const button=setup(t),round={stats:{dashCooldownMs:2500}};
  let activated;const ability=createDashAbility(r=>{activated=r;});
  mountAbility(button,ability);
  assert.equal(button.querySelector('use').getAttribute('href'),'ui-icons.svg#dash');
  assert.equal(button.querySelector('strong').textContent,'DASH');
  assert.equal(button.querySelector('#dash-time').textContent,'READY');
  assert.equal(button.querySelectorAll('[role="progressbar"]').length,1);
  ability.activate(round);assert.equal(activated,round);
  renderAbilitySlot(button,ability,1,0,false,round);
  assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-label'),'DASH READY');
  renderAbilitySlot(button,ability,.4,1500,false,round);
  assert.equal(button.disabled,true);assert.equal(button.querySelector('#dash-time').textContent,'1.5 s');
  assert.equal(button.querySelector('#dash-fill').style.width,'40%');
  assert.equal(button.querySelector('#dash-meter').getAttribute('aria-valuenow'),'40');
  assert.match(button.getAttribute('aria-label'),/cooldown 1.5 seconds/);
  renderAbilitySlot(button,ability,1,0,true,round);
  assert.equal(button.disabled,true);assert.equal(button.querySelector('#dash-time').textContent,'READY');
  assert.equal(button.querySelector('#dash-fill').style.width,'100%');
});

test('swapping definitions replaces all content and uses custom label, ready text and cooldown duration',t=>{
  const button=setup(t);
  mountAbility(button,createDashAbility(()=>{}));
  const ability={icon:'aim',label:'SCAN',readyText:'ONLINE',cooldownMs:4000};
  mountAbility(button,ability);
  assert.equal(button.querySelectorAll('svg').length,1);
  assert.equal(button.querySelectorAll('#dash-meter').length,1);
  assert.equal(button.querySelector('use').getAttribute('href'),'ui-icons.svg#aim');
  assert.equal(button.querySelector('strong').textContent,'SCAN');
  renderAbilitySlot(button,ability,1,0,false);
  assert.equal(button.querySelector('#dash-time').textContent,'ONLINE');
  assert.equal(button.getAttribute('aria-label'),'SCAN ONLINE');
  renderAbilitySlot(button,ability,.5,1000,false);
  assert.equal(button.querySelector('#dash-fill').style.width,'75%','bar uses definition cooldownMs');
  assert.equal(button.querySelector('#dash-meter').getAttribute('aria-label'),'SCAN charge');
  assert.equal(button.disabled,true,'gameplay charge still gates activation');
  renderAbilitySlot(button,ability,0,5000,false);
  assert.equal(button.querySelector('#dash-fill').style.width,'0%');
});

test('DASH definition can display the active perk-adjusted cooldown',t=>{
  const button=setup(t),round={stats:{dashCooldownMs:2500}},ability=createDashAbility(()=>{},()=>1500);
  mountAbility(button,ability);renderAbilitySlot(button,ability,.5,750,false,round);
  assert.equal(button.querySelector('#dash-fill').style.width,'50%');
});
