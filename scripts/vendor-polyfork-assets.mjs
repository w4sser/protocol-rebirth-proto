// One-time vendoring and reproducible verification for free Polyfork low-poly meshes.
// Usage: node scripts/vendor-polyfork-assets.mjs [--verify]
// License: the GLB files, not Polyfork ES modules, are distributed under CC BY 4.0.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {POLYFORK_CANDIDATES} from '../nodspel/polyfork-catalog.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUT=join(ROOT,'nodspel/assets/polyfork');
const IDS=Object.freeze([
  'birch-tree-181b33',
  'cattail-reed-6abbb3',
  'driftwood-log-89a68f',
  'fallen-log-1685fb',
  'fern-plant-1559b8',
  'grass-tuft-a40a08',
  'lobster-pot-stack-d870f0',
  'marram-grass-tuft-8c7a99',
  'medium-rock-e08405',
  'mooring-bollard-2d4bc9',
  'net-pile-0bd489',
  'round-bush-cd2ac0',
  'sea-holly-clump-ce3bc6',
  'seaweed-drift-line-6566c3',
  'small-rock-db33a7',
  'tall-pine-tree-ab4108',
  'tree-stump-ec3f48',
  'wildflower-68d3a1',
  'young-pine-0d7695',
]);
const REFERENCE_MODULES=[
  'nodspel/polyfork-dressing.mjs',
  'nodspel/polyfork-profiles.mjs',
  'nodspel/polyfork-coastal-life.mjs',
];
const byId=new Map(POLYFORK_CANDIDATES.map(item=>[item.id,item]));
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const urlFor=id=>'https://polyfork.dev/cdn/'+id+'.glb';
const fileFor=id=>join(OUT,id+'.glb');

async function checkReferences(){
  const referenced=new Set();
  for(const source of REFERENCE_MODULES){
    const data=await readFile(join(ROOT,source),'utf8');
    for(const match of data.matchAll(/\b[a-z][a-z0-9-]*-[a-f0-9]{6}\b/g))referenced.add(match[0]);
  }
  const expected=[...IDS].sort();
  const actual=[...referenced].sort();
  if(JSON.stringify(expected)!==JSON.stringify(actual))
    throw new Error('Runtime model IDs differ from vendored list: '+JSON.stringify({expected,actual}));
  for(const id of IDS)if(!byId.has(id))throw new Error('Unknown catalog asset '+id);
}

function validateGlb(buf,id){
  if(buf.length<32||buf.length>3*1024*1024||buf.toString('ascii',0,4)!=='glTF'||
      buf.readUInt32LE(4)!==2||buf.readUInt32LE(8)!==buf.length)
    throw new Error('Invalid GLB header or size: '+id+' bytes='+buf.length);
  const chunkLength=buf.readUInt32LE(12),chunkType=buf.toString('ascii',16,20);
  if(chunkType!=='JSON'||chunkLength<10||20+chunkLength>buf.length)
    throw new Error('Invalid GLB JSON chunk: '+id);
  const gltf=JSON.parse(buf.subarray(20,20+chunkLength).toString('utf8'));
  if(gltf.asset?.version!=='2.0'||!Array.isArray(gltf.meshes)||!gltf.meshes.length)
    throw new Error('GLB has no glTF 2.0 meshes: '+id);
}
async function fetchGlb(id){
  const url=urlFor(id);
  for(let attempt=0;attempt<5;attempt++){
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),30000);
    try{
      const res=await fetch(url,{signal:abort.signal,headers:{
        'User-Agent':'ProtocolRebirth/1.0 (commercial game asset vendoring; https://protocolrebirth.com)',
        'Accept':'model/gltf-binary,application/octet-stream;q=0.9'
      }});
      if(res.status===429||res.status>=500){
        await wait(Math.min(16000,1500*Math.pow(2,attempt)));
        continue;
      }
      if(!res.ok)throw new Error('Download '+id+' failed: HTTP '+res.status);
      const bytes=Buffer.from(await res.arrayBuffer());
      validateGlb(bytes,id);
      return bytes;
    }catch(error){
      if(attempt===4)throw error;
      await wait(Math.min(12000,1000*Math.pow(2,attempt)));
    }finally{clearTimeout(timeout);}
  }
  throw new Error('Failed to retrieve model '+id);
}

function attribution(){
  const lines=[
    '# Polyfork low-poly GLB assets',
    '',
    'The following unmodified GLB mesh files are by **Polyfork** and are',
    'redistributed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.',
    '',
    '- Licence: https://creativecommons.org/licenses/by/4.0/',
    '- Author and source: https://polyfork.dev/',
    '- Source licensing terms: https://polyfork.dev/licensing',
    '- Modifications: none to the supplied GLB files; Protocol Rebirth applies',
    '  positioning, scaling and instancing at runtime only.',
    '- Polyfork does not endorse or sponsor Protocol Rebirth.',
    '',
    '## Individual file credits',
    ''
  ];
  for(const id of IDS){
    const model=byId.get(id);
    lines.push('- '+model.name+' by Polyfork (https://polyfork.dev/asset/'+id+'), CC BY 4.0. File: '+id+'.glb');
  }
  return lines.join('\n')+'\n';
}

async function verify(){
  await checkReferences();
  const manifest=JSON.parse(await readFile(join(OUT,'manifest.json'),'utf8'));
  if(manifest.license!=='CC-BY-4.0'||manifest.files.length!==IDS.length||
      JSON.stringify(manifest.files.map(x=>x.id))!==JSON.stringify(IDS))
    throw new Error('Unexpected Polyfork asset manifest');
  for(const entry of manifest.files){
    if(entry.file!==entry.id+'.glb'||entry.source!==urlFor(entry.id)||
      !/^[a-f0-9]{64}$/.test(entry.sha256))throw new Error('Bad manifest entry '+entry.id);
    const buf=await readFile(fileFor(entry.id));
    validateGlb(buf,entry.id);
    if(buf.length!==entry.bytes||sha256(buf)!==entry.sha256)
      throw new Error('Vendored GLB digest mismatch: '+entry.id);
  }
  if(await readFile(join(OUT,'ATTRIBUTION.md'),'utf8')!==attribution())
    throw new Error('CC BY credit file missing or stale');
  console.log('Verified '+IDS.length+' local GLBs, matching SHA-256 manifest and credits');
}

if(process.argv.includes('--verify')){
  await verify();
}else{
  await checkReferences();
  await mkdir(OUT,{recursive:true});
  const files=[];
  for(const id of IDS){
    let bytes;
    try{bytes=await readFile(fileFor(id));validateGlb(bytes,id);}
    catch{bytes=await fetchGlb(id);await writeFile(fileFor(id),bytes);await wait(350);}
    files.push({id,file:id+'.glb',source:urlFor(id),bytes:bytes.length,sha256:sha256(bytes)});
    console.log('Local asset '+files.length+'/'+IDS.length+' '+id+' '+bytes.length+' bytes');
  }
  await writeFile(join(OUT,'manifest.json'),JSON.stringify({
    source:'https://polyfork.dev',license:'CC-BY-4.0',files
  },null,2)+'\n');
  await writeFile(join(OUT,'ATTRIBUTION.md'),attribution());
  await verify();
}
