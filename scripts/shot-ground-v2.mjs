// Side-by-side evaluation from the real raid camera. PREVIEW ONLY; no gameplay changes.
// Run after installing puppeteer: node scripts/shot-ground-v2.mjs
// CHROME_PATH, LEVEL, AREAS (default bunker,archipelago), OUT may be set.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname, join } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = process.env.OUT || join(root, 'verify-out', 'ground-v2');
const types = {
  '.html':'text/html','.js':'application/javascript','.mjs':'application/javascript',
  '.css':'text/css','.json':'application/json','.svg':'image/svg+xml',
  '.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary',
};
const server = createServer(async (req,res) => {
  const p = decodeURIComponent(new URL(req.url,'http://x').pathname);
  const t = resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if (!t.startsWith(root+sep)) { res.writeHead(403);res.end();return; }
  try {
    const b = await readFile(t);
    res.writeHead(200,{'Content-Type':types[extname(t)]||'application/octet-stream'});
    res.end(b);
  } catch { res.writeHead(404);res.end(); }
});
await new Promise(ok => server.listen(0,'127.0.0.1',ok));
const BASE = 'http://127.0.0.1:'+server.address().port;
const puppeteer = createRequire(import.meta.url)('puppeteer');
const browser = await puppeteer.launch({
  headless:true, executablePath:process.env.CHROME_PATH,
  args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
});
await mkdir(OUT,{recursive:true});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const results = [];
try {
  for (const area of (process.env.AREAS||'bunker,archipelago').split(',')) {
    for (const mode of ['off','high','low']) {
      console.log('Capture starting:',area,mode);
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => {if(/ground-preview-v2/.test(m.text())) console.log(area,mode,m.text());});
      await page.evaluateOnNewDocument(() => {
        window.__dc = 0;
        for (const C of [WebGLRenderingContext,WebGL2RenderingContext])
          for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
            const original=C.prototype[name];
            if(original) C.prototype[name]=function(...args){window.__dc++;return original.apply(this,args);};
          }
      });
      await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
      const params = new URLSearchParams({
        seed:'groundshot',debug:'1',q:mode==='low'?'low':'high',area,return:'../index.html',
      });
      if (mode !== 'off') {params.set('ground','2');params.set('groundProfile',mode);}
      await page.goto(BASE+'/nodspel/?'+params,{waitUntil:'load'});
      await sleep(2200);
      await page.evaluate(()=>{
        const b=document.querySelector('#tutorial-start');
        if(b && !b.closest('[hidden]')) b.click();
      });
      if (process.env.LEVEL) {
        await page.evaluate(n=>window.__NR.goLevel(n),Number(process.env.LEVEL));
      }
      await sleep(2000);
      let ground=null;
      if (mode !== 'off') {
        await page.waitForFunction('window.__groundPreview && window.__groundPreview.ready',{timeout:30000});
        await page.evaluate(()=>window.__groundPreview.ready);
        ground=await page.evaluate(()=>({...window.__groundPreview.stats}));
        if (ground.error || !ground.ready || ground.tiles4m+ground.tiles8m===0)
          throw new Error('Ground preview not ready: '+JSON.stringify(ground));
      }
      const perf=process.env.SMOKE_CAPTURE==='1' ? {fps:null,drawsPerFrame:null} : await page.evaluate(()=>new Promise(ok=>{
        let n=0; const d0=window.__dc,t0=performance.now();
        const tick=()=>{if(++n<60) requestAnimationFrame(tick);
        else ok({fps:+(60*1000/(performance.now()-t0)).toFixed(1),
                 drawsPerFrame:Math.round((window.__dc-d0)/60)});};
        requestAnimationFrame(tick);
      }));
      const name=area+(process.env.LEVEL?'-L'+process.env.LEVEL:'')+'-'+mode;
      await page.screenshot({path:join(OUT,name+'.png')});
      results.push({name,...perf,ground,errors});
      console.log(name,JSON.stringify(perf),JSON.stringify(ground));
      await page.close();
    }
  }
  await writeFile(join(OUT,'summary.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally {await browser.close();server.close();}
