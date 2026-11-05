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
      page.on('console', m => {
        if (/ground-preview-v2/.test(m.text())) console.log(area,mode,m.text());
        if (m.type()==='error' && /WebGLProgram|shader error|ERROR: 0:|ground-preview/i.test(m.text()))
          errors.push(m.text().slice(0,600));
      });
      await page.evaluateOnNewDocument(() => {
        window.__dc = 0;
        for (const C of [WebGLRenderingContext,WebGL2RenderingContext])
          for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
            const original=C.prototype[name];
            if(original) C.prototype[name]=function(...args){window.__dc++;return original.apply(this,args);};
          }
      });
      const mobile=process.env.MOBILE_VIEWPORT==='1';
      if(mobile) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
      await page.setViewport(mobile
        ? {width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true}
        : {width:1280,height:720,deviceScaleFactor:1});
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
        await page.waitForFunction('window.__groundPreview?.stats?.ready || window.__groundPreview?.stats?.error',{polling:250,timeout:45000});
        ground=await page.evaluate(()=>({...window.__groundPreview.stats}));
        if (ground.error || !ground.ready || ground.tiles4m+ground.tiles8m===0)
          throw new Error('Ground preview not ready: '+JSON.stringify(ground));
        if(mobile && area==='archipelago'){
          const geometryAudit=await page.evaluate(()=>{
            const overlay=window.__groundPreview?.group;
            const scene=overlay?.parent;
            if(!scene)return {error:'ground scene unavailable'};
            const grass=[],terrain=[];
            scene.traverse(o=>{
              if(o.name==='archipelago-grass-backup'){
                o.updateWorldMatrix(true,false);
                const b=o.geometry?.boundingBox;
                if(!b)o.geometry?.computeBoundingBox();
                const top=o.localToWorld(new (o.position.constructor)(0,o.geometry.boundingBox.max.y,0)).y;
                grass.push(top);
              }
              if(o.parent===overlay && o.type==='Mesh'){
                if(o.renderOrder===-2)terrain.push(o.position.y);
              }
            });
            return {grass,terrain};
          });
          if(geometryAudit.error || !geometryAudit.grass.length || !geometryAudit.terrain.length ||
             Math.max(...geometryAudit.grass)>=Math.min(...geometryAudit.terrain)-.005)
            throw new Error('Mobile layered ground is not separated: '+JSON.stringify(geometryAudit));
          console.log('[mobile-ground-depth]',mode,JSON.stringify(geometryAudit));
        }
      }
      const perf=process.env.SMOKE_CAPTURE==='1' ? {fps:null,drawsPerFrame:null} : await page.evaluate(()=>new Promise(ok=>{
        let n=0; const d0=window.__dc,t0=performance.now();
        const tick=()=>{if(++n<60) requestAnimationFrame(tick);
        else ok({fps:+(60*1000/(performance.now()-t0)).toFixed(1),
                 drawsPerFrame:Math.round((window.__dc-d0)/60)});};
        requestAnimationFrame(tick);
      }));
      // DEBUG-ONLY attribution audit: these planes originate in world.js hazard gameplay,
      // not in ground-preview.js. Compare projected positions with the screenshot.
      const sceneAudit=await page.evaluate(() => {
        const api=window.__NR;
        const level=api?.state?.()?.level;
        if (!level || !api.project) return null;
        const coord = item => ({
          x:item.x, z:item.z,
          screen:api.project(item.x,item.z),
          ...(item.w!=null ? {w:item.w,d:item.d} : {}),
          ...(item.id!=null ? {id:item.id} : {}),
        });
        return {
          level:level.number,
          hazards:(level.hazards || []).map(coord),
          keycard:(level.lootBoxes || []).filter(box => box.item === 'keycard').map(coord),
          otherLoot:(level.lootBoxes || []).filter(box => box.item !== 'keycard').length,
        };
      });
      if (sceneAudit) console.log('[ground-keycard-audit]',area,mode,JSON.stringify(sceneAudit));
      // Pixel probe for the two salmon shapes observed in Pass 2/3 screenshots.
      // The same seed has a Keycard at roughly x=525,y=124 on bunker L1.
      // Report the actual intersected geometry/material, including decal instances.
      if (area==='bunker' && mode==='high' && !process.env.LEVEL) {
        const pinkProbe=await page.evaluate(async () => {
          const ground=window.__groundPreview;
          const camera=window.__NR?.getCamera?.();
          const scene=ground?.group?.parent;
          if(!scene || !camera) return {error:'scene or camera unavailable'};
          const THREE=await import('./vendor/three.module.js');
          const rect=document.querySelector('#game canvas').getBoundingClientRect();
          const out=[];
          for(const [px,py] of [[539,211],[781,275],[877,386]]) {
            const ndc=new THREE.Vector2((px-rect.left)/rect.width*2-1,-((py-rect.top)/rect.height*2-1));
            const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
            const hits=ray.intersectObjects(scene.children,true);
            const nearest=hits.filter(h=>h.point.y<.5 && h.point.y>-.5).slice(0,15)
              .map(h=>{
                const o=h.object,m=Array.isArray(o.material)?o.material[0]:o.material;
                return {type:o.type,name:o.name||'',geometry:o.geometry?.type||'',
                  material:m?.name||m?.type||'',color:m?.color?.getHexString?.()||'',
                  opacity:m?.opacity??1, instanceId:h.instanceId??null,
                  y:+h.point.y.toFixed(3),distance:+h.distance.toFixed(3),
                  parent:o.parent?.name||o.parent?.type||''};
              });
            out.push({pixel:[px,py],nearest});
          }
          return out;
        });
        console.log('[pink-quad-probe]',JSON.stringify(pinkProbe));
      }
      const name=area+(process.env.LEVEL?'-L'+process.env.LEVEL:'')+'-'+mode;
      await page.screenshot({path:join(OUT,name+'.png')});
      results.push({name,...perf,ground,sceneAudit,errors});
      console.log(name,JSON.stringify(perf),JSON.stringify(ground));
      if (errors.length) throw new Error('WebGL or page errors in '+name+': '+errors.join(' | '));
      await page.close();
    }
  }
  await writeFile(join(OUT,'summary.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally {await browser.close();server.close();}
