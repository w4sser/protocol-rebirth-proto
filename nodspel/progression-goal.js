import '../data/items.js?v=1.65.1';
import {RULES} from './levels.js?v=1.65.1';
export const MATERIALS={...globalThis.DATA.currencies,...Object.fromEntries(globalThis.DATA.items.map(i=>[i.id,{name:i.name,icon:i.icon,source:i.source}]))};
export function readGoal(value){
  if(typeof value!=='string'||value.length>4000)return null;
  try{const g=JSON.parse(value);if(!g||typeof g.module!=='string'||!g.module.match(/^[a-z_]+$/)||!Number.isInteger(g.level)||g.level<1||g.level>3||!Array.isArray(g.parts)||!g.parts.length||g.parts.length>12)return null;
    const parts=g.parts.map(p=>{const kind=p.kind==='currency'?'currency':'item',valid=kind==='currency'?globalThis.DATA.currencies[p.id]:globalThis.DATA.items.find(i=>i.id===p.id);if(!valid||!Number.isInteger(p.need)||p.need<1||p.need>100000||!Number.isInteger(p.secured)||p.secured<0)throw Error();return {id:p.id,kind,...MATERIALS[p.id],need:p.need,secured:Math.min(p.secured,1000000)};});
    if(new Set(parts.map(p=>p.id)).size!==parts.length)return null;
    return {module:g.module,level:g.level,name:String(g.name||g.module).slice(0,60),benefit:String(g.benefit||'').slice(0,250),parts};
  }catch{return null;}
}
export function goalProgress(goal,bag={}){
  const parts=goal.parts.map(p=>{const carried=p.kind==='currency'?globalThis.DATA.items.reduce((sum,item)=>sum+(item.grantsCurrency?.[p.id]||0)*Math.max(0,Math.floor(bag[item.id]||0)),0):Math.max(0,Math.floor(bag[p.id]||0));return {...p,carried,remaining:Math.max(0,p.need-p.secured-carried)};});
  return {parts,secured:parts.every(p=>p.secured>=p.need),enoughCarried:parts.every(p=>p.remaining===0)};
}
// Intro supplies are available on the route, never credited until collected/extracted.
// Uses the existing seeded room, node and exit. No new enemy type or hand-drawn map.
export function applyIntroEncounter(level,goal){
  if(level.number!==1||!goal)return;
  const cfg=RULES.intro,r=level.rooms[0],s=level.choiceSide||1;
  level.intro=true;level.title='Guarded Supply Cache';level.firstGraceMs=cfg.graceMs;
  r.name='Electrical Storage';
  Object.assign(level.nodes[0],{x:r.x+s*cfg.nodeX,z:r.z+cfg.nodeZ});
  level.start={x:r.x-s*cfg.lane,z:r.z+cfg.startZ};
  level.boxes=[{x:r.x-s*cfg.lane,z:r.z+cfg.coverZ,w:cfg.coverSize,d:cfg.coverSize,h:1.4,introCover:true}];
  const enemy=level.enemies[0];Object.assign(enemy,{x:r.x-s*cfg.lane,z:r.z+cfg.guardZ,speed:0,introGuard:true,active:true});level.enemies=[enemy];
  level.lootBoxes=[];
  let i=0;for(const p of goal.parts){const currency=p.kind==='currency'&&globalThis.DATA.items.find(item=>item.grantsCurrency?.[p.id]);const count=Math.ceil(Math.max(0,p.need-p.secured)/(currency?currency.grantsCurrency[p.id]:1));for(let n=0;n<count;n++,i++)level.lootBoxes.push({id:`supply-${i}`,x:r.x+s*(cfg.supplyX+(i%2)*cfg.supplySpacing),z:r.z+cfg.supplyZ+Math.floor(i/2)*cfg.supplySpacing,item:currency?currency.id:p.id,marked:true,revealed:true,collected:false,source:'ELECTRICAL STORAGE · REPAIR SUPPLIES'});}
  level.lootBoxes.push({id:'optional-cache',x:r.x-s*cfg.optionalX,z:r.z+cfg.optionalZ,item:cfg.optionalItems[s<0?0:1],marked:true,revealed:true,collected:false,optional:true,source:'OPTIONAL · EXTRA LOOT'});
}
