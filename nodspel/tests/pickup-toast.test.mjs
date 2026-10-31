import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {pushPickup,liveToasts,TOAST_MAX,TOAST_MS} from '../pickup-toast.js?v=2.18.0';
import {createRound,collectLoot} from '../round.js?v=2.18.0';
import {rarityOf,RARITY_COLORS} from '../rarity.js?v=2.18.0';
const src=f=>readFileSync(new URL(f,import.meta.url),'utf8');

test('bag pickups are recorded for the toast; gear and full-bag skips are not',()=>{
  const r=createRound('toast-1',0);r.level.lootBoxes=[{id:'a',x:0,z:0,item:'cable',collected:false}];
  collectLoot(r,{x:0,z:0},500);assert.deepEqual(r.lastBagPickup,{item:'cable',at:500});
  const g=createRound('toast-2',0);g.level.lootBoxes=[{id:'g',x:0,z:0,item:'scavenger_vest',collected:false}];
  collectLoot(g,{x:0,z:0},700);assert.equal(g.lastBagPickup,undefined,'equipment goes to its slot, not the bag');
});
test('at most 3 toasts are visible and the oldest drops first',()=>{
  let l=[];for(const [i,item] of ['cable','fuse','servo','ai_fragment'].entries())l=pushPickup(l,item,1000+i*100);
  assert.equal(TOAST_MAX,3);assert.equal(l.length,3);assert.deepEqual(l.map(t=>t.item),['fuse','servo','ai_fragment']);
});
test('toasts fade after ~1.8 s and the same item merges into one count',()=>{
  assert.equal(TOAST_MS,1800);
  let l=pushPickup([],'cable',0);l=pushPickup(l,'cable',400);assert.equal(l.length,1);assert.equal(l[0].n,2);assert.equal(l[0].at,400);
  l=pushPickup(l,'fuse',500);assert.equal(liveToasts(l,2100).length,2,'cable refreshed at 400, still live at 2100');
  assert.equal(liveToasts(l,2350).length,0);
  l=pushPickup(l,'servo',2400);assert.deepEqual(l.map(t=>t.item),['servo'],'expired toasts are pruned on the next push');
});
test('toast rarity colour comes from rarity.js; ids are unique so each toast stacks',()=>{
  const l=pushPickup(pushPickup([],'cable',0),'ai_fragment',10);assert.notEqual(l[0].id,l[1].id);
  for(const t of l)assert(RARITY_COLORS[rarityOf(t.item)]);assert.notEqual(RARITY_COLORS[rarityOf('cable')],RARITY_COLORS[rarityOf('ai_fragment')]);
});
test('toast container wiring: under the bag panel, rarity colour, tokens only, reduced motion respected',()=>{
  const g=src('../game.mjs'),css=src('../style.css');
  assert(/pickupToast\(round\.lastBagPickup\.item\)/.test(g),'loot loop fires the toast');
  assert(/bp\.offsetTop\+bp\.offsetHeight/.test(g),'positioned below the bag panel');
  assert(/RARITY_COLORS\[rarityOf\(t\.item\)\]/.test(g));
  const blk=css.slice(css.indexOf('/* v1.76 icon-based raid HUD'));
  assert(!/#[0-9a-fA-F]{3,8}\b/.test(blk),'new HUD css uses tokens, no raw colours');
  assert(/prefers-reduced-motion[^}]*pickup-toast\{animation:none/.test(blk));
});

test('pickup toasts are HUD rects for world-label collision avoidance',()=>{
  assert.match(src('../game.mjs').match(/const HUD_SELECTORS='([^']*)'/)[1],/\.pickup-toast\b/);
});
test('debug seed label stays inside the safe area',()=>{
  assert.match(src('../style.css'),/#seed-label\{[^}]*max-width:calc\(100vw - var\(--sl\) - var\(--sr\)/);
});
