// T5 (PRB-92) screenshots: Raid Prep HARD toggle, L1 raid spawn (no shield guard), Hard L2 guard telegraph, thrower ring (Archipelago L2).
// Raid shots need WebGL (swiftshader); each shot is best-effort: a failure is logged and the script still exits 0 so it never breaks verify.
// Writes verify-out/ and copies to /workspace/prp-qh-shots/ when present.
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname, join } from 'node:path';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(join(root, 'verify-out'));
const types = { '.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json' };
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
catch { try { puppeteer = require('puppeteer-core'); launchOpts.executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome'; } catch { console.log('no puppeteer: skipped'); server.close(); process.exit(0); } }
if(process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
await mkdir(OUT, { recursive:true });
const settle = ms => new Promise(r => setTimeout(r, ms));
const VP = [844, 390];
async function save(page, name){
  await page.screenshot({ path: join(OUT, name + '.png') });
  try { await access('/workspace/prp-qh-shots'); await copyFile(join(OUT, name + '.png'), join('/workspace/prp-qh-shots', name + '.png')); } catch {}
  console.log('wrote', name);
}
let browser;
try { browser = await puppeteer.launch(launchOpts); } catch(e) { console.log('no browser: skipped', String(e.message || e).slice(0, 120)); server.close(); process.exit(0); }
// Meta: Raid Prep with the HARD toggle on (Bunker Hard unlocked, Core L3).
async function prepShot(){
  const page = await browser.newPage();
  await page.setViewport({ width:VP[0], height:VP[1], isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  await page.goto(BASE + '/index.html', { waitUntil:'load' }); await settle(900);
  await page.evaluate(() => { document.getElementById('splash')?.click(); }); await settle(200);
  await page.evaluate(`S.introSeen=true;S.beat=PROG.beats.length-1;S.modules={rebirth_core:3,fabricator:2,bit_bay:1,storage:1};S.roomUnlocks={fabricator:true,storage:true,bit_bay:true};S.baseState='core_habitable';S.unlocks.hard.bunker=true;A.go('prep');A.toggleHard();`);
  await settle(6500); await save(page, 't5-raid-prep-hard'); await page.close();
}
// Raid: open the real game; `fn` runs in the page after load (window.__NR needs ?debug=1).
async function raidShot(name, query, fn){
  const page = await browser.newPage();
  await page.setViewport({ width:VP[0], height:VP[1], isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  try {
    await page.goto(`${BASE}/nodspel/?seed=t5shot&debug=1&q=high&return=..%2Findex.html&${query}`, { waitUntil:'load' }); await settle(2500);
    await page.evaluate(() => { for(const b of document.querySelectorAll('button')) if(/^start$/i.test(b.textContent.trim())){ b.click(); break; } }); await settle(500);
    if(fn) await page.evaluate(fn); await settle(900);
    await save(page, name);
  } catch(e) { console.log('skipped', name, String(e.message || e).slice(0, 120)); }
  await page.close();
}
// Stand 4 m in front of the first enemy matching `pick` (state read from the live round).
const NEAR = pick => `(async()=>{const L=window.__NR.state().level,e=L.enemies.find(${pick});if(!e)return;const f=e.facing??0;window.__NR.teleport(e.x+Math.sin(f)*4,e.z+Math.cos(f)*4);})()`;
try { await prepShot(); } catch(e) { console.log('skipped prep', String(e.message || e).slice(0, 120)); }
await raidShot('t5-raid-l1-spawn', 'area=bunker', null);
await raidShot('t5-hard-l2-guard', 'area=bunker&hard=1', `(async()=>{await window.__NR.goLevel(2);})().then(()=>0)`);
await raidShot('t5-hard-l2-guard-warning', 'area=bunker&hard=1', `(async()=>{await window.__NR.goLevel(2);${NEAR('x=>x.encounter===\"guard\"')}})()`);
await raidShot('t5-archipelago-l2-thrower', 'area=archipelago', `(async()=>{await window.__NR.goLevel(2);${NEAR('x=>x.encounter===\"grenadier\"')}})()`);
await browser.close(); server.close();
console.log('done', OUT);
