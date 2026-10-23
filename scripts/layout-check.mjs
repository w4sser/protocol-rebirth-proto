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
// Short landscape heights for the post-raid result popup (widths 667/844/932/1024).
const RESULT_VIEWPORTS=[[667,375],[844,390],[932,430],[1024,471]];
const EXTRACT_URL=`nodspel/?seed=layout&debug=1&q=high&area=bunker&return=..%2Findex.html&gear=scavenger_vest&goal=${encodeURIComponent(JSON.stringify({module:'fabricator',level:1,name:'Fabricator',parts:[{id:'cable',need:2,secured:0}]}))}`;
// Notch phone in landscape (iPhone 14-class): left/right 47 px, bottom home indicator 21 px.
const INSETS={left:47,right:47,top:0,bottom:21};
const INS_ARG=()=>({...INSETS,textSel:SAFE_TEXT});
const failures=[];
// Text UI that must stay inside the safe area too (checked like controls).
const SAFE_TEXT='.progress-goal,#bitdock,.bag-panel,#level-corner,#seed-label,.round-hud,#weapon-name,#encounter-hint,.area-notice,.pickup-toast,.room-pips';
const fail=(ctx,msg)=>{failures.push(`${ctx}: ${msg}`);};

// ---- tiny static server (free port) ----
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const target=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{let body=await readFile(target);const ext=extname(target);
    // Headless Chrome reports env(safe-area-inset-*) as 0. Rewrite them to a notch-landscape phone so UI that ignores the
    // insets (or hardcodes 0px) shows up as leaving the safe area.
    if(ext==='.css'||ext==='.html')body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>INSETS[side]+'px');
    res.writeHead(200,{'Content-Type':types[ext]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);}
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
function collect(extraSel,ins={left:0,right:0,top:0,bottom:0}){
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
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<.05||(cs.pointerEvents==='none'&&!el.matches(ins.textSel||'#__none'))||el.closest('[hidden]')||!el.getClientRects().length)continue;
    const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
    let c={l:-1e9,t:-1e9,r:1e9,b:1e9},scrolls=false;
    for(let p=el.parentElement;p&&p!==document.documentElement;p=p.parentElement){
      const o=getComputedStyle(p);
      if(/auto|scroll/.test(o.overflowX+o.overflowY))scrolls=true;
      if(o.overflowX!=='visible'||o.overflowY!=='visible'){const pr=p.getBoundingClientRect();let pt=pr.top,pb=pr.bottom;
        if(p.id==='app'){ // v1.78 floating HUD: #app is full-bleed, so scrolling content hidden under the chips/buttons counts as scrolled away
          const tb=document.getElementById('topbar'),nv=document.getElementById('tabs');
          if(scrolls&&tb&&tb.offsetHeight)pt=Math.max(pt,tb.getBoundingClientRect().bottom);
          if(scrolls&&nv&&nv.offsetHeight)pb=Math.min(pb,nv.getBoundingClientRect().top);}
        c={l:Math.max(c.l,pr.left),t:Math.max(c.t,pt),r:Math.min(c.r,pr.right),b:Math.min(c.b,pb)};}
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
    const unsafe=!world&&!outside&&!scrolls&&(r.left<ins.left-1||r.right>vw-ins.right+1||r.top<ins.top-1||r.bottom>vh-ins.bottom+1);
    // text-only HUD panels (SAFE_TEXT) are checked for the safe area and the viewport only, not as tappable controls
    if(ins.textSel&&el.matches(ins.textSel)&&!el.matches('button,a[href],[role=button],input')){items.push({n:name(el),l:v.l,t:v.t,r:v.r,b:v.b,el,world:true,textOnly:true,outside,unsafe,covered:null});continue;}
    items.push({n:name(el),l:v.l,t:v.t,r:v.r,b:v.b,el,world,outside,unsafe,covered:covered&&!world?name(top):null});
  }
  // drop wrappers: if an item contains another item it's a container, not a competing control
  const res=[];
  for(const a of items){res.push({n:a.n,l:a.l,t:a.t,r:a.r,b:a.b,covered:a.covered,
    outside:a.outside,unsafe:a.unsafe,
    overlaps:a.textOnly?[]:items.filter(o=>o!==a&&!o.textOnly&&!o.el.contains(a.el)&&!a.el.contains(o.el)&&a.world===o.world&&Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.t,o.t)>2&&items.indexOf(o)>items.indexOf(a)).map(o=>o.n)});}
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
  // quest detail buttons (RAID / HAND IN / Track) must sit fully inside the detail pane, which does not scroll
  for(const d of document.querySelectorAll('.qlog .qdet')){
    const dr=d.getBoundingClientRect();
    for(const b of d.querySelectorAll('.qact button')){const r=b.getBoundingClientRect();
      out.push({n:'.qdet '+b.textContent.trim(),scroll:false,outside:r.left<dr.left-1||r.right>dr.right+1||r.top<dr.top-1||r.bottom>dr.bottom+1||r.bottom>vh+1||r.height<43});}
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
    .concat(sel('.area-notice,#encounter-hint,#kit-toast,#bag-toast,#gear-toast,#goal-pickup,.pickup-toast,#level-toast,#extract-toast').map(e=>box(e,'notice'))).filter(r=>r.r-r.l>2&&r.b-r.tp>1);
  const H=sel('.round-hud,#level-corner,.bag-panel,#dash,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,#weapon-name,.stick').map(e=>box(e,'hud')).filter(r=>r.r-r.l>2);
  const hit=(a,o)=>Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.tp,o.tp)>2;
  const out=[];
  for(let i=0;i<L.length;i++){
    for(let j=i+1;j<L.length;j++)if(!L[i].e.contains(L[j].e)&&!L[j].e.contains(L[i].e)&&hit(L[i],L[j]))out.push(`${L[i].k} "${L[i].t}" overlaps ${L[j].k} "${L[j].t}"`);
    for(const h of H)if(hit(L[i],h))out.push(`${L[i].k} "${L[i].t}" overlaps HUD ${h.t}`);
  }
  return out;
}
// the boot loader (raid + base) covers everything until the first frame; checks and screenshots wait for it to be gone
const loaderGone=page=>page.waitForFunction(()=>!document.getElementById('boot-loader'),{timeout:20000}).catch(()=>fail('loader','boot loader never went away'));
// Base shell must fill the visual viewport: #phone covers it and the bottom tab bar sits at the true bottom, leaving no dead band
// (only the real safe-area inset lives INSIDE #tabs as padding, so its bottom edge still reaches the viewport bottom).
function shellFill(){
  const vh=innerHeight,vv=window.visualViewport,ph=document.getElementById('phone'),tabs=document.getElementById('tabs');
  const pr=ph&&ph.getBoundingClientRect(),shown=tabs&&getComputedStyle(tabs).display!=='none'&&tabs.getClientRects().length,tr=shown&&tabs.getBoundingClientRect();
  return {vh,vvh:vv?vv.height:vh,phoneTop:pr&&pr.top,phoneBottom:pr&&pr.bottom,tabsBottom:tr?tr.bottom:null,tabsTop:tr?tr.top:null,bodyH:document.body.getBoundingClientRect().height};
}
async function checkShell(page,ctx){
  const m=await page.evaluate(shellFill);
  if(m.phoneBottom==null){fail(ctx,'#phone missing');return;}
  if(Math.abs(m.phoneTop)>1||Math.abs(m.phoneBottom-m.vh)>1)fail(ctx,`#phone (${Math.round(m.phoneTop)} to ${Math.round(m.phoneBottom)}) does not fill the viewport height ${m.vh}`);
  if(m.tabsBottom!=null){
    const gap=m.vh-m.tabsBottom;
    if(gap>2)fail(ctx,`dead band of ${Math.round(gap)}px below #tabs (tabs bottom ${Math.round(m.tabsBottom)}, viewport ${m.vh}; at most the ${INSETS.bottom}px safe-area inset may sit under the buttons, inside the bar)`);
    if(gap<-2)fail(ctx,`#tabs bottom ${Math.round(m.tabsBottom)} is below the viewport bottom ${m.vh}`);
  }
}
async function report(page,ctx,extraSel=''){
  await loaderGone(page);
  if(/^base /.test(ctx))await checkShell(page,ctx);
  for(const it of await page.evaluate(collect,extraSel+(extraSel?',':'')+SAFE_TEXT,INS_ARG())){
    if(it.unsafe)fail(ctx,`${it.n} is outside the safe area (${Math.round(it.l)},${Math.round(it.t)} to ${Math.round(it.r)},${Math.round(it.b)}; insets L${INSETS.left} R${INSETS.right} B${INSETS.bottom})`);
    if(it.covered)fail(ctx,`${it.n} is covered by ${it.covered}`);
    if(it.outside)fail(ctx,`${it.n} leaves the viewport (${Math.round(it.l)},${Math.round(it.t)} to ${Math.round(it.r)},${Math.round(it.b)})`);
    for(const o of it.overlaps)fail(ctx,`${it.n} overlaps ${o}`);
  }
  for(const p of await page.evaluate(popupFit)){
    if(p.outside)fail(ctx,`popup ${p.n} does not fit inside the viewport`);
    if(p.scroll&&p.n!=='#mission-panel')fail(ctx,`popup ${p.n} needs its own scroll (scrollHeight > clientHeight)`);
  }
}
// never screenshot mid-fade: wait until the splash is gone, then assert it really is (no half-transparent overlay left)
const shot=async(page,name)=>{
  await loaderGone(page);
  await page.waitForFunction(()=>!document.getElementById('splash'),{timeout:8000}).catch(()=>{});
  const left=await page.evaluate(()=>{const s=document.getElementById('splash');return s?getComputedStyle(s).opacity:null;});
  if(left!==null)fail(`${name}`,`splash still in DOM (opacity ${left}) when base should be interactive`);
  return page.screenshot({path:join(OUT,name+'.png')});
};
const settle=ms=>new Promise(r=>setTimeout(r,ms));
async function newPage(w,h){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  page.on('pageerror',e=>{console.log('  pageerror',String(e).slice(0,160));fail('pageerror',String(e).slice(0,160));});
  return page;
}

