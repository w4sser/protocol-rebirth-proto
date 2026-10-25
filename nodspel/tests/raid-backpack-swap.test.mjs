// v2.0 weapon backpack (docs/design-playtest-oct25.md §c): a found weapon offers a choice — swap it in now or
// stash it in the backpack to bring home — instead of forcing a swap. Armor pickups are unaffected.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bagItems} from '../raid.js';
import {createRound,collectLoot,initEquip,swapGear,bagCapacityOf,lootAction,compareWeapons,stashWeapon,equipFromBackpack,backpackCapacityOf,extractRound,takeDamage} from '../round.js';
import {buildRaidResult} from '../raid-result.js';

const place=(r,item,id='g1')=>{const b={id,x:0,z:0,item,collected:false,revealed:true};r.level.lootBoxes=[b];return b;};
const at={x:0,z:0};

test('depleted Scout Rig entries do not occupy a backpack slot or block pickup',()=>{
  for(const count of [0,'0',null,undefined,-1]){
    const r=createRound('spent-rig',0,{bagCapacity:6});
    r.bag.cable=6;r.bag.scout_rig=count;
    assert.equal(bagItems(r.bag).length,6);
    r.bag.cable--;
    r.level.lootBoxes=[{id:'pickup',item:'fuse',x:0,z:0,collected:false}];
    assert.equal(collectLoot(r,{x:0,z:0},1),true);
    assert.equal(r.bag.fuse,1);
    assert.equal(bagItems(r.bag).length,bagCapacityOf(r));
    assert.equal(bagItems(r.bag).includes('scout_rig'),false);
  }
  assert.deepEqual(bagItems({scout_rig:1}),['scout_rig'],'usable loot still occupies its slot');
});

test('an occupied weapon slot raises a choice (weaponOffer), not the forced gearOffer armor uses',()=>{
  const r=createRound('wpn-a',0);initEquip(r,{weapon:'smg_vector'});
  const box=place(r,'rifle_marksman');
  assert.equal(lootAction(r,'rifle_marksman').text,'CHOOSE');
  assert.ok(collectLoot(r,at,10));
  assert.equal(box.collected,false,'not picked up yet — the player still has to choose');
  assert.ok(!r.gearOffer,'weapon pickups no longer use the armor-style forced offer');
  assert.deepEqual(r.weaponOffer,{boxId:'g1',item:'rifle_marksman',at:10});
  assert.equal(collectLoot(r,at,20),false,'no repeat offer while standing on it');
});

test('compareWeapons flags each stat as an improvement or a downgrade (rate: lower interval is faster)',()=>{
  const stats=compareWeapons('smg_vector','rifle_marksman');
  assert.deepEqual(Object.fromEntries(stats.map(s=>[s.key,s.improved])),{dmg:true,int:false,mag:false,rng:true});
  assert.deepEqual(compareWeapons(null,'smg_vector').map(s=>s.key),['dmg','int','mag','rng'],'no weapon equipped compares against the Basic Carbine');
});

test('SWAP equips the ground weapon now and drops the old one, same as the old forced flow',()=>{
  const r=createRound('wpn-b',0);initEquip(r,{weapon:'smg_vector'});
  place(r,'rifle_marksman');collectLoot(r,at,10);
  const d=swapGear(r,'g1',20);
  assert.equal(r.equip.weapon,'rifle_marksman');assert.equal(d.item,'smg_vector');assert.equal(d.revealed,true);assert.equal(d.blockedUntilLeft,true);
  assert.equal(r.weaponOffer,null);assert.equal(r.level.lootBoxes[0].collected,true);
});

test('BACKPACK stashes the ground weapon in its own slot instead of equipping it',()=>{
  const r=createRound('wpn-c',0);initEquip(r,{weapon:'smg_vector'});
  const box=place(r,'rifle_marksman');collectLoot(r,at,10);
  assert.deepEqual(stashWeapon(r,'g1',20),{dropped:null});
  assert.equal(r.equip.weapon,'smg_vector','equipped weapon is unchanged');
  assert.deepEqual(r.backpack,['rifle_marksman']);
  assert.equal(box.collected,true);assert.equal(r.weaponOffer,null);
});

test('a full backpack requires an explicit drop choice before it can take another weapon',()=>{
  const r=createRound('wpn-d',0);initEquip(r,{weapon:'smg_vector'});
  assert.equal(backpackCapacityOf(r),2);
  r.backpack=['shotgun_breach','rifle_marksman'];
  const box=place(r,'smg_vector','g2');
  assert.equal(stashWeapon(r,'g2',20),null,'full backpack with no drop choice fails closed');
  assert.equal(box.collected,false);
  const res=stashWeapon(r,'g2',21,0);
  assert.equal(res.dropped.item,'shotgun_breach');assert.equal(res.dropped.revealed,true);assert.equal(res.dropped.blockedUntilLeft,true);
  assert.deepEqual(r.backpack,['rifle_marksman','smg_vector']);
  assert.equal(box.collected,true);
  assert.ok(r.level.lootBoxes.some(b=>b.item==='shotgun_breach'&&!b.collected),'the dropped weapon lands on the ground');
});

