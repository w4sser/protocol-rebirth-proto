import '../data/audio.js?v=2.9.1';
import '../ui/audio.js?v=2.9.1';
export const audio=globalThis.PR_AUDIO;
// ESM side-effect imports have no currentScript. Resolve assets relative to this module.
audio.baseUrl=new URL('../assets/audio/',import.meta.url).href;
const config=globalThis.DATA.audio;
let rarePicked=false,kills=0,lastCountdown=null;
export function audioEvent(name,detail={}){
  const weapon=config.weaponClasses[detail.weapon]||'carbine',type=config.enemyTypes[detail.type]||'grunt';
  switch(name){
    case 'start':rarePicked=false;kills=0;lastCountdown=null;audio.stop();audio.music();break;
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
    default:void audio.play(name);
  }
}
if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&!button.disabled)void audio.play(button.matches('.pop-x,[id^=close-]')?'ui-back':button.matches('.result-primary,#tutorial-start')?'ui-confirm':'ui-tap');});
  // Restore music only for a cached page whose raid was still active.
  let cachedMusic=false;
  window.addEventListener('pagehide',e=>{cachedMusic=e.persisted&&audio.desiredMusic;audio.stop();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&cachedMusic)audio.music();cachedMusic=false;});
}
