import test from 'node:test';
import assert from 'node:assert/strict';
import {swapItemStatus,suggestSwap} from '../swap-guidance.js';

const goal={name:'Fabricator',parts:[{id:'cable',need:2,secured:0}]};
test('carried goal supplies are protected before rarity; incoming gets the same purpose information',()=>{
  const bag={cable:2,data_core:1};
  assert.equal(swapItemStatus(goal,bag,'cable'),'NEEDED NOW');
  assert.equal(swapItemStatus(goal,bag,'data_core'),'OTHER USE');
  assert.equal(suggestSwap(goal,bag,'ai_fragment'),'data_core');
  assert.equal(swapItemStatus(goal,{cable:1},'cable',true),'NEEDED NOW');
  assert.equal(swapItemStatus(goal,bag,'cable',true),'TARGET MET');
});
test('surplus units and home stock count; suggestion never proposes exchanging the same item',()=>{
  const bag={cable:3,data_core:1};
  assert.equal(swapItemStatus(goal,bag,'cable'),'TARGET MET');
  assert.equal(suggestSwap(goal,bag,'ai_fragment'),'cable');
  assert.equal(swapItemStatus({...goal,parts:[{id:'cable',need:2,secured:2}]},{cable:1},'cable'),'TARGET MET');
  assert.equal(suggestSwap(goal,{cable:2},'cable'),null);
});
test('salvage currencies are included, and gains never erase loss of a different required resource',()=>{
  const salvage=globalThis.DATA.items.find(i=>i.grantsCurrency?.scrap);
  assert(salvage);
  const g={parts:[{id:'scrap',kind:'currency',need:salvage.grantsCurrency.scrap,secured:0},{id:'cable',need:2,secured:0}]};
  const bag={[salvage.id]:1,cable:1,data_core:1};
  assert.equal(swapItemStatus(g,bag,salvage.id),'NEEDED NOW');
  assert.equal(suggestSwap(g,bag,'cable'),'data_core');
});
test('standalone raids use rarity, handle empty bags, and do not invent a tracked goal',()=>{
  assert.equal(swapItemStatus(null,{cable:1},'cable'),null);
  assert.equal(suggestSwap(null,{cable:1,data_core:1},'ai_fragment'),'cable');
  assert.equal(suggestSwap(null,{},'ai_fragment'),null);
});
