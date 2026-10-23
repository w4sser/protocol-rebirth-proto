// One-off: base screen tab-bar screenshots (RAID far right) at landscape phone sizes with notch insets like layout-check.
// Usage: node scripts/raid-tab-shots.mjs [outDir]   (CHROME_PATH=/usr/bin/google-chrome, puppeteer-core)
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,join} from 'node:path';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const OUT=resolve(process.argv[2]||'/workspace/mobile-audit');
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
const PROGRESSED="document.getElementById('splash')?.click();S.introSeen=true;S.beat=PROG.beats.length-1;S.modules.rebirth_core=1;S.modules.fabricator=1;S.roomUnlocks.fabricator=true;S.baseState=D.baseStates[D.baseStates.length-1].id;session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());";
for(const [w,h] of [[844,390],[667,375]]){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,900));
  await page.evaluate(PROGRESSED);
  await page.waitForSelector('#tabs button');
  await new Promise(r=>setTimeout(r,1500));
  const order=await page.$$eval('#tabs button',b=>b.map(x=>x.textContent.trim()));
  console.log(w,order.join(','));
  await page.screenshot({path:join(OUT,`raid-tab-${w}.png`)});
  await page.close();
}
await browser.close();server.close();
