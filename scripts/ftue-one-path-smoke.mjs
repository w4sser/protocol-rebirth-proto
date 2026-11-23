// Real browser FTUE walk. Debug hooks skip combat/collecting, never story transitions.
import assert from 'node:assert/strict';
import {baseBitCardRoomOverlaps} from './ftue-fixes-states.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let puppeteer;try{puppeteer=require('puppeteer');}catch{puppeteer=require('puppeteer-core');}
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=process.env.FTUE_SHOTS||resolve(root,'verify-out/ftue-one-path');await mkdir(out,{recursive:true});
const insets={left:47,right:47,top:0,bottom:21};
const server=createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://x').pathname),file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{let body=await readFile(file);const ext=extname(file);
 if(['.html','.css'].includes(ext))body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>insets[side]+'px');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[ext]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const [width,height]of [[844,390],[667,375],[932,430]]){
  const context=await browser.createBrowserContext(),page=await context.newPage();page.setDefaultNavigationTimeout(60000);await page.setViewport({width,height,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.evaluateOnNewDocument(()=>{sessionStorage.setItem('pr_splash_seen',String(Date.now()));window.PR_NAVIGATE=url=>window.__launchUrl=url;window.addEventListener('load',()=>{const show=window.PRBitCard?.show;if(show)window.PRBitCard.show=opts=>{window.__ftueCardId=opts.id;return show(opts);};});});
  const shot=async name=>{await page.screenshot({path:resolve(out,`${name}-${width}x${height}.png`)});};
  const noQuest=async()=>assert.equal(await page.evaluate(()=>!!document.querySelector('.qgoal,#quest-chip:not([hidden]),.bit-cutscene[data-id="quest_intro"]')),false,'no early quest UI');
  const scene=async id=>{await page.waitForFunction(id=>document.querySelector('.bit-cutscene')?.dataset.id===id,{},id);await page.waitForFunction(()=>document.querySelector('.bit-cutscene')?.classList.contains('hint-visible'));};
  const dismissScene=async()=>{await page.click('.bit-cutscene');await page.waitForFunction(()=>!document.querySelector('.bit-cutscene'));};
  const card=async id=>{await page.waitForFunction(id=>window.__ftueCardId===id && !!document.querySelector('.bit-card:not([hidden])'),{},id);await delay(3100);};
  const dismissCard=async()=>{await page.click('.bit-card');await page.waitForFunction(()=>!window.PRBitCard.isOpen());};
  const launchRaid=async url=>{const target=new URL(url,base);target.searchParams.set('debug','1');target.searchParams.set('q','low');await page.goto(target.href,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__NR?.round?.(),{timeout:60000});};
  const extract=async items=>{const nav=page.waitForNavigation({waitUntil:'networkidle0',timeout:60000});await page.evaluate(items=>__NR.extractDemo(items),items);await nav;await page.waitForFunction(()=>window.A);};
  await page.goto(base,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.A);await page.evaluate(()=>{document.getElementById('splash')?.remove();window.dispatchEvent(new Event('pr:splash-finished'));});await page.waitForFunction(()=>window.__launchUrl);await launchRaid(await page.evaluate(()=>__launchUrl));
  // Voice-producing events also stay silent while BIT sleeps; SFX continue normally.
  await page.evaluate(async()=>{window.__voiceRequests=[];const voice=PR_AUDIO.voice.bind(PR_AUDIO);PR_AUDIO.voice=(name,...args)=>{__voiceRequests.push(name);return voice(name,...args);};const {audioEvent}=await import('./audio.js?v=2.28.71');audioEvent('bag-full');audioEvent('extract-revealed');});
  assert.equal(await page.evaluate(()=>__voiceRequests.length),0,'no BIT event voice before wake');
  // Observe the fuel drum at first sight. Encounter and explosion remain present in the FTUE.
  await page.evaluate(()=>{const r=__NR.round();const b=r.level.barrels?.[0];if(!b)throw Error('FTUE explosive barrel missing');__NR.teleport(b.x-2,b.z);for(const e of r.level.enemies)e.aggro=false;});
  await delay(1000);assert.equal(await page.evaluate(()=>PRBitCard.isOpen()),false);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.bit-card-img,.bit-cutscene-bust').length),0,'no BIT card/bust before wake');assert.equal(await page.evaluate(()=>(__NR.round().bitSeen||[]).includes('fuel_drum_intro')),false,'sleeping first sight stays unseen');await noQuest();await shot('step01-raid1-asleep');
  await extract(['scrap_alloy','scrap_alloy']);
  await page.waitForSelector('.intro');await shot('step02-wake-bit');
  await page.click('.intro');await delay(1500);await page.evaluate(()=>A.introSkip());await page.click('.intro-go');
  await scene('core_restored');assert.equal(await page.$('#overlay'),null,'no first extraction choice');await noQuest();await shot('step03-core-cutscene');await dismissScene();
  await card('raid_briefing');await noQuest();assert.equal(await page.$eval('.baseviewer',e=>e.dataset.ruin),'1');assert.deepEqual(await page.evaluate(baseBitCardRoomOverlaps),[]);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.baseviewer .mapspot,.baseviewer>.progress-goal,.baseviewer>.goalpill')].filter(e=>e.offsetWidth>0&&getComputedStyle(e).display!=='none'&&/Fabricator/.test(e.textContent)).length),1,'Fabricator shown once in the lit base');await shot('step04-lit-base-fabricator');await dismissCard();
  const materials=await page.evaluate(()=>['fabricator','storage'].flatMap(id=>{const cost=DATA.modules.find(m=>m.id===id).levels[0].cost;const salvage=DATA.items.find(i=>i.grantsCurrency?.scrap);return [...Object.entries(cost.items||{}).flatMap(([k,n])=>Array(n).fill(k)),...Array(Math.ceil((cost.scrap||0)/salvage.grantsCurrency.scrap)).fill(salvage.id)];}));
  await page.evaluate(()=>{A.go('prep');A.deployNodeRaid();});await page.waitForFunction(()=>window.__launchUrl);await launchRaid(await page.evaluate(()=>__launchUrl));await shot('step05-raid2');await extract(materials);
  await page.waitForSelector('#overlay');assert.equal(await page.$$eval('#overlay button',els=>els.length),1,'one Fabricator choice');await noQuest();await shot('step06-build-fabricator');await page.click('#overlay button');
  await scene('fabricator_built');assert.equal(await page.$('#overlay'),null);await noQuest();await shot('step07-fabricator-cutscene');await dismissScene();
  await page.waitForSelector('#overlay.reward');await noQuest();await shot('step08-room-online');await page.click('#overlay button.primary');
  await card('vault_intro');await noQuest();assert.deepEqual(await page.evaluate(baseBitCardRoomOverlaps),[]);await shot('step09-vault-base-intro');await dismissCard();
  // Storage materials came home in raid 2; no inventory or progression state is seeded.
  await page.waitForFunction(()=>document.querySelector('.progress-goal button')?.textContent.includes('BUILD VAULT'));
  const overlaps=await page.evaluate(()=>{const c=document.querySelector('.progress-goal').getBoundingClientRect();return [...document.querySelectorAll('.mapspot,.mapspot .tag')].filter(el=>{const r=el.getBoundingClientRect();return c.left<r.right&&c.right>r.left&&c.top<r.bottom&&c.bottom>r.top;}).map(el=>el.getAttribute('aria-label')||el.textContent);});assert.deepEqual(overlaps,[],'BUILD avoids room hitboxes and labels');await shot('step10-build-vault');await page.click('.progress-goal button');
  await scene('vault_unlocked');await noQuest();await shot('step11-vault-cutscene');await dismissScene();
  assert.equal(await page.evaluate(()=>document.querySelector('.bit-cutscene')?.dataset.id),undefined,'quests wait until next return');await noQuest();
  await page.evaluate(()=>{A.go('prep');A.deployNodeRaid();});await page.waitForFunction(()=>window.__launchUrl);const nextLaunch=await page.evaluate(()=>__launchUrl);assert.equal(new URL(nextLaunch,base).searchParams.get('quest'),null,'no raid quest before its introduction');await launchRaid(nextLaunch);await noQuest();await extract(['cable']);await page.waitForSelector('#overlay button.primary[data-close]');await noQuest();await page.click('#overlay button.primary[data-close]');await scene('quest_intro');await shot('step12-quest-intro');await dismissScene();
  await page.waitForSelector('.qgoal');assert.match(await page.$eval('.qgoal',el=>el.textContent),/Power Trace/);await shot('step13-power-trace');
  assert.deepEqual(errors,[],'no browser exceptions');console.log(`FTUE browser walk ${width}x${height}: passed`);await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
