// v2.28.49 live power pads screenshot harness (pattern: /workspace/prp-hibernate-v22845/scripts/hibernate-shots.mjs
// raid branch; raid page nodspel/?debug=1&area=bunker&seed=...). Local review only; no art is modified.
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname,sep} from 'node:path';
const require=createRequire('/workspace/pptr/package.json');
const puppeteer=require('puppeteer');
const out='/workspace/prp-pads-v22849-shots';
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.woff2':'font/woff2'};
const insets={left:47,right:47,top:0,bottom:21};
const launchOpts={headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
const SEED='pad-1'; // Bunker L1, deterministic: 2 fuel drums near the start room (verified offline).
const {generateLevel,placePowerPads}=await import('../nodspel/levels.js');
const comparison=generateLevel(1,SEED);placePowerPads(comparison,2);
const VANTAGE=comparison.junctions[0].vantage;
const SIZES=[[844,390],[667,375],[932,430]];

function serve(root){
  return http.createServer(async(req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);
    const file=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    try{
      let data=await readFile(file);const ext=extname(file);
      if(ext==='.html'||ext==='.css')data=String(data).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>insets[side]+'px');
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
}
async function withServer(root,fn){
  const server=serve(root);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{return await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
async function openRaid(page,base,seed=SEED,{bitCardSeen=false}={}){
  if(bitCardSeen){
    // Pre-mark the BIT first-sight card seen so these demo shots show the drums themselves,
    // uncluttered -- the dedicated bit-first-sight-card shot below covers the card itself.
    await page.evaluateOnNewDocument(()=>{
      localStorage.setItem('pr_meta_save',JSON.stringify({v:7,bitCardsSeen:{fuel_drum_intro:true,power_pad_intro:true}}));
    });
  }
  await page.goto(`${base}/nodspel/?seed=${seed}&area=bunker&raids=2&debug=1`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await page.waitForFunction(()=>!document.getElementById('boot-loader'),{timeout:20000});
  await page.click('#tutorial-start');
  await page.waitForFunction(()=>window.__NR&&window.__NR.round(),{timeout:30000});
  await new Promise(r=>setTimeout(r,250));
}
async function shot(name,width,height,root,fn){
  const browser=await puppeteer.launch(launchOpts);
  try{
    const page=await browser.newPage();const errors=[];
    page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',name,String(e));});
    await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const path=`${out}/${name}-${width}x${height}.png`;
    const info=await withServer(root,async base=>{const info=await fn(page,base);await page.screenshot({path});return info;});
    if(errors.length)console.log('ERRORS',name,width,height,errors);
    console.log(name,width,height,JSON.stringify(info??{}));
    return {name,width,height,path,errors,...info};
  }finally{await browser.close();}
}

const AFTER=resolve('.');
const BEFORE='/workspace/prp-before-v22848';
const results=[];
for(const [w,h] of SIZES){
  for(const [phase,root] of [['before',BEFORE],['after',AFTER]]){
    results.push(await shot(`room-with-pad-${phase}`,w,h,root,async(page,base)=>{
      await openRaid(page,base,SEED,{bitCardSeen:true});
      await page.evaluate(p=>window.__NR.teleport(p.x,p.z),VANTAGE);
      if(phase==='after')await page.evaluate(()=>window.__NR.padDemo());
      await new Promise(r=>setTimeout(r,150));
      return page.evaluate(()=>({junctions:window.__NR.round().level.junctions?.length??0,junctionLabel:(()=>{const e=document.querySelector('.junction-label');if(!e)return null;const r=e.getBoundingClientRect();return {text:e.textContent,hidden:e.hidden,mode:e.dataset.mode,rect:{x:r.x,y:r.y,w:r.width,h:r.height}};})()}));
    }));
  }
  results.push(await shot('bit-first-sight-card',w,h,AFTER,async(page,base)=>{
    // Skip the unrelated drum card; the power-pad card must be triggered by first sight.
    await page.evaluateOnNewDocument(()=>localStorage.setItem('pr_meta_save',JSON.stringify({v:7,bitCardsSeen:{fuel_drum_intro:true}})));
    await openRaid(page,base);
    await page.evaluate(()=>window.__NR.padDemo());
    await page.waitForFunction(()=>document.querySelector('.bit-card-bubble')?.textContent.includes('Water plus power'),{timeout:8000});
    return page.evaluate(()=>({cardText:document.querySelector('.bit-card-bubble').textContent,seen:window.__NR.round().bitSeen}));
  }));
  for(const mode of ['live','overload'])results.push(await shot(`pad-${mode}`,w,h,AFTER,async(page,base)=>{
    await openRaid(page,base,SEED,{bitCardSeen:true});
    await page.evaluate(()=>window.__NR.padDemo());
    await new Promise(r=>setTimeout(r,150));
    const info=await page.evaluate(mode=>window.__NR.padDemo(mode),mode);
    await new Promise(r=>setTimeout(r,80));
    return info;
  }));
}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
const bad=results.filter(r=>r.errors?.length);
if(bad.length){console.error('ISSUES:\n'+bad.map(b=>b.name+': '+b.errors.join('; ')).join('\n'));process.exitCode=1;}
else console.log('shots: ok ->',out);
