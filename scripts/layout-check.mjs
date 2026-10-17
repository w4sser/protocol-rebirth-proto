// Layout guardrail: drives the real game in headless Chrome at phone-landscape sizes and fails on overlapping controls,
// covered controls, controls outside the viewport, popups that don't fit, overlapping world labels and a non-full-bleed canvas.
// Usage: node scripts/layout-check.mjs   (env: LAYOUT_OUT=verify-out, CHROME_PATH=/usr/bin/google-chrome)
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,join} from 'node:path';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const OUT=resolve(process.env.LAYOUT_OUT||join(root,'verify-out'));
const VIEWPORTS=[[844,390],[932,430],[667,375]];
const failures=[];
const fail=(ctx,msg)=>{failures.push(`${ctx}: ${msg}`);};

// ---- tiny static server (free port) ----
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const target=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{'Content-Type':types[extname(target)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(target));}
  catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;

// ---- puppeteer (puppeteer, else puppeteer-core + CHROME_PATH) ----
const require=createRequire(import.meta.url);
let puppeteer,launchOpts={headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
try{puppeteer=require('puppeteer');}
catch{try{puppeteer=require('puppeteer-core');launchOpts.executablePath=process.env.CHROME_PATH||'/usr/bin/google-chrome';}
  catch{console.error('layout-check: install puppeteer (npm i --no-save puppeteer) or puppeteer-core + CHROME_PATH');process.exit(2);}}
if(process.env.CHROME_PATH)launchOpts.executablePath=process.env.CHROME_PATH;
await mkdir(OUT,{recursive:true});
const browser=await puppeteer.launch(launchOpts);

// ---- in-page collectors (serialised into the page) ----
function collect(extraSel){
  const vw=innerWidth,vh=innerHeight,items=[];
  const sel='button,a[href],[role=button],input,select,textarea,.tab,[onclick]'+(extraSel?','+extraSel:'');
  const name=el=>(el.id?'#'+el.id:el.tagName.toLowerCase())+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'')+((el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,18)?` "${(el.getAttribute('aria-label')||el.textContent).trim().replace(/\s+/g,' ').slice(0,18)}"`:'');
  // an open modal layer (splash, popup, mission panel, settings menu) is the only thing that can be tapped
  const shown=e=>!e.hidden&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const layers=[...document.querySelectorAll('#splash,#overlay,#mission-panel,#settings-menu,.pop-x.mission-x,#tutorial,#round-over,#inventory,#swap-row,#fatal')].filter(shown);
  for(const el of document.querySelectorAll(sel)){
    if(el.matches('#overlay,#splash,.pop-backdrop,#tutorial,#round-over,#inventory,#fatal'))continue;
    if(layers.length&&!layers.some(l=>l.contains(el)))continue;
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<.05||cs.pointerEvents==='none'||el.closest('[hidden]')||!el.getClientRects().length)continue;
    const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
    let c={l:-1e9,t:-1e9,r:1e9,b:1e9},scrolls=false;
    for(let p=el.parentElement;p&&p!==document.documentElement;p=p.parentElement){
      const o=getComputedStyle(p);
      if(/auto|scroll/.test(o.overflowX+o.overflowY))scrolls=true;
      if(o.overflowX!=='visible'||o.overflowY!=='visible'){const pr=p.getBoundingClientRect();c={l:Math.max(c.l,pr.left),t:Math.max(c.t,pr.top),r:Math.min(c.r,pr.right),b:Math.min(c.b,pr.bottom)};}
    }
    // pannable world content (base plates, world-map regions) may legitimately sit under HUD panels / scroll away
    const world=el.matches('.mapspot,.wm-region,.wm-beacon,.wm-label');
    // `outside` is judged on the ORIGINAL rect: clipping or being parked off-screen must not hide overflow. Only content
    // inside a scroller (or pannable world content) may legitimately be scrolled/clipped away.
    const outside=!world&&!scrolls&&(r.left<-1||r.top<-1||r.right>vw+1||r.bottom>vh+1);
    const v=scrolls||world?{l:Math.max(r.left,c.l),t:Math.max(r.top,c.t),r:Math.min(r.right,c.r),b:Math.min(r.bottom,c.b)}:{l:r.left,t:r.top,r:r.right,b:r.bottom};
    if(!outside&&(v.r<=v.l||v.b<=v.t||(v.r-v.l)*(v.b-v.t)<.6*r.width*r.height))continue;   // scrolled/clipped away
    if(!outside&&(v.r<=0||v.l>=vw||v.b<=0||v.t>=vh))continue;                               // parked fully off-screen
    const top=outside?null:document.elementFromPoint((v.l+v.r)/2,(v.t+v.b)/2);
    const covered=!!top&&!(top===el||el.contains(top)||top.contains(el));
    items.push({n:name(el),l:v.l,t:v.t,r:v.r,b:v.b,el,world,outside,covered:covered&&!world?name(top):null});
  }
  // drop wrappers: if an item contains another item it's a container, not a competing control
  const res=[];
  for(const a of items){res.push({n:a.n,l:a.l,t:a.t,r:a.r,b:a.b,covered:a.covered,
    outside:a.outside,
    overlaps:items.filter(o=>o!==a&&!o.el.contains(a.el)&&!a.el.contains(o.el)&&a.world===o.world&&Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.t,o.t)>2&&items.indexOf(o)>items.indexOf(a)).map(o=>o.n)});}
  return res;
}
function popupFit(){
  const vw=innerWidth,vh=innerHeight,out=[];
  for(const el of document.querySelectorAll('#overlay .pop-card,#mission-panel,#settings-menu,.inventory-card,.swap-row,.tutorial-card,.round-card')){
    if(el.closest('[hidden]')||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
    const r=el.getBoundingClientRect();if(r.width<4)continue;
    const x=el.querySelector(':scope>.pop-x'),xr=x&&x.getBoundingClientRect();
    out.push({n:(el.id?'#'+el.id:'.'+el.className.split(' ')[0]),scroll:el.scrollHeight>el.clientHeight+1,
      outside:r.left<-1||r.top<-1||r.right>vw+1||r.bottom>vh+1||(xr&&(xr.left<-1||xr.top<-1))});
  }
  return out;
}

// World-space overlays: every label in #world-labels (loot, node, exit, enemy badge + health bar ...), their nested bars/meters, the
// player bars and transient notices must not overlap each other, nor the HUD (timer, bag, dash, sticks ...). Real client rects.
function worldOverlaps(){
  const vis=e=>!e.hidden&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e).opacity>.05&&e.getClientRects().length;
  const box=(e,k,t)=>{const r=e.getBoundingClientRect();return {k,e,t:t||e.textContent.trim().replace(/\s+/g,' ').slice(0,28)||e.id,l:r.left,tp:r.top,r:r.right,b:r.bottom};};
  const sel=s=>[...document.querySelectorAll(s)].filter(vis);
  const L=sel('#world-labels>*:not(.enemy-damage):not(.enemy-hit-flash)').map(e=>box(e,'label'))
    .concat(sel('#world-labels .enemy-health-bar,#world-labels .node-meter').map(e=>box(e,'bar',`${e.closest('.node-label')?.textContent.trim().slice(0,16)||e.id} ${e.className}`)))
    .concat(sel('.area-notice,#encounter-hint,#kit-toast,#bag-toast,#gear-toast,#goal-pickup,#level-toast,#extract-toast').map(e=>box(e,'notice'))).filter(r=>r.r-r.l>2&&r.b-r.tp>1);
  const H=sel('.round-hud,#level-corner,.bag-panel,#dash,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,#weapon-name,.stick').map(e=>box(e,'hud')).filter(r=>r.r-r.l>2);
  const hit=(a,o)=>Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.tp,o.tp)>2;
  const out=[];
  for(let i=0;i<L.length;i++){
    for(let j=i+1;j<L.length;j++)if(!L[i].e.contains(L[j].e)&&!L[j].e.contains(L[i].e)&&hit(L[i],L[j]))out.push(`${L[i].k} "${L[i].t}" overlaps ${L[j].k} "${L[j].t}"`);
    for(const h of H)if(hit(L[i],h))out.push(`${L[i].k} "${L[i].t}" overlaps HUD ${h.t}`);
  }
  return out;
}
async function report(page,ctx,extraSel=''){
  for(const it of await page.evaluate(collect,extraSel)){
    if(it.covered)fail(ctx,`${it.n} is covered by ${it.covered}`);
    if(it.outside)fail(ctx,`${it.n} leaves the viewport (${Math.round(it.l)},${Math.round(it.t)} to ${Math.round(it.r)},${Math.round(it.b)})`);
    for(const o of it.overlaps)fail(ctx,`${it.n} overlaps ${o}`);
  }
  for(const p of await page.evaluate(popupFit)){
    if(p.outside)fail(ctx,`popup ${p.n} does not fit inside the viewport`);
    if(p.scroll&&p.n!=='#mission-panel')fail(ctx,`popup ${p.n} needs its own scroll (scrollHeight > clientHeight)`);
  }
}
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png')});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
async function newPage(w,h){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  page.on('pageerror',e=>{console.log('  pageerror',String(e).slice(0,160));fail('pageerror',String(e).slice(0,160));});
  return page;
}

