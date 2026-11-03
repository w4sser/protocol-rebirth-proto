// Runs cf-shots/ftue-bot.mjs N times on a fresh profile against BASE; prints JSON per run.
import {createRequire} from 'node:module';const require=createRequire('/workspace/prp-hb/package.json');let P;try{P=require('puppeteer');}catch{P=require('puppeteer-core');}
const N=+process.env.N||5;globalThis.BASE=process.env.BASE||'https://w4sser.github.io/protocol-rebirth-proto';
globalThis.s=ms=>new Promise(r=>setTimeout(r,ms));
const bot=(await import('./ftue-bot.mjs')).default;
for(let i=0;i<N;i++){
 const b=await P.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 globalThis.pg=await b.newPage();await pg.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 globalThis.snap=async n=>{};process.env.TAG='run'+i;
 const t0=Date.now();console.log('=== RUN',i);
 try{await Promise.race([bot(),s(240000).then(()=>{throw new Error('TIMEOUT')})]);}catch(e){console.log('ERR',e.message);}
 console.log('WALL',((Date.now()-t0)/1000).toFixed(1));await b.close();
}
