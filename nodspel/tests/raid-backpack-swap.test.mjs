import {inputPaused} from '../perks.js?v=2.21.1';
// v2.0 weapon backpack (docs/design-playtest-oct25.md §c): a found weapon offers a choice — swap it in now or
// stash it in the backpack to bring home — instead of forcing a swap.
// v2.4 (Robert's playtest): armor pickups (e.g. Scout Rig) get the same PICK UP-or-SWAP choice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bagItems} from '../raid.js';
import {createRound,collectLoot,initEquip,swapGear,bagCapacityOf,lootAction,compareWeapons,stashWeapon,equipFromBackpack,backpackCapacityOf,extractRound,takeDamage,gearSlotOf,hitEnemy,carriedCount} from '../round.js';
import {buildRaidResult,readWeapon} from '../raid-result.js';

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

test('an occupied armor slot (Scout Rig) offers PICK UP alongside SWAP, not only a forced swap',()=>{
  const r=createRound('armor-a',0);initEquip(r,{gear:['scavenger_vest']});
  const box=place(r,'scout_rig');
  assert.ok(collectLoot(r,at,10));
  assert.equal(box.collected,false,'not picked up yet — the player still has to choose');
  assert.deepEqual(r.gearOffer,{boxId:'g1',item:'scout_rig',slot:'armor',at:10});
  const res=stashWeapon(r,'g1',20);
  assert.deepEqual(res,{dropped:null});
  assert.equal(r.equip.armor,'scavenger_vest','picked up, not equipped: armor slot unchanged');
  assert.deepEqual(r.backpack,['scout_rig']);
  assert.equal(box.collected,true);assert.equal(r.gearOffer,null,'stashing also clears the gear offer');
});
test('SWAP still works for armor exactly as before',()=>{
  const r=createRound('armor-swap',0);initEquip(r,{gear:['scavenger_vest']});
  place(r,'scout_rig');collectLoot(r,at,10);
  const d=swapGear(r,'g1',20);
  assert.equal(r.equip.armor,'scout_rig');assert.equal(d.item,'scavenger_vest');assert.equal(d.revealed,true);
});
test('a full backpack blocks picking up armor the same as it blocks weapons (shared carry slots)',()=>{
  const r=createRound('armor-full',0);initEquip(r,{gear:['scavenger_vest']});
  r.backpack=['shotgun_breach','rifle_marksman'];
  const box=place(r,'scout_rig');
  assert.equal(stashWeapon(r,'g1',20),null,'full backpack with no drop choice fails closed');
  assert.equal(box.collected,false);
});
test('equipping armor from the backpack mid-raid swaps the active slot and applies its stats',()=>{
  const r=createRound('armor-equip',0);initEquip(r,{gear:['scavenger_vest']});r.backpack=['scout_rig'];
  const beforeSpeed=r.stats.speed;
  const old=equipFromBackpack(r,0,10);
  assert.equal(old,'scavenger_vest');assert.equal(r.equip.armor,'scout_rig');
  assert.deepEqual(r.backpack,['scavenger_vest'],'the gear it replaces goes back into the backpack, not dropped');
  assert.equal(r.stats.speed,beforeSpeed+.45,'Scout Rig stats applied, same as a direct swap');
  assert.deepEqual(r.lastEquip,{slot:'armor',item:'scout_rig',old:'scavenger_vest',toBackpack:true,at:10});
});
test('death loses equipped gear and backpack items alike; only a win reports them as gearOut',()=>{
  const r=createRound('loss-gear',0);initEquip(r,{weapon:'smg_vector',gear:['scavenger_vest']});r.backpack=['rifle_marksman'];
  takeDamage(r,1000,10);
  const res=buildRaidResult(r,{launch:{raidId:'x',seed:'loss-gear'}});
  assert.equal(res.outcome,'death');assert.deepEqual(res.gearOut,[],'equipped gear and the backpack are both lost on death');
});
test('extraction still reports equipped gear and the backpack as gearOut on a win',()=>{
  const r=createRound('win-gear',0);initEquip(r,{weapon:'smg_vector',gear:['scavenger_vest']});r.backpack=['rifle_marksman'];
  r.levelsCleared=1;extractRound(r,10);
  const res=buildRaidResult(r,{launch:{raidId:'x',seed:'win-gear'}});
  assert.equal(res.outcome,'extract');assert.deepEqual(res.gearOut.sort(),['rifle_marksman','scavenger_vest','smg_vector']);
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
import {gearItem} from '../round.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
const gameFunction=name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));};
function runtimeHarness(r){
  const context=vm.createContext({inputPaused,round:r,weapon:r.weaponState,createWeapon,RULES:{loadout:{ammo:30}},weaponStatsOf:id=>({id}),setupWeaponHUD(){},updateHUD(){},refreshGearLabels(){},gearToast(){},ITEM_NAMES:{}});
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
  const context=vm.createContext({inputPaused,round:r,resultPending:false,document:{createElement:tag=>new Element(tag)},
    $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
    ITEM_NAMES:{rifle_marksman:'Marksman'},compareWeapons,svgIcon:id=>({icon:id}),gearSlotOf,
    hideSwap:()=>{viewport.children[0].hidden=true;},equipFromBackpack,onEquip:()=>equips++,gameClock:()=>10,Date:{now:()=>10}});
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

test('gear-found popup offers SWAP and PICK UP; PICK UP picks it up without equipping',()=>{
  const r=createRound('gear-ui',0);initEquip(r,{gear:['scavenger_vest']});
  const box=place(r,'scout_rig');r.gearOffer={boxId:'g1',item:'scout_rig',slot:'armor',at:1};
  const viewport=new Element('div');
  const context=vm.createContext({inputPaused,round:r,document:{createElement:tag=>new Element(tag)},
    $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
    ITEM_NAMES:{scout_rig:'Scout Rig'},svgIcon:id=>({icon:id}),nearOffer:()=>true,
    clearGearOffer:()=>{r.gearOffer=null;viewport.children[0].hidden=true;},swapGear,onEquip(){},
    stashWeapon,gearToast(){},updateHUD(){},bagItems,bagCapacityOf,backpackCapacityOf,carriedCount,
    showBackpackFullChoice(){assert.fail('backpack has room: the full-choice flow must not open');},
    gameClock:()=>5,Date:{now:()=>5}});
  vm.runInContext(gameFunction('appendPickupButton')+'\n'+gameFunction('showGearOffer'),context);
  vm.runInContext('showGearOffer()',context);
  const popup=viewport.children[0],actions=popup.children.find(e=>e.className==='weapon-offer-actions');
  assert.deepEqual(actions.children.map(e=>e.textContent),['SWAP','PICK UP']);
  assert.equal(box.collected,false);
  actions.children[1].onclick(); // PICK UP
  assert.equal(r.equip.armor,'scavenger_vest','picked up, not equipped');
  assert.deepEqual(r.backpack,['scout_rig']);assert.equal(box.collected,true);assert.equal(popup.hidden,true);
});
test('gear-found popup hides PICK UP entirely once the material bag is full',()=>{
  const r=createRound('gear-ui-full',0);initEquip(r,{gear:['scavenger_vest']});r.bag.cable=bagCapacityOf(r);
  place(r,'scout_rig');r.gearOffer={boxId:'g1',item:'scout_rig',slot:'armor',at:1};
  const viewport=new Element('div');
  const context=vm.createContext({inputPaused,round:r,document:{createElement:tag=>new Element(tag)},
    $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
    ITEM_NAMES:{scout_rig:'Scout Rig'},svgIcon:id=>({icon:id}),nearOffer:()=>true,
    clearGearOffer(){},swapGear,onEquip(){},stashWeapon,gearToast(){},updateHUD(){},bagItems,bagCapacityOf,backpackCapacityOf,carriedCount,
    gameClock:()=>5,Date:{now:()=>5}});
  vm.runInContext(gameFunction('appendPickupButton')+'\n'+gameFunction('showGearOffer'),context);
  vm.runInContext('showGearOffer()',context);
  const popup=viewport.children[0],actions=popup.children.find(e=>e.className==='weapon-offer-actions');
  assert.deepEqual(actions.children.map(e=>e.textContent),['SWAP'],'bag full -> only swap/leave');
});

test('starter ground popup compares and offers backpack or equip, then initializes the chosen weapon',()=>{
  const r=createRound('starter-ui',0);initEquip(r,{weapon:'basic_carbine'});r.weaponState=createWeapon();
  const box=place(r,'rifle_marksman');collectLoot(r,at,1,r.weaponState);
  const viewport=new Element('div');const onEquip=runtimeHarness(r);
  const context=vm.createContext({inputPaused,round:r,document:{createElement:tag=>new Element(tag)},
    $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
    ITEM_NAMES:{rifle_marksman:'Marksman'},compareWeapons,svgIcon:id=>({icon:id}),nearWeaponOffer:()=>true,
    clearWeaponOffer:()=>{r.weaponOffer=null;viewport.children[0].hidden=true;},swapGear,onEquip,backpackCapacityOf,bagItems,bagCapacityOf,carriedCount,
    world:{addLoot:()=>assert.fail('free starter must never be dropped')},labelLoot(){},gameClock:()=>10,Date:{now:()=>10}});
  vm.runInContext(gameFunction('weaponCompareRow')+'\n'+gameFunction('appendPickupButton')+'\n'+gameFunction('showWeaponOffer'),context);
  vm.runInContext('showWeaponOffer()',context);
  const popup=viewport.children[0],actions=popup.children.find(e=>e.className==='weapon-offer-actions');
  assert.equal(popup.children.find(e=>e.className==='weapon-compare').children.length,4);
  assert.deepEqual(actions.children.map(e=>e.textContent),['SWAP','PICK UP']);
  assert.equal(box.collected,false);actions.children[0].onclick();
  assert.equal(r.equip.weapon,'rifle_marksman');assert.equal(r.weaponState.id,'rifle_marksman');assert.equal(box.collected,true);
});

const compareKeys={dmg:'damage',int:'shotIntervalMs',mag:'capacity',rng:'range'};
const stockWeapon=id=>createWeapon(30,readWeapon(`id:${id},`+Object.entries(gearItem(id).weapon).map(([k,v])=>`${k}:${v}`).join(',')));
test('comparison uses each runtime instance, including duplicate ids, without changing weapon state',()=>{
  const equipped=createWeapon(30,readWeapon('id:smg_vector,dmg:3,int:90,mag:12,rng:10'));
  const carried=createWeapon(20,readWeapon('id:smg_vector,dmg:2,int:100,mag:10,rng:9'));
  fireWeapon(equipped,at,{x:0,z:-1},100);
  const before=JSON.stringify([equipped,carried]);
  const rows=compareWeapons('smg_vector','smg_vector',equipped,carried);
  for(const row of rows){
    assert.equal(row.from,equipped.rule[compareKeys[row.key]]);
    assert.equal(row.to,carried.rule[compareKeys[row.key]]);
    assert.equal(row.improved,false,'carried gun is weaker despite identical stock ids');
  }
  assert.equal(JSON.stringify([equipped,carried]),before,'compare must not affect ammo, reload or upgrades');
  for(const id of ['smg_vector','rifle_marksman','shotgun_breach']){
    const actual=stockWeapon(id);
    for(const row of compareWeapons('smg_vector',id,equipped)){
      assert.equal(row.from,equipped.rule[compareKeys[row.key]]);
      assert.equal(row.to,actual.rule[compareKeys[row.key]],'fresh candidate matches its equip-time stats');
    }
  }
  const basic=createWeapon(30,{damage:4,capacity:7,range:12,shotIntervalMs:100});
  assert.equal(compareWeapons(null,'smg_vector',basic)[0].from,4,'starter runtime also overrides stock');
});

test('backpack and ground popups compare the selected instance against the upgraded equipped gun',()=>{
  for(const kind of ['backpack','ground'])for(const modified of [false,true]){
    const r=createRound('runtime-compare-ui',0);initEquip(r,{weapon:'smg_vector'});
    r.weaponState=createWeapon(30,{id:'smg_vector',damage:4,shotIntervalMs:90,capacity:12,range:12});
    const candidate=modified?createWeapon(20,{id:'smg_vector',damage:3,shotIntervalMs:100,capacity:10,range:10}):null;
    // Duplicate ids must resolve the requested slot/box, not another instance of that item.
    r.backpack=['smg_vector','smg_vector'];r.backpackWeaponStates=[r.weaponState,candidate];
    r.level.lootBoxes=[{id:'other',item:'smg_vector',weaponState:r.weaponState},{id:'chosen',item:'smg_vector',weaponState:candidate}];
    r.weaponOffer={boxId:'chosen',item:'smg_vector'};
    const viewport=new Element('div');
    const context=vm.createContext({inputPaused,round:r,resultPending:false,document:{createElement:tag=>new Element(tag)},
      $:selector=>selector==='#viewport'?viewport:viewport.children.find(e=>e.id===selector.slice(1)),
      ITEM_NAMES:{smg_vector:'Vector'},compareWeapons,svgIcon:id=>({icon:id}),hideSwap(){},nearWeaponOffer:()=>true,backpackCapacityOf,gearSlotOf,bagItems,bagCapacityOf,carriedCount,clearWeaponOffer(){}});
    vm.runInContext(gameFunction('weaponCompareRow')+'\n'+gameFunction('appendPickupButton')+'\n'+gameFunction(kind==='backpack'?'showBackpackWeapon':'showWeaponOffer'),context);
    vm.runInContext(kind==='backpack'?'showBackpackWeapon(1)':'showWeaponOffer()',context);
    const rows=viewport.children[0].children.find(e=>e.className==='weapon-compare').children;
    const expected=candidate??stockWeapon('smg_vector');
    for(const [i,key] of Object.values(compareKeys).entries()){
      assert.equal(rows[i].children[1].textContent,r.weaponState.rule[key],`${kind} current ${key}`);
      assert.equal(rows[i].children[3].textContent,expected.rule[key],`${kind} candidate ${key}`);
      assert.equal(rows[i].dataset.improved,'false');
    }
  }
});

test('backpack row and weapon buttons accept pointer input while the bag panel stays passthrough',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const declarations=selector=>[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([,selectors])=>selectors.trim()===selector).map(([, ,body])=>body).join(';');
  for(const selector of ['.backpack-row','.backpack-tiles button.item-tile']){
    assert.match(declarations(selector),/pointer-events\s*:\s*auto\b/,selector);
  }
  assert.match(declarations('.bag-panel'),/pointer-events\s*:\s*none\b/);
  assert.doesNotMatch(declarations('.bag-panel'),/pointer-events\s*:\s*auto\b/);
});

