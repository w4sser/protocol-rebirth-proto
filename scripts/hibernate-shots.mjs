// Local review harness; requires /workspace/pptr's Puppeteer and Chrome. No art is modified.
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname,sep} from 'node:path';
const require=createRequire('/workspace/pptr/package.json');
const puppeteer=require('puppeteer');
const out='/workspace/prp-hibernate-v22845-shots';
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.woff2':'font/woff2'};
const insets={left:47,right:47,top:0,bottom:21};
const results=[];
for(const [phase,root] of [['before','/workspace/prp-before-v22844'],['after',resolve('.')]].filter(([p])=>!process.env.PHASE||p===process.env.PHASE)){
  const server=http.createServer(async(req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);
    const file=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    try{
      let data=await readFile(file);const ext=extname(file);
      if(ext==='.html'||ext==='.css')data=String(data).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>insets[side]+'px');
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const [width,height] of [[844,390],[667,375],[932,430]])for(const state of ['asleep','mid-wake','line1','raid-loading']){
      const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=user-gesture-required']});
      try{
        const page=await browser.newPage();const errors=[];
        page.on('pageerror',e=>errors.push(String(e)));
        await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
        await page.evaluateOnNewDocument(raid=>{
          sessionStorage.setItem('pr_splash_seen',String(Date.now()));
          if(raid){
            // Hold actual combat decode promises for 7s. Cap must still allow play at 5s.
            const original=AudioContext.prototype.decodeAudioData;
            AudioContext.prototype.decodeAudioData=function(...args){const decoded=original.apply(this,args);return new Promise((resolve,reject)=>setTimeout(()=>decoded.then(resolve,reject),7000));};
          }else{
            // Headless Chrome lets the context run; model iOS: suspended until the first touch on this page.
            const desc=Object.getOwnPropertyDescriptor(BaseAudioContext.prototype,'state');
            let gestured=false;for(const t of ['touchstart','pointerdown','touchend','click'])addEventListener(t,()=>{gestured=true;},{capture:true});
            Object.defineProperty(BaseAudioContext.prototype,'state',{configurable:true,get(){return gestured?desc.get.call(this):'suspended';}});
            localStorage.setItem('pr_meta_save',JSON.stringify({v:1}));
            localStorage.setItem('pr_raid_result_v1',JSON.stringify({schema:'protocol-rebirth/raid-result',version:1,raidId:'shot-ftue',outcome:'extract',extracted:[],lost:[],ftue:true}));
          }
        },state==='raid-loading');
        await page.goto(base+(state==='raid-loading'?'/nodspel/?debug=1&ftue=1&area=bunker&seed=hibernate-shot':'/index.html'),{waitUntil:'load'});
        if(state==='raid-loading'){
          if(phase==='after')await page.waitForFunction(()=>document.querySelector('#boot-loader p')?.textContent.includes('calibrating'),{timeout:30000});
          else await page.waitForFunction(()=>window.__NR?.round?.(),{timeout:30000});
        }else{
          await page.waitForSelector('.intro.vo-wait-tap',{timeout:20000}).catch(async e=>{console.log('GATE FAILURE',phase,errors,await page.evaluate(()=>({screen:document.body.dataset.screen,body:document.body.className,text:document.body.innerText.slice(-1600),ctx:window.PR_AUDIO?.context?.state,settings:window.PR_AUDIO?.settings})));await page.screenshot({path:out+'/gate-failure.png'});throw e;});
          await page.waitForFunction(()=>[...document.querySelectorAll('.intro-stage img')].every(i=>i.complete&&i.naturalWidth));
          await page.waitForFunction(()=>!document.getElementById('boot-loader'),{timeout:6000}).catch(()=>{});
          if(state!=='asleep'){
            await page.touchscreen.tap(width/2,height-65);
            if(state==='mid-wake')await new Promise(r=>setTimeout(r,250));
            else await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.intro-lines p')).opacity)>.95,{timeout:12000});
          }
        }
        const info=await page.evaluate(()=>({intro:document.querySelector('.intro')?.className,filter:document.querySelector('.intro-bit')&&getComputedStyle(document.querySelector('.intro-bit')).filter,lineOpacity:document.querySelector('.intro-lines p')&&getComputedStyle(document.querySelector('.intro-lines p')).opacity,loading:document.querySelector('#boot-loader')?.textContent,decoded:window.PR_AUDIO?.decodedFiles.size}));
        const path=`${out}/${phase}-${state}-${width}x${height}.png`;
        await page.screenshot({path});
        if(errors.length)throw Error(errors.join('\n'));
        results.push({phase,state,width,height,path,...info});console.log(phase,state,width,height,JSON.stringify(info));
      }finally{await browser.close();}
    }
  }finally{await new Promise(r=>server.close(r));}
}
await writeFile(out+'/results.json',JSON.stringify(results,null,2));
