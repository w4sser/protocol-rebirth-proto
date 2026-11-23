import {bitAccompaniesRaid} from './bit-presence.js?v=2.28.74';
import {prepareCombatAudio,waitForCombatAudio} from './audio-ready.js?v=2.28.74';
import '../data/audio.js?v=2.28.74';
import '../ui/audio.js?v=2.28.74';
export const audio=globalThis.PR_AUDIO;
// ESM side-effect imports have no currentScript. Resolve assets relative to this module.
audio.baseUrl=new URL('../assets/audio/',import.meta.url).href;
// Decode every SFX/VO/loop as soon as the raid page loads, before the first gesture -- same
// fix as the base splash (PRB-154): a suspended AudioContext still decodes fine, so the first
// shots/VO after 'start' (ui/audio.js installUnlock already resumes synchronously on that tap)
// never race a live fetch+decode.
export const combatAudioReady=prepareCombatAudio(audio);
export const waitForRaidAudio=()=>waitForCombatAudio(combatAudioReady,{capMs:audio.config.raidReadyWaitMs});
void audio.preload();
const config=globalThis.DATA.audio;
const bitVoiceAllowed=bitAccompaniesRaid({ftue:new URLSearchParams(globalThis.location?.search||'').get('ftue')==='1'});
function bitVoice(name){if(bitVoiceAllowed)void audio.voice(name);}
audio.sfxWaitMs=config.raidSfxWaitMs;
let rarePicked=false,kills=0,lastCountdown=null;
export function audioEvent(name,detail={}){
  const weapon=config.weaponClasses[detail.weapon]||'carbine',type=config.enemyTypes[detail.type]||'grunt';
  switch(name){
    case 'start':void audio.unlock();rarePicked=false;kills=0;lastCountdown=null;audio.stop();audio.music();break;
    case 'stop':audio.stop();break;
    case 'shoot':void audio.play(name+'-'+weapon,{enemy:!!detail.enemy});break;
    case 'reload':case 'empty':void audio.play(name+'-'+weapon);break;
    case 'impact':void audio.play('impact-'+(detail.enemy?'enemy':'wall'));break;
    case 'hit':void audio.play('hit-'+type);break;
    case 'kill':void audio.play('death-'+type);void audio.play('kill');if(++kills%config.killStreak===0)bitVoice('nice-shot');break;
    case 'pickup':{const tier=detail.rarity||'common';void audio.play('pickup-'+tier);if(!rarePicked&&config.rareTiers.includes(tier)){rarePicked=true;bitVoice('scrap-detected');}break;}
    case 'bag-full':void audio.play(name);bitVoice('bag-heavy');break;
    case 'heal-low':bitVoice('heal-budget-low');break;
    case 'hunter-wave':void audio.play(name);bitVoice('hunters-inbound');break;
    case 'extract-revealed':bitVoice('extraction-marked');break;
    case 'countdown':{const second=Math.ceil(detail.remainingMs/1000);if(second>0&&second<=config.extractCountdownSeconds&&second!==lastCountdown){lastCountdown=second;void audio.play('extract-countdown');}break;}
    case 'result':audio.stop();void audio.play(detail.success?'extract-success':'death');if(!detail.success)bitVoice('signal-lost');break;
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