// ---- base (meta) ----
const PROGRESSED="document.getElementById('splash')?.click();S.introSeen=true;S.beat=PROG.beats.length-1;S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.baseState=D.baseStates[D.baseStates.length-1].id;session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());";
async function baseRun([w,h]){
  const tag=`base ${w}x${h}`;console.log(tag);
  for(const mode of ['fresh','progressed']){
    const page=await newPage(w,h);
    await page.goto(BASE+'/index.html',{waitUntil:'load'});await settle(900);
    if(mode==='progressed')await page.evaluate(PROGRESSED);
    if(mode==='fresh')await page.waitForFunction(()=>{const s=document.getElementById('splash');return !s||getComputedStyle(s).display==='none'||+getComputedStyle(s).opacity<.05;},{timeout:8000}).catch(e=>fail(`${tag} fresh landing`,`splash never went away: ${String(e).slice(0,60)}`));
    await settle(300);
    await report(page,`${tag} ${mode} landing`);await shot(page,`base-${w}x${h}-${mode}-landing`);
    if(mode==='progressed'){
      const steps=[['base','A.go("base")'],['prep','A.go("prep")'],['stash','A.go("stash")'],['vendor','A.go("vendor")'],['bit','A.go("bit")'],['worldmap','A.go("worldmap")'],['operator','A.go("operator")'],
        ['prep-mission','A.go("prep");A.planToggle(true)'],['prep-slot','A.go("prep");A.pickSlot("weapon")'],
        ['pop-core','A.go("base");A.openBuilding("rebirth_core")'],['pop-fabricator','A.go("base");A.openBuilding("fabricator")'],['pop-storage','A.go("base");A.openBuilding("storage")'],
        ['settings','A.go("base");document.getElementById("menubtn").click()']];
      for(const [name,js] of steps){
        try{await page.evaluate(`closeAllPopups();A.planToggle(false);${js}`);}catch(e){fail(`${tag} ${name}`,`action threw: ${String(e).slice(0,100)}`);continue;}
        await settle(350);await report(page,`${tag} ${name}`);await shot(page,`base-${w}x${h}-${name}`);
      }
    }
    await page.close();
  }
}

