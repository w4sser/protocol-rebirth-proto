const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const script = path.join(root, 'ui/debug-sandbox.js');
assert.ok(fs.existsSync(script), 'isolated debug storage bootstrap exists');
function browser(search, backing = new Map()) {
  class Storage {
    constructor(data = new Map()) { this.data = data; }
    get length() { return this.data.size; }
    key(i) { return [...this.data.keys()][i] ?? null; }
    getItem(k) { return this.data.get(String(k)) ?? null; }
    setItem(k, v) { this.data.set(String(k), String(v)); }
    removeItem(k) { this.data.delete(String(k)); }
    clear() { this.data.clear(); }
  }
  const ctx = {Storage, URLSearchParams, localStorage:new Storage(backing), sessionStorage:new Storage(), location:{search}};
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), ctx);
  return ctx;
}
const normal = browser('');
normal.localStorage.setItem('pr_meta_save', 'original save');
normal.localStorage.setItem('pr_slot_0_save', 'original slot');
normal.localStorage.setItem('pr_raid_result_v1', 'ordinary pending result');
normal.PR_DEBUG.seed('worlds', '{"sandbox":true}');
const backing = normal.localStorage.data;
const debug = browser('?debugMode=worlds', backing);
assert.equal(debug.localStorage.getItem('pr_meta_save'), '{"sandbox":true}');
assert.equal(debug.localStorage.getItem('pr_raid_result_v1'), null);
debug.localStorage.setItem('pr_meta_save', 'debug progress');
debug.localStorage.setItem('pr_raid_result_v1', 'debug result');
debug.localStorage.setItem('pr_slot_0_save', 'debug slot');
const reloaded = browser('?debugMode=worlds', backing);
assert.equal(reloaded.localStorage.getItem('pr_meta_save'), 'debug progress');
assert.equal(normal.localStorage.getItem('pr_meta_save'), 'original save');
assert.equal(normal.localStorage.getItem('pr_slot_0_save'), 'original slot');
assert.equal(normal.localStorage.getItem('pr_raid_result_v1'), 'ordinary pending result');
assert.equal(debug.PR_DEBUG.withMode('../'), '../?debugMode=worlds');
assert.equal(debug.PR_DEBUG.withMode('./nodspel/?seed=x'), './nodspel/?seed=x&debugMode=worlds');
assert.equal(debug.PR_DEBUG.withMode('../?debugMode=all#x'), '../?debugMode=worlds#x');
debug.localStorage.clear();
assert.equal(debug.localStorage.getItem('pr_meta_save'), null);
assert.equal(normal.localStorage.getItem('pr_meta_save'), 'original save');
assert.equal(browser('?debugMode=invalid', backing).PR_DEBUG.mode, null);
assert.equal(browser('?debugMode=all', backing).localStorage.getItem('pr_raid_result_v1'), null);

