// Rebuild the four malformed GLBs deterministically using only vertex geometry.
// Usage: node scripts/repair-props-glb.mjs
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const roots=['assets/env/shore','assets/env/nature/rocks'];
const names=['shore_rock_edge_4m','rock_granite_s_a','rock_granite_s_b','rock_granite_s_c'];
const enc=new TextEncoder();
function pack(name){
 const shore=name.startsWith('shore_'), n=shore?12:9, positions=[],normals=[],colors=[];
 function tri(a,b,c,color){
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
  const norm=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const len=Math.hypot(...norm)||1;for(const v of [a,b,c]){positions.push(...v);normals.push(...norm.map(x=>x/len));colors.push(...color,255);}
 }
 if(shore){
  for(let i=0;i<n;i++){const x=-2+4*i/n,y=-2+4*(i+1)/n;
   const t=i/n, u=(i+1)/n, height=z=>.39+.07*Math.sin(Math.PI*z)*Math.sin(Math.PI*z*3);
   const a=[x,0,-.6],b=[y,0,-.6],c=[y,height(u),-.55],d=[x,height(t),-.55],e=[x,0,.6],f=[y,0,.6],g=[y,height(u),.55],h=[x,height(t),.55];
   tri(a,b,c,[125,143,151]);tri(a,c,d,[125,143,151]);tri(h,g,f,[116,134,142]);tri(h,f,e,[116,134,142]);tri(d,c,g,[143,158,163]);tri(d,g,h,[143,158,163]);
  }
 }else{
  const v=name.at(-1),r=v==='a'?.24:v==='b'?.28:.32,H=v==='a'?.25:v==='b'?.28:.30;
  const rings=[[],[],[]];for(let j=0;j<3;j++)for(let i=0;i<n;i++){const a=i*Math.PI*2/n,rad=[.83,1,.67][j],rough=1+.09*Math.sin(3*a+v.charCodeAt(0));rings[j].push([r*rad*rough*Math.cos(a),[0,H*.44,H*.85][j],r*rad*rough*Math.sin(a)]);}
  for(let j=0;j<2;j++)for(let i=0;i<n;i++){const k=(i+1)%n,a=rings[j][i],b=rings[j][k],c=rings[j+1][k],d=rings[j+1][i];tri(a,b,c,[123,141,151]);tri(a,c,d,[123,141,151]);}
  for(let i=0;i<n;i++){const k=(i+1)%n;tri([0,H*.95,0],rings[2][i],rings[2][k],i%5===0?[103,135,115]:[143,159,163]);}
 }
 const count=positions.length/3,p=Float32Array.from(positions),no=Float32Array.from(normals),co=Uint8Array.from(colors);
 const binary=Buffer.alloc(p.byteLength+no.byteLength+co.byteLength);Buffer.from(p.buffer).copy(binary,0);Buffer.from(no.buffer).copy(binary,p.byteLength);Buffer.from(co.buffer).copy(binary,p.byteLength+no.byteLength);
 const min=[0,1,2].map(i=>Math.min(...positions.filter((_,j)=>j%3===i))),max=[0,1,2].map(i=>Math.max(...positions.filter((_,j)=>j%3===i)));
 const json={asset:{version:'2.0',generator:'Protocol Rebirth repaired prop'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name}],meshes:[{name,primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},material:0,mode:4}]}],materials:[{name:'cool_granite',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1},doubleSided:true}],accessors:[{bufferView:0,componentType:5126,count,type:'VEC3',min,max},{bufferView:1,componentType:5126,count,type:'VEC3'},{bufferView:2,componentType:5121,normalized:true,count,type:'VEC4'}],bufferViews:[{buffer:0,byteOffset:0,byteLength:p.byteLength,target:34962},{buffer:0,byteOffset:p.byteLength,byteLength:no.byteLength,target:34962},{buffer:0,byteOffset:p.byteLength+no.byteLength,byteLength:co.byteLength,target:34962}],buffers:[{byteLength:binary.length}]};
 const j=Buffer.from(JSON.stringify(json)),pad=(4-j.length%4)%4,jbuf=Buffer.concat([j,Buffer.alloc(pad,32)]),out=Buffer.alloc(12+8+jbuf.length+8+binary.length);
 out.write('glTF',0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jbuf.length,12);out.write('JSON',16);jbuf.copy(out,20);
 const offset=20+jbuf.length;out.writeUInt32LE(binary.length,offset);out.writeUInt32LE(0x004e4942,offset+4);binary.copy(out,offset+8);
 return {out,count,triangles:count/3,min,max};
}
for(const name of names){
 const root=name.startsWith('shore_')?roots[0]:roots[1],manifestPath=join(root,'manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));const file=name+'.glb',item=manifest.assets.find(x=>x.file===file);
 if(!item)throw Error('Manifest entry missing: '+file);
 const {out,triangles,min,max}=pack(name);
 await writeFile(join(root,file),out);
 item.file_size_bytes=out.length;item.triangle_count=triangles;item.bbox_m={min,max};item.approx_dimensions_m=max.map((v,i)=>+(v-min[i]).toFixed(4));
 item.notes='Rebuilt cool neutral granite with valid GLB header and vertex colors. No external texture.';
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log('REBUILT',file,out.length+'B',triangles+' triangles');
}