// v2.4: each physical rig retains its remaining shield across every carry path.
test('spent Scout Rig is consumed immediately and never returned on extraction',()=>{
  const r=createRound('spent-rig',0,{shield:10,bagCapacity:5,speed:4.05});
  initEquip(r,{gear:['scout_rig']});
  takeDamage(r,10,10);
  assert.equal(r.health,100);assert.equal(r.shield,0);assert.equal(r.equip.armor,null);
  assert.equal(r.maxShield,0);assert.deepEqual(r.gearConsumed,['scout_rig']);
  r.levelsCleared=1;extractRound(r,20);
  assert(!buildRaidResult(r).gearOut.includes('scout_rig'));
});
test('partly spent armor keeps durability across backpack equips and ground swaps',()=>{
  const r=createRound('rig-instance',0,{shield:25});initEquip(r,{gear:['scavenger_vest']});
  takeDamage(r,20,1);assert.equal(r.shield,5);
  r.backpack=['scout_rig'];equipFromBackpack(r,0,2);assert.equal(r.shield,10);
  equipFromBackpack(r,0,3);assert.equal(r.shield,5,'same vest does not renew');
  place(r,'scout_rig');const dropped=swapGear(r,'g1',4);assert.equal(dropped.armorState.shield,5);
  assert.equal(stashWeapon(r,dropped.id,5).dropped,null);equipFromBackpack(r,1,6);
  assert.equal(r.shield,5,'picking the old vest back up does not renew it');
  takeDamage(r,5,7);assert.equal(r.equip.armor,null,'last durability consumes that instance');
  assert(!r.backpack.includes('scavenger_vest'));
});
test('material bag full blocks direct gear pickup as well as the UI choice',()=>{
  const r=createRound('bag-full-api',0);r.bag.cable=bagCapacityOf(r);const b=place(r,'scout_rig');
  assert.equal(stashWeapon(r,b.id,1),null);assert.equal(b.collected,false);
});
test('attacking an inactive defender wakes it, while queued swarm bodies remain locked',()=>{
  const r=createRound('wake-defender',0);const defender={id:'d',kind:'enemy',health:3,x:2,z:0,r:.48,active:false};
  r.level.enemies=[defender];assert.equal(hitEnemy(r,'d',1),true);
  assert.equal(defender.active,true);assert.equal(defender.aggro,true);
  const swarm={...defender,id:'s',active:false,swarm:'nest'};r.level.enemies=[swarm];
  assert.equal(hitEnemy(r,'s',2),false);assert.equal(swarm.active,false);
});

