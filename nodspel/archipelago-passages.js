const overlaps=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-6&&Math.abs(a.z-b.z)<(a.d+b.d)/2-1e-6;
// Discover openings from the final wall layout, including partitions and encounter-cut side routes.
// A strip spans the wall and both approaches; narrow it to the actual clear corridor footprint.
export function archipelagoPassages(level){
  const passages=[];
  for(const axis of ['x','z']){
    const across=axis==='x'?'z':'x',size=axis==='x'?'w':'d',thick=axis==='x'?'d':'w';
    // A cut can leave a stub shorter than the wall thickness. Its collinear neighbour
    // still establishes which way that wall runs.
    const walls=level.walls.filter(w=>w[size]>=w[thick]||level.walls.some(b=>b[size]>b[thick]&&Math.abs(w[across]-b[across])<.025&&Math.abs(w[thick]-b[thick])<.025));
    for(const a of walls){
      const end=a[axis]+a[size]/2;
      const next=walls.filter(b=>b!==a&&Math.abs(a[across]-b[across])<.025&&b[axis]-b[size]/2>end+.025)
        .sort((b,c)=>(b[axis]-b[size]/2)-(c[axis]-c[size]/2))[0];
      if(!next)continue;
      const start=next[axis]-next[size]/2,mid=(end+start)/2;
      let lo=end+.04,hi=start-.04;
      const center=(a[across]+next[across])/2,depth=Math.max(a[thick],next[thick])+1.6;
      for(const w of level.walls){
        if(Math.abs(w[across]-center)>=(w[thick]+depth)/2-.001)continue;
        const left=w[axis]-w[size]/2,right=w[axis]+w[size]/2;
        if(right<=mid)lo=Math.max(lo,right+.04);
        else if(left>=mid)hi=Math.min(hi,left-.04);
        else{lo=hi;break;}
      }
      if(hi-lo<.8)continue;
      const p=axis==='x'?{x:(lo+hi)/2,z:center,w:hi-lo,d:depth}:{x:center,z:(lo+hi)/2,w:depth,d:hi-lo};
      // Require continuous ground on both sides, not an unrelated gap between islands.
      let grounded=true;
      for(const s of [-1,0,1])for(const t of [-1,0,1]){
        const x=p.x+s*p.w*.49,z=p.z+t*p.d*.49;
        if(!level.floors.some(f=>Math.abs(x-f.x)<=f.w/2+.001&&Math.abs(z-f.z)<=f.d/2+.001))grounded=false;
      }
      if(grounded&&!level.walls.some(w=>overlaps(w,p)))passages.push({...p,axis});
    }
  }
  return passages;
}
// Passage rectangles already include both approaches; reserve another rock-sized margin.
export function inPassageClearance(footprint,passages){
  return passages.some(p=>Math.abs(footprint.x-p.x)<p.w/2+.9+(footprint.w??0)/2&&Math.abs(footprint.z-p.z)<p.d/2+.9+(footprint.d??0)/2);
}
// Remove collidable dressing before gameplay takes copies of the solid list.
export function clearPassageProps(level,passages=archipelagoPassages(level)){
  for(let i=level.boxes.length-1;i>=0;i--)if(inPassageClearance(level.boxes[i],passages))level.boxes.splice(i,1);
}
