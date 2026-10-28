import '../data/audio.js?v=2.6.1';
import '../ui/audio.js?v=2.6.1';
export const audio=globalThis.PR_AUDIO;
// ESM side-effect imports have no currentScript. Resolve assets relative to this module.
audio.baseUrl=new URL('../assets/audio/',import.meta.url).href;
const config=globalThis.DATA.audio;
let rarePicked=false,kills=0,lastStep=-Infinity,lastCountdown=null;
export function footstepSurface(level,position,area){
  const inside=f=>position&&f&&Math.abs(position.x-f.x)<=f.w/2&&Math.abs(position.z-f.z)<=f.d/2;
  const floor=level?.floors?.find(inside),tags=config.surfaceTags[area];
  if(floor?.surface)return floor.surface;
  if(tags?.house&&inside(level?.house?.floor))return tags.house;
  if(tags?.pier&&floor?.dir)return tags.pier;
  return config.areaSurfaces[area]||'concrete';
}
export function audioEvent(name,detail={}){
  const weapon=config.weaponClasses[detail.weapon]||'carbine',type=config.enemyTypes[detail.type]||'grunt';
  switch(name){
    case 'area':audio.area(detail.area||'bunker');break;
    case 'start':rarePicked=false;kills=0;lastStep=-Infinity;lastCountdown=null;audio.stop();audio.area(detail.area||'bunker');break;
    case 'stop':audio.stop();break;
    case 'shoot':case 'reload':case 'empty':void audio.play(name+'-'+weapon);break;
    case 'impact':void audio.play('impact-'+(detail.enemy?'enemy':'wall'));break;
    case 'hit':void audio.play('hit-'+type);break;
    case 'kill':void audio.play('death-'+type);void audio.play('kill');if(++kills%config.killStreak===0)void audio.voice('nice-shot');break;
    case 'pickup':{const tier=detail.rarity||'common';void audio.play('pickup-'+tier);if(!rarePicked&&config.rareTiers.includes(tier)){rarePicked=true;void audio.voice('scrap-detected');}break;}
    case 'bag-full':void audio.play(name);void audio.voice('bag-heavy');break;
    case 'heal-low':void audio.voice('heal-budget-low');break;
    case 'hunter-wave':void audio.play(name);void audio.voice('hunters-inbound');break;
    case 'extract-revealed':void audio.voice('extraction-marked');break;
    case 'countdown':{const second=Math.ceil(detail.remainingMs/1000);if(second>0&&second<=config.extractCountdownSeconds&&second!==lastCountdown){lastCountdown=second;void audio.play('extract-countdown');}break;}
    case 'result':audio.stop();void audio.play(detail.success?'extract-success':'death');if(!detail.success)void audio.voice('signal-lost');break;
    case 'step':if(detail.moving&&detail.now-lastStep>=config.footstepMs){lastStep=detail.now;void audio.play('step-'+(detail.surface||footstepSurface(detail.level,detail.position,detail.area)));}break;
    default:void audio.play(name);
  }
}
if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&!button.disabled)void audio.play(button.matches('.pop-x,[id^=close-]')?'ui-back':button.matches('.result-primary,#tutorial-start')?'ui-confirm':'ui-tap');});
  // stop() clears desiredArea; retain it only across a cached-page round trip.
  let cachedArea=null;
  window.addEventListener('pagehide',e=>{cachedArea=e.persisted?audio.desiredArea:null;audio.stop();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&cachedArea)audio.area(cachedArea);cachedArea=null;});
}
