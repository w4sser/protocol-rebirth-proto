import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {generateBigLevel} from '../big-level.js';
import {buildArchipelago} from '../archipelago.js';
import {movePlayer,describeMoveBlock} from '../physics.mjs';

// Collision-contract tests run on the FINAL runtime walls, not the authoring
// walls. buildArchipelago replaces authored shoreline walls with invisible
// shore segments and individual boulder colliders, which is where the
// f735c403-1:2 bridge-mouth snag originated.
function runtime(level){
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  buildArchipelago(level,group,box,{quality:{props:0}});
  return {solids:[...level.walls,...level.boxes],dispose(){
    group.traverse(m=>{
      if(m.geometry&&!m.geometry.userData.shared)m.geometry.dispose();
      const materials=Array.isArray(m.material)?m.material:[m.material];
      for(const mat of materials)if(mat&&!mat.userData.shared)mat.dispose();
    });
  }};
}
const inside=(p,f,margin=0)=>Math.abs(p.x-f.x)<=f.w/2+margin&&Math.abs(p.z-f.z)<=f.d/2+margin;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function fixtures(){
  const all=[{level:generateLevel(2,'f735c403-1','archipelago'),label:'reported-phone-seed'}];
  for(let n=1;n<=3;n++)for(let i=0;i<12;i++)
    all.push({level:generateLevel(n,'shore-collision-sweep-'+i,'archipelago'),label:'normal-'+n+'-'+i});
  for(let i=0;i<6;i++)
    all.push({level:generateBigLevel('shore-collision-big-'+i,'archipelago'),label:'big-'+i});
  return all;
}
function portals(level){
  const out=[];
  for(const [i,c] of (level.corridors??[]).entries())out.push({c,label:'corridor-'+i,banks:[-1,1]});
  for(const [i,c] of (level.deadEnds??[]).entries()){
    const dir=c.dir.x||c.dir.z||1;
    out.push({c,label:'dead-end-'+i,banks:[-Math.sign(dir)]});
  }
  if(level.closet){
    const c=level.closet,dir=c.dir.x||c.dir.z||1;
    out.push({c,label:'closet',banks:[-Math.sign(dir)]});
  }
  return out;
}
function point(c,axis,side,along,across){
  const p={x:c.x,z:c.z};p[axis]+=along;p[side]+=across;return p;
}
function diagnostic(label,level,portal,bank,radius,from,to,end,solids){
  const blocker=describeMoveBlock(end,to,solids,level.floors,radius);
  return JSON.stringify({label,seed:level.seed,portal,bank,radius,
    from,to,end,miss:dist(end,to),blocker});
}

test('all generated bridge and branch doorways are traversable after shoreline / boulder rendering',()=>{
  let entryChecks=0,branches=0,rockContact=0,shoreContact=0;
  for(const {level,label} of fixtures()){
    const {solids,dispose}=runtime(level);
    try{
      rockContact+=solids.filter(w=>w.rock).length;
      shoreContact+=solids.filter(w=>w.shore).length;
      for(const {c,label:portal,banks} of portals(level)){
        branches++;
        const axis=c.dir.x?'x':'z',side=c.dir.x?'z':'x';
        const length=c.dir.x?c.w:c.d,width=c.dir.x?c.d:c.w;
        const inner=Math.min(1.05,Math.max(.18,length/2));
        for(const bank of banks)for(const radius of [.36,.48])
          for(const lateral of [-.85,0,.85])for(const angled of [false,true]){
          const edge=bank*length/2;
          const from=point(c,axis,side,edge+bank*1.2,lateral);
          const to=point(c,axis,side,edge-bank*inner,angled?lateral*.55:lateral);
          const end=movePlayer(from,{x:to.x-from.x,z:to.z-from.z},
            solids,level.floors,radius);
          assert.ok(dist(end,to)<.12,
            'blocked doorway: '+diagnostic(label,level,portal,bank,radius,from,to,end,solids));
          entryChecks++;
        }
      }
    }finally{dispose();}
  }
  assert.ok(entryChecks>300,'sweep must actually exercise many independent crossings');
  assert.ok(branches>40,'exercise main bridges, side branches and big-map bridges');
  assert.ok(rockContact>0&&shoreContact>0,'sweep must include runtime rocks and shoreline');
});

