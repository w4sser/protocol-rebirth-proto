// PRB-155: real build/death triggers, baseline and current captures with phone safe insets.
// NODE_PATH=/workspace/pptr/node_modules CHROME_PATH=/usr/bin/google-chrome node scripts/narrator-cutscene-shots.mjs
import http from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve, extname, sep} from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire('/workspace/pptr/package.json');
const puppeteer = require('puppeteer');
const current = resolve(import.meta.dirname, '..');
const out = process.env.FAB_ONLY ? '/workspace/prp-fab-art-v22836-shots' : '/workspace/prp-narrator-cs-v22834-shots';
const insets = {left:47,right:47,top:0,bottom:21};
const types = {'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const sleep = ms => new Promise(r => setTimeout(r, ms));
global.window = {};
for(const f of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat']) require(current + '/data/' + f + '.js');
const {freshState} = require(current + '/app.js');
function seed(kind){
  const s = freshState(); s.introSeen = true;
  if(kind === 'core') s.stash.scrap_alloy = 2;
  else {
    s.modules.rebirth_core = 1; s.baseState = 'core_habitable'; s.roomUnlocks = {fabricator:true};
    if(kind === 'fabricator') {
      const cost = window.DATA.modules.find(m => m.id === 'fabricator').levels[0].cost;
      s.cur.scrap = cost.scrap; Object.assign(s.stash, cost.items);
    } else s.modules.fabricator = 1;
  }
  return s;
}
const result = {schema:'protocol-rebirth/raid-result',version:1,raidId:'nodspel:narrator-shot',outcome:'death',area:'bunker',levelsCleared:1,enemiesDefeated:0,nodesLit:0,remainingMs:0,extracted:[],lost:['cable'],endedAt:1,kitLeft:{medkit:0}};
const reports = [];
await mkdir(out,{recursive:true});
for(const [phase, root] of [['before','/workspace/prp-before-main'],['after',current]].filter(([phase]) => !(process.env.AFTER_ONLY || process.env.FAB_ONLY) || phase === 'after')){
  const server = http.createServer(async (req,res) => {
    const path = decodeURIComponent(new URL(req.url,'http://x').pathname);
    const target = resolve(root,'.' + (path.endsWith('/') ? path + 'index.html' : path));
    if(!target.startsWith(root + sep)){ res.writeHead(403); res.end(); return; }
    try {
      let body = await readFile(target); const ext = extname(target);
      if(ext === '.css' || ext === '.html') body = String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,s) => insets[s] + 'px');
      res.writeHead(200,{'Content-Type':types[ext] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(body);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  try {
    for(const [width,height] of [[844,390],[667,375],[932,430]]){
      for(const scenario of process.env.FAB_ONLY ? ['fabricator'] : phase === 'before' ? ['core'] : ['core','death','fabricator','reduced']){
        const reduced = scenario === 'reduced', kind = reduced ? 'fabricator' : scenario;
        const browser = await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
        try {
          const page = await browser.newPage(); const errors = [];
          if(reduced) await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
          page.on('pageerror',e => errors.push(String(e)));
          await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
          await page.evaluateOnNewDocument((save,death) => {
            localStorage.setItem('pr_meta_save',JSON.stringify(save));
            if(death) localStorage.setItem('pr_raid_result_v1',JSON.stringify(death));
            sessionStorage.setItem('pr_splash_seen',String(Date.now())); window.PR_NAVIGATE = () => {};
          },seed(kind),kind === 'death' ? result : null);
          await page.goto('http://127.0.0.1:' + server.address().port + '/index.html',{waitUntil:'load'});
          await page.waitForFunction(() => document.body.dataset.screen === 'base');
          if(kind === 'death'){
            await page.waitForSelector('#overlay.raid-summary-ov button.primary[data-close]',{visible:true});
            await page.click('#overlay.raid-summary-ov button.primary[data-close]');
          } else {
            await page.evaluate(id => A.build(id),kind === 'core' ? 'rebirth_core' : 'fabricator');
            if(phase === 'before' || kind === 'fabricator'){
              await page.waitForSelector('#overlay [data-close]',{visible:true});
              if(phase === 'before'){
                await sleep(400);
                const path = `${out}/before-power-popup-${width}x${height}.png`;
                await page.screenshot({path}); reports.push({phase,kind:'power-popup',width,height,path});
              }
              await page.click('#overlay [data-close]');
            } else assert.equal(await page.$('#overlay'),null,'Core has no payoff popup');
          }
          await page.waitForSelector('.bit-cutscene',{visible:true,timeout:20000});
          if(kind === 'fabricator') await page.waitForFunction(() => [...document.querySelectorAll('.bit-cutscene-stage img')].every(img => img.complete && img.naturalWidth > 0));
          for(const frame of ['early','late']){
            if(frame === 'early' && phase === 'after' && !reduced && kind !== 'fabricator'){
              await page.waitForFunction(() => document.querySelector('.bit-cutscene')?.classList.contains('crossfaded'));
              await sleep(250);
            }
            if(frame === 'late'){
              await page.waitForFunction(after => {
                const el = document.querySelector('.bit-cutscene');
                return el?.classList.contains('crossfaded') && Number(getComputedStyle(el.querySelector('.bit-cutscene-to')).opacity) >= .99 && (!after || el.classList.contains('info-visible'));
              },{},phase === 'after');
              await sleep(500);
            }
            const info = await page.evaluate(() => {
              const el = document.querySelector('.bit-cutscene');
              const rect = s => {const n = el.querySelector(s);if(!n)return null; const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
              const r = el.getBoundingClientRect();
              const stage = el.querySelector('.bit-cutscene-stage').getBoundingClientRect().toJSON();
              const geometry = window.PRBitCutscene.geometry;
              const painted = el.dataset.id === 'fabricator_built' ? Object.fromEntries(['bit','vest'].map(k => [k, window.PRBitCutscene.paintedRect(stage,geometry[k])])) : null;
              return {images:[...el.querySelectorAll('.bit-cutscene-stage img')].map(img => ({src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,opacity:getComputedStyle(img).opacity})),painted,box:{x:r.x,y:r.y,width:r.width,height:r.height},copy:rect('.bit-cutscene-copy'),bubble:rect('.bit-cutscene-bubble'),bust:rect('.bit-cutscene-bust'),strip:rect('.bit-cutscene-info'),text:el.innerText,overlay:!!document.querySelector('#overlay'),card:!!document.querySelector('.bit-card:not([hidden])'),lineOpacity:getComputedStyle(el.querySelector('.bit-cutscene-line')).opacity,stripOpacity:el.querySelector('.bit-cutscene-info') && getComputedStyle(el.querySelector('.bit-cutscene-info')).opacity};
            });
            if(kind === 'fabricator'){
              assert(info.images[0].src.endsWith('cutscene-fabricator-dark-v1.webp') && info.images[1].src.endsWith('cutscene-fabricator-powered-v1.webp'),'dedicated pair actually displayed');
              assert(info.images.every(img => img.width === 1600 && img.height === 720),'loaded source geometry matches projection');
              assert(frame === 'early' ? Number(info.images[1].opacity) === 0 : Number(info.images[1].opacity) >= .99,'early frame is dark and late frame is powered');
            }
            assert.deepEqual(info.box,{x:0,y:0,width,height},'full bleed');
            for(const b of [info.copy,info.bust,info.strip].filter(Boolean)){
              assert(b.x >= insets.left && b.right <= width-insets.right && b.y >= 0 && b.bottom <= height-insets.bottom,'safe area: ' + JSON.stringify(info));
            }
            assert(!info.overlay && !info.card,'no stacking');
            if(phase === 'after' && frame === 'late'){
              assert(info.bubble && info.bust && info.strip,'standard layout');
              const a=info.bubble,b=info.strip;
              assert(!(a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y),'bubble and strip do not overlap');
              if(kind === 'fabricator'){
                assert.equal(await page.$('.bit-cutscene-fx'),null,'dedicated art has no procedural overlay');
                for(const subject of Object.values(info.painted)) for(const b of [info.bubble,info.bust,info.strip]){
                  assert(!(subject.x < b.right && subject.right > b.x && subject.y < b.bottom && subject.bottom > b.y),'painted subject is clear of UI: ' + JSON.stringify({subject,b}));
                }
              }
              assert(Number(info.lineOpacity) >= .99 && Number(info.stripOpacity) >= .99,'readable late frame');
            }
            if(reduced){
              const styles = await page.evaluate(() => {
                const el = document.querySelector('.bit-cutscene');
                return {hint:el.classList.contains('hint-visible'),opacity:['.bit-cutscene-bust','.bit-cutscene-bubble','.bit-cutscene-info','.bit-cutscene-continue','.bit-cutscene-hologram'].map(s => el.querySelector(s) ? getComputedStyle(el.querySelector(s)).opacity : '1'),transitions:['.bit-cutscene-bust','.bit-cutscene-bubble','.bit-cutscene-info','.bit-cutscene-continue'].map(s => getComputedStyle(el.querySelector(s)).transitionDuration),animation:getComputedStyle(el.querySelector('.bit-cutscene-stage')).animationName};
              });
              assert(styles.hint && styles.opacity.every(o => Number(o) === 1),'all reduced-motion content appears immediately');
              assert(styles.transitions.every(t => t === '0s') && styles.animation === 'none','no reduced-motion animation');
              info.reducedStyles = styles;
            }
            const path = process.env.FAB_ONLY ? `${out}/fab-${frame}-${width}x${height}.png` : `${out}/${phase}-${scenario}-${frame}-${width}x${height}.png`;
            await page.screenshot({path}); reports.push({phase,kind,frame,width,height,path,info,errors});
            assert.deepEqual(errors,[],'no runtime errors'); console.log(path);
          }
        } finally {await browser.close();}
      }
    }
  } finally {await new Promise(r => server.close(r));}
}
await writeFile(out + ((process.env.AFTER_ONLY || process.env.FAB_ONLY) ? '/after-results.json' : '/results.json'),JSON.stringify(reports,null,2));
console.log('Narrator screenshots passed:',reports.length);
