// v1.67: goal card shows the effect tiles (from DATA.upgradeRewardTiles) and the first upgrade pays off exactly once.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const root=__dirname+'/..',files=['items','modules','bit','raid_zones','recipes','vendors','retention','quests','progression','combat'];
function boot(save){const w=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost/'}).window;
  for(const f of files)w.eval(fs.readFileSync(root+'/data/'+f+'.js','utf8'));
  if(save)w.localStorage.setItem('pr_meta_save',JSON.stringify(save));w.PR_NAVIGATE=u=>w.launchURL=u;
  w.eval(fs.readFileSync(root+'/app.js','utf8')+';window.T={state:()=>S,progressionGoal,goalEffectTiles,finishModuleLevel,ingestRaidResult,session:()=>session,migrateState,load};');return w;}
const launchOf=w=>new URL(w.launchURL,'http://localhost/').searchParams;
const deploy=w=>{w.launchURL=null;w.A.go('prep');w.A.deployNodeRaid();return launchOf(w);};

// (a) goal card tiles
{const w=boot(),A=w.A,T=w.T,d=w.document;A.dismissIntro();A.build('rebirth_core');A.go('base');
 const g=T.progressionGoal(),all=w.DATA.upgradeRewardTiles(g.module,g.level),tiles=T.goalEffectTiles(g);
 assert.equal(g.module,'fabricator');assert(tiles.length>=1&&tiles.length<=3,'max 3 tiles');
 for(const t of tiles)assert(all.some(a=>a.source===t.source&&a.value===t.value&&a.label===t.label&&a.icon===t.icon),'tile comes from upgradeRewardTiles: '+t.source);
 assert.equal(new Set(tiles.map(t=>t.source)).size,tiles.length);
 const vals=tiles.map(t=>t.value);assert(vals.includes('+25')&&vals.includes('+1 SLOT'),'felt stats first: '+vals);
 const card=d.querySelector('.s-base .progress-goal');assert(card,'goal card rendered');
 const rendered=[...card.querySelectorAll('.gtile')];assert.deepStrictEqual(rendered.map(e=>e.dataset.source),Array.from(tiles,t=>t.source));
 rendered.forEach((e,i)=>{assert(e.querySelector('svg'),'icon');assert.equal(e.querySelector('b').textContent,tiles[i].value);assert.equal(e.querySelector('small').textContent,tiles[i].label);});
 assert(!card.textContent.includes(g.benefit),'no benefit prose on the card');assert(!card.querySelector(':scope>span'),'no prose span');
 // every module/level pair: never more than 3, always a subset
 for(const m of w.DATA.modules)for(const l of m.levels){const t=w.DATA.goalEffectTiles(m.id,l.level,3),a=w.DATA.upgradeRewardTiles(m.id,l.level);assert(t.length<=3);assert(t.every(x=>a.some(y=>y.source===x.source)));}
 w.close();}

// (b) first upgrade payoff
const key='fabricator:1';
function toFabricator1(){const w=boot(),A=w.A,T=w.T;A.dismissIntro();A.build('rebirth_core');A.go('base');return w;}
function fundAndBuild(w,mod){const T=w.T,S=T.state();const next=w.DATA.modules.find(m=>m.id===mod).levels.find(l=>l.level===(S.modules[mod]||0)+1);
  S.cur.scrap+=next.cost.scrap||0;S.cur.dataCores+=next.cost.dataCores||0;for(const id in next.cost.items||{})w.eval(`addItem(${JSON.stringify(id)},${next.cost.items[id]})`);
  w.A.unlockRoom?w.A.unlockRoom(mod):0;if((S.modules[mod]||0)<next.level)w.A.build(mod);}
{const w=toFabricator1(),T=w.T,S=T.state();
 // no payoff before the upgrade (guided intro raid)
 assert(!S.payoff&&!S.payoffDone);let q=deploy(w);assert.equal(q.get('intro'),'1');assert(!q.has('payoff'),'no payoff before Fabricator L1');
 const result={schema:'protocol-rebirth/raid-result',version:1,raidId:q.get('raidId'),seed:q.get('seed'),outcome:'extract',area:'bunker',levelsCleared:1,enemiesDefeated:0,nodesLit:1,remainingMs:400000,extracted:['cable','cable','scrap_alloy'],lost:[],endedAt:Date.now(),kitLeft:{medkit:1}};
 T.ingestRaidResult(result);w.A.go('base');w.A.unlockRoom('fabricator');assert.equal(S.modules.fabricator,1);
 assert.deepStrictEqual(JSON.parse(JSON.stringify(S.payoff)),{pending:key});assert(!S.payoffDone);
 // reload keeps it pending, then first raid consumes it
 const saved=JSON.parse(w.localStorage.getItem('pr_meta_save'));assert.equal(saved.payoff.pending,key);
 const re=boot(saved);assert.equal(re.T.state().payoff.pending,key);
 q=deploy(re);assert.equal(q.get('payoff'),'loot_cluster','first raid after Fabricator L1');assert(!q.has('intro'));assert.equal(Number(q.get('bag')),5);
 assert.equal(re.T.state().payoff,null);assert.equal(re.T.state().payoffDone,true);
 // second raid: none
 const r1=re.T.state().coreLaunch;re.T.ingestRaidResult({...result,raidId:r1.raidId,outcome:'death',extracted:[],lost:[]});
 q=deploy(re);assert(!q.has('payoff'),'second raid has no payoff');
 // reload after consumption keeps it consumed
 const again=boot(JSON.parse(re.localStorage.getItem('pr_meta_save')));assert.equal(again.T.state().payoffDone,true);assert(!deploy(again).has('payoff'));
 // later qualifying upgrade never re-arms
 again.T.finishModuleLevel('storage',2);assert.equal(again.T.state().payoff,null,'only the first qualifying upgrade ever');
 [w,re,again].forEach(x=>x.close());}