// ---- base (meta) ----
const PROGRESSED="document.getElementById('splash')?.click();S.introSeen=true;S.beat=PROG.beats.length-1;S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.baseState=D.baseStates[D.baseStates.length-1].id;session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());";
// v1.77 stash: stuffed stash (OVERFLOW + usage icons), sell/recycle popup, quest-warning confirm, quick-clean popup.
const STUFF='S.modules.storage=0;S.stash={cable:7,fuse:10,scrap_alloy:20,servo:10,med_gel:10,bio_sample:10,power_cell:5,polymer_plate:10,circuit_board:10,optical_sensor:5,memory_module:5,purification_filter:5,hydraulic_component:5,transmitter:3,power_relay:5,tidal_coil:5,frost_glass:5,core_ash:3,prewar_relic:5};S.fir={polymer_plate:10,scrap_alloy:4};S.chains={bunker:{step:2,prog:0}};';
async function baseRun([w,h]){
  const tag=`base ${w}x${h}`;console.log(tag);
  for(const mode of ['fresh','progressed']){
    const page=await newPage(w,h);
    await page.goto(BASE+'/index.html',{waitUntil:'load'});await settle(900);
    if(mode==='progressed')await page.evaluate(PROGRESSED);
    if(mode==='fresh')await page.waitForFunction(()=>{const s=document.getElementById('splash');return !s||!s.isConnected;},{timeout:8000}).catch(e=>fail(`${tag} fresh landing`,`splash never went away: ${String(e).slice(0,60)}`));
    await settle(300);
    await report(page,`${tag} ${mode} landing`);await shot(page,`base-${w}x${h}-${mode}-landing`);
    if(mode==='progressed'){
      const steps=[['base','A.go("base")'],['prep','A.go("prep")'],['stash','A.go("stash")'],['vendor','A.go("vendor")'],['bit','A.go("bit")'],['worldmap','A.go("worldmap")'],['worldmap-new','S.modules.rebirth_core=2;S.areaScouted={archipelago:true};S.areaSeen={};session.screen="base";session.wmCam=null;A.go("worldmap")'],['prep-new','S.modules.rebirth_core=2;S.areaScouted={archipelago:true};S.areaSeen={};A.go("prep")'],['operator','A.go("operator")'],
        ['prep-mission','A.go("prep");A.planToggle(true)'],['prep-slot','A.go("prep");A.pickSlot("weapon")'],
        ['pop-core','A.go("base");A.openBuilding("rebirth_core")'],['pop-fabricator','A.go("base");A.openBuilding("fabricator")'],['pop-storage','A.go("base");A.openBuilding("storage")'],['pop-room-locked','A.go("base");A.openRoom("bit_bay")'],['pop-quarters','S.roomUnlocks.living_quarters=true;A.go("base");A.openRoom("living_quarters")'],['pop-quarters-rested','S.roomUnlocks.living_quarters=true;A.go("base");A.openRoom("living_quarters");A.rest()'],['pop-fabricator-l2','S.modules.fabricator=2;S.modules.rebirth_core=2;S.cur.scrap=300;A.go("base");A.openRoom("fabricator")'],
        ['reward-fab','A.go("base");{const b=S.modules.bit_bay;S.modules.bit_bay=0;overlay(upgradeRewardHtml("fabricator",1,false),null,"reward");S.modules.bit_bay=b;}'],['reward-storage','A.go("base");overlay(upgradeRewardHtml("storage",2,false),null,"reward")'],
        ['pop-quests','A.go("base");A.questLog("bunker",0)'],['pop-quests-daily','A.go("base");A.questLog("daily")'],['pop-handin','A.go("base");A.handInDemo()'],['pop-handin-extract','A.go("base");A.handInDemo("extract")'],['pop-quests-fir','A.questLogDemo()'],['pop-quests-late','A.go("base");S.debugAreas=true;S.chains.archipelago={step:4,prog:1};A.questLog("archipelago",4)'],
        ['stash-stuffed',STUFF+'A.go("stash")'],['pop-stash-sell',STUFF+'A.go("stash");A.openStashItem("cable");A.stashQty(1)'],['pop-stash-warn',STUFF+'A.go("stash");A.openStashItem("polymer_plate");A.stashQty(0);A.stashAct("sell")'],['pop-stash-free',STUFF+'A.go("stash");A.openStashItem("basic_carbine")'],['pop-stash-clean',STUFF+'A.go("stash");A.openQuickClean()'],
        ['settings','A.go("base");document.getElementById("menubtn").click()']];
      for(const [name,js] of steps){
        try{await page.evaluate(`closeAllPopups();A.planToggle(false);${js}`);}catch(e){fail(`${tag} ${name}`,`action threw: ${String(e).slice(0,100)}`);continue;}
        await settle(name==='worldmap-new'?1300:350);await report(page,`${tag} ${name}`);await shot(page,`base-${w}x${h}-${name}`);
        if(name==='base'){ // v1.67: room plates never sit under the goal card
          const hit=await page.evaluate(()=>{const c=document.querySelector('.s-base .progress-goal'),vw=document.querySelector('.baseviewer'),nav=document.getElementById('tabs'),tbar=document.getElementById('topbar');if(!c||!vw)return [];
            const a=c.getBoundingClientRect(),v=vw.getBoundingClientRect(),n=nav&&nav.offsetHeight?nav.getBoundingClientRect():null,tbr=tbar&&tbar.offsetHeight?tbar.getBoundingClientRect():null,ov=(x,y)=>Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2,out=[];
            for(const p of document.querySelectorAll('.baseworld .mapspot.plate')){const r=p.getBoundingClientRect(),t=(p.querySelector('b')||p).textContent.trim();
              if(ov(a,r))out.push(t+'" sits under the goal card');else if(n&&ov(n,r))out.push(t+'" sits under the nav bar');else if(tbr&&!p.classList.contains('gate')&&ov(tbr,r))out.push(t+'" sits under the top chips');
              else if(!p.classList.contains('gate')&&(r.left<v.left-1||r.right>v.right+1||r.top<v.top-1||r.bottom>v.bottom+1))out.push(t+'" is not fully inside the viewer');}
            return out;});
          for(const t of hit)fail(`${tag} ${name}`,`room plate "${t}`);
        }
      }
    }
    await page.close();
  }
}

