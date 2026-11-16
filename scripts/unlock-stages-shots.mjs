// Reproducible owner-playtest shots: same real UI triggers against before and after worktrees.
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), pptr=createRequire('/workspace/pptr/package.json')('puppeteer');
const repo=resolve(new URL('..',import.meta.url).pathname);
global.window={};
for(const f of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat'])require(repo+'/data/'+f+'.js');
const app=require(repo+'/app.js');
const out='/workspace/prp-unlock-stages-v22846-shots';await mkdir(out,{recursive:true});
const insets={left:47,right:47,top:0,bottom:21};
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const manifest=[];
for(const [label,root] of [['before','/workspace/prp-before-v22844'],['after',repo]]){
 const server=http.createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{let data=await readFile(file);const ext=extname(file);
   if(ext==='.css'||ext==='.html')data=String(data).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g,(_,s)=>insets[s]+'px');
   res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(const [width,height] of [[844,390],[667,375],[932,430]]) for(const kind of ['vault-teaser','vault-unlock-dark','vault-unlock-powered','fabricator-teaser','fabricator-unlock','new-find-first','new-find-later']){
   console.log('starting',label,kind,width,height);
   const save=app.freshState();save.introSeen=true;save.baseState='core_habitable';save.modules.rebirth_core=1;save.modules.fabricator=1;save.roomUnlocks={fabricator:true};save.payoffDone=true;
   save.beat=window.DATA.progression.beats.findIndex(b=>b.id==='choice_upgrade');
   save.bitCardsSeen={core_restored:true,raid_briefing:true,fabricator_built:true,quest_intro:true,vault_intro:true,vault_unlocked:true,first_death:true,new_find:true};
   save.stash={polymer_plate:2,scrap_alloy:8,cable:8};save.cur.scrap=200;save.seenItems={};
   if(kind==='vault-teaser'){save.bitCardsSeen.vault_intro=false;save.bitCardsSeen.vault_unlocked=false;save.stash={};save.cur.scrap=0;}
   if(kind.startsWith('vault-unlock'))save.bitCardsSeen.vault_unlocked=false;
   if(kind.startsWith('fabricator')){save.modules.fabricator=0;save.bitCardsSeen.fabricator_built=false;if(kind==='fabricator-teaser')save.bitCardsSeen.raid_briefing=false;}
   if(kind==='new-find-first')save.bitCardsSeen.new_find=false;
   const browser=await pptr.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
   try{
    const page=await browser.newPage();await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.evaluateOnNewDocument(save=>{localStorage.setItem('pr_meta_save',JSON.stringify(save));sessionStorage.setItem('pr_splash_seen',String(Date.now()));window.PR_NAVIGATE=()=>{};},save);
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load'});
    await page.waitForFunction(()=>document.body.dataset.screen==='base');
    await page.evaluate(()=>{closeAllPopups();A.go("base");});
    if(kind.startsWith('vault-unlock'))await page.evaluate(()=>A.build('storage'));
    if(kind==='fabricator-unlock'){
     await page.evaluate(()=>A.build('fabricator'));
     await page.waitForSelector('#overlay [data-close]',{visible:true});await page.click('#overlay [data-close]');
    }
    if(kind.startsWith('new-find'))await page.evaluate(()=>{S.itemInfoQueue=['polymer_plate'];maybeShowItemInfo();});
    const scene=kind.includes('teaser')||kind==='fabricator-unlock'||(label==='after'&&kind.startsWith('vault-unlock'));
    if(scene)await page.waitForSelector('.bit-cutscene',{visible:true});
    else await page.waitForSelector('#overlay',{visible:true});
    await new Promise(r=>setTimeout(r,kind.endsWith('-dark')?800:4200));
    const info=await page.evaluate(()=>{
     const el=document.querySelector('.bit-cutscene')||document.querySelector('#overlay');
     const b=el.getBoundingClientRect(), p=el.querySelector('.pop,.pop-card,.popup')||el;
     return {scene:el.dataset.id||null,text:el.textContent,from:el.querySelector('.bit-cutscene-from')?.getAttribute('src'),to:el.querySelector('.bit-cutscene-to')?.getAttribute('src'),box:{x:b.x,y:b.y,width:b.width,height:b.height},scroll:p.scrollHeight,client:p.clientHeight};
    });
    const name=`${label}-${kind}-${width}x${height}.png`;await page.screenshot({path:out+'/'+name});manifest.push({name,...info,errors});console.log(name,info.scene||'popup');
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
}
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
console.log('Captured',manifest.length,'screenshots');
