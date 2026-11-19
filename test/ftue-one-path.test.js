const {JSDOM}=require('jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
const root=__dirname+'/..';
const files=['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','quests','progression','combat'];
function boot(seed){
  const w=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost/'}).window;
  if(seed)w.localStorage.setItem('pr_meta_save',JSON.stringify(seed));
  w.URL.createObjectURL=()=> 'blob:test';w.PR_NAVIGATE=()=>{};
  const scenes=[],cards=[];
  w.PRBitCutscene={preload:b=>Promise.resolve([b.from,b.to]),play:b=>scenes.push(b),release(){},isOpen:()=>false};
  w.PRBitCard={show:b=>cards.push(b),dismiss(){},isOpen:()=>false};
  for(const f of files)w.eval(fs.readFileSync(root+'/data/'+f+'.js','utf8'));
  w.eval(fs.readFileSync(root+'/app.js','utf8')+';window.T={state:()=>S,session,questsOpen,chainAvailable,trackedQuest,trackedGoalHtml,showHomecomingSummary,migrateBitCardsSeen,MODS,PROG,save};');
  w.A.startFtueDirect=()=>{};
  return {w,s:w.T.state(),scenes,cards};
}
const {w,s,scenes,cards}=boot();
s.raids=1;s.introSeen=false;
const extracted={ok:true,raid:{ftue:true,outcome:'extract',extracted:[],lost:[]},added:[],currency:{}};
w.T.session.pendingHomecomingSummary=extracted;
// Raid ingestion is covered by the browser walk. Fund only the named recipe here.
function fund(id){const cost=w.T.MODS[id].levels[0].cost;for(const [k,n]of Object.entries(cost.items||{}))s.stash[k]=n;for(const k of ['scrap','dataCores'])if(cost[k])s.cur[k]=cost[k];}
fund('rebirth_core');w.A.dismissIntro();
assert.equal(s.modules.rebirth_core,1,'wake proceeds straight to Core build');
assert.equal(scenes.at(-1).id,'core_restored');
assert.equal(w.document.querySelector('#overlay'),null,'no extraction choice');
assert.equal(cards.length,0,'Fabricator card waits for Core scene');
scenes.at(-1).onDone();
assert.equal(cards.at(-1).id,'raid_briefing');assert.match(cards.at(-1).text,/raid/i);
cards.at(-1).onDone();
assert.equal(w.T.trackedQuest(),null);assert.equal(w.T.questsOpen(),false);
s.beat=w.T.PROG.beats.findIndex(b=>b.id==='raid_1')+1;s.raids++;
fund('fabricator');w.T.showHomecomingSummary({...extracted,raid:{...extracted.raid,ftue:false}});
const actions=w.document.querySelectorAll('#overlay button');assert.equal(actions.length,1);assert.match(actions[0].textContent,/BUILD FABRICATOR/);
w.A.build('fabricator');assert.equal(scenes.at(-1).id,'fabricator_built');
assert.equal(w.document.querySelector('#overlay'),null,'reward waits for cutscene');
assert.equal(w.T.trackedGoalHtml(),'');assert.equal(w.T.chainAvailable('bunker'),false);
scenes.at(-1).onDone();assert.match(w.document.querySelector('#overlay').textContent,/ROOM ONLINE/);
w.document.querySelector('#overlay [data-close]').click();
assert.equal(cards.at(-1).id,'vault_intro');assert.equal(scenes.filter(b=>b.id==='vault_intro').length,0,'Vault introduced in base');
cards.at(-1).onDone();fund('storage');w.A.go('base');
assert.match(w.document.querySelector('.progress-goal').textContent,/BUILD VAULT/i);
w.A.build('storage');assert.equal(scenes.at(-1).id,'vault_unlocked');
assert.equal(w.T.trackedQuest(),null,'no quests during Vault scene');
scenes.at(-1).onDone();assert.equal(scenes.filter(b=>b.id==='quest_intro').length,0,'no quest intro on scene dismissal');
w.A.go('base');assert.equal(scenes.at(-1).id,'quest_intro','quests introduced on next base return');
assert.equal(w.T.trackedGoalHtml(),'','no chip before introduction completes');
scenes.at(-1).onDone();assert.match(w.T.trackedGoalHtml(),/Power Trace/);
assert.equal(w.T.chainAvailable('bunker'),true);
// Legacy saves keep quest access, stash and completed rooms. Partial saves adopt the new path.
const legacy={modules:{fabricator:1,storage:0},bitCardsSeen:{quest_intro:true}};w.T.migrateBitCardsSeen(legacy);assert.equal(legacy.ftuePath,false);
const partial={modules:{fabricator:0,storage:0},bitCardsSeen:{}};w.T.migrateBitCardsSeen(partial);assert.equal(partial.ftuePath,true);
const saved=JSON.parse(JSON.stringify(s));const reloaded=boot(saved);assert.equal(reloaded.s.modules.storage,1);assert.equal(reloaded.w.T.chainAvailable('bunker'),true);
// Held scene completion survives a reload; already paid buildings are never charged again.
for(const [module,id] of [['rebirth_core','core_restored'],['fabricator','fabricator_built'],['storage','vault_unlocked']]){
 const pending=JSON.parse(JSON.stringify(s));pending.bitCardsSeen[id]=false;
 const resumed=boot(pending);resumed.w.A.go('base');
 assert.equal(resumed.scenes.at(-1).id,id,'resume '+id);
 assert.deepEqual(JSON.parse(JSON.stringify(resumed.s.stash)),pending.stash,'no second payment');resumed.w.close();
}
reloaded.w.close();w.close();console.log('FTUE one-path state transitions passed');
