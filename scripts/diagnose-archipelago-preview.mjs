import puppeteer from 'puppeteer';
const base='https://w4sser.github.io/protocol-rebirth-proto/previews/archipelago-v2/';
let version={};
try{const res=await fetch(base+'preview-version.json?diag='+Date.now());version=await res.json();console.log('PUBLISHED VERSION',JSON.stringify(version));}catch(e){console.error('VERSION FETCH',String(e));}
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let broken=false;
try{
 for(const quality of ['low','high']){
  const p=await browser.newPage();const messages=[];
  await p.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>messages.push('PAGE ERROR: '+String(e?.stack||e)));
  p.on('console',msg=>{if(['error','warning'].includes(msg.type()))messages.push('CONSOLE '+msg.type()+': '+msg.text());});
  p.on('requestfailed',request=>messages.push('REQUEST FAILED: '+request.url()+' '+JSON.stringify(request.failure())));
  p.on('response',response=>{if(response.status()>=400)messages.push('HTTP '+response.status()+' '+response.url());});
  const u=base+'nodspel/?area=archipelago&archVisual=v2&archTarget=1&seed=archipelago-v2-target&q='+quality+'&diagnose='+Date.now();
  const res=await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,9000));
  const state=await p.evaluate(()=>({url:location.href,loadingHidden:document.getElementById('loading')?.hidden,loadingText:document.getElementById('loading')?.textContent?.trim(),bootLoader:!!document.getElementById('boot-loader'),hasNR:!!window.__NR,canvases:[...document.querySelectorAll('canvas')].map(x=>[x.width,x.height]),resources:performance.getEntriesByType('resource').filter(r=>/game\.mjs|world\.js|archipelago/.test(r.name)).map(r=>({name:r.name,transferSize:r.transferSize,duration:r.duration}))}));
  console.log('DIAG',quality,'http',res.status(),'state',JSON.stringify(state,null,2));messages.forEach(m=>console.log('DIAG '+quality+' '+m));
  if(!state.loadingHidden||!state.hasNR){broken=true;try{const details=await p.evaluate(async()=>{try{await import('./game.mjs?v=2.28.83-ground-v10-coast-feather-coastal-v1-timber-v1-dressing-default-military-v2-vendored-glbs-military-visual4-organic-v2-granite6');return 'manual import OK';}catch(e){return String(e?.stack||e)}});console.log('MANUAL IMPORT',quality,details)}catch(e){console.log('IMPORT PROBE ERROR',String(e))}}
  await p.close();
 }
}finally{await browser.close();}
if(broken)process.exitCode=1;