// ---- raid (Node Raid) ----

// Gameplay sweep: walk the player from the start to each node in small steps (as real movement does) and sample the
// world labels every frame-ish. Fails on labels overlapping each other in ANY sample, and on flicker: a label that
// toggles visibility 3+ times, or jumps more than 40 px between two samples while the camera only moves a little.
function sampleLabels(){
  window.__lc=window.__lc||0;
  const vis=e=>!e.hidden&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e).opacity>.05&&e.getClientRects().length;
  const out={labels:{},overlaps:[],at:performance.now()},L=[];
  for(const e of document.querySelectorAll('#world-labels>*:not(.enemy-damage):not(.enemy-hit-flash)')){
    if(!e.dataset.lc)e.dataset.lc=String(++window.__lc);
    const v=!!vis(e),r=e.getBoundingClientRect(),t=e.textContent.trim().replace(/\s+/g,' ').slice(0,24);
    // timed hazards (shock pads) switch on and off by design: they count for overlaps, not for flicker
    out.labels[e.dataset.lc]={v,x:r.left+r.width/2,y:r.top+r.height/2,t:t||'.'+String(e.className).split(' ').slice(0,2).join('.'),timed:e.matches('.hazard-label')};
    if(v&&r.width>2&&r.height>2)L.push({t,l:r.left,tp:r.top,r:r.right,b:r.bottom});
  }
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],o=L[j];
    if(Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.tp,o.tp)>2)out.overlaps.push(`"${a.t}" overlaps "${o.t}"`);}
  return out;
}
async function sweepLabels(page,ctx){
  const pts=await page.evaluate(()=>{const s=window.__NR.state();return {start:s.position,targets:s.level.nodes.map(n=>({x:n.x+1.2,z:n.z+1.2}))};});
  const path=[];let cur=pts.start;
  for(const t of pts.targets){const d=Math.hypot(t.x-cur.x,t.z-cur.z),n=Math.max(1,Math.ceil(d/.18));for(let i=1;i<=n;i++)path.push({x:cur.x+(t.x-cur.x)*i/n,z:cur.z+(t.z-cur.z)*i/n});cur=t;}
  const hist={},overl=new Set();
  for(const p of path.slice(0,90)){
    await page.evaluate(q=>window.__NR.teleport(q.x,q.z),p);await settle(70);
    const s=await page.evaluate(sampleLabels);
    s.overlaps.forEach(m=>overl.add(m));
    for(const [id,l] of Object.entries(s.labels))(hist[id]=hist[id]||[]).push({...l,at:s.at});
  }
  for(const m of overl)fail(ctx,`world label ${m} during gameplay`);
  for(const h of Object.values(hist)){
    if(h.some(x=>x.timed))continue;
    let toggles=0,jump=0;
    // flicker = 3+ visibility flips inside any 12 consecutive samples (~2 m of walking, longer than the 1.2 s show-hold); passing a range threshold once is fine
    const flips=[];for(let i=1;i<h.length;i++){if(h[i].v!==h[i-1].v)flips.push(i);if(h[i].v&&h[i-1].v)jump=Math.max(jump,Math.hypot(h[i].x-h[i-1].x,h[i].y-h[i-1].y));}
    // time-based (runner speed independent): 3 flips inside 1.1 s is faster than the game's 1.2 s show-hold allows
    for(let i=0;i+2<flips.length;i++)if(h[flips[i+2]].at-h[flips[i]].at<1100)toggles=Math.max(toggles,3);
    const name=h.find(x=>x.t)?.t||'label';
    if(toggles>=3)fail(ctx,`world label "${name}" flickers (3 visibility flips within 1.1 s during a ${h.length}-step walk)`);
    if(jump>40)fail(ctx,`world label "${name}" jitters (jumped ${Math.round(jump)} px between two frames)`);
  }
}
// Owner playtest 2026-10-17: the meta intro raid with a tracked goal (NEEDED labels next to the node label).
async function introGoalRun([w,h]){
  const tag=`raid intro-goal ${w}x${h}`;console.log(tag);
  const goal={module:'fabricator',level:1,name:'Fabricator',benefit:'Scavenger Vest',parts:[{id:'cable',need:2,secured:0},{id:'scrap_alloy',need:2,secured:1}]};
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=77d97187-meta&area=bunker&debug=1&q=high&intro=1&kit=medkit%3A1&goal=${encodeURIComponent(JSON.stringify(goal))}`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await loaderGone(page);await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});await settle(1500);
  await report(page,`${tag} L1`,'.stick,#reset,#open-bag,#use-kit');
  await sweepLabels(page,`${tag} L1`);
  await shot(page,`raid-intro-goal-${w}x${h}`);
  await page.close();
}
// v1.67: first-upgrade payoff raid (bunker, bag cache near spawn + BIT notice) must not overlap HUD, timer or world labels.
async function payoffRun([w,h]){
  const tag=`raid payoff ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=77d97187-payoff&area=bunker&debug=1&q=high&bag=5&kit=medkit%3A1&payoff=loot_cluster`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await loaderGone(page);await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});await settle(1200);
  await report(page,`${tag} L1`,'.stick,#reset,#open-bag,#use-kit');
  await sweepLabels(page,`${tag} L1`);
  const pay=await page.evaluate(()=>{const st=window.__NR.state(),L=st.level,sp=window.__NR.project(st.position.x,st.position.z),hud=[...document.querySelectorAll('.round-hud,#level-corner,.bag-panel,#dash,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,.stick')].filter(e=>e.offsetHeight).map(e=>e.getBoundingClientRect());
    return {sp,n:L.lootBoxes.filter(b=>b.id.startsWith('payoff-')).length,pts:L.lootBoxes.filter(b=>b.id.startsWith('payoff-')).map(b=>window.__NR.project(b.x,b.z)),hud,w:innerWidth,h:innerHeight};});
  const vis=pay.pts.filter(p=>p.x>10&&p.x<pay.w-10&&p.y>10&&p.y<pay.h-10&&Math.hypot(p.x-pay.sp.x,p.y-pay.sp.y)>34&&!pay.hud.some(r=>p.x>r.left-4&&p.x<r.right+4&&p.y>r.top-4&&p.y<r.bottom+4));
  if(!pay.n||vis.length<Math.min(pay.n,5))fail(tag,`payoff cluster not clearly visible at start (${vis.length}/${pay.n} clear of edges, player and HUD)`);
  await shot(page,`raid-payoff-${w}x${h}`);
  await page.close();
}
async function raidRun([w,h],area){
  const tag=`raid ${area} ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=layout&debug=1&q=high&area=${area}&quest=extract%3Acable%3A1%3A3`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await report(page,`${tag} tutorial`);await shot(page,`raid-${area}-${w}x${h}-tutorial`);
  await loaderGone(page);await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});await settle(1500);
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
      const L=[...document.querySelectorAll('#world-labels>*:not(.enemy-damage)')].filter(vis).map(e=>box(e,'label')).concat([...document.querySelectorAll('.area-notice,#encounter-hint,#kit-toast,#bag-toast,#gear-toast,#goal-pickup,.pickup-toast,#level-toast,#extract-toast')].filter(vis).map(e=>box(e,'notice'))).filter(r=>r.r-r.l>2);
      const H=[...document.querySelectorAll('.round-hud,#level-corner,.bag-panel,#dash,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,.stick')].filter(vis).map(e=>box(e,'hud')).filter(r=>r.r-r.l>2);
      const hit=(a,o)=>Math.min(a.r,o.r)-Math.max(a.l,o.l)>2&&Math.min(a.b,o.b)-Math.max(a.tp,o.tp)>2;
      const out=[];
      for(let i=0;i<L.length;i++){for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))out.push(`${L[i].k} "${L[i].t}" overlaps ${L[j].k} "${L[j].t}"`);
        for(const h of H)if(hit(L[i],h))out.push(`${L[i].k} "${L[i].t}" overlaps HUD ${h.t}`);}
      return out;});
    for(const m of labels)fail(ctx,`world label ${m}`);
    await sweepLabels(page,ctx);
    await shot(page,`raid-${area}-${w}x${h}-L${level}`);
    if(level===1){ // v1.76: four quick pickups -> at most 3 toasts, stacked under the bag panel, inside the safe area, clear of HUD and labels
      await page.evaluate(()=>window.__NR.pickupDemo());await settle(1300);
      const n=await page.evaluate(()=>document.querySelectorAll('.pickup-toast').length);
      if(n<1||n>3)fail(ctx,`pickup toasts visible: ${n} (expected 1 to 3)`);
      await report(page,`${ctx} pickup-toasts`,'.stick,#reset,#open-bag');
      for(const m of await page.evaluate(worldOverlaps))fail(`${ctx} pickup-toasts`,`world label ${m}`);
      await shot(page,`raid-${area}-${w}x${h}-pickup-toasts`);
      await settle(1200);
    }
  }
  await page.close();
}

// Regression: the guard's badge/health bar and the loot "?" sat on the node label ("STAND CLOSE") in the bunker encounter shot.
async function encShotRun([w,h]){
  const tag=`raid enc-shot ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=enc-shot&area=bunker&debug=1&q=high`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await loaderGone(page);await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});
  for(const wait of [3000,1500]){
    await settle(wait);
    for(const m of await page.evaluate(worldOverlaps))fail(`${tag} L1`,`world label ${m}`);
  }
  await report(page,`${tag} L1`,'.stick,#reset,#open-bag');await shot(page,`raid-enc-shot-${w}x${h}-L1`);
  await page.close();
}

// Raid boot loader: while the scene loads it must cover the whole viewport (HUD included), then fade out and leave the DOM.
async function raidLoadingRun([w,h]){
  const tag=`raid-loading ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/nodspel/?seed=layout&debug=1&q=high&area=bunker`,{waitUntil:'domcontentloaded'});
  const info=await page.evaluate(()=>{const l=document.getElementById('boot-loader');if(!l)return null;const r=l.getBoundingClientRect(),cs=getComputedStyle(l);
    const hud=document.querySelector('.round-hud'),hr=hud&&hud.getBoundingClientRect(),top=hr&&document.elementFromPoint(hr.left+hr.width/2,hr.top+hr.height/2);
    return {full:Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2,opacity:+cs.opacity,covers:!top||l.contains(top),face:!!l.querySelector('use[href$="#bit-face"]'),bar:!!l.querySelector('.pr-loader-bar i')};});
  if(!info)fail(tag,'boot loader missing at DOM ready');
  else{if(!info.full)fail(tag,'loader is not full-screen');if(!info.covers)fail(tag,'HUD is drawn above the loader');if(!info.face||!info.bar)fail(tag,'loader lacks BIT face or progress bar');
    await page.screenshot({path:join(OUT,`raid-loading-${w}x${h}.png`)});}
  await loaderGone(page);
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await page.close();
}
// Base after a raid: the secured-loot strip and the level toast queue (one at a time, never over a popup, never over the HUD).
async function baseAfterRaidRun([w,h]){
  const tag=`base-after-raid ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(BASE+'/index.html',{waitUntil:'load'});await settle(900);
  await page.evaluate(PROGRESSED);await settle(200);
  await page.waitForFunction(()=>!document.querySelector('#toast .toastmsg')&&!toastQ.length,{timeout:20000}).catch(()=>{});
  await page.evaluate(()=>{
    const res=ingestRaidResult({schema:'protocol-rebirth/raid-result',version:1,raidId:'layout-'+Date.now(),seed:'s',area:'bunker',outcome:'extract',levelsCleared:3,enemiesDefeated:4,nodesLit:6,remainingMs:1,extracted:['cable','power_cell','scrap_alloy','fuse'],lost:[],endedAt:1});
    toast('',coreResultStripHtml({outcome:'extract',lost:[]},res)||'');toast('Operator level 4');toast('Second notice');
    window.__q=document.querySelectorAll('#toast .toastmsg').length;
  });
  await settle(500);
  const one=await page.evaluate(()=>document.querySelectorAll('#toast .toastmsg').length);
  if(one!==1)fail(tag,`toasts overlap: ${one} visible at once (queue must show one at a time)`);
  const bad=await page.evaluate(()=>{const t=document.querySelector('#toast .toastmsg');if(!t)return ['no toast shown'];const a=t.getBoundingClientRect(),out=[],vw=innerWidth;
    for(const e of document.querySelectorAll('#topbar,#tabs,#bitdock,.progress-goal,.goalpill')){if(!e.offsetHeight||getComputedStyle(e).visibility==='hidden')continue;const r=e.getBoundingClientRect();
      if(Math.min(a.right,r.right)-Math.max(a.left,r.left)>2&&Math.min(a.bottom,r.bottom)-Math.max(a.top,r.top)>2)out.push('toast overlaps '+(e.id||e.className));}
    if(a.right>vw-1||a.left<0||(!t.querySelector('.qt use')&&!toastQ.some(q=>q.html&&q.html.includes('secured'))))out.push('toast outside viewport or without item tiles');return out;});
  for(const m of bad)fail(tag,m);
  await shot(page,`base-after-raid-${w}x${h}`);
  // a popup opened while toasts are queued hides/defers them
  await page.evaluate(()=>{A.questLog('daily');});await settle(700);
  const vis=await page.evaluate(()=>{const t=document.querySelector('#toast .toastmsg'),o=document.getElementById('overlay');return !!(o&&t&&getComputedStyle(document.getElementById('toast')).visibility!=='hidden');});
  if(vis)fail(tag,'toast visible while a popup is open');
  await page.close();
}

