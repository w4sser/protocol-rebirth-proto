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
import {perkState,updateClears,pickReady,hasPerk} from '../perks.js';
for(const big of [false,true])test(`archipelago selects its environment in ${big?'big':'standard'} levels`,()=>{
 const l=generateLevel(1,'arch-selection','archipelago',false,big);
 assert.equal(l.area,'archipelago');assert.equal(l.archipelago,true);
 const scene=new THREE.Scene(),world=buildWorld(l,scene,{quality:'low'});
 try{assert.ok(scene.getObjectByName('water'),'renderer builds the Archipelago environment');}finally{world.dispose();}
});
// Round upgrades removed (v2.28.25, PRB-146): clearing rooms never queues a perk offer, pickReady never
// opens the picker, and hasPerk stays false for an ordinary raid -- regardless of how many rooms clear.
test('clearing every room in a raid never queues a perk offer, and hasPerk stays false',()=>{
 const r=createRound('frequency',0);r.level.rooms=Array.from({length:4},(_,i)=>({x:i*20,z:0,w:10,d:10}));
 r.level.enemies=r.level.rooms.map((p,i)=>({...p,id:String(i),health:0,type:'grunt',active:true,diedAt:0}));r.level.hazards=[];
 for(let i=0;i<4;i++){updateClears(r,r.level.rooms[i]);assert.deepEqual(perkState(r).queue,[]);}
 assert.equal(perkState(r).rooms['1:0'].state,'cleared');
 const p=r.level.rooms[1],combat={projectiles:[],blasts:[]};
 assert.equal(pickReady(r,combat,p,0,()=> 'off'),null);
 assert.equal(pickReady(r,combat,p,10001,()=> 'off',false),null);
 for(const id of ['roll','reload','shield','medic','recon','dressing','ricochet','chain'])assert.equal(hasPerk(r,id),false);
});
test('minimap and legend mount only within pause menu',()=>{
 const source=readFileSync(new URL('../big-level-runtime.js',import.meta.url),'utf8');
 assert.match(source,/#pause-map/);assert.doesNotMatch(source,/querySelector\('#game'\)/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/id="raid-settings"[\s\S]*id="pause-map"/);
});

test('game.mjs no longer opens a perk picker (v2.28.25 / PRB-146)',()=>{
 const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/createPerkUI|function openPerk|perkPickDemo/);
 assert.doesNotMatch(source,/perk-ui\.js/);
});
