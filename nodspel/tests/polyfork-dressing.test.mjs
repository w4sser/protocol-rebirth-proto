import test from 'node:test';
import assert from 'node:assert/strict';
import {POLYFORK_CANDIDATES} from '../polyfork-catalog.mjs';
import {planPolyforkDressing,filterDressingTrees} from '../polyfork-dressing.mjs';
import {propReservations} from '../props-placement.mjs';
import {generateLevel} from '../levels.js';
import {archipelagoDressingConfig} from '../archipelago-dressing-policy.mjs';
import {planMilitaryRemnantsDressing} from '../polyfork-military-remnants.mjs';

const level={
  archipelago:true,seed:'polyfork-qa-42',
  floors:[{x:0,z:0,w:30,d:25},{x:46,z:0,w:25,d:25},
    {x:31.5,z:0,w:16,d:4.3,dir:{x:1,z:0}}],
  walls:[{x:0,z:11,w:30,d:.35},{x:0,z:-11,w:30,d:.35}],
  rooms:[],nodes:[{x:4,z:2}],lootBoxes:[{x:-4,z:-3}],
  start:{x:-9,z:0},exit:{x:52,z:0},enemies:[{x:9,z:6}],
};
test('curated model gallery has 56 unique real-id-shaped URLs',()=>{
  assert.equal(POLYFORK_CANDIDATES.length,56);
  assert.equal(new Set(POLYFORK_CANDIDATES.map(p=>p.id)).size,56);
  for(const c of POLYFORK_CANDIDATES){
    assert.match(c.id,/^[a-z0-9-]+-[a-f0-9]{6}$/);
    assert.equal(c.url,'https://polyfork.dev/cdn/'+c.id+'.glb');
    assert.ok(['Forest','Coast','Bunker'].includes(c.category));
  }
});
test('opt-in planner yields deterministic, bounded, playable-only decoration',()=>{
  const a=planPolyforkDressing(level,{quality:'high'});
  assert.deepEqual(a,planPolyforkDressing(level,{quality:'high'}));
  assert.ok(a.length>0,'large test island should yield decorations');
  assert.ok(a.length<=125,'high density is limited');
  const res=propReservations(level);
  for(const p of a){
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.h>0);
    assert.ok(level.floors.filter(f=>!f.dir).some(f=>
      Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2));
    assert.equal(res.blocked(p.x,p.z,.55),false,'must clear bridge and objective reservations');
  }
});
test('LOW has a smaller instance budget, and other environments receive none',()=>{
  assert.ok(planPolyforkDressing(level,{quality:'low'}).length<=40);
  assert.deepEqual(planPolyforkDressing({...level,archipelago:false}),[]);
  assert.deepEqual(planPolyforkDressing({...level,floors:[]}),[]);
});


test('native v2 pines remove only unfadable GLB tree species from dressing',()=>{
  const original=[
    {id:'young-pine-0d7695',x:1},{id:'tall-pine-tree-ab4108',x:2},
    {id:'birch-tree-181b33',x:3},{id:'grass-tuft-a40a08',x:4},
    {id:'fern-plant-1559b8',x:5},{id:'fallen-log-1685fb',x:6},
    {id:'round-bush-cd2ac0',x:7}
  ];
  assert.deepEqual(filterDressingTrees(original),original,
    'live and non-v2 previews continue using their existing forest assets');
  const filtered=filterDressingTrees(original,{nativePines:true});
  assert.deepEqual(filtered,[original[3],original[4],original[6]],
    'v2 removes old trees AND bleached decorative logs while preserving dark dressing');
  assert.deepEqual(filterDressingTrees(original,{nativePines:true}),filtered,
    'filtering must stay deterministic');
});

