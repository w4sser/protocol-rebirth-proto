// v2.28.25 / PRB-146: mid-raid "round upgrades" (the SELECT PERK picker) are removed completely.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRound,takeDamage,hitEnemy,enterExit} from '../round.js';
import {perkState,updateClears,pickReady,hasPerk,autoPickPerks} from '../perks.js';
import {resultView} from '../result-screen.js';

const combat={projectiles:[],blasts:[]},off=()=> 'off';
const point={x:0,z:0};
const foe=(id,x=0)=>({id,kind:'enemy',type:'grunt',x,z:0,r:.48,health:1,active:true});
function arena(enemies){
  const r=createRound('noupgrades',0);
  Object.assign(r.level,{rooms:[{x:0,z:0,w:10,d:10},{x:20,z:0,w:10,d:10}],enemies,nodes:[],hazards:[],walls:[],boxes:[],start:point,floors:[{x:10,z:0,w:40,d:20}],exit:{x:0,z:0,r:1}});
  return r;
}

test('after two room clears the queue stays empty, pickReady is null, hasPerk is false, and the exit opens with no offer',()=>{
  const r=arena([foe('a',0),foe('b',20)]);
  hitEnemy(r,'a',100,1);updateClears(r,point);
  hitEnemy(r,'b',200,1);updateClears(r,{x:20,z:0});
  const s=perkState(r);
  assert.equal(s.rooms['1:0'].state,'cleared');
  assert.equal(s.rooms['1:1'].state,'cleared');
  assert.deepEqual(s.queue,[],'clearing never queues a perk offer');
  assert.equal(pickReady(r,combat,point,10000,off),null);
  assert.deepEqual(autoPickPerks(r,10000,undefined,{all:true}),[],'extract-time auto-pick is a no-op');
  for(const id of ['roll','reload','shield','medic','recon','dressing','ricochet','chain'])assert.equal(hasPerk(r,id),false);
  assert.equal(enterExit(r,point,300),'next','the exit opens straight to the next level, no mid-raid perk offer');
});

test('death cause / last-hit still renders on the death result (PRB-118 kept)',()=>{
  const r=createRound('noupgrades-death',0);
  r.equip={weapon:'basic_carbine'};
  r.lastHit={source:'Sentry',attack:'projectile'};
  r.playerMoving=true;
  takeDamage(r,10000,1000);
  assert.equal(r.reason,'death');
  const view=resultView(r,{launch:{returnUrl:'../index.html'}});
  assert.equal(view.kind,'death');
  assert.match(view.deathCause,/Last hit: Sentry projectile - you were moving/);
});

test('production game.mjs does not import or open the perk UI',()=>{
  const game=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(game,/perk-ui\.js|createPerkUI|function openPerk|perkPickDemo/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/perk-overlay|perks\.css|perk-ui/);
});
