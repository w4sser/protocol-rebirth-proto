// Screenshots of the post-raid EXTRACTED popup at short landscape sizes.
// Usage: node scripts/shot-extract.mjs   (env: SHOT_OUT=/workspace/mobile-audit, CHROME_PATH=/usr/bin/google-chrome)
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,join} from 'node:path';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const OUT=resolve(process.env.SHOT_OUT||'/workspace/mobile-audit');
const SIZES=[[844,390],[667,375],[1024,471]];
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
const goal=encodeURIComponent(JSON.stringify({module:'fabricator',level:1,name:'Fabricator',parts:[{id:'cable',need:2,secured:0}]}));
const browser=await puppeteer.launch(opts);
try{
  for(const [w,h] of SIZES){
    const page=await browser.newPage();await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await page.goto(`${BASE}/nodspel/?seed=layout&debug=1&q=high&area=bunker&return=..%2Findex.html&gear=scavenger_vest&goal=${goal}`,{waitUntil:'load'});
    await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
    await page.waitForFunction(()=>!document.getElementById('boot-loader'),{timeout:20000});
    await page.click('#tutorial-start');await page.waitForFunction('window.__NR',{timeout:30000});
    await new Promise(r=>setTimeout(r,800));
    await page.evaluate(()=>window.__NR.extractDemo(['cable','power_cell','servo','ai_fragment','fuse','optical_sensor','data_core','scrap_alloy','gear_box',globalThis.DATA.items.map(i=>i.id).find(id=>!['cable','power_cell','servo','ai_fragment','fuse','optical_sensor','data_core','scrap_alloy','gear_box'].includes(id))]));await new Promise(r=>setTimeout(r,500));
    const file=join(OUT,`extract-${w}x${h}.png`);await page.screenshot({path:file});console.log(file);
    await page.close();
  }
}finally{await browser.close();server.close();}
