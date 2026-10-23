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
async function shot(name, setup, vp){
  vp = vp || [844, 390];
  const page = await browser.newPage();
  await page.setViewport({ width:vp[0], height:vp[1], isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  await page.goto(BASE + '/index.html', { waitUntil:'load' });
  await settle(900);
  await page.evaluate(() => { document.getElementById('splash')?.click(); });
  await settle(200);
  await page.evaluate(setup);
  await settle(600);
  await page.screenshot({ path: join(OUT, name + '.png') });
  await page.close();
  console.log('wrote', name);
}
const SEED = `S.introSeen=true;S.beat=PROG.beats.length-1;S.modules={rebirth_core:2,fabricator:2,bit_bay:1,storage:1};S.roomUnlocks={fabricator:true,storage:true,bit_bay:true,living_quarters:true};S.baseState='core_habitable';S.cur.scrap=120;S.revealed={scrap:true};S.stash=Object.assign(S.stash||{},{cable:3,polymer_plate:3,scrap_alloy:3,fuse:3,circuit_board:3});S.power={value:60,at:Date.now(),offlineDrained:0,reinforceAt:0,lastRoom:null,maintain:null};session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());`;
const LOCKED = SEED + `S.roomUnlocks={};S.modules.bit_bay=0;`;
for(const [tag, vp] of [['', [844, 390]], ['-667', [667, 375]]]){
  await shot('t2-room-explain-locked' + tag, LOCKED + `A.openRoom('storage');`, vp);
  await shot('t2-room-explain-open' + tag, SEED + `A.openRoom('bit_bay');`, vp);
  await shot('t2-fabricator-craft' + tag, SEED + `A.openRoom('fabricator');`, vp);
  await shot('t2-quarters-before' + tag, SEED + `A.openRoom('living_quarters');`, vp);
  await shot('t2-quarters-rested' + tag, SEED + `A.openRoom('living_quarters');A.rest();`, vp);
}
await browser.close(); server.close();
console.log('done', OUT);
