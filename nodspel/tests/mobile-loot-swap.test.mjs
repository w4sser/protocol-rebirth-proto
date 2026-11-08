import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const start=game.indexOf('function showSwap()');
const end=game.indexOf('// Kit slot full:',start);
const swap=game.slice(start,end);

test('bag-full dialog keeps decision open and preserves manual choices',()=>{
  assert(start>0&&end>start);
  assert.match(swap,/swapRecommendation\(launch\.goal,round\.bag,info\.item\)/);
  assert.match(swap,/CHOOSE OTHER/);
  assert.match(swap,/SWAP ANYWAY/);
  assert.match(swap,/KEEP LOOT/);
  assert.match(swap,/function showSwap\(/);
  assert.doesNotMatch(swap,/setTimeout\(hideSwap/,'the choice cannot disappear after a fixed timeout');
  assert.match(swap,/if\(stale\(\)\|\|!round\.bag\[dropId\]\)/,'stale trades fail closed');
});

test('mobile swap dialog fits a short safe-area viewport',()=>{
  assert.match(css,/#viewport \.swap-row\[data-kind=bag\]\{/);
  assert.match(css,/max-height:calc\(100% - 80px\)/);
  assert.match(css,/\.swap-choice-list\{[^}]*overflow-y:auto/);
  assert.match(css,/\.swap-actions \.swap-action\{[^}]*min-height:44px/);
  assert.match(css,/@media \(max-height:400px\)/);
});
