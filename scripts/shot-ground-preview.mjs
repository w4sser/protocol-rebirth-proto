// PREVIEW: real raid camera screenshots with/without ?ground=1 (same seed) + rough FPS/draw calls. Best-effort.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname, join } from 'node:path';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = process.env.OUT || join(root, 'verify-out', 'ground');
const types = { '.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary' };
const server = createServer(async (req, res) => { const p = decodeURIComponent(new URL(req.url,'http://x').pathname); const t = resolve(root,'.'+(p.endsWith('/')?p+'index.html':p)); if(!t.startsWith(root+sep)){res.writeHead(403);res.end();return;} try{const b=await readFile(t);res.writeHead(200,{'Content-Type':types[extname(t)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();} });
await new Promise(r => server.listen(0,'127.0.0.1',r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const puppeteer = createRequire(import.meta.url)('puppeteer');
const browser = await puppeteer.launch({ headless:true, executablePath:process.env.CHROME_PATH, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
await mkdir(OUT,{recursive:true});
const settle = ms => new Promise(r => setTimeout(r, ms));
const results = [];
for (const area of (process.env.AREAS||'bunker,archipelago').split(',')) for (const g of ['0','1']) {
  const page = await browser.newPage(); page.on('console', m => { if(/ground-preview/.test(m.text())) console.log(area, m.text()); });
  await page.evaluateOnNewDocument(() => { window.__dc=0; for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) for (const f of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) { const o=C.prototype[f]; if(o) C.prototype[f]=function(...a){window.__dc++;return o.apply(this,a);}; } });
  await page.setViewport({ width:1280, height:720, deviceScaleFactor:1 });
  await page.goto(`${BASE}/nodspel/?seed=groundshot&debug=1&q=high&area=${area}&return=..%2Findex.html${g==='1'?'&ground=1':''}`, { waitUntil:'load' }); await settle(2500);
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^start$/i.test(b.textContent.trim())) { b.click(); break; } });
  if(process.env.LEVEL) await page.evaluate(n=>window.__NR.goLevel(n), +process.env.LEVEL);
  await settle(process.env.LEVEL?1200:4000);
  const perf = await page.evaluate(() => new Promise(ok => { let n=0; const d0=window.__dc, t0=performance.now(); const f=()=>{ if(++n<60) requestAnimationFrame(f); else { const dt=performance.now()-t0; ok({ fps:+(n*1000/dt).toFixed(1), drawsPerFrame:Math.round((window.__dc-d0)/n) }); } }; requestAnimationFrame(f); }));
  const name = `${area}${process.env.LEVEL?'-L'+process.env.LEVEL:''}-ground${g}`; await page.screenshot({ path: join(OUT, name+'.png') });
  results.push({ name, ...perf }); console.log(name, JSON.stringify(perf)); await page.close();
}
console.log(JSON.stringify(results)); await browser.close(); server.close();
