// Real-browser OP01 gameplay smoke + screenshots. Headless SwiftShader
// cannot certify actual iPhone frame rate; performance QA remains separate.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=resolve(process.env.OP01_QA_OUT||join(root,'op01-qa-captures'));
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const bytes=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}
  catch{res.writeHead(404);res.end('missing');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const require=createRequire(import.meta.url);
let puppeteer;
try{puppeteer=require('puppeteer');}catch{puppeteer=require('puppeteer-core');}
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,
  args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const checks=[],failures=[],pause=ms=>new Promise(r=>setTimeout(r,ms));
const accuracy=s=>(s.direction?.[0]??0)*Math.sin(s.rotation||0)+(s.direction?.[2]??0)*Math.cos(s.rotation||0);
try{
  for(const [width,height,quality] of [[844,390,'medium'],[932,430,'low']]){
    const tag=width+'x'+height+'-'+quality,errors=[],page=await browser.newPage();
    await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(String(error)));
    try{
      // No skin override: the QA run must validate OP01 as production default.
      const url=base+'/nodspel/index.html?seed=op01-qa&area=archipelago&q='+quality+'&ftue=1&op01QA=1';
      await page.goto(url,{waitUntil:'load',timeout:45000});
      await page.waitForFunction(()=>document.documentElement.dataset.skin==='op01'&&!!window.__OP01_QA&&
        !document.getElementById('boot-loader'),{timeout:55000});
      await pause(800);
      const snapshot=()=>page.evaluate(()=>({...window.__OP01_QA.snapshot(),
        canvas:!!document.querySelector('#game canvas')}));
      const capture=name=>page.screenshot({path:join(out,tag+'-'+name+'.png')});
      const idle=await snapshot();await capture('idle');
      await page.keyboard.down('w');await pause(550);
      const run=await snapshot();await capture('run');
      await page.keyboard.down('Space');await pause(300);
      const aim=await snapshot();await capture('aim');
      await page.keyboard.up('Space');await pause(70);
      const shoot=await snapshot();await capture('shoot');
      // Capture the fire hold, then reverse movement. The operator should
      // rotate gradually toward the new running direction, while aiming
      // always overrides that transition immediately.
      await pause(110);
      const postShoot=await snapshot();await capture('post-shoot');
      await page.keyboard.up('w');await page.keyboard.down('s');
      await pause(110);
      const turnEarly=await snapshot();await capture('turn-early');
      await pause(320);
      const turnMid=await snapshot();await capture('turn-mid');
      // Wait for visual turn completion rather than assuming headless
      // SwiftShader always runs enough animation frames within 1 second.
      await page.waitForFunction(()=>{
        const s=window.__OP01_QA?.snapshot();
        if(!s)return false;
        const diff=Math.atan2(Math.sin(s.rotation-s.movementYaw),
          Math.cos(s.rotation-s.movementYaw));
        return Math.abs(diff)<.12;
      },{timeout:5000}).catch(()=>{});
      const turnLate=await snapshot();await capture('turn-late');
      await page.keyboard.up('s');
      await page.keyboard.down('Shift');await pause(90);
      const dash=await snapshot();await capture('dash');await page.keyboard.up('Shift');
      const report={tag,idle,run,aim,shoot,postShoot,turnEarly,turnMid,turnLate,
        dash,aimCos:accuracy(aim),shootCos:accuracy(shoot),errors};
      checks.push(report);
      if(!idle.canvas||!run.canvas)failures.push(tag+': game canvas missing');
      if(Math.abs((idle.visualScale||0)-1.10)>.001 ||
         Math.abs((idle.visualHeight||0)-1.958)>.01)
        failures.push(tag+': OP01 gameplay silhouette is not 10% larger');
      if(!['run','back'].includes(run.lower))failures.push(tag+': running animation missing ('+run.lower+')');
      if(aim.upper!=='aim')failures.push(tag+': aiming animation missing ('+aim.upper+')');
      if(aim.faceLocked)failures.push(tag+': aim preview marked as fired');
      if(!postShoot.faceLocked||!shoot.faceLocked)failures.push(tag+': real shot was not recorded');
      const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
      // Capturing a screenshot can take multiple frames on SwiftShader.
      // Snapshot deltas are NOT per-frame turn angles: flag only a jump
      // beyond a reasonable transition, and verify gradual return below.
      if(angle(postShoot.rotation,shoot.rotation)>1.2)
        failures.push(tag+': shot facing snapped immediately');
      const initialGap=angle(turnEarly.rotation,turnEarly.movementYaw);
      const middleGap=angle(turnMid.rotation,turnMid.movementYaw);
      const lateGap=angle(turnLate.rotation,turnLate.movementYaw);
      if(initialGap>.25){
        if(!(middleGap<initialGap-.07))
          failures.push(tag+': no smooth turn toward movement ('+initialGap.toFixed(2)+' -> '+middleGap.toFixed(2)+')');
        if(!(lateGap<.14))
          failures.push(tag+': last-shot facing remains after running ('+lateGap.toFixed(2)+')');
      }
      if(angle(turnEarly.rotation,postShoot.rotation)>1.2)
        failures.push(tag+': facing snapped when movement direction reversed');
      for(const [state,snap] of [['idle',idle],['run',run],['postShoot',postShoot]]){
        if(!(snap.healthAnchorErrorPx<5))
          failures.push(tag+': health bar detached from head in '+state+' ('+snap.healthAnchorErrorPx+')');
      }
      if(shoot.upper!=='shoot')failures.push(tag+': shot animation missing ('+shoot.upper+')');
      // An in-progress crossfade may still be settling at the aim snapshot
      // on very slow software-rendered devices. The weapon MUST be aligned
      // when the actual shot happens, which is the gameplay-critical point.
      if(accuracy(aim)<.58)failures.push(tag+': aim preview direction wrong ('+accuracy(aim).toFixed(2)+')');
      if(accuracy(shoot)<.90)failures.push(tag+': barrel direction at firing is wrong ('+accuracy(shoot).toFixed(2)+')');
      if(idle.outlines!==4||run.outlines!==4)failures.push(tag+': four-part occlusion silhouette absent');
      // The opt-in presentation controls must be testable on a mobile viewport,
      // independently of the normal raid. Capture three side-by-side reference states.
      if(width===844){
        await page.goto(base+'/nodspel/index.html?seed=op01-rim-qa&area=archipelago&q=medium&ftue=1&op01QA=1&operatorScaleTest=1&operatorScale=135&operatorRim=0.24',
          {waitUntil:'load',timeout:45000});
        await page.waitForFunction(()=>document.documentElement.dataset.skin==='op01'&&
          !!window.__OP01_QA&&!document.getElementById('boot-loader')&&
          !!document.getElementById('operator-scale-test'),{timeout:55000});
        await pause(400);
        const scaled=await snapshot();
        await capture('experiment-135-rim024');
        const press=async label=>page.evaluate(text=>{
          const button=[...document.querySelectorAll('#operator-scale-test button')]
            .find(element=>element.textContent===text);
          if(!button)throw new Error('Missing experiment control '+text);
          button.click();
          return button.getAttribute('aria-pressed');
        },label);
        if(Math.abs(scaled.visualScale-1.485)>.001||scaled.rimStrength!==.24)
          failures.push(tag+': experiment start presets not applied');
        if(await press('150%')!=='true'||await press('0.32')!=='true')
          failures.push(tag+': experiment buttons do not select active variants');
        await pause(120);
        const enlarged=await snapshot();
        await capture('experiment-150-rim032');
        if(Math.abs(enlarged.visualScale-1.65)>.001||enlarged.rimStrength!==.32)
          failures.push(tag+': scale and rim controls did not update together');
        if(await press('100%')!=='true'||await press('0.16')!=='true')
          failures.push(tag+': unable to restore experiment baseline');
        await pause(120);
        const restored=await snapshot();
        await capture('experiment-100-rim016');
        if(Math.abs(restored.visualScale-1.10)>.001||restored.rimStrength!==.16)
          failures.push(tag+': experiment did not restore original OP01 presentation');
        report.experiment={scaled:{visualScale:scaled.visualScale,rim:scaled.rimStrength},
          enlarged:{visualScale:enlarged.visualScale,rim:enlarged.rimStrength},
          restored:{visualScale:restored.visualScale,rim:restored.rimStrength}};
      }
      for(const error of errors)failures.push(tag+': page error '+error.slice(0,190));
    }catch(error){failures.push(tag+': '+String(error));checks.push({tag,error:String(error),errors});}
    finally{await page.close();}
  }
}finally{
  await browser.close();
  await new Promise(r=>server.close(r));
  await writeFile(join(out,'metrics.json'),JSON.stringify({checks,failures},null,2));
}
console.log('OP01_BROWSER_QA',JSON.stringify({checks:checks.map(x=>({
  tag:x.tag,idle:x.idle?.lower,run:x.run?.lower,aim:x.aim?.upper,shoot:x.shoot?.upper,
  aimCos:x.aimCos,lod:x.idle?.lod,error:x.error})),failures}));
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