test('native v2 thins bright white-looking detail without affecting legacy or LOW subset',()=>{
  const ids=['small-rock-db33a7','wildflower-68d3a1','sea-holly-clump-ce3bc6'];
  const clutter=Array.from({length:100},(_,i)=>({
    id:ids[i%3],x:(i*13.7)%31,z:(i*9.3)%26,h:.4
  }));
  const safe=[{id:'grass-tuft-a40a08',x:1,z:2},{id:'medium-rock-e08405',x:4,z:8}];
  const mixed=[...clutter,...safe];
  assert.equal(filterDressingTrees(mixed),mixed,'legacy mode keeps all authored decoration');
  const filtered=filterDressingTrees(mixed,{nativePines:true});
  assert.deepEqual(filtered,filterDressingTrees(mixed,{nativePines:true}),
    'quiet v2 filtering is deterministic');
  const kept=filtered.filter(item=>ids.includes(item.id)).length;
  assert.ok(kept>=15&&kept<=45,'roughly 55–85% of tiny bright details are reduced');
  assert.ok(safe.every(item=>filtered.includes(item)),'moss, grass and major rocks remain');
  const low=filterDressingTrees(mixed.filter((_,i)=>i%2===0),{nativePines:true});
  assert.ok(low.every(item=>filtered.includes(item)),'LOW retains a subset of HIGH placements');
  const driftwood=[
    {id:'fallen-log-1685fb',x:2,z:3},
    {id:'driftwood-log-89a68f',x:7,z:5},
    {id:'seaweed-drift-line-6566c3',x:6,z:9},
    {id:'medium-rock-e08405',x:4,z:8}
  ];
  assert.equal(filterDressingTrees(driftwood),driftwood,
    'normal live Archipelago keeps its original driftwood and log props');
  const paleTufts=Array.from({length:100},(_,i)=>({id:'marram-grass-tuft-8c7a99',x:i*1.31,z:i*0.71}));
  const surviving=filterDressingTrees(paleTufts,{nativePines:true});
  assert.deepEqual(surviving,[],
    'pale beach-grass tufts still read as white confetti at 844x390, so v2 removes them');
  assert.equal(filterDressingTrees(paleTufts).length,100,
    'default/non-v2 beach grass remains unchanged');
  assert.deepEqual(filterDressingTrees(driftwood,{nativePines:true}),[driftwood[3]],
    'native v2 removes bleached logs and ray-identified white seaweed drift line, while keeping gameplay cover');
});

test('Pass ZA: residual bright detail is shoreline-only and clears player, POIs and approach routes',()=>{
  const f=level.floors[0];
  const sample=(x,z,id='wildflower-68d3a1')=>({id,x,z,h:.4});
  const interior=Array.from({length:20},(_,i)=>sample(f.x-4+i*.35,4.5));
  const spawn=Array.from({length:20},(_,i)=>sample(level.start.x+i*.18,level.start.z));
  const objective=Array.from({length:20},(_,i)=>sample(level.nodes[0].x+i*.11,level.nodes[0].z));
  const route=Array.from({length:20},(_,i)=>sample(-6+i*.35,.5));
  const coast=Array.from({length:120},(_,i)=>sample(-f.w/2+.55,
    -f.d/2+2.4+i*.16));
  const outside=[sample(999,999)];
  const candidates=[...interior,...spawn,...objective,...route,...coast,...outside];
  const kept=filterDressingTrees(candidates,{nativePines:true,level});
  assert.deepEqual(kept,filterDressingTrees(candidates,{nativePines:true,level}),
    'spatial filter keeps the same seeded candidates every time');
  for(const item of [...interior,...spawn,...objective,...route,...outside])
    assert.ok(!kept.includes(item),'bright detail cannot distract the central playable read');
  assert.ok(kept.length>1,'some sparse coastal detail is still present');
  assert.ok(kept.length<coast.length*.35,'remaining pale coastal plants stay sparse');
  assert.ok(kept.every(item=>coast.includes(item)),'only shoreline pockets retain pale detail');
  assert.deepEqual(filterDressingTrees([
    sample(-f.w/2+.5,5,'marram-grass-tuft-8c7a99'),
    sample(-7.319,1.086,'sea-holly-clump-ce3bc6')
  ],{nativePines:true,level}),[],
    'real-camera-confirmed white beach tufts and white sea-holly are entirely excluded from v2');
  assert.equal(filterDressingTrees([sample(-7.319,1.086,'sea-holly-clump-ce3bc6')]).length,1,
    'legacy non-v2 sea-holly dressing remains untouched');
  const dark=[sample(0,0,'grass-tuft-a40a08'),sample(-4,2,'round-bush-cd2ac0'),
    sample(0,2,'medium-rock-e08405')];
  assert.deepEqual(filterDressingTrees(dark,{nativePines:true,level}),dark,
    'dark, collision-safe vegetation and major rocks keep their existing placements');
  assert.deepEqual(filterDressingTrees(candidates,{level,quietGround:false}),candidates,
    'normal non-v2 scene is completely unchanged');
});