test('equipping from the backpack mid-raid swaps the active slot; the old weapon moves into the backpack, not dropped',()=>{
  const r=createRound('wpn-e',0);initEquip(r,{weapon:'smg_vector'});r.backpack=['rifle_marksman','shotgun_breach'];
  const old=equipFromBackpack(r,0,10);
  assert.equal(old,'smg_vector');assert.equal(r.equip.weapon,'rifle_marksman');
  assert.deepEqual(r.backpack,['smg_vector','shotgun_breach'],'capacity-neutral swap, nothing dropped');
  assert.deepEqual(r.lastEquip,{slot:'weapon',item:'rifle_marksman',old:'smg_vector',toBackpack:true,at:10});
});

test('equipping from the backpack while unarmed (Basic Carbine) frees the backpack slot instead of storing a null entry',()=>{
  const r=createRound('wpn-f',0);r.backpack=['rifle_marksman'];
  const old=equipFromBackpack(r,0,10);
  assert.equal(old,null);assert.equal(r.equip.weapon,'rifle_marksman');assert.deepEqual(r.backpack,[]);
});

test('extraction brings the backpack home alongside equipped gear (raid->base gearOut handoff)',()=>{
  const r=createRound('wpn-g',0);initEquip(r,{weapon:'smg_vector'});r.backpack=['rifle_marksman'];
  r.levelsCleared=1;extractRound(r,10);
  const res=buildRaidResult(r,{launch:{raidId:'x',seed:'wpn-g'}});
  assert.deepEqual(res.gearOut.sort(),['rifle_marksman','smg_vector']);
});

test('death does not special-case the backpack at the round level — loss is enforced by outcome gating, same as equipped gear',()=>{
  const r=createRound('wpn-h',0);initEquip(r,{weapon:'smg_vector'});r.backpack=['rifle_marksman'];
  takeDamage(r,1000,10);
  assert.deepEqual(r.backpack,['rifle_marksman']);assert.equal(r.equip.weapon,'smg_vector');
});

// Runtime state belongs to a weapon instance, not its item id.
import {createWeapon,fireWeapon,tickWeapon} from '../weapon.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
const gameFunction=name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));};
function runtimeHarness(r){
  const context=vm.createContext({round:r,weapon:r.weaponState,createWeapon,RULES:{loadout:{ammo:30}},weaponStatsOf:id=>({id}),setupWeaponHUD(){},updateHUD(){},refreshGearLabels(){},gearToast(){},ITEM_NAMES:{}});
  vm.runInContext(gameFunction('onEquip'),context);
  return ()=>{vm.runInContext('onEquip()',context);return context.weapon;};
}

test('backpack swaps preserve ammo, reserve, reload and cooldown even for duplicate weapon ids',()=>{
  const r=createRound('runtime',0);initEquip(r,{weapon:'smg_vector'});
  const a=createWeapon(30,{id:'smg_vector'}),b=createWeapon(17,{id:'smg_vector'});
  fireWeapon(a,at,{x:0,z:-1},100);fireWeapon(b,at,{x:0,z:-1},110);
  r.weaponState=a;r.backpack=['smg_vector'];r.backpackWeaponStates=[b];
  const onEquip=runtimeHarness(r),snapshot=w=>[w.ammo,w.reserve,w.reloadAt,w.nextShotAt];
  const beforeA=snapshot(a),beforeB=snapshot(b);
  equipFromBackpack(r,0,120);assert.equal(onEquip(),b);assert.equal(r.backpackWeaponStates[0],a);
  equipFromBackpack(r,0,130);assert.equal(onEquip(),a);
  assert.equal(a.projectiles.length,0,'stashed shots must not resume when re-equipped');
  assert.equal(a.nextId,1,'weapon identity and shot sequence are retained');
  assert.deepEqual(snapshot(a),beforeA);assert.deepEqual(snapshot(b),beforeB);
  assert.equal(fireWeapon(a,at,{x:0,z:-1},131),null,'swapping cannot bypass fire cooldown');
  tickWeapon(a,beforeA[2]-1);assert.equal(a.ammo,beforeA[0],'reload does not finish early');
  tickWeapon(a,beforeA[2]);assert.equal(a.ammo,beforeA[0]+1,'original reload deadline still applies');
});

