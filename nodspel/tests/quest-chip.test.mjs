import test from 'node:test';import assert from 'node:assert/strict';
import '../../data/items.js';
import {readQuest,readLaunch} from '../raid-result.js';
import {questChip} from '../hud.js';
test('quest param parsing: valid forms and rejects',()=>{
  assert.deepEqual(readQuest('extract:cable:1:3'),{type:'extract',target:'cable',prog:1,n:3});
  assert.deepEqual(readQuest('kill:sentry:0:3'),{type:'kill',target:'sentry',prog:0,n:3});
  assert.deepEqual(readQuest('clear:2:0:1'),{type:'clear',target:2,prog:0,n:1});
  assert.equal(readQuest('extract:../x:1:3'),null);assert.equal(readQuest('kill:dragon:0:1'),null);assert.equal(readQuest('clear:9:0:1'),null);
  assert.equal(readQuest('extract:cable:1:0'),null);assert.equal(readQuest('extract:cable:-1:3'),null);assert.equal(readQuest(null),null);assert.equal(readQuest('x'.repeat(80)),null);
  assert.equal(readQuest('extract:cable:9:3').prog,3,'prog clamps to n');
  assert.deepEqual(readLaunch('?quest=kill%3Agrunt%3A1%3A4').quest,{type:'kill',target:'grunt',prog:1,n:4});assert.equal(readLaunch('?seed=a').quest,null);
});
test('chip ticks with carried items, kills and cleared levels',()=>{
  const q=readQuest('extract:cable:1:3');
  assert.deepEqual(questChip(q,{bag:{}}),{type:'extract',item:'cable',prog:1,n:3,done:false});
  assert.equal(questChip(q,{bag:{cable:1}}).prog,2);assert.equal(questChip(q,{bag:{cable:5}}).done,true);assert.equal(questChip(q,{bag:{cable:5}}).prog,3);
  assert.equal(questChip(readQuest('kill:sentry:0:3'),{killsByType:{sentry:2,grunt:5}}).prog,2);
  assert.equal(questChip(readQuest('clear:2:0:1'),{levelsCleared:1}).prog,0);assert.equal(questChip(readQuest('clear:2:0:1'),{levelsCleared:2}).done,true);
  assert.equal(questChip(null,{}),null);
});
