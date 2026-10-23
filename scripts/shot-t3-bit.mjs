// T3 (PRB-94) screenshots: BIT hub skill tree and the pending-haul Confirm popup. Copies to /workspace/prp-qh-shots/ when present.
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
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
async function shot(name, setup, vp, after){
  vp = vp || [844, 390];
  const page = await browser.newPage();
  await page.setViewport({ width:vp[0], height:vp[1], isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  await page.goto(BASE + '/index.html', { waitUntil:'load' });
  await settle(900);
  await page.evaluate(() => { document.getElementById('splash')?.click(); });
  await settle(200);
  await page.evaluate(setup);
  await settle(500);
  if(after) await page.evaluate(after);
  await settle(400);
  await page.screenshot({ path: join(OUT, name + '.png') });
  await page.close();
  try { await access('/workspace/prp-qh-shots'); await copyFile(join(OUT, name + '.png'), join('/workspace/prp-qh-shots', name + '.png')); } catch {}
  console.log('wrote', name);
}
const SEED = `S.introSeen=true;S.beat=PROG.beats.length-1;S.modules={rebirth_core:2,fabricator:1,bit_bay:1,storage:1};S.roomUnlocks={fabricator:true,storage:true,bit_bay:true};S.baseState='core_habitable';S.bondXp=150;S.bitSkill='zone_scout';S.revealed={scrap:true};document.querySelectorAll('#overlay').forEach(o=>o.remove());`;
const PEND = `idleState().scavPending={scrap:12,items:{cable:1,scrap_alloy:1}};`;
const SCROLL_SKILLS = `document.querySelector('.bitskills')?.scrollIntoView({block:'center'});`;
for(const [tag, vp] of [['', [844, 390]], ['-667', [667, 375]], ['-932', [932, 430]]]){
  await shot('t3-bit-skills' + tag, SEED + `A.go('bit');`, vp, SCROLL_SKILLS);
  await shot('t3-bit-confirm' + tag, SEED + PEND + `A.go('bit');A.openHaul();`, vp);
}
await browser.close(); server.close();
console.log('done', OUT);
