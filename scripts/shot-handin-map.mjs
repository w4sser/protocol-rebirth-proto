// Screenshots: hand-in popup + locked world-map checklist at short landscape sizes (notch insets like layout-check).
// Usage: node scripts/shot-handin-map.mjs   (env: SHOT_OUT=/workspace/prp-qh-shots, CHROME_PATH=/usr/bin/google-chrome)
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,join} from 'node:path';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const OUT=resolve(process.env.SHOT_OUT||'/workspace/prp-qh-shots');
const SIZES=[[844,390],[667,375]];
const INSETS={left:47,right:47,top:0,bottom:21};
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const target=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/\/$/,'/index.html'));
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{let body=await readFile(target);const ext=extname(target);
    if(ext==='.css'||ext==='.html')body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>INSETS[side]+'px');
    res.writeHead(200,{'Content-Type':types[ext]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);}
  catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
const require=createRequire(import.meta.url);
let puppeteer,opts={headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
try{puppeteer=require('puppeteer');}catch{puppeteer=require('puppeteer-core');opts.executablePath=process.env.CHROME_PATH||'/usr/bin/google-chrome';}
if(process.env.CHROME_PATH)opts.executablePath=process.env.CHROME_PATH;
await mkdir(OUT,{recursive:true});
const PROGRESSED="document.getElementById('splash')?.click();S.introSeen=true;S.beat=PROG.beats.length-1;S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.baseState=D.baseStates[D.baseStates.length-1].id;session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());";
const SHOTS=[
  ['handin-fixed','A.go("base");A.handInDemo()'],
  // Core 2 + Archipelago scouted -> Town is the locked next target (needs Core 3 + Town Survey)
  ['worldmap-checklist','S.modules.rebirth_core=2;S.areaScouted={archipelago:true,town:true};S.areaSeen={archipelago:true};A.go("worldmap");session.wmCam={area:"archipelago",fx:.72,fy:.33,z:1.5};refresh()'],
];
const only=process.argv[2];
const browser=await puppeteer.launch(opts);
try{
  for(const [w,h] of SIZES)for(const [name,js] of SHOTS){
    if(only&&only!==name)continue;
    const page=await browser.newPage();await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await page.goto(BASE+'/index.html',{waitUntil:'load'});await new Promise(r=>setTimeout(r,900));
    await page.evaluate(PROGRESSED);await new Promise(r=>setTimeout(r,200));
    await page.evaluate(js);await new Promise(r=>setTimeout(r,1500));
    const file=join(OUT,`${name}-${w}x${h}.png`);await page.screenshot({path:file});console.log(file);
    await page.close();
  }
}finally{await browser.close();server.close();}
