#!/usr/bin/env node
// PRB-160: cached-art real-trigger timings at 4x CPU. No runtime code is patched.
// NODE_PATH=/workspace/pptr/node_modules CHROME_PATH=/usr/bin/google-chrome node scripts/cutscene-latency.mjs
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('/workspace/pptr/package.json'), puppeteer=require('puppeteer');
const after=resolve(import.meta.dirname,'..'), before='/workspace/prp-before-main';
const out='/workspace/prp-cs-latency-v22839-shots';
const shotsOnly=process.argv.includes('--screenshots-only');
execFileSync('git',['-C',before,'checkout','-q','--detach','origin/main']);
await mkdir(out,{recursive:true});
global.window={};
for(const f of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat']) require(after+'/data/'+f+'.js');
const {freshState}=require(after+'/app.js');
function seed(kind){
 const s=freshState();s.introSeen=kind!=='cold_open';s.raids=1;
 if(kind==='core_restored')s.stash.scrap_alloy=2;
 else if(kind!=='cold_open'){
  s.modules.rebirth_core=1;s.baseState='core_habitable';s.roomUnlocks={fabricator:true};
  if(kind==='fabricator_built'){
   const c=window.DATA.modules.find(m=>m.id==='fabricator').levels[0].cost;s.cur.scrap=c.scrap;Object.assign(s.stash,c.items);
  }else s.modules.fabricator=1;
 }
 return s;
}
const death={schema:'protocol-rebirth/raid-result',version:1,raidId:'nodspel:latency',outcome:'death',area:'bunker',levelsCleared:1,enemiesDefeated:0,nodesLit:0,remainingMs:0,extracted:[],lost:['cable'],endedAt:1,kitLeft:{medkit:0}};
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const insets={left:47,right:47,top:0,bottom:21},rows=[];
for(const [phase,root] of [['before',before],['after',after]].filter(([phase])=>!shotsOnly||phase==='after')){
 const server=http.createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://x').pathname),target=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{let body=await readFile(target);const ext=extname(target);
   if(ext==='.css'||ext==='.html')body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,s)=>insets[s]+'px');
   res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'public, max-age=3600'});res.end(body);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(const [width,height] of [[844,390],[667,375],[932,430]])for(const kind of (shotsOnly?['core_restored','fabricator_built']:['core_restored','fabricator_built','first_death','cold_open']))for(let trial=0;trial<(shotsOnly?1:3);trial++){
   const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
   try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const cdp=await page.createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.evaluateOnNewDocument((save,death,kind)=>{
     localStorage.setItem('pr_meta_save',JSON.stringify(save));
     if(death)localStorage.setItem('pr_raid_result_v1',JSON.stringify(death));
     if(kind!=='cold_open')sessionStorage.setItem('pr_splash_seen',String(Date.now()));
     window.PR_NAVIGATE=()=>{};
    },seed(kind),kind==='first_death'?death:null,kind);
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?quality=low',{waitUntil:'load'});
    if(kind==='cold_open'){
     await page.waitForSelector('.intro');
     await page.waitForSelector('#splash.prompt-ready');
    }else await page.waitForFunction(()=>document.body.dataset.screen==='base');
    // A real player has already activated audio on the splash before these story beats.
    // Activate it here too: saves skip the splash, otherwise Fabricator/death's close click
    // would include first-ever AudioContext construction rather than cutscene latency.
    if(kind!=='cold_open')await page.evaluate(async()=>{document.body.click();await window.PR_AUDIO?.unlock();});
    // All measurements use cached AND decoded art on both revisions. The production AFTER
    // cache is warmed by startup too; manual warm on BEFORE isolates intentional waits.
    if(phase==='after'){
     // Observe the production cache; do not allocate or retain any harness Images.
     await page.waitForFunction(id=>window.PRBitCutscene.isWarm(id),{timeout:15000},kind==='cold_open'?'cold_open':kind);
    }else await page.evaluate(async(kind)=>{
     const list=kind==='cold_open'?[...document.querySelectorAll('.intro-stage img')].map(img=>img.src):
      [BIT_CUTSCENES[kind].from,BIT_CUTSCENES[kind].to,BIT_CUTSCENES[kind].bust?.from,BIT_CUTSCENES[kind].bust?.to].filter(Boolean);
     window.__latencyWarm=await Promise.all(list.map(async src=>{const img=new Image();img.src=src;await img.decode();return img;}));
     if(kind!=='cold_open')await window.PRBitCutscene.preload(BIT_CUTSCENES[kind]);
    },kind);
    if(kind==='fabricator_built')await page.evaluate(()=>A.build('fabricator'));
    if(kind==='first_death')await page.waitForSelector('#overlay.raid-summary-ov [data-close]');
    const initial=await page.evaluate(kind=>{
     const splash=document.querySelector('#splash');
     if(kind==='cold_open'){
      if(!splash)throw new Error('Cold-open splash finished before timing began');
      if(!splash.classList.contains('descending'))splash.click();
      if(!splash.isConnected)throw new Error('Cold-open splash finished before timed gesture');
     }
     const selector=kind==='cold_open'?'.intro':'.bit-cutscene',start=performance.now();window.__latencyStart=start;
     if(kind==='cold_open')window.addEventListener('pr:splash-finished',()=>{window.__splashFinishedMs=performance.now()-start;},{once:true});
     window.__latencyResult=null;
     let decoding=false;
     const frame=()=>{
      const el=document.querySelector(selector),img=el?.querySelector(kind==='cold_open'?'.intro-backdrop':'.bit-cutscene-from');
      if(el&&img?.complete&&img.naturalWidth&& (kind!=='cold_open'||!document.querySelector('#splash'))){
       if(!decoding){decoding=true;img.decode().then(()=>requestAnimationFrame(()=>{
        window.__latencyResult={ms:performance.now()-start,src:img.getAttribute('src'),complete:img.complete,decoded:true};
       }));}return;
      }
      requestAnimationFrame(frame);
     };
     requestAnimationFrame(frame);
     if(kind==='core_restored')A.build('rebirth_core');
     else if(kind==='cold_open')splash.click();
     else document.querySelector('#overlay [data-close]').click();
     return {triggerReturnMs:performance.now()-start,synchronous:!!document.querySelector(selector)};
    },kind);
    if(shotsOnly){
     // A separate pass requests the screenshot near 50ms without disturbing benchmark trials.
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,50-(performance.now()-window.__latencyStart)))));
     const file=`${kind==='core_restored'?'core':'fab'}-50ms-${width}x${height}.png`;
     const requestedMs=await page.evaluate(()=>performance.now()-window.__latencyStart);
     await page.screenshot({path:out+'/'+file});
     rows.push({kind,width,height,file,requestedMs});
     assert.deepEqual(errors,[],'no page errors');continue;
    }
    await page.waitForFunction(()=>window.__latencyResult,{timeout:15000,polling:'raf'});
    const result=await page.evaluate(()=>({...window.__latencyResult,splashFinishedMs:window.__splashFinishedMs??null}));
    if(kind==='cold_open')assert.notEqual(result.splashFinishedMs,null,'timed real splash finish');
    // Capture after the timing has completed so screenshot layout/readback cannot perturb it.
    let shot=null;
    if(trial===0&&kind!=='cold_open'){
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,50-(performance.now()-window.__latencyStart)))));
     const name=kind==='core_restored'?'core':kind==='fabricator_built'?'fab':'death';
     const file=phase==='after'?`${name}-50ms-${width}x${height}.png`:`before-${name}-ready-${width}x${height}.png`;
     shot={file,requestedMs:await page.evaluate(()=>performance.now()-window.__latencyStart)};
     await page.screenshot({path:out+'/'+file});
    }
    const row={phase,kind,width,height,trial,warming:phase==='after'?'production-cache-only':'manual-baseline-isolation',...initial,...result,shot};rows.push(row);console.log(JSON.stringify(row));
    assert.deepEqual(errors,[],'no page errors');
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
}
if(shotsOnly){
 await writeFile(out+'/shot-times.json',JSON.stringify(rows,null,2)+'\n');
}else{
const summaries=[];
for(const phase of ['before','after'])for(const [width,height] of [[844,390],[667,375],[932,430]])for(const kind of ['core_restored','fabricator_built','first_death','cold_open']){
 const samples=rows.filter(r=>r.phase===phase&&r.width===width&&r.kind===kind).map(r=>r.ms).sort((a,b)=>a-b);
 summaries.push({phase,kind,width,height,medianMs:samples[1],minMs:samples[0],maxMs:samples[2]});
}
await writeFile(out+'/latency.json',JSON.stringify({cpuThrottlingRate:4,method:'three fresh-browser trials per viewport; median target <100ms; real trigger to rAF after backdrop decode; BEFORE manually warmed to isolate waits; AFTER production-cache-only; previously activated audio; cold open from splash finish; screenshots requested around 50ms or immediately after first paint when later, request times recorded',beforeCommit:execFileSync('git',['-C',before,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),summaries,rows},null,2)+'\n');
const failures=summaries.filter(r=>r.phase==='after'&&r.medianMs>=100);
assert.equal(failures.length,0,'AFTER median target <100ms: '+JSON.stringify(failures));

}
