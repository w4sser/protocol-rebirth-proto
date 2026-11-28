// PR 2 (HUD diet, v2.28.79): seed/room-pips/quest-chip moved into the pause panel, #weapon-name
// is a brief toast instead of a permanent label, the depth timer/zone/pips stay a single chip
// (no duplicate #round-timer-box underneath), and the bag panel collapsed to icon + count.
// game.mjs/index.html/style.css have no exported pure functions for these -- following the
// existing convention (nodspel/tests/room-hud.test.mjs, pickup-toast.test.mjs), assert on source.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=f=>readFileSync(new URL(f,import.meta.url),'utf8');

test('weapon name is a ~2s toast, not a permanent label',()=>{
  const g=src('../game.mjs');
  assert.match(g,/function weaponToast\(\)\{const name=\$\('#weapon-name'\);if\(!name\)return;name\.hidden=false;clearTimeout\(weaponToast\.t\);weaponToast\.t=setTimeout\(\(\)=>\{name\.hidden=true;\},2000\);\}/,
    'weaponToast must hide #weapon-name again after 2000ms');
});

test('the bag panel is just the icon + count button -- no separate weight gauge bar or NEED tile row',()=>{
  const html=src('../index.html'),g=src('../game.mjs'),css=src('../style.css');
  assert.doesNotMatch(html,/id="bag-items"/,'the old bag-tiles row must be gone from the markup');
  assert.doesNotMatch(html,/class="bag-weight"/,'the old weight gauge bar must be gone from the markup');
  assert.doesNotMatch(g,/renderBagContents/,'game.mjs must no longer render a bag-tiles row');
  assert.match(g,/\$\('#open-bag'\)\?\.classList\.toggle\('heavy',carriedWeight\(round\)>=\.5\);/,
    'renderBagWeightHUD must tint the icon past half capacity instead of filling a gauge bar');
  assert.match(css,/#open-bag\.heavy\{border-color:var\(--ad-loot\);color:var\(--ad-loot\)\}/);
});

test('depth mode shows one compact timer chip: #round-timer-box is hidden while #depth-hud (zone label + pips + clock) is shown',()=>{
  const g=src('../game.mjs');
  const fn=g.slice(g.indexOf('function renderDepthHud('),g.indexOf('\n}\n',g.indexOf('function renderDepthHud(')));
  assert.match(fn,/if\(!round\.depth\)\{if\(box\)box\.hidden=true;if\(timerBox\)timerBox\.hidden=false;return;\}/);
  assert.match(fn,/if\(timerBox\)timerBox\.hidden=true;/,'the global round timer must hide once a Depth raid is active, leaving one chip');
});

test('seed/room-pips/quest-chip reminder lives inside the pause panel only',()=>{
  const html=src('../index.html');
  const settingsStart=html.indexOf('id="raid-settings"'),settingsEnd=html.indexOf('</section>',settingsStart);
  const settingsBlock=html.slice(settingsStart,settingsEnd),rest=html.slice(0,settingsStart)+html.slice(settingsEnd);
  for(const id of ['seed-label','room-pips','quest-chip']){
    assert.match(settingsBlock,new RegExp(`id="${id}"`),`#${id} must live inside #raid-settings`);
    assert.doesNotMatch(rest,new RegExp(`id="${id}"`),`#${id} must not also appear in the permanent raid HUD`);
  }
});