// Post-raid EXTRACTED popup: the panel fits the viewport and the primary button is fully visible, even with a long loot list.
async function extractPopupRun([w,h]){
  const tag=`extract-popup ${w}x${h}`;console.log(tag);
  const page=await newPage(w,h);
  await page.goto(`${BASE}/${EXTRACT_URL}`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await loaderGone(page);await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});await settle(800);
  await page.evaluate(()=>{const ids=globalThis.DATA.items.map(i=>i.id).filter(id=>!['cable','power_cell','servo','ai_fragment','fuse','optical_sensor','data_core','scrap_alloy','gear_box'].includes(id));window.__NR.extractDemo(['cable','power_cell','servo','ai_fragment','fuse','optical_sensor','data_core','scrap_alloy','gear_box',ids[0]]);});await settle(500);
  const r=await page.evaluate(()=>{
    const card=document.querySelector('#round-over .result-card'),btn=document.querySelector('#return-base'),x=card.querySelector(':scope>.pop-x');
    const c=card.getBoundingClientRect(),b=btn.getBoundingClientRect(),f=document.querySelector('.result-footer').getBoundingClientRect(),xr=x.getBoundingClientRect();
    const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
    return {vw:innerWidth,vh:innerHeight,card:[c.left,c.top,c.right,c.bottom],btn:[b.left,b.top,b.right,b.bottom],btnHidden:btn.hidden,btnVisible:!btn.hidden&&getComputedStyle(btn).visibility!=='hidden',onTop:!!hit&&(hit===btn||btn.contains(hit)),footerBottom:f.bottom,x:[xr.left,xr.top,xr.right,xr.bottom],
      emoji:/\p{Extended_Pictographic}/u.test(card.textContent),moreText:/more item types/i.test(card.textContent),tiles:card.querySelectorAll('#result-loot .result-tile').length};});
  if(!r.btnVisible)fail(tag,'primary button (Return to base) is not displayed');
  if(r.card[0]<-1||r.card[1]<-1||r.card[2]>r.vw+1||r.card[3]>r.vh+1)fail(tag,`panel does not fit the viewport (${r.card.map(Math.round)} in ${r.vw}x${r.vh})`);
  if(r.btn[0]<-1||r.btn[1]<-1||r.btn[2]>r.vw+1||r.btn[3]>r.vh+1)fail(tag,`primary button is cut off (${r.btn.map(Math.round)} in ${r.vw}x${r.vh})`);
  if(r.btn[3]>r.card[3]+1||r.btn[1]<r.card[1]-1)fail(tag,'primary button is outside the panel');
  if(!r.onTop)fail(tag,'primary button is covered by another element');
  if(r.tiles<8)fail(tag,`expected the capped 10-type loot list (8 tiles), got ${r.tiles}`);
  if(r.x[0]<0||r.x[1]<0||r.x[2]>r.vw||r.x[3]>r.vh)fail(tag,`close badge not fully on screen (${r.x.map(Math.round)})`);
  if(r.moreText)fail(tag,'"more item types" text line is back');
  if(r.emoji)fail(tag,'emoji in result popup');
  if(!r.tiles)fail(tag,'no loot tiles');
  await shot(page,`extract-popup-${w}x${h}`);
  await page.close();
}