test('continuous central lane through every main bridge remains open after final collision assembly',()=>{
  let paths=0;
  for(const {level,label} of fixtures()){
    const {solids,dispose}=runtime(level);
    try{
      for(const [i,c] of (level.corridors??[]).entries()){
        const axis=c.dir.x?'x':'z',side=c.dir.x?'z':'x',length=c.dir.x?c.w:c.d;
        for(const radius of [.36,.48])for(const lateral of [0,.65]){
          const from=point(c,axis,side,-length/2-1.0,lateral);
          const to=point(c,axis,side,length/2+1.0,lateral);
          const end=movePlayer(from,{x:to.x-from.x,z:to.z-from.z},
            solids,level.floors,radius);
          assert.ok(dist(end,to)<.14,
            'blocked full bridge: '+diagnostic(label,level,'corridor-'+i,0,radius,from,to,end,solids));
          paths++;
        }
      }
    }finally{dispose();}
  }
  assert.ok(paths>40,'exercise full-length traversal including bridge center');
});

test('shore and water edges away from crossings remain closed',()=>{
  let edges=0,water=0;
  for(const {level,label} of fixtures()){
    const {solids,dispose}=runtime(level);
    try{
      for(const r of level.rooms){
        for(const dir of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]){
          if((r.doors??[]).some(d=>d.x===dir.x&&d.z===dir.z))continue;
          const axis=dir.x?'x':'z',half=dir.x?r.w/2:r.d/2,sign=dir.x||dir.z;
          const from={x:r.x,z:r.z},to={x:r.x,z:r.z};
          from[axis]+=sign*(half-1.1);to[axis]+=sign*(half+1.2);
          // An adjacent island/corridor can legitimately support this point.
          if(level.floors.some(f=>f.dir&&inside(to,f,.48)
              ||(f.x!==r.x||f.z!==r.z)&&!f.dir&&inside(to,f,.48)))continue;
          const end=movePlayer(from,{x:to.x-from.x,z:to.z-from.z},
            solids,level.floors,.36);
          assert.ok(sign*(end[axis]-r[axis])<half+.16,
            'escaped island edge: '+JSON.stringify({label,seed:level.seed,room:r.id,dir,from,to,end}));
          edges++;
        }
      }
      for(const c of level.corridors??[]){
        const axis=c.dir.x?'z':'x',width=c.dir.x?c.d:c.w;
        const from={x:c.x,z:c.z},to={x:c.x,z:c.z};
        to[axis]+=width/2+1.3;
        // Do not mislabel a bridge attached to overlapping island ground as water.
        if(level.rooms.some(r=>inside(from,r,.5)||inside(to,r,.5)))continue;
        const end=movePlayer(from,{x:to.x-from.x,z:to.z-from.z},
          solids,level.floors,.36);
        assert.ok(Math.abs(end[axis]-c[axis])<=width/2-.36+.15,
          'walked off bridge into water: '+JSON.stringify({label,seed:level.seed,c,to,end}));
        water++;
      }
    }finally{dispose();}
  }
  assert.ok(edges>30,'verify intact non-door shorelines');
  assert.ok(water>3,'verify unsupported water beside independent bridges');
});

test('no invisible bridge-mouth seam remains as a blocking shore collider',()=>{
  let checked=0;
  for(const {level,label} of fixtures()){
    const {solids,dispose}=runtime(level);
    try{
      for(const {c,label:portal,banks} of portals(level)){
        const axis=c.dir.x?'x':'z',side=c.dir.x?'z':'x';
        const length=c.dir.x?c.w:c.d;
        for(const bank of banks){
          const edge=bank*length/2;
          for(const lateral of [-.9,-.45,0,.45,.9]){
            const sample=point(c,axis,side,edge+bank*.08,lateral);
            for(const [i,b] of solids.entries()){
              if(!b.shore)continue;
              const cx=Math.max(b.x-b.w/2,Math.min(sample.x,b.x+b.w/2));
              const cz=Math.max(b.z-b.d/2,Math.min(sample.z,b.z+b.d/2));
              assert.ok(Math.hypot(sample.x-cx,sample.z-cz)>.48,
                'invisible shoreline collides with walkable bridge mouth: '+
                JSON.stringify({label,seed:level.seed,portal,bank,lateral,sample,index:i,wall:b}));
            }
            checked++;
          }
        }
      }
    }finally{dispose();}
  }
  assert.ok(checked>100);
});
