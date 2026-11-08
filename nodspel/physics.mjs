// @hot boxHit nodeHit traceTargets aimEndpoint aimConePoints
import {bridgeEntrySupports} from './bridge-flow.mjs?v=2.28.0';
export function movePlayer(position, delta, boxes, floors, radius) {
  const p = {...position};
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / .08));
  const limit = typeof floors==='number'?floors-radius:Infinity;
  const onFloor=(x,z)=>typeof floors==='number' || [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius*.707,-radius*.707],[radius*.707,-radius*.707],[-radius*.707,radius*.707],[radius*.707,radius*.707]].every(([dx,dz])=>floors.some(f=>(Math.abs(x+dx-f.x)<=f.w/2 && Math.abs(z+dz-f.z)<=f.d/2)||bridgeEntrySupports(f,x+dx,z+dz)));
  const blocked = (x, z) => boxes.some(b => {
    if(Number.isFinite(b.r)){
      const distance=Math.hypot(x-b.x,z-b.z),previous=Math.hypot(p.x-b.x,p.z-b.z);
      // An existing overlap must allow an outward step, rather than trapping
      // both axes forever. New overlaps remain blocked.
      return distance<radius+b.r-1e-8&&distance<=previous+1e-9;
    }
    const cx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const cz = Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
    return Math.hypot(x - cx, z - cz) < radius;
  });
  for (let i = 0; i < steps; i++) {
    const x = Math.max(-limit, Math.min(limit, p.x + delta.x / steps));
    if (onFloor(x,p.z) && !blocked(x, p.z)) p.x = x;
    const z = Math.max(-limit, Math.min(limit, p.z + delta.z / steps));
    if (onFloor(p.x,z) && !blocked(p.x, z)) p.z = z;
  }
  return p;
}

// Static geometry stays solid. Actors use circles and yield to movement;
// repeated separation also handles enemies becoming active under the player.
export function moveWithActors(position,delta,enemies,solids,floors,radius){
  let p={...position};const actors=enemies.filter(e=>e.health>0&&e.active!==false);
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.08));
  for(let step=0;step<steps;step++){
    p=movePlayer(p,{x:delta.x/steps,z:delta.z/steps},solids,floors,radius);
    for(let pass=0;pass<16;pass++){
      let overlaps=false;
      for(const enemy of actors){
        const r=enemy.r??.48,total=radius+r+.001,dx=enemy.x-p.x,dz=enemy.z-p.z,distance=Math.hypot(dx,dz);
        if(distance>=total-1e-6)continue;overlaps=true;
        const others=actors.filter(e=>e!==enemy).map(e=>({x:e.x,z:e.z,r:e.r??.48}));
        const angle=distance>1e-8?Math.atan2(dz,dx):0;
        // Prefer a small push along the contact normal. If cover prevents that,
        // try tangential escape directions while sweeping against the walls.
        let best={x:enemy.x,z:enemy.z},bestDistance=distance;
        for(let i=0;i<16;i++){
          const theta=angle+(i===0?0:Math.ceil(i/2)*Math.PI/8*(i%2?1:-1));
          const candidate=movePlayer(enemy,{x:p.x+Math.cos(theta)*total-enemy.x,z:p.z+Math.sin(theta)*total-enemy.z},[...solids,...others],floors,r);
          const gap=Math.hypot(candidate.x-p.x,candidate.z-p.z);
          if(gap>bestDistance){best=candidate;bestDistance=gap;}
          if(gap>=total-1e-6)break;
        }
        enemy.x=best.x;enemy.z=best.z;
        const gap=Math.hypot(p.x-enemy.x,p.z-enemy.z);
        if(gap<total-1e-6){
          const normal=gap>1e-8?Math.atan2(p.z-enemy.z,p.x-enemy.x):Math.PI;
          let escape=p,escapeDistance=gap;
          for(let i=0;i<16;i++){
            const theta=normal+(i===0?0:Math.ceil(i/2)*Math.PI/8*(i%2?1:-1));
            const candidate=movePlayer(p,{x:enemy.x+Math.cos(theta)*total-p.x,z:enemy.z+Math.sin(theta)*total-p.z},[...solids,...actors.map(e=>({x:e.x,z:e.z,r:e.r??.48}))],floors,radius);
            const d=Math.hypot(candidate.x-enemy.x,candidate.z-enemy.z);
            if(d>escapeDistance){escape=candidate;escapeDistance=d;}
            if(d>=total-1e-6)break;
          }
          p=escape;
        }
      }
      if(!overlaps)break;
    }
  }
  return p;
}

