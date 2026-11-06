// Asset gate for props merged from PR #198. Run: npm install --no-save gltf-validator && node scripts/validate-props.mjs
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';
const roots=['assets/env/nature','assets/env/shore','assets/env/nature/rocks'];
let failures=0,checked=0,bytesTotal=0;
for(const root of roots){
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 const listed=new Set();
 for(const entry of manifest.assets){
  const name=entry.file, path=join(root,name);listed.add(name);
  try{
   const bytes=await readFile(path);checked++;bytesTotal+=bytes.length;
   assert.equal(bytes.toString('ascii',0,4),'glTF','GLB header');
   assert.equal(bytes.readUInt32LE(4),2,'GLB version');
   assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB header length');
   assert.equal(entry.file_size_bytes,bytes.length,'manifest byte size');
   assert.ok(bytes.length<=150000,'mobile GLB budget 150KB');
   const report=await validator.validateBytes(new Uint8Array(bytes),{
    uri:pathToFileURL(resolve(path)).href,
    maxIssues:100,
    externalResourceFunction:async uri=>new Uint8Array(await readFile(resolve(dirname(path),decodeURIComponent(uri))))
   });
   const errors=report.issues.messages.filter(m=>m.severity===0);
   const warnings=report.issues.messages.filter(m=>m.severity===1);
   if(errors.length)throw Error(errors.map(e=>e.code+': '+e.message).join(' | '));
   console.log('PASS',path,bytes.length+'B',warnings.length+' warnings');
  }catch(e){failures++;console.error('FAIL',path,String(e.message||e));}
 }
 const actual=(await readdir(root)).filter(n=>n.endsWith('.glb'));
 for(const name of actual)if(!listed.has(name)){failures++;console.error('UNLISTED',join(root,name));}
}
console.log(JSON.stringify({checked,bytesTotal,failures}));
if(failures)process.exitCode=1;
