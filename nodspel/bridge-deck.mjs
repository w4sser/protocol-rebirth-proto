// Deterministic visual plan for Nordic timber footbridges.
import {bridgeEntryFlare} from './bridge-flow.mjs?v=2.28.1';
// Navigation floors, collision and AI paths are deliberately untouched.
function seededRandom(seed){
  let s=2166136261;
  for(const char of String(seed))s=Math.imul(s^char.charCodeAt(0),16777619);
  return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
export function planBridgeDeck(floor,levelSeed,{quality='high'}={}){
  if(!floor?.dir)return null;
  const along=floor.dir.x?'x':'z';
  const length=along==='x'?floor.w:floor.d;
  const width=along==='x'?floor.d:floor.w;
  if(!(length>0&&width>0))return null;
  const r=seededRandom(`${levelSeed}:timber-deck-v1:${floor.x}:${floor.z}:${floor.w}:${floor.d}`);
  const isLow=quality==='low',spacing=isLow?.85:.50;
  const count=Math.max(1,Math.ceil(length/spacing)),pitch=length/count,planks=[];
  for(let i=0;i<count;i++){
    planks.push({
      t:-length/2+(i+.5)*pitch,
      length:Math.max(.10,pitch-(isLow?.07:.04)),
      width:Math.max(.1,width+bridgeEntryFlare(floor,-length/2+(i+.5)*pitch)-.10-r()*.09),
      cross:(r()-.5)*.035,
      tone:Math.floor(r()*4),landing:false,
    });
  }
  // Small, broadened landings visually connect the pier to the islands.
  // They project over the island's existing floor, not into new gameplay space.
  const apronDepth=1.20,rows=isLow?2:3;
  for(const end of [-1,1])for(let i=0;i<rows;i++){
    planks.push({
      t:end*(length/2+(i+.5)*apronDepth/rows),
      length:apronDepth/rows-.035,
      width:width+.15+.65*(i+1)/rows,
      cross:0,
      tone:Math.floor(r()*4),landing:true,
    });
  }
  const supportCount=Math.max(2,Math.ceil(length/3.3));
  const supports=[];
  for(let i=0;i<supportCount;i++){
    const t=-length/2+Math.min(length-.45, .50+i*(length-1)/Math.max(1,supportCount-1));
    for(const side of [-1,1])supports.push({t,side});
  }
  return {along,length,width,planks,supports};
}
