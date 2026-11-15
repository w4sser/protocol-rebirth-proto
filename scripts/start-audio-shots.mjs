// PRB-154: matched start-screen proof at phone landscape sizes, including safe-area insets.
// NODE_PATH=/workspace/pptr/node_modules CHROME_PATH=/usr/bin/google-chrome node scripts/start-audio-shots.mjs
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname,sep} from 'node:path';
const require=createRequire('/workspace/pptr/package.json');
let puppeteer;try{puppeteer=require('puppeteer');}catch{puppeteer=require('puppeteer-core');}
const current=resolve(new URL('..',import.meta.url).pathname);
// Seed the same fresh, post-raid profile for both revisions; no FTUE navigation while capturing.
global.window={};
for(const name of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','quests','progression','combat'])require(current+'/data/'+name+'.js');
const seed=require(current+'/app.js').freshState();seed.introSeen=true;seed.raids=1;
delete global.window;
const out=process.argv[2]||'/workspace/prp-start-audio-v22833-shots';
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const insets={left:47,right:47,top:0,bottom:21},results=[];
for(const [label,root] of [['before','/workspace/prp-before-main'],['after',current]]){
  const server=http.createServer(async(req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
    const file=resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
    if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    try{
      let body=await readFile(file);const ext=extname(file);
      if(ext==='.html'||ext==='.css')body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>insets[side]+'px');
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    for(const [width,height] of [[844,390],[667,375],[932,430]]){
      console.log("capturing",label,width,height);
      const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
      try{
        const page=await browser.newPage();await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
        const errors=[];page.on('pageerror',e=>errors.push(String(e)));
        await page.evaluateOnNewDocument(seed=>{
          localStorage.setItem('pr_meta_save',JSON.stringify(seed));
          sessionStorage.removeItem('pr_splash_seen');
          localStorage.setItem('pr_ftue_v1',JSON.stringify({step:'done',attempts:1,t:{}}));
        },seed);
        await page.goto(`http://127.0.0.1:${server.address().port}/index.html?splash=1&q=low`,{waitUntil:'domcontentloaded'});
        if(label==='after')await page.waitForSelector('#splash.prompt-ready');
        await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
        await page.evaluate(()=>document.getAnimations().filter(a=>a.animationName==='splashPromptPulse').forEach(a=>{a.pause();a.currentTime=1300;}));
        const path=`${out}/${label}-${width}x${height}.png`;await page.screenshot({path});
        const prompt=await page.evaluate(()=>{const el=document.querySelector('#splash-prompt')||document.querySelector('#splash small');const b=el.getBoundingClientRect();return {text:el.textContent,box:{x:b.x,y:b.y,width:b.width,height:b.height},playButton:!!document.querySelector('#splash-play')};});
        let playback=null;
        if(label==='after'){
          playback=await page.evaluate(async()=>{
            const a=window.PR_AUDIO;await a.preload();
            const buffers=await Promise.all([...a.cache.values()]);
            if(buffers.some(b=>!b.length))throw Error('empty decoded buffer');
            const evidence={decoded:buffers.length,format:a.format,beforeTap:a.context.state,voices:0};
            const source=a.source.bind(a);
            a.source=(buffer,bus,...args)=>{if(bus==='voice'){evidence.voices++;evidence.voiceAt=performance.now();}return source(buffer,bus,...args);};
            S.introSeen=false;session.screen='intro';SCREENS.intro();
            document.querySelector('.intro-lines p').addEventListener('animationstart',()=>{evidence.lineAt=performance.now();});
            window.__startAudioEvidence=evidence;return evidence;
          });
          await page.tap('#splash-prompt');
          await page.waitForFunction(()=>PR_AUDIO.voiceName==='youre-back',{timeout:10000});
          playback=await page.evaluate(async()=>{
            const evidence=window.__startAudioEvidence;evidence.afterTap=PR_AUDIO.context.state;
            evidence.deltaMs=evidence.voiceAt-evidence.lineAt;
            A.dismissIntro();await PR_AUDIO.unlock();
            evidence.cancelled=PR_AUDIO.voiceName===null;
            evidence.replay=await PR_AUDIO.requestVoice('youre-back');
            return evidence;
          });
          if(playback.voices!==1||!playback.cancelled||playback.replay||Math.abs(playback.deltaMs)>100)throw Error('greeting timing/cancellation failed: '+JSON.stringify(playback));
        }
        results.push({label,width,height,path,errors,prompt,playback});console.log(path,JSON.stringify({prompt,playback}));
        if(errors.length)throw Error(errors.join('\n'));
        if(label==='after'&&(prompt.playButton||prompt.box.x<47||prompt.box.x+prompt.box.width>width-47||prompt.box.y+prompt.box.height>height-21))throw Error('prompt outside safe area or duplicate PLAY');
      }finally{await browser.close();}
    }
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2)+'\n');