test('upgraded rig durability is distinct from bonus shield and survives until fully spent',()=>{
  const r=createRound('upgraded-rig',0,{shield:60});initEquip(r,{gear:['scavenger_vest'],armorShield:50});
  takeDamage(r,25,1);assert.equal(r.equip.armor,'scavenger_vest');assert.equal(r.armorState.shield,25);
  takeDamage(r,25,2);assert.equal(r.equip.armor,null);
  assert.equal(r.shield,10,'non-armor shield is preserved');assert.equal(r.maxShield,10);
});
// v2.4 fix: a zero-base-shield piece (Dampener Cloak has no `stats.shield` of its own) can still carry a
// durable, upgrade-granted shield instance — it must consume and get discarded exactly like any other rig.
test('a zero-base-shield armor piece (Dampener Cloak) still tracks and spends its upgrade-granted shield',()=>{
  const r=createRound('cloak-upgrade',0,{shield:16});
  initEquip(r,{gear:['dampener_cloak'],armorShield:16});
  assert.ok(r.armorState,'the supplied armorShield must be tracked even though the gear has no nominal shield');
  assert.equal(r.armorState.maxShield,16);
  takeDamage(r,16,10);
  assert.equal(r.equip.armor,null,'the spent cloak is consumed, not left equipped with a phantom shield');
  assert.deepEqual(r.gearConsumed,['dampener_cloak']);
  r.levelsCleared=1;extractRound(r,20);
  assert(!buildRaidResult(r).gearOut.includes('dampener_cloak'),'a spent zero-base-shield rig must not come home for a fresh shield next raid');
});
test('re-equipping a zero-base-shield piece from the backpack keeps its carried shield instance (not the gate on nominal shield)',()=>{
  const r=createRound('cloak-backpack',0,{shield:16});initEquip(r,{gear:['scavenger_vest']});
  takeDamage(r,20,1);assert.equal(r.equip.armor,null,'scavenger vest (25 shield) spent down to 0 and consumed');
  r.backpack=['dampener_cloak'];r.backpackArmorStates=[{shield:9,maxShield:16}];
  equipFromBackpack(r,0,2);
  assert.ok(r.armorState,'incoming carried shield must survive even though Dampener Cloak has zero nominal shield');
  assert.equal(r.armorState.shield,9);assert.equal(r.armorState.maxShield,16);
});
// v2.4 fix: unequipped gear/weapons carried in the backpack share the bag's capacity with materials —
// a 4-slot bag holding 3 materials plus a stashed Scout Rig is full, not 3/4 with room for a 5th item.
test('carried-but-unequipped gear counts toward the shared bag capacity',()=>{
  const r=createRound('shared-cap',0,{bagCapacity:4});r.bag.cable=3;
  const box=place(r,'scout_rig');
  assert.equal(carriedCount(r),3);
  assert.ok(stashWeapon(r,box.id,1),'bag has room: 3 materials + 1 backpack slot fits in a 4-slot bag');
  assert.deepEqual(r.backpack,['scout_rig']);assert.equal(carriedCount(r),4);
  r.level.lootBoxes=[{id:'fuse-box',item:'fuse',x:0,z:0,collected:false}];
  collectLoot(r,at,2);
  assert.equal(r.bag.fuse,0,'bag is already full once the backpack item is counted — the pickup is rejected');
  assert.ok(r.bagFull,'a full-bag notice fires instead of silently accepting a 5th item');
  assert.equal(r.level.lootBoxes[0].collected,false);
});
