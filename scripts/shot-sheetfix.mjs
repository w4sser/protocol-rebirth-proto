// T2 (PRB-90) screenshots: room explain (locked + open), Fabricator craft UI, Living Quarters rest before/after.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname, join } from 'node:path';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(join(root, 'verify-out'));
const types = { '.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const target = resolve(root, '.' + (p.endsWith('/') ? p + 'index.html' : p));
  if(!target.startsWith(root + sep)){ res.writeHead(403); res.end(); return; }
  try { const body = await readFile(target); res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url);
let puppeteer, launchOpts = { headless:true, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] };
try { puppeteer = require('puppeteer'); }
catch { puppeteer = require('puppeteer-core'); launchOpts.executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome'; }
if(process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
await mkdir(OUT, { recursive:true });
const browser = await puppeteer.launch(launchOpts);
const settle = ms => new Promise(r => setTimeout(r, ms));
// v2.26.1: Rebirth Core selected -> room action sheet. Screens + overlap checks (sheet vs RAID/menu, OPEN vs text).
const SEED = `S.introSeen=true;S.beat=PROG.beats.length-1;S.modules={rebirth_core:2,fabricator:2,bit_bay:1,storage:1};S.roomUnlocks={fabricator:true,storage:true,bit_bay:true,living_quarters:true};S.baseState='core_habitable';S.cur.scrap=120;S.revealed={scrap:true};session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());selectBaseSpot(document.querySelector('.core-spot'));`;
const OUTD = process.env.SHOT_OUT || OUT; await mkdir(OUTD, { recursive:true }); let bad = 0;
for(const vp of [[844,390],[820,377],[667,375],[1280,720],[1920,1080]]){
  const page = await browser.newPage();
  await page.setViewport({ width:vp[0], height:vp[1], isMobile:vp[0]<1000, hasTouch:true, deviceScaleFactor:1 });
  await page.goto(BASE + '/index.html', { waitUntil:'load' }); await settle(900);
  await page.evaluate(()=>{if(window.A)A.startFtueDirect=()=>{};}); await page.evaluate(()=>(document.getElementById('splash-play')||document.getElementById('splash'))?.click()); await page.waitForFunction(()=>!document.getElementById('splash'),{timeout:8000}).catch(()=>{}); await settle(200);
  await page.evaluate(SEED); await settle(600);
  const errs = await page.evaluate(() => { const R = e => e && e.offsetWidth ? e.getBoundingClientRect() : null, ov = (a,b) => a && b && Math.min(a.right,b.right)-Math.max(a.left,b.left) > 0 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 0, out = [];
    const sh = R(document.querySelector('.roomsheet')); if(!sh) return ['no sheet'];
    if(ov(sh, R(document.querySelector('#tabs .nav-prep')))) out.push('sheet overlaps RAID');
    if(ov(sh, R(document.querySelector('.basemenu-btn')))) out.push('sheet overlaps menu');
    if(sh.left < 0 || sh.right > innerWidth || sh.bottom > innerHeight) out.push('sheet off screen');
    const txt = [...document.querySelectorAll('.roomsheet .rs-head b,.roomsheet .rs-head small')].map(R);
    for(const b of document.querySelectorAll('.roomsheet button')){ const r = R(b); if(!r) continue; if(r.width < 44 || r.height < 44) out.push('button <44px: ' + b.textContent.trim());
      for(const t of txt) if(ov(r, t)) out.push('button overlaps text: ' + b.textContent.trim()); }
    for(const e of document.querySelectorAll('.roomsheet *')){ const r = R(e); if(r && (r.right > sh.right + 1 || r.left < sh.left - 1)) out.push('content overflows sheet: ' + e.className); }
    return [...new Set(out)]; });
  await page.screenshot({ path: join(OUTD, `core-selected-${vp[0]}x${vp[1]}.png`) });
  console.log(vp.join('x'), errs.length ? 'FAIL ' + errs.join('; ') : 'ok'); bad += errs.length; await page.close();
}
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
