// Guard against truncated PNG uploads and corrupt color/alpha channels in Ground Pass 3.
// node scripts/validate-terrain-pngs.mjs
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const dir=fileURLToPath(new URL('../assets/env/terrain/',import.meta.url));
const expected=new Map([
  ['decal_atlas.png',[256,3]],
  ['ground_granite_albedo.png',[256,3]],
  ['chunk_0_0_splat.png',[96,6]],
  ['chunk_0_0_bunker_splat.png',[96,6]],
  ['ground_mobile_nature_atlas.png',[256,3]],
  ['ground_mobile_bunker_atlas.png',[256,3]],
]);
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[i]=c>>>0;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
let errors=0;
for(const [name,[size,colorType]] of expected){
 try{
  const b=await readFile(join(dir,name));
  if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('bad signature');
  let off=8,ihdr=null,idats=[],palette=0,alpha=null,ended=false;
  while(off<b.length){
   if(off+12>b.length)throw Error('truncated chunk header');
   const length=b.readUInt32BE(off);
   if(off+length+12>b.length)throw Error('truncated chunk body');
   const type=b.toString('ascii',off+4,off+8);
   const data=b.subarray(off+8,off+8+length);
   const actual=crc32(b.subarray(off+4,off+8+length)),expectedCRC=b.readUInt32BE(off+8+length);
   if(actual!==expectedCRC)throw Error('CRC error in '+type);
   if(type==='IHDR')ihdr=data;
   if(type==='PLTE')palette=length/3;
   if(type==='tRNS')alpha=data;
   if(type==='IDAT')idats.push(data);
   off+=12+length;
   if(type==='IEND'){ended=true;break;}
  }
  if(!ended||off!==b.length)throw Error('missing IEND or trailing data');
  if(!ihdr||ihdr.readUInt32BE(0)!==size||ihdr.readUInt32BE(4)!==size||ihdr[8]!==8||ihdr[9]!==colorType)throw Error('unexpected image format or dimensions');
  if(colorType===3&&(!palette||!alpha&&name==='decal_atlas.png'))throw Error('missing palette/alpha');
  const raw=inflateSync(Buffer.concat(idats));
  const bpp=colorType===6?4:1,stride=size*bpp;
  if(raw.length!==(stride+1)*size)throw Error('decompressed PNG row count mismatch');
  const out=Buffer.alloc(size*size*bpp);
  for(let y=0;y<size;y++){
    const filter=raw[y*(stride+1)];
    if(filter!==0&&filter!==1)throw Error('unexpected PNG filter '+filter);
    for(let x=0;x<stride;x++){
      const enc=raw[y*(stride+1)+1+x];
      out[y*stride+x]=(enc+(filter===1&&x>=bpp?out[y*stride+x-bpp]:0))&255;
      if(colorType===3&&out[y*stride+x]>=palette)throw Error('invalid palette index');
    }
  }
  if(colorType===6)for(let k=0;k<out.length;k+=4)if(out[k]+out[k+1]+out[k+2]+out[k+3]!==255)throw Error('splat weights not normalized');
  console.log('[PASS]',name,size+'x'+size,'PNG CRC/DEFLATE/channels valid',b.length+' bytes');
 }catch(error){errors++;console.error('[FAIL]',name,String(error));}
}
console.log('GROUND PASS 3 PNG RESULT:',expected.size-errors,'/',expected.size,'valid,',errors,'errors');
if(errors)process.exitCode=1;
