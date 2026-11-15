// Owner-authorized v3, 2026-11-14. Original JPG is authoritative; v2 stays untouched.
// Use --check to verify; --write creates v3 exclusively and refuses to replace it.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const target = new URL('../assets/bit-face-master-v3.svg', import.meta.url);
const halfSpan=185, depth=115, endpointY=534;
const radius=(halfSpan**2+depth**2)/(2*depth);
const centreY=endpointY+depth-radius;
const first=Math.atan2(endpointY-centreY,-halfSpan);
const last=Math.atan2(endpointY-centreY,halfSpan);
const sweep=last-first, segments=64;
const fmt=n=>(Math.abs(n)<0.0000005?0:n).toFixed(6);
const pair=p=>p.map(fmt).join(' ');
// Analytic circular centreline with radial thickness 32 + 32 sin(pi*t).
function edge(t,side){
  const a=first+sweep*t, r=radius+side*(16+16*Math.sin(Math.PI*t));
  const dr=side*16*Math.PI*Math.cos(Math.PI*t);
  return {p:[500+r*Math.cos(a),centreY+r*Math.sin(a)],
    d:[dr*Math.cos(a)-r*Math.sin(a)*sweep,dr*Math.sin(a)+r*Math.cos(a)*sweep]};
}
function curve(from,to,side){
  const a=edge(from,side),b=edge(to,side),h=(to-from)/3;
  return ` C${pair(a.p.map((v,k)=>v+h*a.d[k]))} ${pair(b.p.map((v,k)=>v-h*b.d[k]))} ${pair(b.p)}`;
}
let path=`M${pair(edge(0,1).p)}`;
for(let i=0;i<segments;i++)path+=curve(i/segments,(i+1)/segments,1);
path+=` A16 16 0 0 0 ${pair(edge(1,-1).p)}`;
for(let i=segments;i>0;i--)path+=curve(i/segments,(i-1)/segments,-1);
path+=` A16 16 0 0 0 ${pair(edge(0,1).p)} Z`;
export const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 875" width="1000" height="875" role="img" aria-labelledby="title desc">
  <title id="title">BIT face master v3 — owner proportion sheet</title>
  <desc id="desc">1000 by 875. Eyes 78 by 170, centres 486 apart. Smile endpoint centres 370 apart, arc depth 115, radial thickness 32 to 64 to 32. Face cyan #75CFCC. Original JPG: assets/reference/bit/BIT-Face-Proportion-Master-v1_A4-print_2.jpg. Legacy assets/bit-face-master.svg is preserved unchanged.</desc>
  <ellipse cx="257" cy="370" rx="39" ry="85" fill="#75CFCC" stroke="none"/>
  <ellipse cx="743" cy="370" rx="39" ry="85" fill="#75CFCC" stroke="none"/>
  <path d="${path}" fill="#75CFCC" stroke="none"/>
</svg>
`;
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
if(process.argv.includes('--write')){
  writeFileSync(target,svg,{flag:'wx'});
  console.log('Created assets/bit-face-master-v3.svg; legacy master untouched');
}else if(process.argv.includes('--check')){
  if(readFileSync(target,'utf8')!==svg)throw Error('v3 differs from reproducible sheet geometry');
  console.log('PASS: v3 is reproducible from the owner-sheet geometry');
}else{
  process.stdout.write(svg);
}
}
