import {createRoomVisibility} from './big-level-culling.js?v=2.22.0';
import * as THREE from './vendor/three.module.js';
import {levelMapSVG,mapIconSymbols} from './level-map.js?v=2.22.0';
import {graphRoomAt} from './zone-graph.js?v=2.22.0';
import {updateBigCulling,extractAvailable} from './big-level.js?v=2.22.0';

export function createBigLevelRuntime(level,world,makeLabel){
  if(!level.big)return null;
  const overlay=document.createElement('aside');overlay.id='big-level-minimap';overlay.setAttribute('aria-label','Level minimap');
  document.querySelector('#pause-map').append(overlay);
  const caption=document.createElement('div');caption.style.cssText='font-size:11px;line-height:15px;white-space:nowrap;text-align:center;background:var(--ad-night);color:var(--ad-bone);padding:2px 4px';caption.append('V Vault / G Gen / B BIT',document.createElement('br'),'O Open / T Time / K Key');
  const map=document.createElement('div');map.style.cssText='height:160px';overlay.append(map,caption);
  const extractLabels=level.extracts.slice(1).map(e=>({extract:e,label:makeLabel('',new THREE.Vector3(e.x,1.8,e.z),'exit-label','exit','EXTRACT')}));
  const poiLabels=level.graph.pois.map(p=>({poi:p,label:makeLabel(p.description,new THREE.Vector3(p.x,1.8,p.z),'room-label','room',p.type.toUpperCase())}));
  const applyVisibility=createRoomVisibility(level,world);
  const dump=()=>JSON.parse(JSON.stringify({...level.graph,POIs:level.graph.pois}));
  window.__NR={...window.__NR,dumpLevelGraph:dump};
  let lastMap='',symbols='';
  const iconsReady=fetch(new URL('./ui-icons.svg',import.meta.url)).then(r=>r.text()).then(sprite=>{symbols=mapIconSymbols(sprite);}).catch(()=>{});
  return {
    step(position,now,combat){return updateBigCulling(level,position,now,combat);},
    render(round,position,labels){
      const awake=level.awakeRooms??new Set([0]);applyVisibility(awake);
      for(const label of labels)if(!awake.has(graphRoomAt(level.graph,label.point,level.activeRoom)))label.el.hidden=true;
      for(const {extract:e,label} of extractLabels){const open=extractAvailable(e,round);label.caption.textContent=e.type==='timed'?(open?'EXTRACT OPEN UNTIL 4:00':'EXTRACT: OPEN 1:00 TO 4:00 ELAPSED'):(open?'KEY EXTRACT: OPEN':'KEY EXTRACT: FIND KEY IN VAULT');label.el.classList.toggle('done',open);}
      for(const {poi,label} of poiLabels)label.caption.textContent=poi.description;
      const svg=levelMapSVG(level.graph,{position,active:[...awake],symbols});if(svg!==lastMap){map.innerHTML=svg;const el=map.firstElementChild;el.style.width='100%';el.style.height='100%';lastMap=svg;}
    },
    async exportPNG(){
      await iconsReady;
      const styles=getComputedStyle(document.documentElement),palette=['ink','night','bit','cyan','loot','bone','danger'].map(k=>`--ad-${k}:${styles.getPropertyValue(`--ad-${k}`).trim()}`).join(';');
      const svg=levelMapSVG(level.graph,{symbols,palette});
      const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);
      const link=document.createElement('a');link.download=`level-${String(level.seed).replace(/[^a-z0-9-]/gi,'_')}.png`;link.href=canvas.toDataURL('image/png');link.click();
    },
    dispose(){overlay.remove();}
  };
}
