#!/usr/bin/env node
// Usage: node scripts/big-level-map.mjs [seed] [output.svg|output.png]
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {generateBigLevel} from '../nodspel/big-level.js';
import {levelMapSVG,mapIconSymbols} from '../nodspel/level-map.js';

const [seed='big-review',output='verify-out/big-level-map.png']=process.argv.slice(2),target=resolve(output),svgPath=target.replace(/\.(png|svg)$/i,'')+'.svg';
if(!['.svg','.png'].includes(extname(target).toLowerCase()))throw new Error('Output must end in .svg or .png');
await mkdir(dirname(target),{recursive:true});
const symbols=mapIconSymbols(await readFile(new URL('../nodspel/ui-icons.svg',import.meta.url),'utf8'));
const level=generateBigLevel(seed),svg=levelMapSVG(level.graph,{standalone:true,symbols});await writeFile(svgPath,svg);
console.log(`SVG: ${svgPath} (${level.rooms.length} rooms, seed ${JSON.stringify(seed)})`);
if(extname(target).toLowerCase()==='.png'){
  let converted=false;
  for(const [cmd,args] of [['rsvg-convert',['-o',target,svgPath]],['convert',[svgPath,target]]]){const result=spawnSync(cmd,args,{encoding:'utf8'});if(result.status===0){converted=true;break;}if(result.error?.code!=='ENOENT')console.warn(`${cmd}: ${result.stderr?.trim()||result.error?.message||result.status}`);}
  if(!converted){
    const require=createRequire('/workspace/prp-hb/package.json'),puppeteer=require('puppeteer');
    const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
    try{const page=await browser.newPage();await page.setContent(`<body style="margin:0">${svg}</body>`);await page.$eval('svg',el=>document.documentElement.style.background='black');await (await page.$('svg')).screenshot({path:target});}finally{await browser.close();}
  }
  console.log(`PNG: ${target}`);
}
