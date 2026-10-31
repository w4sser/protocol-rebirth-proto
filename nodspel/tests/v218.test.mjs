import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {liveToasts} from '../pickup-toast.js';
import {generateLevel} from '../levels.js';
import {buildWorld} from '../world.js';
import * as THREE from '../vendor/three.module.js';
import {createRound} from '../round.js';
import {perkState,updateClears,pickReady} from '../perks.js';
for(const big of [false,true])test(`archipelago selects its environment in ${big?'big':'standard'} levels`,()=>{
 const l=generateLevel(1,'arch-selection','archipelago',false,big);
 assert.equal(l.area,'archipelago');assert.equal(l.archipelago,true);
 const scene=new THREE.Scene(),world=buildWorld(l,scene,{quality:'low'});
 try{assert.ok(scene.getObjectByName('water'),'renderer builds the Archipelago environment');}finally{world.dispose();}
});
test('field upgrades arrive every second cleared room and wait for loot readout',()=>{
 const r=createRound('frequency',0);r.level.rooms=Array.from({length:4},(_,i)=>({x:i*20,z:0,w:10,d:10}));
 r.level.enemies=r.level.rooms.map((p,i)=>({...p,id:String(i),health:0,type:'grunt',active:true,diedAt:0}));r.level.hazards=[];
 for(let i=0;i<4;i++){updateClears(r,r.level.rooms[i]);assert.equal(perkState(r).queue.length,Math.floor((i+1)/2));}
 const p=r.level.rooms[1],combat={projectiles:[],blasts:[]};
 pickReady(r,combat,p,0,()=> 'off');
 assert.equal(pickReady(r,combat,p,10000,()=> 'off',true),null);
 assert.equal(perkState(r).queue[0],'1:1');
 assert.equal(pickReady(r,combat,p,10001,()=> 'off',false),'1:1');
});
test('minimap and legend mount only within pause menu',()=>{
 const source=readFileSync(new URL('../big-level-runtime.js',import.meta.url),'utf8');
 assert.match(source,/#pause-map/);assert.doesNotMatch(source,/querySelector\('#game'\)/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/id="raid-settings"[\s\S]*id="pause-map"/);
});

test('production perk gate waits for pickup DOM, toasts and loot comparisons to disappear',()=>{
 const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function lootReadoutVisible('),end=source.indexOf('function act(',start);
 const dom=new JSDOM('<div id="swap-row" hidden></div><div id="goal-pickup" hidden></div><div class="pickup-toast" hidden></div>');
 const context=vm.createContext({document:dom.window.document,liveToasts,pickupToasts:[],gameClock:()=>10000,
  round:{over:false},perkChoosing:false,lootReadoutVisible:null});
 vm.runInContext(source.slice(start,end),context);
 for(const el of dom.window.document.querySelectorAll('div')){
  el.getClientRects=()=>el.hidden?[]:[{}];el.hidden=false;
  assert.equal(context.lootReadoutVisible(),true);
  assert.doesNotThrow(()=>context.openPerk('1:0'),'offer stays queued before any UI or pause call');
  el.hidden=true;
 }
 assert.equal(context.lootReadoutVisible(),false);dom.window.close();
});