test('Pass ZA: filtering preserves a genuine LOW subset and stays away from bridge landings',async()=>{
  const {planMilitaryRemnantsDressing}=await import('../polyfork-military-remnants.mjs');
  const high=planMilitaryRemnantsDressing(level,{quality:'high'}).items;
  const low=planMilitaryRemnantsDressing(level,{quality:'low'}).items;
  const highFiltered=filterDressingTrees(high,{nativePines:true,level});
  const lowFiltered=filterDressingTrees(low,{nativePines:true,level});
  const key=p=>[p.id,p.x,p.z,p.h].join('/');
  const highKeys=new Set(highFiltered.map(key));
  assert.ok(lowFiltered.every(item=>highKeys.has(key(item))),
    'LOW survivors must all exist in the exact same HIGH positions');
  assert.ok(highFiltered.length<=high.length&&lowFiltered.length<=low.length);
  const res=propReservations(level);
  for(const item of highFiltered){
    if(!['marram-grass-tuft-8c7a99','small-rock-db33a7',
      'wildflower-68d3a1','sea-holly-clump-ce3bc6'].includes(item.id))continue;
    assert.equal(res.blocked(item.x,item.z,1.4),false,
      'pale details may not crowd bridge landings or gameplay objectives');
  }
});

test('Pass ZB: multi-seed, multi-island dressing density stays sparse and LOW is a true HIGH subset',()=>{
  const seeds=['archipelago-v2-target',
    ...Array.from({length:12},(_,i)=>'arch-dressing-audit-'+String(i).padStart(2,'0'))];
  const prohibited=new Set([
    'fallen-log-1685fb','driftwood-log-89a68f','seaweed-drift-line-6566c3',
    'marram-grass-tuft-8c7a99','sea-holly-clump-ce3bc6',
    'young-pine-0d7695','tall-pine-tree-ab4108','birch-tree-181b33'
  ]);
  const accents=new Set(['small-rock-db33a7','wildflower-68d3a1']);
  const highConfig=archipelagoDressingConfig({
    area:'archipelago',search:'?archVisual=v2&archTarget=1',quality:'high'
  });
  const lowConfig=archipelagoDressingConfig({
    area:'archipelago',search:'?archVisual=v2&archTarget=1',quality:'low'
  });
  assert.equal(highConfig.density,lowConfig.density,'same density is required for deterministic LOW subset');
  const budgetHigh=Math.ceil(125*highConfig.density),budgetLow=Math.ceil(40*lowConfig.density);
  const totals={layouts:0,islands:0,high:0,low:0,accentHigh:0,accentLow:0,
    maxPerIslandHigh:0,maxPerIslandLow:0,maxPer3mAccentCell:0,
    levelSummary:[],seeds:seeds.length};
  const key=p=>[p.id,p.x,p.z,p.h].join('/');
  for(const number of [1,2,3]){
    const byLevel={number,layouts:0,islands:0,high:0,low:0,accents:0};
    for(const seed of seeds){
      const generated=generateLevel(number,seed,'archipelago',false,false);
      const saved=JSON.stringify({
        floors:generated.floors,boxes:generated.boxes,walls:generated.walls,
        nodes:generated.nodes,enemies:generated.enemies,start:generated.start,exit:generated.exit
      });
      const h=planMilitaryRemnantsDressing(generated,highConfig);
      const l=planMilitaryRemnantsDressing(generated,lowConfig);
      const high=filterDressingTrees(h.items,{nativePines:true,level:generated});
      const low=filterDressingTrees(l.items,{nativePines:true,level:generated});
      const again=filterDressingTrees(planMilitaryRemnantsDressing(generated,highConfig).items,
        {nativePines:true,level:generated});
      assert.deepEqual(high,again,seed+' L'+number+' must remain deterministic');
      assert.deepEqual(filterDressingTrees(h.items),h.items,
        seed+' L'+number+' legacy composition must remain unaltered');
      const highKeys=new Set(high.map(key));
      assert.ok(low.every(p=>highKeys.has(key(p))),seed+' L'+number+' LOW must be subset of HIGH');
      assert.ok(high.length<=budgetHigh&&low.length<=budgetLow,seed+' L'+number+' respects budgets');
      const floors=generated.floors.filter(f=>!f.dir);
      const perHigh=new Array(floors.length).fill(0),perLow=new Array(floors.length).fill(0);
      const accentsPerCell=new Map(),reservations=propReservations(generated);
      for(const [collection,perIsland] of [[high,perHigh],[low,perLow]]){
        for(const item of collection){
          assert.ok(!prohibited.has(item.id),seed+' L'+number+' leaked pale clutter or legacy trees '+item.id);
          const id=item.region??floors.findIndex(f=>
            Math.abs(item.x-f.x)<=f.w/2+1&&Math.abs(item.z-f.z)<=f.d/2+1);
          if(id>=0&&id<floors.length)perIsland[id]++;
          if(!accents.has(item.id))continue;
          const f=floors.find(f=>
            Math.abs(item.x-f.x)<=f.w/2+1.1&&Math.abs(item.z-f.z)<=f.d/2+1.1);
          assert.ok(f,seed+' L'+number+' accent belongs on an island shoreline');
          const edge=Math.min(f.w/2-Math.abs(item.x-f.x),f.d/2-Math.abs(item.z-f.z));
          assert.ok(edge<=1.9,seed+' L'+number+' pale accent stays out of playable interior');
          assert.equal(reservations.blocked(item.x,item.z,1.4),false,
            seed+' L'+number+' pale accent clear of landing/POI reservations');
        }
      }
      for(const item of high.filter(p=>accents.has(p.id))){
        const cell=[Math.floor(item.x/3),Math.floor(item.z/3)].join(',');
        accentsPerCell.set(cell,(accentsPerCell.get(cell)??0)+1);
      }
      const accentHigh=high.filter(p=>accents.has(p.id)).length;
      const accentLow=low.filter(p=>accents.has(p.id)).length;
      totals.maxPer3mAccentCell=Math.max(totals.maxPer3mAccentCell,0,...accentsPerCell.values());
      totals.maxPerIslandHigh=Math.max(totals.maxPerIslandHigh,0,...perHigh);
      totals.maxPerIslandLow=Math.max(totals.maxPerIslandLow,0,...perLow);
      assert.deepEqual(JSON.stringify({
        floors:generated.floors,boxes:generated.boxes,walls:generated.walls,
        nodes:generated.nodes,enemies:generated.enemies,start:generated.start,exit:generated.exit
      }),saved,seed+' L'+number+' visual planners never modify gameplay geometry');
      totals.layouts++;totals.islands+=floors.length;totals.high+=high.length;totals.low+=low.length;
      totals.accentHigh+=accentHigh;totals.accentLow+=accentLow;
      byLevel.layouts++;byLevel.islands+=floors.length;byLevel.high+=high.length;
      byLevel.low+=low.length;byLevel.accents+=accentHigh;
    }
    totals.levelSummary.push(byLevel);
  }
  assert.ok(totals.layouts===39&&totals.islands>=39,'all 13 seeds across all three levels were audited');
  assert.ok(totals.high>totals.low,'HIGH retains more vegetation across the seed sample');
  console.info('ARCH_DRESSING_MULTI_SEED_AUDIT',JSON.stringify(totals));
});