// upgrade not in the map does not trigger; old saves that already own a payoff upgrade never get a late one
{const w=boot(),T=w.T,S=T.state();w.A.dismissIntro();T.finishModuleLevel('bit_bay',1);assert.equal(S.payoff,null);assert(!S.payoffDone);
 T.finishModuleLevel('storage',1);assert.equal(S.payoff,null,'storage L1 is not a payoff upgrade');
 T.finishModuleLevel('storage',2);assert.deepStrictEqual(JSON.parse(JSON.stringify(S.payoff)),{pending:'storage:2'},'raid_bag_plus_1 unlock qualifies');w.close();}
{const w=boot(),old=JSON.parse(JSON.stringify(w.T.state()));delete old.payoff;delete old.payoffDone;old.modules.fabricator=1;old.modules.rebirth_core=1;old.introSeen=true;w.close();
 const o=boot(old);assert.equal(o.T.state().payoffDone,true,'old save with Fabricator L1 gets no late payoff');assert.equal(o.T.state().payoff,null);o.T.finishModuleLevel('fabricator',2);assert.equal(o.T.state().payoff,null);
 const fresh=JSON.parse(JSON.stringify(boot().T.state()));delete fresh.payoff;delete fresh.payoffDone;const f=boot(fresh);assert.equal(f.T.state().payoffDone,false);assert.equal(f.T.state().payoff,null);o.close();f.close();}
// free_tool: launch-only tool, stash untouched, nothing returns to the stash, waits while the player carries their own tool
{const w=boot(),T=w.T,S=T.state();w.A.dismissIntro();S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.beat=w.DATA.progression.beats.length-1;S.baseState=w.DATA.baseStates[w.DATA.baseStates.length-1].id;
 S.stash.tool_decoy=1;S.payoff={pending:'fabricator:2'};
 w.A.go('prep');T.session().prep.loadout.tool='tool_decoy';w.launchURL=null;w.A.deployNodeRaid();let q=launchOf(w);
 assert(!q.has('payoff'),'pending free_tool waits while the player carries their own tool');
 S.coreLaunch=null;S.stash.tool_decoy=1;T.session().prep=null;
 w.A.go('prep');T.session().prep.loadout.tool=null;w.launchURL=null;w.A.deployNodeRaid();q=launchOf(w);
 assert.equal(q.get('payoff'),'free_tool');assert.equal(q.get('tool'),'tool_grenade:1');assert.equal(S.stash.tool_decoy,1,'stash untouched');assert.equal(S.stash.tool_grenade||0,0);
 assert(!S.coreLaunch.tool,'free tool is not accounted as taken from stash');
 T.ingestRaidResult({schema:'protocol-rebirth/raid-result',version:1,raidId:S.coreLaunch.raidId,seed:q.get('seed'),outcome:'extract',area:'bunker',levelsCleared:1,enemiesDefeated:0,nodesLit:1,remainingMs:1,extracted:[],lost:[],endedAt:Date.now(),kitLeft:{medkit:0},toolLeft:{id:'tool_grenade',n:1}});
 assert.equal(S.stash.tool_grenade||0,0,'free charge does not become a stash item');w.close();}
console.log('PAYOFF PASSED');