try{
  for(const vp of RESULT_VIEWPORTS)await extractPopupRun(vp);
  await encShotRun([844,390]);
  for(const vp of VIEWPORTS)await raidLoadingRun(vp);
  for(const vp of VIEWPORTS)await baseAfterRaidRun(vp);
  for(const vp of VIEWPORTS)await introGoalRun(vp);
  for(const vp of VIEWPORTS)await payoffRun(vp);
  for(const vp of VIEWPORTS)await baseRun(vp);
  for(const vp of VIEWPORTS)for(const area of ['bunker','town'])await raidRun(vp,area);
}finally{await browser.close();server.close();}
// one line per problem, listing the viewports it happens at
const grouped=new Map();
for(const f of failures){const m=f.match(/^(\w+(?: \w+)?) (\d+x\d+)(.*)$/);const k=m?m[1]+m[3]:f;grouped.set(k,[...(grouped.get(k)||[]),m?m[2]:'']);}
const uniq=[...grouped].map(([k,v])=>`${k}  [${[...new Set(v)].join(', ')}]`);
if(uniq.length){console.error(`\nlayout-check: ${uniq.length} failure(s)\n - `+uniq.join('\n - '));console.error(`screenshots: ${OUT}`);process.exit(1);}
console.log(`layout-check: ok (screenshots in ${OUT})`);
