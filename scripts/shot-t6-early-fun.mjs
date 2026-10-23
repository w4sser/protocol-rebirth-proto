// T6 (PRB-93) screenshots: first-raid intro HUD (BIT tip) and Breach Shotgun raid spawn.
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
async function raidShot(name, query){
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:VP[0], height:VP[1], isMobile:true, hasTouch:true, deviceScaleFactor:2 });
    await page.goto(BASE + '/nodspel/index.html?' + query, { waitUntil:'load', timeout:20000 }); await settle(2500);
    await save(page, name); await page.close();
  } catch(e){ console.log('shot skipped', name, String(e.message || e).slice(0, 100)); }
}
await raidShot('t6-first-raid-hud', 'seed=t6intro&intro=1');
await raidShot('t6-shotgun-spawn', 'seed=t6shotgun&gear=shotgun_breach&w=id:shotgun_breach,dmg:3,mag:2,rld:1000,int:600,rng:4.5,cone:18,ast:22,spr:9,kb:1.1,pel:5,hom:0');
try { await browser.close(); } catch {}
server.close();
