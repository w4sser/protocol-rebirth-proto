import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {renderAbilitySlot} from '../abilities.js';
const require=createRequire(import.meta.url);

test('ability states keep the high contrast icon on a solid background and preserve cooldown semantics',async()=>{
  const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
  const tokens=await readFile(new URL('../../ui/tokens.css',import.meta.url),'utf8');
  const luminance=name=>{
    const hex=tokens.match(new RegExp(`--ad-${name}:(#[0-9a-f]{6})`,'i'))[1];
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  assert.ok(contrast('cyan','ink')>=4.5);assert.ok(contrast('bone','ink')>=4.5);
  const ready=css.match(/#dash\{([^}]+)\}/)[1],cooldown=css.match(/#dash:disabled\{([^}]+)\}/)[1],center=css.match(/#dash:disabled:before\{([^}]+)\}/)[1];
  assert.match(ready,/background:var\(--ad-cyan\)/);assert.match(ready,/color:var\(--ad-ink\)/);
  assert.match(cooldown,/color:var\(--ad-bone\)/);assert.match(cooldown,/conic-gradient/);assert.match(center,/background:var\(--ad-ink\)/);
  const {JSDOM}=require('../../node_modules/jsdom'),dom=new JSDOM('<button id="dash"></button>'),button=dom.window.document.querySelector('button'),ability={label:'Dash'};
  renderAbilitySlot(button,ability,1,0,false);assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-label'),'Dash ready');
  renderAbilitySlot(button,ability,.4,1500,false);assert.equal(button.disabled,true);assert.equal(button.style.getPropertyValue('--charge'),'0.4');assert.match(button.getAttribute('aria-label'),/cooldown 1.5 seconds/);
  dom.window.close();
});
