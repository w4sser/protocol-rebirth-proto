// v2.4.0 regression: real browser resize/rotation, full-bleed views and perk gesture isolation.
// Runs in CI's layout job; needs puppeteer (or puppeteer-core and CHROME_PATH).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url);
let puppeteer;try{puppeteer=require('puppeteer');}catch{puppeteer=require('puppeteer-core');}
const insets={left:47,right:47,top:8,bottom:21};
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://local').pathname),target=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!target.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
  try{
    let body=await readFile(target);const ext=extname(target);
    if(['.html','.css'].includes(ext))body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>insets[side]+'px');
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const base=`http://127.0.0.1:${server.address().port}`,sizes=[[667,375],[844,390],[932,430],[1280,720]],errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function resize(page,width,height){
  await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.evaluate(()=>{window.dispatchEvent(new Event('orientationchange'));window.dispatchEvent(new Event('resize'));window.visualViewport?.dispatchEvent(new Event('resize'));});
  await pause(300);
}
async function fills(page,selectors,label){
  const bounds=await page.evaluate(({selectors,ins})=>selectors.map(selector=>{
    const el=document.querySelector(selector);if(!el)return {selector,missing:true};
    const r=el.getBoundingClientRect(),safe=selector==='#viewport';return {selector,top:r.top-(safe?ins.top:0),left:r.left-(safe?ins.left:0),right:r.right+(safe?ins.right:0),bottom:r.bottom+(safe?ins.bottom:0),width:innerWidth,height:visualViewport?.height||innerHeight};
  }),{selectors,ins:insets});
  for(const r of bounds){assert.ok(!r.missing,`${label}: missing ${r.selector}`);assert.ok(Math.abs(r.top)<=1&&Math.abs(r.bottom-r.height)<=1,`${label} ${r.selector}: height ${JSON.stringify(r)}`);assert.ok(Math.abs(r.left)<=1&&Math.abs(r.right-r.width)<=1,`${label} ${r.selector}: width ${JSON.stringify(r)}`);}
}
async function rotateThrough(page,selectors,label){
  for(const [w,h] of sizes){await resize(page,h,w);await resize(page,w,h);await fills(page,selectors,`${label} ${w}x${h}`);
    if(label==='base prep'){const gap=await page.evaluate(()=>{const a=document.getElementById('app'),l=a.querySelector('.lobby');return a.getBoundingClientRect().bottom-parseFloat(getComputedStyle(a).paddingBottom)-l.getBoundingClientRect().bottom;});assert.ok(Math.abs(gap)<=1,`prep ${w}x${h}: unused content height ${gap}`);}}
  // Simulate a late toolbar settlement with *only* visualViewport.resize.
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:innerHeight-36});visualViewport.dispatchEvent(new Event('resize'));});
  await pause(80);await fills(page,selectors,label+' toolbar settle');
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});await pause(80);
}
async function modalFits(page,label){
  const result=await page.evaluate(ins=>{
    const p=document.querySelector('.perk-panel'),r=p.getBoundingClientRect();
    const safe=r.left>=ins.left-1&&r.right<=innerWidth-ins.right+1&&r.top>=ins.top-1&&r.bottom<=innerHeight-ins.bottom+1;
    const countdown=!!p.querySelector('.perk-countdown-bar');
    // Scroll is allowed, but each card must be reachable in the panel.
    const reachable=[...p.querySelectorAll('.perk-choice')].every(e=>{e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return b.top>=r.top-1&&b.bottom<=r.bottom+1;});p.scrollTop=0;
    return {safe,countdown,reachable,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
  },insets);
  assert.ok(result.safe&&result.countdown&&result.reachable,`${label}: modal fit ${JSON.stringify(result)}`);
}
try{
  browser=await puppeteer.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await resize(page,844,390);
  // Pause the game module while inspecting the genuine boot loader.
  await page.setRequestInterception(true);let held=null;
  // Late module/asset fetches can still land after interception is disabled below;
  // continue() on those rejects, so swallow it (the browser auto-continues them anyway).
  page.on('request',req=>{if(req.url().includes('/game.mjs'))held=req;else req.continue().catch(()=>{});});
  const loading=page.goto(base+'/nodspel/?debug=1&area=bunker',{waitUntil:'load'});
  await page.waitForSelector('#boot-loader');
  await rotateThrough(page,['#viewport','#boot-loader'],'raid loader');
  await held.continue();await loading;await page.setRequestInterception(false);
  await page.waitForFunction(()=>window.__NR&& !document.getElementById('boot-loader'),{timeout:30000});
  await rotateThrough(page,['#viewport','#game','#game canvas'],'raid HUD');
  await page.evaluate(()=>{const tutorial=document.querySelector('#tutorial');if(tutorial&&!tutorial.hidden)document.querySelector('#tutorial-start').click();window.__NR.setRoomClearsEnabled(false);window.__NR.round().level.enemies=[];document.querySelector('#round-over').hidden=true;});
  // Confirm the fixture can fire before checking that modal dismissal cannot fire.
  await page.keyboard.press('Space');await page.waitForFunction(()=>window.__NR.round().weaponState.nextId>0);
  for(const [w,h] of sizes){
    await resize(page,w,h);
    const lock=await page.evaluate(async()=>{
      const start=performance.now();
      window.__NR.perkPickDemo();
      let cards=[...document.querySelectorAll('.perk-choice')];
      if(cards.length<3){await new Promise(requestAnimationFrame);cards=[...document.querySelectorAll('.perk-choice')];}
      const disabled=cards.length===3&&cards.every(b=>b.disabled);
      cards[0]?.click();
      cards[0]?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
      return {disabled,taken:window.__NR.round().perks.taken.length,elapsed:performance.now()-start};
    });
    assert.ok(lock.disabled,`cards disabled on open (elapsed ${lock.elapsed.toFixed(1)} ms)`);
    assert.equal(lock.taken,0,`lock ignores click and keyboard (elapsed ${lock.elapsed.toFixed(1)} ms)`);
    await modalFits(page,`${w}x${h}`);
    await page.waitForFunction(()=>[...document.querySelectorAll('.perk-choice')].every(b=>!b.disabled));
    // A press already down when the modal reopens must not choose even after 600 ms.
    const box=await page.$eval('.perk-choice',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    await page.mouse.move(box.x,box.y);await page.mouse.down();
    await page.evaluate(()=>{window.__NR.perkPickDemo();});
    await pause(700);await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.__NR.round().perks.taken.length),0,'held pre-open pointer ignored after unlock');
    // Touch starting during lock and held through unlock is rejected too.
    await page.evaluate(()=>{window.__NR.perkPickDemo();});
    const cdp=await page.createCDPSession();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y}]});await pause(700);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    assert.equal(await page.evaluate(()=>window.__NR.round().perks.taken.length),0,'touch held through lock ignored');
    const shotsBefore=await page.evaluate(()=>window.__NR.round().weaponState.nextId);
    await page.tap('.perk-choice');await page.waitForFunction(()=>window.__NR.round().perks.taken.length===1);
    await pause(450);
    assert.equal(await page.evaluate(()=>window.__NR.round().weaponState.nextId),shotsBefore,'closing perk pick does not fire');
    // Reset only the debug fixture between independent viewport cases.
    await page.evaluate(()=>{const r=window.__NR.round();r.perks.taken=[];});
  }
  // A real HUD tap must spend a kit, and an exhausted budget remains tappable for feedback.
  await page.evaluate(()=>{window.__NR.setRoomClearsEnabled(false);const r=window.__NR.round();r.level.enemies=[];r.health=40;r.kit={medkit:2};r.stakes.healed=r.stakes.budget-5;});
  await page.waitForFunction(()=>document.querySelector('#use-kit b').textContent==='2');
  await page.tap('#use-kit');
  await page.waitForFunction(()=>window.__NR.round().kit.medkit===1);
  assert.ok(await page.evaluate(()=>{const r=window.__NR.round();return r.health>40&&r.health<=45&&r.stakes.healed<=r.stakes.budget;}),'tap heals within budget');
  await page.evaluate(()=>{const r=window.__NR.round();r.health=40;r.stakes.healed=r.stakes.budget;});
  await page.tap('#use-kit');await page.waitForFunction(()=>document.querySelector('#encounter-hint').textContent.includes('budget spent'));
  assert.equal(await page.evaluate(()=>window.__NR.round().kit.medkit),1,'blocked tap preserves kit');
  await page.evaluateOnNewDocument(()=>{sessionStorage.removeItem('pr_splash_seen');});
  await page.setRequestInterception(true);const art=[];
  page.removeAllListeners('request');page.on('request',req=>{if(req.url().includes('splash_archipelago_radar_lighthouse'))art.push(req);else req.continue().catch(()=>{});});
  const baseLoading=page.goto(base+'/index.html',{waitUntil:'load'});
  await page.waitForSelector('#splash');
  await rotateThrough(page,['#phone','#splash'],'base splash');
  for(const req of art)await req.continue();await baseLoading;await page.setRequestInterception(false);
  await page.evaluate(()=>{document.getElementById('splash')?.click();S.introSeen=true;S.beat=PROG.beats.length-1;S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.baseState=D.baseStates[D.baseStates.length-1].id;session.screen='prep';refresh();closeAllPopups();});
  await page.waitForFunction(()=>!document.getElementById('splash'),{timeout:10000});
  await rotateThrough(page,['#phone','#app'],'base prep');
  await page.evaluate(()=>A.openWeapon('basic_carbine'));await pause(250);
  await rotateThrough(page,['#overlay.wpnov','#overlay.wpnov .inner','.wpnscreen'],'weapon detail');
  // Reported playtest state: Mk I Marksman, level 3/3, two of three merge copies.
  await page.evaluate(()=>{closeAllPopups();S.armory.rifle_marksman=2;S.gearUp.rifle_marksman=3;S.gearTier.rifle_marksman=1;A.openWeapon('rifle_marksman');});
  for(const [w,h] of [[1024,471],[844,390]]){
    await resize(page,w,h);await pause(100);
    const result=await page.evaluate(()=>{
      const panel=document.querySelector('.wpn-r'),merge=panel.querySelector('.wmerge'),button=panel.querySelector('button.upg');
      const overlaps=()=>{const a=merge.getBoundingClientRect(),b=button.getBoundingClientRect();return a.bottom>b.top&&a.top<b.bottom;};
      const initial=overlaps();panel.scrollTop=panel.scrollHeight;const scrolled=overlaps();
      return {initial,scrolled,mag:document.querySelector('[data-slot=mag]').textContent,optic:document.querySelector('[data-slot=optic]').textContent};
    });
    assert.ok(!result.initial&&!result.scrolled,`${w}x${h}: merge and max level never overlap`);
    assert.match(result.mag,/merge to Mk II first/);assert.match(result.optic,/merge to Mk III first/);
  }
  assert.deepEqual(errors,[],'no page errors');await page.close();console.log('viewport-check: all resize, full-bleed and perk lock regressions passed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