// ---- raid (Node Raid) ----
async function raidRun([w,h],area){
  const tag=`raid ${area} ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=layout&debug=1&q=high&area=${area}`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await report(page,`${tag} tutorial`);await shot(page,`raid-${area}-${w}x${h}-tutorial`);
  await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});await settle(1500);
  const fb=await page.evaluate(()=>{const c=document.querySelector('#game').getBoundingClientRect();return [c.left,c.top,c.width,c.height,innerWidth,innerHeight];});
  if(Math.abs(fb[0])>1||Math.abs(fb[1])>1||Math.abs(fb[2]-fb[4])>1||Math.abs(fb[3]-fb[5])>1)fail(tag,`canvas is not full-bleed (${fb.slice(0,4).map(Math.round)} vs ${fb[4]}x${fb[5]})`);
  for(const level of [1,2,3]){
    const ctx=`${tag} L${level}`;
    await page.evaluate(n=>window.__NR.goLevel(n),level);await settle(1800);
    await report(page,ctx,'.stick,#reset,#open-bag');
    const labels=await page.evaluate(()=>{
      const vis=e=>!e.hidden&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e).opacity>.05&&e.getClientRects().length;
      const box=(e,k)=>{const r=e.getBoundingClientRect();return {k,t:e.textContent.trim().replace(/\s+/g,' ').slice(0,28)||e.id,l:r.left,tp:r.top,r:r.right,b:r.bottom};};
      // world labels + transient notices must not overlap each other, nor the HUD (timer, bag, dash, sticks ...)
      const L=[...document.querySelectorAll('#world-labels>*:not(.enemy-damage)')].filter(vis).map(e=>box(e,'label')).concat([...document.querySelectorAll('.area-notice,#encounter-hint,#kit-toast,#bag-toast,#gear-toast,#goal-pickup,#level-toast,#extract-toast')].filter(vis).map(e=>box(e,'notice'))).filter(r=>r.r-r.l>2);
      const H=[...document.querySelectorAll('.round-hud,#level-corner,.bag-panel,#dash,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,.stick')].filter(vis).map(e=>box(e,'hud')).filter(r=>r.r-r.l>2);
      const hit=(a,o)=>Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.tp,o.tp)>2;
      const out=[];
      for(let i=0;i<L.length;i++){for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))out.push(`${L[i].k} "${L[i].t}" overlaps ${L[j].k} "${L[j].t}"`);
        for(const h of H)if(hit(L[i],h))out.push(`${L[i].k} "${L[i].t}" overlaps HUD ${h.t}`);}
      return out;});
    for(const m of labels)fail(ctx,`world label ${m}`);
    await shot(page,`raid-${area}-${w}x${h}-L${level}`);
  }
  await page.close();
}

