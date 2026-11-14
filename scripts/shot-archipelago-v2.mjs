// Actual raid-camera comparison. No replacement scene, injected geometry or camera changes.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep,join} from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=process.env.OUT||join(root,'verify-out','archipelago-v2-parity');
const baseline=process.env.BASELINE_SHA||'e1206a289e5d64af3fafd7717d9eeace89b40a62';
const beforeFiles=new Map();
for(const path of ['nodspel/index.html','nodspel/game.mjs','nodspel/world.js','nodspel/archipelago.js','nodspel/coastline.mjs','nodspel/archipelago-visual-v2.mjs','nodspel/archipelago-dressing-policy.mjs']){
  beforeFiles.set(path,execFileSync('git',['show',baseline+':'+path],{cwd:root,maxBuffer:4e6}));
}
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),before=url.pathname.startsWith('/before/');
    const path=decodeURIComponent(url.pathname.replace(/^\/(before|after)\//,'/'));
    const relative=path.slice(1)+(path.endsWith('/')?'index.html':''),file=resolve(root,relative);
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const body=before&&beforeFiles.has(relative)?beforeFiles.get(relative):await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||process.env.PUPPETEER_EXECUTABLE_PATH,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
await mkdir(out,{recursive:true});
const results=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(page,label,errors){
  await wait(350);
  const state=await page.evaluate(()=>({
    loadingHidden:document.querySelector('#loading')?.hidden,
    canvas:[...document.querySelectorAll('canvas')].some(c=>c.width>0&&c.height>0),
    quality:window.__NR.quality(),position:window.__NR.state().position,
    info:window.__NR.info(),url:location.href,
    bedrock:(()=>{const plans=[];window.__NR.getScene().traverse(o=>{if(o.userData.bedrockPlan)plans.push(o.userData.bedrockPlan);});return plans;})(),
  }));
  assert.equal(state.loadingHidden,true,label+' boot');assert.ok(state.canvas,label+' canvas');assert.deepEqual(errors,[],label+' errors');
  await page.screenshot({path:join(out,label+'.png')});results.push({label,...state,errors:[...errors],renderer:'desktop Chromium, 844x390 DPR2; no physical Safari/FPS claim'});
  console.log('CAPTURE OK',label,'quality',state.quality,'last-pass calls (not whole-frame draw count)',state.info.calls);
}
try{
  for(const version of ['after','before'])for(const quality of ['high','low']){
    if(process.env.ONLY_AFTER==='1'&&version==='before')continue;
    const page=await browser.newPage(),errors=[];
    await page.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',version,quality,String(e));});
    page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push('HTTP '+r.status()+' '+r.url());});
    page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader error|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    const query='?area=archipelago&archVisual=v2&archTarget=1&seed=archipelago-v2-target&q='+quality+'&debug=1';
    console.log('Starting',version,quality);
    await page.goto(base+'/'+version+'/nodspel/'+query,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>!document.querySelector('#boot-loader')&&window.__NR?.state,{timeout:60000});
    await page.evaluate(()=>window.__NR.setMoodAutoDowngradeEnabled(false));
    await page.click('#tutorial-start');
    await capture(page,version+'-'+quality+'-spawn',errors);
    {
      const matchingView=results.find(r=>r.label==='after-'+quality+'-coast')?.position;
      await page.evaluate(matchingView=>{
        if(matchingView){window.__NR.teleport(matchingView.x,matchingView.z);return;}
        const scene=window.__NR.getScene(),floor=window.__NR.state().level.floors.find(f=>!f.dir);let portal;
        scene.traverse(o=>{if(o.name==='arch-v2-rock-cut-portal')portal=o;});
        if(portal)window.__NR.teleport(floor.x+(portal.position.x-floor.x)*.62,floor.z+(portal.position.z-floor.z)*.62);
      },matchingView);
      await capture(page,version+'-'+quality+'-coast',errors);
      await page.evaluate(async()=>{
        await window.__NR.goLevel(2);const f=window.__NR.state().level.floors.find(f=>f.dir);if(!f)throw new Error('No Level 2 bridge');
        window.__NR.teleport(f.x-(f.dir.x?Math.min(2.7,f.w*.25):0),f.z-(f.dir.x?0:Math.min(2.7,f.d*.25)));
      });
      await capture(page,version+'-'+quality+'-bridge',errors);
    }
    await page.close();
  }
  await writeFile(join(out,'capture-report.json'),JSON.stringify({baseline,results},null,2));
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
