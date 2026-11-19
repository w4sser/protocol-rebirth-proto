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
  w.eval(fs.readFileSync(root+'/app.js','utf8')+';window.T={state:()=>S,session,questsOpen,chainAvailable,trackedQuest,trackedGoalHtml,showHomecomingSummary,migrateBitCardsSeen,MODS,PROG,save,guidedBuildPath,roomUnlockStages,BIT_CUTSCENES};');
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
assert.equal(w.document.querySelector('.baseviewer').dataset.ruin,'1','Core restore immediately lights the base before Fabricator');
const lines=[...Object.values(w.T.BIT_CUTSCENES).map(b=>b.line).filter(Boolean),w.DATA.newFindIntro,...['drum','pad','shelf'].map(id=>fs.readFileSync(root+'/nodspel/'+id+'-intro.js','utf8').match(/BIT_LINE=["'](.+)["'];/)[1])];
assert.equal(new Set(lines).size,lines.length,'BIT briefing and first-sight lines are unique');
for(const id of ['fabricator','storage']){
 const b=w.T.roomUnlockStages(id).teaser;
 assert.equal(b.info.length,1,'one material cost strip');assert.match(b.info[0].text,/Scrap/);
 assert.doesNotMatch(b.line,/cable|scrap|alloy|barely breathing|don.t have legs|\d/i,'prose never repeats costs or an old joke');
 assert.ok(b.line.length<=55,'briefing stays short');
}
assert.equal(cards.at(-1).info.length,1);assert.equal(cards.at(-1).text,w.T.roomUnlockStages('fabricator').teaser.line);
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
scenes.at(-1).onDone();assert.equal(w.T.trackedQuest(),null,'first job stays hidden until its introduction');assert.equal(scenes.filter(b=>b.id==='quest_intro').length,0,'no quest intro on scene dismissal');
w.T.showHomecomingSummary({...extracted,raid:{...extracted.raid,ftue:false}});w.document.querySelector('#overlay button.primary[data-close]').click();assert.equal(scenes.at(-1).id,'quest_intro','quests introduced after the next real raid-return summary');
assert.equal(w.T.trackedGoalHtml(),'','no chip before introduction completes');
scenes.at(-1).onDone();assert.match(w.T.trackedGoalHtml(),/Power Trace/);
assert.equal(w.T.chainAvailable('bunker'),true);assert.equal(w.T.guidedBuildPath(),false,'ordinary building behavior resumes after Vault');
// Legacy saves keep quest access, stash and completed rooms. Partial saves adopt the new path.
const legacy={modules:{fabricator:1,storage:0},bitCardsSeen:{quest_intro:true}};w.T.migrateBitCardsSeen(legacy);assert.equal(legacy.ftuePath,false);
const veteran={modules:{fabricator:1},bitCardsSeen:{},chains:{bunker:{step:1,prog:0}}};w.T.migrateBitCardsSeen(veteran);assert.equal(veteran.ftuePath,false,'old quest progress retains access');
const pastIntro={beat:w.T.PROG.beats.findIndex(b=>b.id==='raid_1')+1,modules:{fabricator:0},bitCardsSeen:{}};w.T.migrateBitCardsSeen(pastIntro);assert.equal(pastIntro.ftuePath,false,'returning profiles past the previous FTUE retain their behavior');
const builtBeforeNarration={modules:{fabricator:1},bitCardsSeen:{}};w.T.migrateBitCardsSeen(builtBeforeNarration);assert.equal(builtBeforeNarration.ftuePath,false);
const partial={modules:{fabricator:0,storage:0},bitCardsSeen:{}};w.T.migrateBitCardsSeen(partial);assert.equal(partial.ftuePath,true);
const saved=JSON.parse(JSON.stringify(s));const reloaded=boot(saved);assert.equal(reloaded.s.modules.storage,1);assert.equal(reloaded.w.T.chainAvailable('bunker'),true);
// Held scene completion survives a reload; already paid buildings are never charged again.
for(const [module,id] of [['rebirth_core','core_restored'],['fabricator','fabricator_built'],['storage','vault_unlocked']]){
 const pending=JSON.parse(JSON.stringify(s));pending.bitCardsSeen[id]=false;
 const resumed=boot(pending);resumed.w.A.go('base');
 assert.equal(resumed.scenes.at(-1).id,id,'resume '+id);
 for(const key of Object.keys(resumed.w.T.MODS[module].levels[0].cost.items||{}))assert.equal(resumed.s.stash[key]||0,pending.stash[key]||0,'no second payment');assert.equal(resumed.s.cur.scrap,pending.cur.scrap);resumed.w.close();
}
// Reload before wake has no session-only summary, but still takes the direct Core path.
const beforeWake=JSON.parse(JSON.stringify(s));beforeWake.introSeen=false;beforeWake.modules.rebirth_core=0;beforeWake.modules.fabricator=0;beforeWake.modules.storage=0;beforeWake.bitCardsSeen={};beforeWake.stash.scrap_alloy=2;
const wakeReload=boot(beforeWake);wakeReload.w.A.dismissIntro();assert.equal(wakeReload.s.modules.rebirth_core,1);assert.equal(wakeReload.scenes.at(-1).id,'core_restored');wakeReload.w.close();
const beforeBriefing=JSON.parse(JSON.stringify(s));beforeBriefing.modules.fabricator=0;beforeBriefing.modules.storage=0;beforeBriefing.bitCardsSeen={core_restored:true,raid_briefing:false};
const cardReload=boot(beforeBriefing);assert.equal(cardReload.cards.at(-1).id,'raid_briefing','unfinished base briefing resumes on reload');cardReload.w.close();
reloaded.w.close();w.close();console.log('FTUE one-path state transitions passed');