// Regression: the guard's badge/health bar and the loot "?" sat on the node label ("STAND CLOSE") in the bunker encounter shot.
async function encShotRun([w,h]){
  const tag=`raid enc-shot ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=enc-shot&area=bunker&debug=1&q=high`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});
  for(const wait of [3000,1500]){
    await settle(wait);
    for(const m of await page.evaluate(worldOverlaps))fail(`${tag} L1`,`world label ${m}`);
  }
  await report(page,`${tag} L1`,'.stick,#reset,#open-bag');await shot(page,`raid-enc-shot-${w}x${h}-L1`);
  await page.close();
}

try{
  await encShotRun([844,390]);
  for(const vp of VIEWPORTS)await baseRun(vp);
  for(const vp of VIEWPORTS)for(const area of ['bunker','town'])await raidRun(vp,area);
}finally{await browser.close();server.close();}
// one line per problem, listing the viewports it happens at
const grouped=new Map();
for(const f of failures){const m=f.match(/^(\w+(?: \w+)?) (\d+x\d+)(.*)$/);const k=m?m[1]+m[3]:f;grouped.set(k,[...(grouped.get(k)||[]),m?m[2]:'']);}
const uniq=[...grouped].map(([k,v])=>`${k}  [${[...new Set(v)].join(', ')}]`);
if(uniq.length){console.error(`\nlayout-check: ${uniq.length} failure(s)\n - `+uniq.join('\n - '));console.error(`screenshots: ${OUT}`);process.exit(1);}
console.log(`layout-check: ok (screenshots in ${OUT})`);
