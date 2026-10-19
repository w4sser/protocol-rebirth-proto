// Visual wiring only. Route over floor and around cover/walls, never through them.
// No colliders or gameplay state: each cable follows its terminal's active flag.
export function controlCablePath(level,node){
  const step=.25,margin=.09,goal=level.exit;
  const solids=[...level.walls,...level.boxes];
  const onFloor=(x,z)=>level.floors.some(f=>Math.abs(x-f.x)<=f.w/2+1e-8&&Math.abs(z-f.z)<=f.d/2+1e-8);
  const free=p=>[[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]].every(([dx,dz])=>onFloor(p.x+dx,p.z+dz))&&
    !solids.some(b=>Math.abs(p.x-b.x)<b.w/2+margin&&Math.abs(p.z-b.z)<b.d/2+margin);
  const clear=(a,b)=>{const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.08);for(let i=0;i<=n;i++)if(!free({x:a.x+(b.x-a.x)*i/Math.max(n,1),z:a.z+(b.z-a.z)*i/Math.max(n,1)}))return false;return true;};
  if(!free(node)||!free(goal))return [];
  const key=(x,z)=>`${x},${z}`,point=c=>({x:node.x+c.x*step,z:node.z+c.z*step});
  const first={x:0,z:0,prev:null},queue=[first],seen=new Set([key(0,0)]);
  let end=null;
  for(let head=0;head<queue.length;head++){
    const cell=queue[head],p=point(cell);
    if(Math.hypot(p.x-goal.x,p.z-goal.z)<=step*1.5&&clear(p,goal)){end=cell;break;}
    for(const [dx,dz] of [[1,0],[0,-1],[-1,0],[0,1]]){
      const next={x:cell.x+dx,z:cell.z+dz,prev:cell},k=key(next.x,next.z);
      if(seen.has(k))continue;seen.add(k);if(clear(p,point(next)))queue.push(next);
    }
  }
  if(!end)return [];
  const path=[{x:goal.x,z:goal.z}];for(let c=end;c;c=c.prev)path.push(point(c));path.reverse();
  // Keep right-angle turns, but combine collinear grid steps into long channels.
  const out=[path[0]];
  for(let i=1;i<path.length-1;i++){
    const a=out[out.length-1],b=path[i],c=path[i+1];
    if(Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))>1e-8)out.push(b);
  }
  if(Math.hypot(path.at(-1).x-out.at(-1).x,path.at(-1).z-out.at(-1).z)>1e-8)out.push(path.at(-1));
  return out;
}
