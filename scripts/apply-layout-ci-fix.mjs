import {readFile,writeFile} from 'node:fs/promises';
const path='scripts/layout-check.mjs';
let s=await readFile(path,'utf8');
const start='try{\n  for(const vp of VIEWPORTS)await pauseMapRun(vp);';
const end="  for(const vp of VIEWPORTS)for(const area of ['bunker','town'])await raidRun(vp,area);\n}finally";
if(!s.includes(start)||!s.includes(end))throw Error('Layout script changed; manual review needed');
s=s.replace(start,`const layoutGroup=process.env.LAYOUT_GROUP||'all';
if(!['all','popups','base','raid-bunker','raid-town'].includes(layoutGroup))throw Error('Unknown LAYOUT_GROUP: '+layoutGroup);
const group=name=>layoutGroup==='all'||layoutGroup===name;
try{
  if(group('popups')){
  for(const vp of VIEWPORTS)await pauseMapRun(vp);`);
s=s.replace(end,`  }
  if(group('base')){
    for(const vp of VIEWPORTS)await baseAfterRaidRun(vp);
    for(const vp of VIEWPORTS)await baseRun(vp);
  }
  if(group('raid-bunker'))for(const vp of VIEWPORTS)await raidRun(vp,'bunker');
  if(group('raid-town'))for(const vp of VIEWPORTS)await raidRun(vp,'town');
}finally`);
s=s.replace("  for(const vp of VIEWPORTS)await baseAfterRaidRun(vp);\n  for(const vp of VIEWPORTS)await introGoalRun(vp);", "  for(const vp of VIEWPORTS)await introGoalRun(vp);");
s=s.replace("  for(const vp of VIEWPORTS)await baseRun(vp);\n  }", "  }");
await writeFile(path,s);
const ci='.github/workflows/ci.yml';let y=await readFile(ci,'utf8');
y=y.replace('  layout:\n    runs-on: ubuntu-latest',`  layout:
    strategy:
      fail-fast: false
      matrix:
        group: [popups, base, raid-bunker, raid-town]
    name: layout / ${{ matrix.group }}
    runs-on: ubuntu-latest`);
y=y.replace('          LAYOUT_OUT: verify-out','          LAYOUT_OUT: verify-out\n          LAYOUT_GROUP: ${{ matrix.group }}');
y=y.replace('          name: layout-screenshots','          name: layout-screenshots-${{ matrix.group }}');
await writeFile(ci,y);
console.log('Applied layout isolation patch');