// v2.24.0 hot path: the x/z slab test is unrolled (the old `for (const [axis,size] of [['x','w'],['z','d']])`
// allocated three arrays + an iterator per call, and this runs thousands of times per frame).
function boxHit(a, b, box) {
  if(Number.isFinite(box.r))return nodeHit(a,b,box);
  let near = 0, far = 1;
  const dx = b.x - a.x, xlo = box.x - box.w / 2, xhi = box.x + box.w / 2;
  if (Math.abs(dx) < 1e-9) {
    if (a.x < xlo || a.x > xhi) return Infinity;
  } else {
    const t1 = (xlo - a.x) / dx, t2 = (xhi - a.x) / dx;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return Infinity;
  }
  const dz = b.z - a.z, zlo = box.z - box.d / 2, zhi = box.z + box.d / 2;
  if (Math.abs(dz) < 1e-9) {
    if (a.z < zlo || a.z > zhi) return Infinity;
  } else {
    const t1 = (zlo - a.z) / dz, t2 = (zhi - a.z) / dz;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return Infinity;
  }
  return near;
}

function nodeHit(a, b, node) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const ox = a.x - node.x, oz = a.z - node.z;
  const length = dx * dx + dz * dz;
  const dot = ox * dx + oz * dz;
  const c = ox * ox + oz * oz - node.r * node.r;
  const disc = dot * dot - length * c;
  let nodeTime = Infinity;
  if (c <= 0) nodeTime = 0;
  else if (length > 0 && disc >= 0) {
    const t = (-dot - Math.sqrt(disc)) / length;
    if (t >= 0 && t <= 1) nodeTime = t;
  }
  return nodeTime;
}
const WALL_HIT=Object.freeze({kind:'wall'}); // shared read-only result (v2.24.0 hot path)
export function traceTargets(a,b,boxes,nodes) {
  let nodeTime=Infinity,closest=null;
  for(const node of nodes){const time=nodeHit(a,b,node);if(time<nodeTime){nodeTime=time;closest=node;}}
  let wallTime = Infinity;
  for (const box of boxes) wallTime = Math.min(wallTime, boxHit(a,b,box));
  // hot-ok: target hits are rare events; callers keep the result
  if (nodeTime < wallTime) return closest.kind?{kind:closest.kind,target:closest}:{kind:'node',node:closest};
  if (wallTime !== Infinity) return WALL_HIT;
  return null;
}
export function traceShot(a,b,boxes,node) {
  return traceTargets(a,b,boxes,[node])?.kind ?? null;
}

// Contact on the swept segment, before knockback or the projectile is removed.
export function shotContact(a,b,hit,boxes){
  const target=hit.target??hit.node;
  let time=target?nodeHit(a,b,target):1;
  if(!target)for(const box of boxes)time=Math.min(time,boxHit(a,b,box));
  return {x:a.x+(b.x-a.x)*time,z:a.z+(b.z-a.z)*time};
}

// Aim only stops at solid obstacles; living targets and loot do not clip it.
const aimEnd={x:0,z:0};
export function aimEndpoint(position,direction,range,obstacles){
  const length=Math.hypot(direction.x,direction.z);
  if(length<1e-9)return {x:position.x,z:position.z}; // hot-ok: degenerate direction only
  const end=aimEnd;end.x=position.x+direction.x/length*range;end.z=position.z+direction.z/length*range;
  let time=1;
  for(const obstacle of obstacles)time=Math.min(time,boxHit(position,end,obstacle));
  return {x:position.x+(end.x-position.x)*time,z:position.z+(end.z-position.z)*time}; // hot-ok: result is the API (callers keep it)
}

// Visibility fan: include both sides of each solid corner so triangles never
// bridge across a wall silhouette. Targets do not participate in clipping.
const coneAngles=[];const byNumber=(a,b)=>a-b;
export function aimConePoints(position,direction,range,halfAngle,obstacles){
  const heading=Math.atan2(direction.z,direction.x),angles=coneAngles;angles.length=0;
  for(let i=0;i<=48;i++)angles.push(-halfAngle+2*halfAngle*i/48);
  for(const box of obstacles){
    if(Number.isFinite(box.r)){
      const dx=box.x-position.x,dz=box.z-position.z,distance=Math.hypot(dx,dz);
      if(distance<=box.r){angles.push(-halfAngle,halfAngle);continue;}
      const center=Math.atan2(dz,dx)-heading,spread=Math.asin(Math.min(1,box.r/distance));
      for(const side of [-1,1])for(const offset of [-1e-5,0,1e-5]){
        const angle=center+side*spread+offset,wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));
        if(wrapped>-halfAngle&&wrapped<halfAngle)angles.push(wrapped);
      }
      continue;
    }
    for(let sx=-1;sx<=1;sx+=2)for(let sz=-1;sz<=1;sz+=2){
      const angle=Math.atan2(box.z+sz*box.d/2-position.z,box.x+sx*box.w/2-position.x)-heading;
      const wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));
      for(let k=-1;k<=1;k++){const offset=k*1e-5;if(wrapped+offset>-halfAngle&&wrapped+offset<halfAngle)angles.push(wrapped+offset);}
    }
  }
  angles.sort(byNumber);
  // hot-ok: the returned fan (one point per angle) is the API; callers keep it for the frame
  const out=[{x:position.x,z:position.z}];const dir={x:0,z:0};
  for(const angle of angles){dir.x=Math.cos(heading+angle);dir.z=Math.sin(heading+angle);out.push(aimEndpoint(position,dir,range,obstacles));}
  return out;
}
