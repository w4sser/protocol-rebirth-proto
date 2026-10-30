import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,sep,extname} from 'node:path';
import {inflateSync} from 'node:zlib';

// Minimal PNG 1x1 RGB(A) pixel decoder (no deps): walks IDAT chunks, inflates, and reads the
// first (only) filtered scanline byte-for-byte -- for a single pixel all PNG filter types
// degenerate to the raw value since the left/up neighbours are implicitly 0.
function pngPixel(buf){
  let i = 8, idat = [];
  while(i < buf.length){
    const len = buf.readUInt32BE(i), type = buf.toString('ascii', i+4, i+8);
    if(type === 'IDAT') idat.push(buf.subarray(i+8, i+8+len));
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return [raw[1], raw[2], raw[3]];
}

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const target=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const body=await readFile(target);const ext=extname(target);
    res.writeHead(200,{'Content-Type':types[ext]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);}
  catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({headless:true, executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page = await browser.newPage();
page.on('console', m => console.log('PAGE:', m.text()));
page.on('pageerror', e => console.log('PAGEERROR:', e));
await page.setViewport({width:844, height:390});
await page.goto(BASE + '/index.html?q=high', {waitUntil:'load', timeout:60000});
await new Promise(r => setTimeout(r, 1500)); // let the flight mount + shaders compile
const outBase = process.argv[2] || '/tmp/splash';
const waits = (process.argv[3] || '0,1800,3600,5400,7200').split(',').map(Number);
let prev = 0;
for(const w of waits){
  await new Promise(r => setTimeout(r, Math.max(0, w - prev)));
  prev = w;
  await page.screenshot({path: `${outBase}-${w}.png`});
  const pts = {top:[80,5], upper:[80,70], mid:[80,150], lower2:[80,220], lower:[80,290], bottom:[80,350]};
  const out = {};
  for(const [k,[x,y]] of Object.entries(pts)){
    const buf = await page.screenshot({clip:{x,y,width:1,height:1}});
    out[k] = pngPixel(buf);
  }
  console.log(`t=${w}ms px=`, out);
}
await browser.close();
server.close();
