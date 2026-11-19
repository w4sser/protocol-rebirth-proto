// Graphics pilot evidence. Run from repo root: node scripts/gfx-pilot.mjs shots|perf|smoke|rocks|all
// Chrome/Puppeteer are local prerequisites. Static servers and browsers always close in finally.
// Derived from Claude's inherited capture harness; no gameplay or art fixtures are shipped.
import http from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import {createRequire} from "node:module";
import {resolve, extname, sep} from "node:path";

const ROOTS = {before: resolve(process.env.GFX_BEFORE_ROOT || "/workspace/prp-before-v22852"), after: process.cwd()};
const outDir = resolve(process.env.GFX_SHOTS_DIR || "/workspace/prp-gfx-v22853-shots");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); } catch { puppeteer = require("puppeteer-core"); }
const launchOpts = {
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};
const types = {".html":"text/html",".js":"application/javascript",".mjs":"application/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp",".png":"image/png",".glb":"model/gltf-binary",".ogg":"audio/ogg",".m4a":"audio/mp4",".woff2":"font/woff2",".webmanifest":"application/manifest+json"};

function serverFor(root){
  return http.createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const target = resolve(root, "." + p);
    if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try {
      let body = await readFile(target);
      if(['.html','.css'].includes(extname(target)))body=String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,side)=>({left:47,right:47,top:0,bottom:21})[side]+'px');
      res.writeHead(200, { "Content-Type": types[extname(target)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
}
async function withServer(root, fn){
  const server = serverFor(root);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try { return await fn(base); } finally { server.close(); }
}
async function withPage(w, h, fn){
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const errors=[];page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m=>{if(m.type()==="error" && /THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  try { const result=await fn(page);if(errors.length)throw Error(errors.join("\n"));return result; } finally { await browser.close(); }
}


const SEED='gfxpilot1',mode=process.argv[2]||'all';
const settle=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(page,base,quality,scene='pad'){
  await page.goto(`${base}/nodspel/index.html?seed=${SEED}&area=bunker&debug=1&raids=${scene==='drum'?0:6}&q=${quality}`,{waitUntil:'load'});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await page.waitForFunction(()=>!document.getElementById('boot-loader'),{timeout:30000});
  await page.click('#tutorial-start');
  await page.waitForFunction(()=>window.__NR?.round(),{timeout:30000});
  await page.evaluate(scene=>{
    const nr=window.__NR,l=nr.round().level;
    nr.setMoodAutoDowngradeEnabled(false);nr.openExit();
    if(scene==='drum'){
      // Keep the bands intact: drumDemo detonates the first drum before the capture.
      const b=l.barrels[0];nr.teleport(b.x,b.z+2.5);
    }else{
      nr.padDemo('live');const j=l.junctions[0],p=l.hazards.find(h=>h.id===j.padId),e=l.exit;
      p.forcedUntil=Infinity;nr.teleport((j.x+p.x+e.x)/3,(j.z+p.z+e.z)/3);
    }
  },scene);
}
async function shot(branch,w,h,quality,scene){return withServer(ROOTS[branch],base=>withPage(w,h,async page=>{
  await boot(page,base,quality,scene);await settle(500);
  const info=await page.evaluate(()=>({quality:__NR.quality(),level:__NR.round().level.number,over:__NR.round().over}));
  if(info.quality!==quality||info.over)throw Error('capture changed quality or ended raid');
  const path=`${outDir}/${scene}-${branch}-${quality}-${w}x${h}.png`;await page.screenshot({path});console.log(path);return {path,info};
}));}
async function perf(branch,quality){return withServer(ROOTS[branch],base=>withPage(844,390,async page=>{
  await boot(page,base,quality);
  const result=await page.evaluate(()=>__NR.capturePerformance({durationMs:10000,warmupMs:1500,deviceLabel:'headless-swiftshader'}));
  const final=await page.evaluate(()=>({quality:__NR.quality(),over:__NR.round().over}));
  if(final.quality!==quality||final.over)throw Error('performance fixture changed quality or ended raid');
  // Profiler FPS is sample count / sum(frame times), so this is the arithmetic average, not median.
  return {branch,quality,...result,averageFrameMs:1000/result.fps};
}));}
async function smoke(){return withServer(ROOTS.after,base=>withPage(844,390,async page=>{
  await boot(page,base,'high');const samples=[];
  for(const quality of ['medium','low','high','medium','high','low','high']){
    await page.evaluate(q=>__NR.setQuality(q),quality);await settle(180);
    await page.setViewport({width:quality==='medium'?667:844,height:quality==='medium'?375:390,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    samples.push(await page.evaluate(()=>({quality:__NR.quality(),...__NR.info()})));
  }
  await page.screenshot({path:`${outDir}/quality-switch-high.png`});return samples;
}));}
async function rocks(){return withServer(ROOTS.after,base=>withPage(844,390,async page=>{
  await boot(page,base,'high');
  const info=await page.evaluate(async()=>{
    const {GLTFLoader}=await import('/nodspel/vendor/GLTFLoader.js');
    const gltf=await new GLTFLoader().loadAsync('/assets/env/nature/rocks-gen/rock_gen_c.glb');
    const nr=__NR,pos=nr.state().position;gltf.scene.position.set(pos.x-1.6,0,pos.z+.4);
    nr.getScene().add(gltf.scene);const meshes=[];gltf.scene.traverse(n=>{if(n.isMesh)meshes.push({vertexColors:n.material.vertexColors,hasColor:!!n.geometry.attributes.color});});
    return {asset:'rock_gen_c.glb',meshes,placement:'debug scene only, original scale, camera untouched'};
  });
  await settle(500);await page.screenshot({path:`${outDir}/rocks-gen-bunker-high-844x390.png`});return info;
}));}
await mkdir(outDir,{recursive:true});
const {writeFile}=await import('node:fs/promises');
if(mode==='shots'||mode==='all'){
  const results=[];for(const branch of ['before','after'])for(const [w,h] of [[844,390],[667,375],[932,430]])for(const quality of ['high','low'])for(const scene of ['pad','drum'])results.push(await shot(branch,w,h,quality,scene));
  await writeFile(`${outDir}/shot-results.json`,JSON.stringify(results,null,2));
}
if(mode==='perf'||mode==='all'){
  const results=[];for(const branch of ['before','after'])for(const quality of ['low','high']){const r=await perf(branch,quality);results.push(r);console.log(branch,quality,r.fps,r.averageFrameMs);}
  await writeFile(`${outDir}/fps.json`,JSON.stringify({note:'Headless SwiftShader software GL: relative comparisons only, not physical-phone FPS.',scene:'bunker L1 live pad, junction and open extract; 844x390; 10s capture after 1.5s warmup',results},null,2));
}
if(mode==='smoke'||mode==='all')await writeFile(`${outDir}/quality-switch.json`,JSON.stringify(await smoke(),null,2));
if(mode==='rocks'||mode==='all')await writeFile(`${outDir}/rocks-gen.json`,JSON.stringify(await rocks(),null,2));