global.window = {PR_DEBUG:debug.PR_DEBUG};
for (const f of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat','quests','debug-unlocks']) require('../data/' + f + '.js');
const app = require('../app.js'), D = window.DATA;
const fresh = app.freshState(), before = JSON.stringify(fresh);
const worlds = app.prepareDebugState(JSON.parse(before));
app._setState(worlds);
assert.equal(JSON.stringify(fresh), before);
assert.ok(app.navAllowed('prep'));
assert.ok(worlds.modules[D.progression.raidPrepUnlockModule] >= 1);
assert.ok(worlds.introSeen);
for (const area of D.worldMap.areas) {
  assert.ok(app.areaUnlocked(area.id), area.id + ' unlocked');
  worlds.area = area.id;
  assert.equal(app.raidArea(), area.id);
  const url = new URL(app.coreLaunchUrl('debug-raid', 'seed', '../', {area:area.id}), 'https://example.test/');
  assert.equal(url.searchParams.get('area'), area.id);
  assert.equal(url.searchParams.get('debugMode'), 'worlds');
  assert.equal(url.searchParams.get('return'), '../?debugMode=worlds');
  assert.equal(url.searchParams.get('intro'), null);
}
assert.equal(worlds.modules.bit_bay, fresh.modules.bit_bay, 'worlds does not max unrelated rooms');
window.PR_DEBUG = browser('?debugMode=all').PR_DEBUG;
const all = app.prepareDebugState(app.freshState());
app._setState(all);
for (const m of D.modules) assert.equal(all.modules[m.id], Math.max(...m.levels.map(l=>l.level)));
for (const r of D.baseMap.rooms) assert.ok(app.roomUnlocked(r.id));
for (const r of D.recipes) assert.ok(all.unlocks.recipe[r.id]);
for (const i of D.items) if(!i.free) assert.ok(app.have(i.id) > 0, i.id + ' available');
assert.equal(app.operatorLevel().level, D.progression.operator.maxLevel);
for (const id in D.progression.playerStats.skills) assert.equal(app.skillLevel(id), D.progression.playerStats.skills[id].maxLevel);
const once = JSON.stringify(all);
assert.equal(JSON.stringify(app.prepareDebugState(all)), once, 'reload does not regrant consumed items');
window.PR_DEBUG = browser('').PR_DEBUG;
assert.equal(JSON.stringify(app.prepareDebugState(JSON.parse(before))), before, 'normal mode stays unchanged');
console.log('debug-unlocks: isolation, reload, all world launches and full progression passed');

// Exercise the actual Dev Panel actions, loader, profile UI and raid handoff in a DOM.
const {JSDOM} = require('jsdom');
function boot(mode, savedEntries = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'), {runScripts:'outside-only', url:'https://example.test/index.html' + (mode ? '?debugMode='+mode : '')});
  const w = dom.window;
  for(const [key,value] of Object.entries(savedEntries)) w.localStorage.setItem(key,value);
  w.eval(fs.readFileSync(script,'utf8'));
  w.sessionStorage.setItem('pr_splash_seen',String(Date.now()));
  const files=['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat','quests','debug-unlocks'];
  for(const f of files) w.eval(fs.readFileSync(path.join(root,'data',f+'.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'save-slots.js'),'utf8'));
  const urls=[]; w.PR_NAVIGATE=u=>urls.push(u);
  w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8')+'\nwindow.__test={state:()=>S,save,navAllowed,talentPointsAvailable,talentCanLearn};');
  return {w,urls,close:()=>w.close()};
}
const ordinaryState = JSON.parse(before); ordinaryState.introSeen=true;
let originalRaw=JSON.stringify(ordinaryState);
const originalEntries={pr_meta_save:originalRaw,pr_slot_0_save:originalRaw,pr_slots_v1:JSON.stringify({v:1,active:0,slots:[{name:'My save'},null,null]})};
const b=boot(null,originalEntries);
b.w.A.go('dev');
assert.match(b.w.document.getElementById('app').textContent,/Unlock All Worlds/);
assert.match(b.w.document.getElementById('app').textContent,/Unlock Everything/);
originalRaw=b.w.localStorage.getItem('pr_meta_save');
b.w.A.devUnlock('worlds');
assert.match(b.urls[0],/debugMode=worlds/);
b.w.dispatchEvent(new b.w.Event('beforeunload'));
assert.equal(b.w.localStorage.getItem('pr_meta_save'),originalRaw);
const seeded=Object.fromEntries(Object.keys(b.w.localStorage).map(key=>[key,b.w.localStorage.getItem(key)]));
b.close();
for(const mode of ['worlds','all']){
  const booted=boot(mode,seeded), {w,urls}=booted;
  assert.equal(w.PR_DEBUG.normalSave(),originalRaw);
  assert.ok(w.__test.navAllowed('prep'));
  if(mode==='all'){
    assert.ok(w.__test.talentPointsAvailable()>0);
    for(const branch of w.DATA.bitTalents.branches) for(const node of branch.nodes) assert.ok(w.__test.talentCanLearn(node.id),node.id+' selectable');
    for(const item of w.DATA.chipShop.items) if(item.kind==='cosmetic') assert.ok(w.__test.state().unlocks.cosmetic[item.ref]);
  }
  for(const area of w.DATA.worldMap.areas){
    w.A.setArea(area.id); w.A.go('prep'); w.A.deployNodeRaid();
    const launched=new URL(urls.at(-1),'https://example.test/');
    assert.equal(launched.searchParams.get('area'),area.id);
    assert.equal(launched.searchParams.get('intro'),null);
    assert.equal(launched.searchParams.get('ftue'),null);
    assert.equal(launched.searchParams.get('debugMode'),mode);
    assert.equal(launched.searchParams.get('return'),'../index.html?debugMode='+mode);
    assert.equal(w.PR_DEBUG.normalSave(),originalRaw);
  }
  w.A.go('base'); w.A.openProfiles();
  assert.equal(w.PR_DEBUG.normalSave(),originalRaw,'profile panel stays isolated');
  w.A.devReset();
  assert.equal(w.__test.state().debugUnlockMode,mode,'reset keeps the active debug grants');
  for(const area of w.DATA.worldMap.areas){w.A.setArea(area.id);assert.equal(w.__test.state().area,area.id);}
  assert.equal(w.PR_DEBUG.normalSave(),originalRaw,'reset never changes the normal save');
  w.A.devExitSandbox();
  assert.equal(urls.at(-1),'/index.html');
  assert.equal(w.PR_DEBUG.normalSave(),originalRaw);
  booted.close();
}
console.log('debug-unlocks: Dev Panel, actual deploy actions, talents and profile isolation passed');