test('used weapon state survives a ground swap, stash, backpack eviction and re-equip',()=>{
  const r=createRound('ground-state',0);initEquip(r,{weapon:'smg_vector'});
  const a=createWeapon(20,{id:'smg_vector'});fireWeapon(a,at,{x:0,z:-1},10);r.weaponState=a;
  place(r,'rifle_marksman');const onEquip=runtimeHarness(r);
  const dropped=swapGear(r,'g1',20);onEquip();assert.equal(dropped.weaponState,a);
  assert.ok(stashWeapon(r,dropped.id,30));assert.equal(r.backpackWeaponStates[0],a);
  r.backpackCapacity=1;
  const incoming={id:'next',x:0,z:0,item:'shotgun_breach',collected:false};r.level.lootBoxes.push(incoming);
  const evicted=stashWeapon(r,'next',40,0).dropped;assert.equal(evicted.weaponState,a);
  swapGear(r,evicted.id,50);assert.equal(onEquip(),a);assert.equal(a.ammo,a.rule.capacity-1);
});

test('starter Carbine pickup can be compared and stashed without changing the active weapon',()=>{
  const r=createRound('starter-choice',0);initEquip(r,{weapon:'basic_carbine'});
  const a=createWeapon();r.weaponState=a;const box=place(r,'rifle_marksman');
  collectLoot(r,at,10,a);assert.equal(box.collected,false);assert.equal(r.equip.weapon,null);
  assert.equal(r.weaponOffer.item,'rifle_marksman');assert.equal(compareWeapons(null,'rifle_marksman').length,4);
  stashWeapon(r,box.id,20);assert.equal(r.weaponState,a);assert.deepEqual(r.backpack,['rifle_marksman']);
});

// Exercise the actual UI functions without requiring WebGL or a browser.
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.hidden=true;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this[name]=value;}
}
test('backpack first tap shows shared stat arrows; confirm alone equips, close cancels',()=>{
  const r=createRound('compare-ui',0);initEquip(r,{weapon:'smg_vector'});r.backpack=['rifle_marksman'];
  const viewport=new Element('div');let equips=0;
  const context=vm.createContext({round:r,resultPending:false,document:{createElement:tag=>new Element(tag)},
    $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
    ITEM_NAMES:{rifle_marksman:'Marksman'},compareWeapons,svgIcon:id=>({icon:id}),
    hideSwap:()=>{viewport.children[0].hidden=true;},equipFromBackpack,onEquip:()=>equips++,Date:{now:()=>10}});
  vm.runInContext(gameFunction('weaponCompareRow')+'\n'+gameFunction('showBackpackWeapon'),context);
  vm.runInContext('showBackpackWeapon(0)',context);
  const popup=viewport.children[0],compare=popup.children.find(e=>e.className==='weapon-compare');
  assert.equal(equips,0);assert.equal(r.equip.weapon,'smg_vector');assert.equal(popup.hidden,false);
  assert.deepEqual(compare.children.map(row=>row.children[2].children[0].icon),['chevron-up','chevron-down','chevron-down','chevron-up']);
  popup.children.find(e=>e.className==='pop-x swap-close').onclick();assert.equal(popup.hidden,true);assert.equal(equips,0);
  vm.runInContext('showBackpackWeapon(0)',context);
  popup.children.find(e=>e.className==='weapon-offer-actions').children[0].onclick();
  assert.equal(equips,1);assert.equal(r.equip.weapon,'rifle_marksman');assert.equal(popup.hidden,true);
  assert.match(source,/b\.onclick=\(\)=>showBackpackWeapon\(i\)/,'backpack tile opens comparison');
});

test('starter ground popup compares and offers backpack or equip, then initializes the chosen weapon',()=>{
  const r=createRound('starter-ui',0);initEquip(r,{weapon:'basic_carbine'});r.weaponState=createWeapon();
  const box=place(r,'rifle_marksman');collectLoot(r,at,1,r.weaponState);
  const viewport=new Element('div');const onEquip=runtimeHarness(r);
  const context=vm.createContext({round:r,document:{createElement:tag=>new Element(tag)},
    $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
    ITEM_NAMES:{rifle_marksman:'Marksman'},compareWeapons,svgIcon:id=>({icon:id}),nearWeaponOffer:()=>true,
    clearWeaponOffer:()=>{r.weaponOffer=null;viewport.children[0].hidden=true;},swapGear,onEquip,backpackCapacityOf,
    world:{addLoot:()=>assert.fail('free starter must never be dropped')},labelLoot(){},Date:{now:()=>10}});
  vm.runInContext(gameFunction('weaponCompareRow')+'\n'+gameFunction('showWeaponOffer'),context);
  vm.runInContext('showWeaponOffer()',context);
  const popup=viewport.children[0],actions=popup.children.find(e=>e.className==='weapon-offer-actions');
  assert.equal(popup.children.find(e=>e.className==='weapon-compare').children.length,4);
  assert.deepEqual(actions.children.map(e=>e.textContent),['SWAP','BACKPACK']);
  assert.equal(box.collected,false);actions.children[0].onclick();
  assert.equal(r.equip.weapon,'rifle_marksman');assert.equal(r.weaponState.id,'rifle_marksman');assert.equal(box.collected,true);
});
