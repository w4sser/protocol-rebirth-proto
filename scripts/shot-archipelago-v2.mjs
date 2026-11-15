// Actual raid-camera comparison. No replacement scene, injected geometry or camera changes.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep,join} from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=process.env.OUT||join(root,'verify-out','archipelago-v2-parity');
const baseline=process.env.BASELINE_SHA||'e1206a289e5d64af3fafd7717d9eeace89b40a62';
const beforeFiles=new Map();
for(const path of ['nodspel/index.html','nodspel/game.mjs','nodspel/world.js','nodspel/archipelago.js','nodspel/coastline.mjs','nodspel/archipelago-visual-v2.mjs','nodspel/archipelago-dressing-policy.mjs']){
  beforeFiles.set(path,execFileSync('git',['show',baseline+':'+path],{cwd:root,maxBuffer:4e6}));
}
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),before=url.pathname.startsWith('/before/');
    const path=decodeURIComponent(url.pathname.replace(/^\/(before|after)\//,'/'));
    const relative=path.slice(1)+(path.endsWith('/')?'index.html':''),file=resolve(root,relative);
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const body=before&&beforeFiles.has(relative)?beforeFiles.get(relative):await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||process.env.PUPPETEER_EXECUTABLE_PATH,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
await mkdir(out,{recursive:true});
const results=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(page,label,errors){
  await wait(350);
  // Screenshots without asynchronously loaded foliage falsely present an empty island.
  await page.waitForFunction(()=>window.__polyforkPreview?.stats?.ready===true,{timeout:45000});
  const state=await page.evaluate(()=>({
    loadingHidden:document.querySelector('#loading')?.hidden,
    canvas:[...document.querySelectorAll('canvas')].some(c=>c.width>0&&c.height>0),
    quality:window.__NR.quality(),position:window.__NR.state().position,
    info:window.__NR.info(),url:location.href,
    coastalDressing:{...window.__polyforkPreview.stats},
    bedrock:(()=>{const plans=[];window.__NR.getScene().traverse(o=>{if(o.userData.bedrockPlan)plans.push(o.userData.bedrockPlan);});return plans;})(),
  }));
  assert.equal(state.loadingHidden,true,label+' boot');assert.ok(state.canvas,label+' canvas');assert.deepEqual(errors,[],label+' errors');
  await page.screenshot({path:join(out,label+'.png')});results.push({label,...state,errors:[...errors],renderer:'desktop Chromium, 844x390 DPR2; no physical Safari/FPS claim'});
  console.log('CAPTURE OK',label,'quality',state.quality,'last-pass calls (not whole-frame draw count)',state.info.calls);
}
// Exercise the real isometric camera/player loop, not just the pine material
// helper. The player is teleported behind an actual procedural crown so the
// orthographic view ray must fade that tree, then restored to the spawn.
async function checkPineVisibility(page,quality,errors){
  const view=await page.evaluate(()=>{
    const scene=window.__NR.getScene(),camera=window.__NR.getCamera();
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const spawn=window.__NR.state().position;
    const toward=camera.getWorldDirection(camera.position.clone()).negate();
    let trees=[];scene.traverse(o=>{if(o.name==='arch-v2-coastal-pine'&&o.pineMeshes?.length)trees.push(o);});
    trees.sort((a,b)=>b.userData.pineHeight-a.userData.pineHeight);
    for(const tree of trees){
      // Prefer a tall sentinel that is not already close to the spawn.
      if(Math.hypot(tree.position.x-spawn.x,tree.position.z-spawn.z)<5)continue;
      for(const crown of tree.pineMeshes.filter(m=>m.geometry.type==='IcosahedronGeometry')){
        const p=crown.getWorldPosition(crown.position.clone());
        const t=(p.y-.86)/toward.y;
        if(t<.8||t>16)continue;
        const x=p.x-toward.x*t,z=p.z-toward.z*t;
        return {x,z,treeX:tree.position.x,treeZ:tree.position.z,
          originalX:spawn.x,originalZ:spawn.z,variant:tree.userData.pineVariant};
      }
    }
    return null;
  });
  assert.ok(view,'v2 needs an actual tall foreground pine to test');
  const pineOpacity=()=>page.evaluate(v=>{
    let result=null;
    window.__NR.getScene().traverse(o=>{
      if(o.name==='arch-v2-coastal-pine'&&Math.abs(o.position.x-v.treeX)<.001
        &&Math.abs(o.position.z-v.treeZ)<.001)result=o.userData.pineOpacity;
    });
    return result;
  },view);
  await page.evaluate(v=>window.__NR.teleport(v.x,v.z),view);
  // Capture a genuine runtime fade, not a directly mutated test material.
  await page.waitForFunction(v=>{
    let fade=1;window.__NR.getScene().traverse(o=>{
      if(o.name==='arch-v2-coastal-pine'&&Math.abs(o.position.x-v.treeX)<.001
        &&Math.abs(o.position.z-v.treeZ)<.001)fade=o.userData.pineOpacity;
    });
    return fade<.45;
  },{timeout:6500},view);
  await capture(page,'after-'+quality+'-pine-faded',errors);
  assert.ok((await pineOpacity())<.45,'foreground canopy must fade over the Operator');
  await page.evaluate(v=>window.__NR.teleport(v.originalX,v.originalZ),view);
  await page.waitForFunction(v=>{
    let fade=0;window.__NR.getScene().traverse(o=>{
      if(o.name==='arch-v2-coastal-pine'&&Math.abs(o.position.x-v.treeX)<.001
        &&Math.abs(o.position.z-v.treeZ)<.001)fade=o.userData.pineOpacity;
    });
    return fade>.95;
  },{timeout:6500},view);
  await capture(page,'after-'+quality+'-pine-restored',errors);
  assert.ok((await pineOpacity())>.95,'tree must restore when no longer in front of the player');
  console.log('PINE FADE OK',quality,view.variant,'independent opacity and restoration');
}

try{
  for(const version of ['after','before'])for(const quality of ['high','low']){
    if(process.env.ONLY_AFTER==='1'&&version==='before')continue;
    const page=await browser.newPage(),errors=[];
    await page.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',version,quality,String(e));});
    page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push('HTTP '+r.status()+' '+r.url());});
    page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader error|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    const query='?area=archipelago&archVisual=v2&archTarget=1&seed=archipelago-v2-target&q='+quality+'&debug=1';
    console.log('Starting',version,quality);
    await page.goto(base+'/'+version+'/nodspel/'+query,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>!document.querySelector('#boot-loader')&&window.__NR?.state,{timeout:60000});
    await page.evaluate(()=>window.__NR.setMoodAutoDowngradeEnabled(false));
    await page.click('#tutorial-start');
    await capture(page,version+'-'+quality+'-spawn',errors);
    if(version==='after')await checkPineVisibility(page,quality,errors);
    {
      const matchingView=results.find(r=>r.label==='after-'+quality+'-coast')?.position;
      await page.evaluate(matchingView=>{
        if(matchingView){window.__NR.teleport(matchingView.x,matchingView.z);return;}
        const scene=window.__NR.getScene(),floor=window.__NR.state().level.floors.find(f=>!f.dir);let portal;
        scene.traverse(o=>{if(o.name==='arch-v2-rock-cut-portal')portal=o;});
        if(portal)window.__NR.teleport(floor.x+(portal.position.x-floor.x)*.62,floor.z+(portal.position.z-floor.z)*.62);
      },matchingView);
      await capture(page,version+'-'+quality+'-coast',errors);
      if(version==='after'){
        // A dedicated actual gameplay-camera view of the new floating boat.
        // Pick the boat closest to the operator, then stand safely inshore
        // from its nearest coast-shell point. No camera hacks/scene injection.
        const boatView=await page.evaluate(()=>{
          const scene=window.__NR.getScene(),boats=[],shores=[];
          scene.traverse(o=>{
            if(o.name==='arch-v2-coastal-dinghy')boats.push(o);
            if(o.name==='archipelago-coast-shell')shores.push(o);
          });
          if(!boats.length||!shores.length)return null;
          const player=window.__NR.state().position;
          const boat=boats.sort((a,b)=>Math.hypot(a.position.x-player.x,a.position.z-player.z)
            -Math.hypot(b.position.x-player.x,b.position.z-player.z))[0];
          let best=null;
          for(const shell of shores){
            const attr=shell.geometry.getAttribute('position'),count=Math.floor(attr.count/6);
            if(!count)continue;
            let cx=0,cz=0;
            for(let i=0;i<count;i++){cx+=attr.getX(i);cz+=attr.getZ(i);}
            cx/=count;cz/=count;
            for(let i=0;i<count;i++){
              const x=attr.getX(i),z=attr.getZ(i),d=Math.hypot(x-boat.position.x,z-boat.position.z);
              if(!best||d<best.d)best={x,z,cx,cz,d};
            }
          }
          if(!best)return null;
          const dx=best.cx-best.x,dz=best.cz-best.z,len=Math.max(.001,Math.hypot(dx,dz));
          return {x:best.x+dx/len*1.30,z:best.z+dz/len*1.30};
        });
        assert.ok(boatView,'v2 has a real floating dinghy close to a shoreline');
        await page.evaluate(p=>window.__NR.teleport(p.x,p.z),boatView);
        await capture(page,version+'-'+quality+'-boat',errors);
      }
      await page.evaluate(async()=>{
        await window.__NR.goLevel(2);const f=window.__NR.state().level.floors.find(f=>f.dir);if(!f)throw new Error('No Level 2 bridge');
        window.__NR.teleport(f.x-(f.dir.x?Math.min(2.7,f.w*.25):0),f.z-(f.dir.x?0:Math.min(2.7,f.d*.25)));
      });
      await capture(page,version+'-'+quality+'-bridge',errors);
    }
    await page.close();
  }
  await writeFile(join(out,'capture-report.json'),JSON.stringify({baseline,results},null,2));
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
