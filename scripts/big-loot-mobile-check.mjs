// Browser/touch smoke only. Not physical-phone performance or combat validation.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),out=resolve(root,'verify-out/big-loot-mobile');
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname),file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
await mkdir(out,{recursive:true});
const puppeteer=createRequire(import.meta.url)('puppeteer'),reports=[];
let browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const [width,height] of [[844,390],[667,375]]){
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.goto(`http://127.0.0.1:${server.address().port}/nodspel/?seed=loot-audit-0&debug=1&q=low&area=bunker&levels=big`,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>!document.getElementById('boot-loader'),{timeout:30000});
  await page.waitForSelector('#tutorial-start',{visible:true,timeout:30000});
  await page.tap('#tutorial-start');
  await page.waitForFunction(()=>window.__NR?.state?.().level?.big,{timeout:30000});
  const plan=await page.evaluate(async()=>{
   const nr=window.__NR,round=nr.round(),l=nr.state().level;
   nr.setRoomClearsEnabled(false);
   // Isolate navigation/pickup from combat so failed shooting is not mislabeled a loot bug.
   for(const e of l.enemies)e.active=false;
   const {movePlayer}=await import('./physics.mjs?v=2.28.0');
   const {RULES}=await import('./levels.js?v=2.28.0');
   const {doorSolids}=await import('./round.js?v=2.28.0');
   const start={...nr.state().position},step=.5,solids=[...l.walls,...l.boxes,...doorSolids(l),...l.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
   const boxes=l.lootBoxes.filter(b=>b.lootTier===1&&!b.collected&&!b.requiresNode);
   const minX=Math.min(...l.floors.map(f=>f.x-f.w/2)),maxX=Math.max(...l.floors.map(f=>f.x+f.w/2)),minZ=Math.min(...l.floors.map(f=>f.z-f.d/2)),maxZ=Math.max(...l.floors.map(f=>f.z+f.d/2));
   const key=(i,j)=>`${i},${j}`,queue=[{i:0,j:0,parent:-1}],seen=new Set([key(0,0)]);
   for(let k=0;k<queue.length&&k<30000;k++){
    const q=queue[k],p={x:start.x+q.i*step,z:start.z+q.j*step};
    const b=boxes.find(b=>Math.hypot(b.x-p.x,b.z-p.z)<RULES.loot.pickupRadius-.3);
    if(b){const path=[];for(let a=k;a>=0;a=queue[a].parent)path.push({x:start.x+queue[a].i*step,z:start.z+queue[a].j*step});
     return {start,target:{id:b.id,item:b.item},path:path.reverse().slice(1),stickRadius:RULES.aimControls.stickRadiusPx,enemyPressureDisabled:true};}
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const id=key(q.i+di,q.j+dj);if(seen.has(id))continue;
     const t={x:p.x+di*step,z:p.z+dj*step};if(t.x<minX||t.x>maxX||t.z<minZ||t.z>maxZ)continue;
     const moved=movePlayer(p,{x:di*step,z:dj*step},solids,l.floors,RULES.playerRadius+.1);
     if(Math.hypot(moved.x-t.x,moved.z-t.z)>1e-6)continue;
     seen.add(id);queue.push({i:q.i+di,j:q.j+dj,parent:k});
    }
   }
   throw Error('No reachable common loot opportunity in rendered map');
  });
  const stick=await page.$eval('#move-stick',el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  const client=await page.createCDPSession();
  const touch=(type,dx=0,dy=0)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:stick.x+dx,y:stick.y+dy,id:1,radiusX:3,radiusY:3,force:1}]});
  await writeFile(resolve(out,`plan-${width}x${height}.json`),JSON.stringify(plan,null,2));
  let point=0,collected=false;const motion=[];
  for(let tick=0;tick<400;tick++){
   const current=await page.evaluate(id=>{const nr=window.__NR;return {position:nr.state().position,collected:nr.state().level.lootBoxes.find(b=>b.id===id)?.collected,over:nr.round().over};},plan.target.id);
   if(tick%10===0)motion.push({tick,point,...current});
   if(tick%50===0)console.log('TOUCH_PROGRESS',width,tick,point,current.position);
   if(current.collected){collected=true;break;}assert.equal(current.over,false,'Fixture raid ended before pickup');
   // Slow software rendering can carry an actor beyond a small waypoint between
   // CDP replies. Advance after crossing it instead of oscillating around it.
   while(point<plan.path.length-1){
    const a=plan.path[point],prev=point?plan.path[point-1]:plan.start;
    const sx=a.x-prev.x,sz=a.z-prev.z,len=Math.hypot(sx,sz)||1;
    const along=((a.x-current.position.x)*sx+(a.z-current.position.z)*sz)/len;
    const side=Math.abs((current.position.x-prev.x)*sz-(current.position.z-prev.z)*sx)/len;
    if(Math.hypot(a.x-current.position.x,a.z-current.position.z)<.18||(along<=.1&&side<.4))point++;else break;
   }
   const target=plan.path[Math.min(point,plan.path.length-1)];assert.ok(target,'Expected a walking path, not teleport pickup');
   const dx=target.x-current.position.x,dz=target.z-current.position.z,length=Math.hypot(dx,dz)||1;
   const magnitude=plan.stickRadius*Math.max(.45,Math.min(.9,length/.5));
   // Short real touch gestures stop movement while the controller reads state.
   // This avoids coupling movement overshoot to slow headless CDP round trips.
   await touch('touchStart');
   await touch('touchMove',(dx-dz)/length/Math.SQRT2*magnitude,(dx+dz)/length/Math.SQRT2*magnitude);
   await sleep(40);
   await touch('touchEnd');
  }
  await page.screenshot({path:resolve(out,`touch-${width}x${height}.png`)});
  await writeFile(resolve(out,`motion-${width}x${height}.json`),JSON.stringify({plan,motion,collected},null,2));
  assert.ok(collected,'Real touch navigation did not collect the target; inspect motion and screenshot');
  const state=await page.evaluate(()=>({position:window.__NR.state().position,bag:window.__NR.round().bag,big:window.__NR.state().level.big,quality:window.__NR.quality()}));
  await page.screenshot({path:resolve(out,`bunker-big-${width}x${height}.png`)});
  assert.equal(errors.length,0,errors.join('\n'));
  reports.push({width,height,seed:'loot-audit-0',target:plan.target,collected,state,enemyPressureDisabled:true,teleported:false});
  await page.close();
 }
 console.log('BIG_LOOT_MOBILE_SMOKE',JSON.stringify(reports));
}finally{
 await writeFile(resolve(out,'mobile-report.json'),JSON.stringify({reports,scope:'Chromium touch-emulated viewports; actual walking and collection; enemies disabled. Not physical-phone FPS, live AI or a combat playtest.'},null,2)+'\n');
 if(browser)await browser.close();await new Promise(r=>server.close(r));
}
