// Real renderer + deploy/return smoke, also usable against the published Pages URL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window={};
for(const f of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat']) require('../data/'+f+'.js');
const baseline=require('../app.js').freshState();baseline.introSeen=true;
const root=process.cwd();
let server;
let base=process.env.DEBUG_SMOKE_URL;
if(!base){
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404).end();return;}
      const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wasm':'application/wasm'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port+'/';
}
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
  const page=await browser.newPage();await page.setViewport({width:844,height:390});
  await page.evaluateOnNewDocument(raw=>{
    if(localStorage.getItem('pr_meta_save')===null)localStorage.setItem('pr_meta_save',raw);
    sessionStorage.setItem('pr_splash_seen',String(Date.now()));
  },JSON.stringify(baseline));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'?q=low',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>window.A);
  await page.evaluate(()=>{document.getElementById('splash')?.remove();window.A.go('dev');});
  const before=await page.evaluate(()=>localStorage.getItem('pr_meta_save'));
  // devUnlock saves pending normal progress once on the way out (only the idle clock moves);
  // from then on the normal save must stay byte-identical.
  const sansClock=raw=>{const st=JSON.parse(raw);if(st.idle){delete st.idle.clock;delete st.idle.lastSeen;}return st;};
  let normal=null;
  for(const mode of ['worlds','all']){
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.evaluate(mode=>A.devUnlock(mode),mode)]);
    assert.equal(await page.evaluate(()=>PR_DEBUG.mode),mode);
    if(normal===null){normal=await page.evaluate(()=>PR_DEBUG.normalSave());assert.deepEqual(sansClock(normal),sansClock(before),'entering the sandbox kept the normal save');}
    assert.equal(await page.evaluate(()=>PR_DEBUG.normalSave()),normal);
    for(const area of ['bunker','archipelago','town']){
      const url=await page.evaluate(area=>{
        document.getElementById('splash')?.remove();
        window.PR_AUDIO_RAID_ENTRY=null;window.PR_NAVIGATE=url=>window.__launchUrl=url;
        A.setArea(area);A.go('prep');A.deployNodeRaid();return window.__launchUrl;
      },area);
      assert.ok(url,'deploy produced a URL');
      const target=new URL(url,base);target.searchParams.set('debug','1');target.searchParams.set('q','low');
      assert.equal(target.searchParams.get('area'),area);assert.equal(target.searchParams.get('intro'),null);
      await page.goto(target.href,{waitUntil:'networkidle0'});
      await page.waitForFunction(()=>window.__NR?.round?.(),{timeout:60000});
      assert.equal(await page.evaluate(()=>__NR.round().level.area??'bunker'),area); // bunker levels carry no area field (levels.js)
      assert.ok(await page.evaluate(()=>document.querySelector('canvas')?.width>0));
      // An extract hands the result off and returns automatically (raid-result.js handoffRaidResult);
      // the explicit Return to base button is only the fallback when that handoff cannot run.
      const handoff=page.waitForNavigation({waitUntil:'networkidle0',timeout:60000}).then(()=>'auto',()=>null);
      const button=page.waitForSelector('#return-base',{visible:true,timeout:60000}).then(()=>'button',()=>null);
      await page.evaluate(()=>__NR.extractDemo(['cable']));
      const how=await Promise.race([handoff,button]);
      assert.ok(how,'extract neither returned to base nor offered Return to base');
      if(how==='button')await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('#return-base')]);
      assert.equal(new URL(page.url()).pathname.endsWith('/nodspel/'),false,'back on the base page');
      await page.waitForFunction(()=>window.A&&window.PR_DEBUG);
      assert.equal(await page.evaluate(()=>PR_DEBUG.mode),mode);
      assert.equal(await page.evaluate(()=>PR_DEBUG.normalSave()),normal);
      assert.equal(await page.evaluate(()=>localStorage.getItem('pr_raid_result_v1')),null,'result ingested');
      console.log(mode+': '+area+' rendered, extracted and returned with normal save unchanged');
    }
    // Use the existing action, without the launch-capture hook installed above.
    await page.evaluate(()=>{delete window.PR_NAVIGATE;A.go('base');});
    if(mode==='all'){
      await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.evaluate(()=>A.devExitSandbox())]);
      assert.equal(await page.evaluate(()=>PR_DEBUG.mode),null);
      const saved=JSON.parse(normal),current=await page.evaluate(()=>JSON.parse(localStorage.getItem('pr_meta_save')));
      assert.deepEqual(current.modules,saved.modules);assert.deepEqual(current.unlocks,saved.unlocks);
    }
  }
  assert.deepEqual(errors,[],'no browser exceptions');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
