// Stash screenshots (v1.77): stuffed stash with usage icons + OVERFLOW, sell popup, quick-clean popup, at landscape phone sizes with notch insets.
// Usage: node scripts/stash-shots.mjs [outDir]   (CHROME_PATH=/usr/bin/google-chrome, puppeteer-core)
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,join} from 'node:path';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const OUT=resolve(process.argv[2]||'/workspace/prp-qh-shots');
const INSETS={left:47,right:47,top:0,bottom:21};
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const p=decodeURIComponent(new URL(req.url,'http://x').pathname),t=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if(!t.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{let b=await readFile(t);const e=extname(t);
    if(e==='.css'||e==='.html')b=String(b).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,s)=>INSETS[s]+'px');
    res.writeHead(200,{'Content-Type':types[e]??'application/octet-stream','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const require=createRequire(import.meta.url);
let pp,o={headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
try{pp=require('puppeteer');}catch{pp=require('puppeteer-core');o.executablePath=process.env.CHROME_PATH||'/usr/bin/google-chrome';}
await mkdir(OUT,{recursive:true});
const browser=await pp.launch(o);
// Past the FTUE, Storage L1, a stash that overflows (usage icons: quest/build/trader/chip) and an active Spare Parts hand-in.
const SEED="document.getElementById('splash')?.click();S.introSeen=true;S.beat=PROG.beats.length-1;S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.baseState=D.baseStates[D.baseStates.length-1].id;"+
"S.cur.scrap=2700;S.stash={rifle_marksman:1,dampener_cloak:1,smg_vector:1,shotgun_breach:1,scavenger_vest:1,medkit:3,tool_emp:2,scout_rig:1,cable:7,fuse:10,scrap_alloy:20,servo:10,med_gel:10,bio_sample:10,power_cell:5,polymer_plate:10,circuit_board:10,optical_sensor:5,memory_module:5,purification_filter:5,hydraulic_component:5,transmitter:3,power_relay:5,tidal_coil:5,frost_glass:5,core_ash:3,prewar_relic:5};S.fir={polymer_plate:10,scrap_alloy:4};S.chains={bunker:{step:3,prog:0}};document.querySelectorAll('#overlay').forEach(o=>o.remove());";
const SHOTS=process.env.SHOTS?JSON.parse(process.env.SHOTS):[['stash','A.go("stash")'],['sell','A.go("stash");A.openStashItem("cable");A.stashQty(1);A.stashQty(1)'],['warn','A.go("stash");A.openStashItem("polymer_plate");A.stashQty(0);A.stashAct("sell")'],['overflow','A.go("stash");A.openQuickClean()']];
for(const [w,h] of (process.env.SIZES?JSON.parse(process.env.SIZES):[[1024,471],[844,390]])){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,900));
  await page.evaluate(SEED);
  await page.waitForSelector('#tabs button');await page.evaluate('A.go("stash")');await new Promise(r=>setTimeout(r,2000));
  for(const [name,js] of SHOTS){
    await page.evaluate(`closeAllPopups();${js}`);
    await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('#app,#phone').forEach(e=>{e.scrollTop=0;});});await new Promise(r=>setTimeout(r,500));
    const info=await page.evaluate(()=>({slots:stashSlotsUsed(),cap:stashCapacity(),icons:document.querySelectorAll('.slot .uses i').length}));
    console.log(w,name,JSON.stringify(info));
    await page.screenshot({path:join(OUT,`${process.env.TAG||''}${name}-${w}.png`)});
  }
  await page.close();
}
await browser.close();server.close();
