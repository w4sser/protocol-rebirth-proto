import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {generateBigLevel} from '../big-level.js';
import {buildArchipelago} from '../archipelago.js';
import {movePlayer} from '../physics.mjs';
import {planBridgeDeck} from '../bridge-deck.mjs';
import {
  BRIDGE_ENTRY_FLARE_DEPTH,BRIDGE_ENTRY_FLARE_EXTRA,
  BRIDGE_LAND_RAIL_RECESS,BRIDGE_SIDE_BUFFER,
  bridgeEntrySupports,bridgeMouthWidth,
} from '../bridge-flow.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const travel=(start,to,solids,floors,radius)=>movePlayer(
  start,{x:to.x-start.x,z:to.z-start.z},solids,floors,radius
);

function simpleLevel(vertical=false){
  const roomA=vertical?{x:0,z:0,w:12,d:12}:{x:0,z:0,w:12,d:12};
  const roomB=vertical?{x:0,z:19,w:12,d:12}:{x:19,z:0,w:12,d:12};
  const bridge=vertical
    ?{x:0,z:9.5,w:4,d:7,dir:{x:0,z:1},bridgeFunnel:true}
    :{x:9.5,z:0,w:7,d:4,dir:{x:1,z:0},bridgeFunnel:true};
  const railLength=Math.max(.3,7-2*BRIDGE_LAND_RAIL_RECESS),t=.4;
  const walls=[];
  const mouth=bridgeMouthWidth(4,12,t);
  for(const room of [roomA,roomB])for(const sign of [-1,1]){
    if(vertical)walls.push({x:sign*(12+mouth)/4,z:room.z+(room===roomA?1:-1)*5.8,w:(12-mouth)/2,d:t});
    else walls.push({x:room.x+(room===roomA?1:-1)*5.8,z:sign*(12+mouth)/4,w:t,d:(12-mouth)/2});
  }
  for(const sign of [-1,1]){
    if(vertical)walls.push({x:sign*(2+t/2),z:bridge.z,w:t,d:railLength});
    else walls.push({x:bridge.x,z:sign*(2+t/2),w:railLength,d:t});
  }
  return {floors:[roomA,bridge,roomB],walls,bridge};
}

test('bridge rail collision lies outside the full 4-metre walkway',()=>{
  for(const seed of ['angled-0','angled-1','angled-2','angled-3']){
    const level=generateLevel(2,seed,'archipelago');
    for(const c of level.corridors){
      const xAxis=!!c.dir.x,across=xAxis?'z':'x',along=xAxis?'x':'z';
      const width=xAxis?c.d:c.w;
      const railWidth=xAxis?'d':'w',railLength=xAxis?'w':'d';
      const rails=level.walls.filter(w=>
        w.bridgeRail===true && Math.abs(w[along]-c[along])<.02 &&
        Math.abs(w[across]-c[across])>=width/2 &&
        Math.abs(w[across]-c[across])<width/2+1
      );
      assert.equal(rails.length,2,'both corridor rails found');
      for(const rail of rails){
        const inner=Math.abs(rail[across]-c[across])-rail[railWidth]/2;
        assert.ok(inner>=width/2-.01,'rail must not steal walkable width: '+JSON.stringify({seed,c,rail}));
      }
    }
  }
});

test('full bridge entry accepts angled movement from both banks and sides, on both axes',()=>{
  // Previously, just reaching the first 30 cm of planks could pass tests while
  // the player hit invisible rails 1 m later. Travel 2.8 m onto the bridge.
  for(const vertical of [false,true]){
    const level=simpleLevel(vertical),along=vertical?'z':'x',across=vertical?'x':'z';
    for(const radius of [.36,.48])for(const sign of [-1,1])for(const bank of [0,1]){
      for(const fromOffset of [-.25,.35,1.0,1.2])for(const toOffset of [.65,1.0,1.2]){
        const start={x:0,z:0},target={x:0,z:0};
        const bankDir=bank===0?1:-1;
        start[along]=(bank===0?0:19)+bankDir*3;
        target[along]=(bank===0?0:19)+bankDir*8.8;
        start[across]=sign*(2+fromOffset);
        target[across]=sign*toOffset;
        const end=travel(start,target,level.walls,level.floors,radius);
        assert.ok(distance(end,target)<.15,
          'angled bridge crossing snag: '+JSON.stringify({vertical,radius,bank,sign,fromOffset,toOffset,end,target}));
      }
    }
    // The middle of the pier must remain bounded by water (no invisible shortcut).
    const mid={x:level.bridge.x,z:level.bridge.z},beyond={...mid};
    beyond[across]=4;
    const end=travel(mid,beyond,level.walls,level.floors,.36);
    assert.ok(Math.abs(end[across]-mid[across])<1.7,'no walking off the open-water sides');
  }
});

test('visual timber funnel and collision use the same width, on HIGH and LOW',()=>{
  for(const vertical of [false,true]){
    const bridge=simpleLevel(vertical).bridge;
    assert.ok(bridgeEntrySupports(bridge,vertical?2.9:6.1,vertical?6.1:2.9),
      'wide early landing supports running close to outer planks');
    assert.ok(BRIDGE_SIDE_BUFFER>=2,'rock-free margin covers flared approach');
    for(const quality of ['high','low']){
      const plan=planBridgeDeck(bridge,'angled-bridge',{quality});
      const deck=plan.planks.filter(p=>!p.landing);
      const middle=deck.filter(p=>Math.abs(p.t)<plan.length/2-BRIDGE_ENTRY_FLARE_DEPTH);
      const near=deck.filter(p=>Math.abs(p.t)>plan.length/2-.45);
      const land=plan.planks.filter(p=>p.landing);
      assert.ok(middle.length>0&&middle.every(p=>p.width<plan.width),'over-water width unchanged');
      assert.ok(near.some(p=>p.width>plan.width+BRIDGE_ENTRY_FLARE_EXTRA*.6));
      assert.ok(land.every(p=>p.width>=plan.width+BRIDGE_ENTRY_FLARE_EXTRA),'approach plank matches playable funnel');
    }
  }
});

test('rendered seeded Archipelago levels keep funnel clearance free from rock contact',()=>{
  for(const big of [false,true])for(let seed=0;seed<3;seed++){
    const level=big?generateBigLevel('bridge-funnel-big-'+seed,'archipelago')
      :generateLevel(2,'bridge-funnel-'+seed,'archipelago');
    const group=new THREE.Group();
    const box=(x,y,z,w,h,d,color,parent=group)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
      m.position.set(x,y,z);parent.add(m);return m;
    };
    buildArchipelago(level,group,box,{quality:{props:0}});
    try{
      for(const c of level.corridors.slice(0,4)){
        const along=c.dir.x?'x':'z',across=c.dir.x?'z':'x';
        const length=c.dir.x?c.w:c.d,halfWidth=(c.dir.x?c.d:c.w)/2;
        for(const sign of [-1,1])for(const end of [-1,1]){
          const p={x:c.x,z:c.z};
          p[along]+=end*(length/2-.6);p[across]+=sign*(halfWidth+.65);
          const nearestRock=level.walls.filter(w=>w.rock).reduce((d,w)=>
            Math.min(d,Math.hypot(p.x-w.x,p.z-w.z)-w.r),Infinity);
          assert.ok(nearestRock>.48,'boulders cannot pinch a widened entry: '+JSON.stringify({big,seed,p,nearestRock}));
        }
      }
    }finally{group.traverse(m=>{m.geometry?.dispose();if(Array.isArray(m.material))m.material.forEach(x=>x.dispose());else m.material?.dispose();});}
  }
});
