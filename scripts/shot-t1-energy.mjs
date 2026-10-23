// Screenshots: base HUD with power meter + tracked goal; low-energy warn popup.
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
async function shot(name, setup){
  const page = await browser.newPage();
  await page.setViewport({ width:844, height:390, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
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
const SEED = `S.introSeen=true;S.beat=PROG.beats.length-1;S.modules={rebirth_core:1,fabricator:1,bit_bay:1,storage:1};S.roomUnlocks={fabricator:true,storage:true,bit_bay:true};S.baseState='core_habitable';S.cur.scrap=80;S.revealed={scrap:true};S.chains={bunker:{step:0,prog:1}};S.trackedQuest='bunker';S.power={value:100,at:Date.now(),offlineDrained:0,reinforceAt:0,lastRoom:null,maintain:null};session.screen='base';refresh();document.querySelectorAll('#overlay').forEach(o=>o.remove());`;
await shot('t1-base-energy-tracked', SEED);
await shot('t1-energy-low-warn', SEED + `S.power.value=18;S.power.at=Date.now();refresh();A.powerTap();`);
await browser.close(); server.close();
console.log('done', OUT);
