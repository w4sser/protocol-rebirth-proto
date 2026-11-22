// Same harness for the untouched v2.28.42 baseline and this worktree.
// Usage: node scripts/ftue-fixes-shots.mjs <root> <out> <before|after>
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname,sep,join} from 'node:path';
import {chipSave,questChipRoomOverlaps} from './ftue-fixes-states.mjs';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'/workspace/prp-ftue-fixes-v22843-shots'),phase=process.argv[4]||'after';
const require=createRequire('/workspace/pptr/package.json');
let puppeteer;try{puppeteer=require('puppeteer');}catch{puppeteer=require('puppeteer-core');}
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const insets={left:47,right:47,top:0,bottom:21};
const server=http.createServer(async(req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://x').pathname),target=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
 if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{let body=await readFile(target);const ext=extname(target);
 if(ext==='.html'||ext==='.css')body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,s)=>insets[s]+'px');
 res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
await mkdir(out,{recursive:true});
// Generate real saves with this root's freshState and data; baseline is never modified.
global.window={};
const index=await readFile(join(root,'index.html'),'utf8');
for(const [,file] of index.matchAll(/<script[^>]+src="(data\/[^?" ]+)(?:\?[^" ]*)?"/g))require(join(root,file));
const app=require(join(root,'app.js')),beats=window.DATA.progression.beats;
const results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(w,h,name,run,save){
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.evaluateOnNewDocument(save=>{if(save)localStorage.setItem('pr_meta_save',JSON.stringify(save));sessionStorage.setItem('pr_splash_seen',String(Date.now()));window.PR_NAVIGATE=()=>{};},save||null);
 const file=`${phase}-${name}-${w}x${h}.png`;
 try{const info=await run(page);await page.screenshot({path:join(out,file)});results.push({file,errors,...info});console.log(file,JSON.stringify(info));}
 finally{await browser.close();}
}
const goal={module:'fabricator',level:1,name:'Fabricator',parts:[{id:'cable',need:1,secured:0},{id:'scrap_alloy',need:2,secured:0},{id:'scrap',kind:'currency',need:10,secured:0}]};
try{
 for(const [w,h] of [[844,390],[667,375],[932,430]]){
  for(const built of [false,true]){
   const save=chipSave(app.freshState(),beats,built);
   await shot(w,h,built?'base-guard-duty':'base-fabricator-locked',async page=>{
    await page.goto(base+'/index.html',{waitUntil:'load'});
    await page.waitForFunction(()=>window.A&&!document.getElementById('boot-loader'),{timeout:30000});
    await page.evaluate(()=>{A.startFtueDirect=()=>{};document.getElementById('splash')?.remove();closeAllPopups();session.screen='base';refresh();});
    await page.evaluate(()=>document.fonts.ready);await delay(350);
    return {overlaps:await page.evaluate(questChipRoomOverlaps),text:await page.$eval('.baseviewer>.progress-goal,.baseviewer>.goalpill',e=>e.textContent)};
   },save);
  }
  for(const pickup of [false,true])await shot(w,h,pickup?'raid-after-pickup':'raid-first-room',async page=>{
   await page.goto(`${base}/nodspel/?debug=1&seed=ftue-fixes&area=bunker&intro=1&ftue=1&goal=${encodeURIComponent(JSON.stringify(goal))}`,{waitUntil:'load'});
   await page.waitForFunction(()=>window.__NR?.round()&&!document.getElementById('boot-loader'),{timeout:40000});
   await page.evaluate(()=>{if(!document.getElementById('tutorial').hidden)document.getElementById('tutorial-start').click();});
   await page.waitForFunction(()=>window.__NR?.round()&&!document.getElementById('boot-loader'),{timeout:40000});await delay(400);
   // Replay the live level's reveal state through the real adapter for a deterministic sprite-event record.
   await page.evaluate(async()=>{
    const {createPixelFeedback}=await import('./fx-feedback.js?v=2.28.66');
    window.__ftueProof={pixel:[]};
    // The adapter's behavior is separately tested; record this live level's reveal states here.
    const events=window.__ftueProof.pixel;
    const recorder=createPixelFeedback({enabled:true,clear(){},stop(){},update(){},spawn(name){events.push(name);return null;}},{});
    const round=window.__NR.round();recorder.sync(round,{lootBoxes:round.level.lootBoxes.map(loot=>({loot}))},{x:0,z:0},1,.016);
   });
   const before=await page.evaluate(()=>window.__NR.round().level.lootBoxes.length);
   if(pickup){
    await page.evaluate(()=>{const b=window.__NR.round().level.lootBoxes.find(b=>b.item==='cable'&&!b.collected);window.__NR.teleport(b.x,b.z);});
    await page.waitForFunction(()=>window.__NR.round().bag.cable>0,{timeout:15000});await delay(110);
   }
   return await page.evaluate(before=>({crates:before,loot:window.__NR.round().level.lootBoxes.map(({item,quantity,collected})=>({item,quantity:quantity??1,collected})),pixelEvents:window.__ftueProof.pixel,pickupText:document.getElementById('pickup-toasts')?.textContent||'',bag:window.__NR.round().bag}),before);
  });
 }
}finally{server.close();await writeFile(join(out,phase+'-results.json'),JSON.stringify(results,null,2));}
if(results.some(r=>r.errors.length))process.exitCode=1;
if(phase==='after'&&results.some(r=>r.overlaps?.length||r.crates>3||r.pixelEvents?.includes('chest')))process.exitCode=1;
