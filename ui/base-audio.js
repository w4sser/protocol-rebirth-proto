(function(){
  const audio=window.PR_AUDIO;if(!audio)return;
  const menu=document.querySelector('#settings-menu');
  if(menu){const body=document.createElement('div');body.className='audio-menu-body';audio.settingsUI(body);for(const child of [...menu.children])if(!child.matches('.pop-x,.menu-head'))body.append(child);menu.append(body);}
  audio.area('base');
  document.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||button.disabled)return;void audio.play(button.matches('.pop-x,[data-close]')?'ui-back':button.matches('.primary,.playbtn')?'ui-confirm':'ui-tap');});
  window.addEventListener('pagehide',()=>{clearTimeout(welcomeTimer);audio.stop();});
  window.addEventListener('pageshow',()=>audio.area('base'));
  // A raid result ingestion explicitly requests this line, deferred until Safari unlock.
  let welcome=false,outcome=null,welcomeTimer=null;
  window.PR_AUDIO_BASE_RETURN=result=>{welcome=true;outcome=result;};
  const greet=()=>{if(!welcome)return;void audio.unlock().then(async ok=>{
    if(!ok||!welcome)return;welcome=false;
    const success=outcome==='extract';void audio.play(success?'extract-success':'death');
    if(success){void audio.voice('welcome-back');return;}
    // Integrated raids navigate immediately. Carry their failure cue onto the
    // result screen so navigation cannot cut off BIT's death line.
    await audio.voice('signal-lost');
    if(audio.desiredArea!=='base')return;
    welcomeTimer=setTimeout(()=>{if(audio.desiredArea==='base')void audio.voice('welcome-back');},audio.config.globalVoiceCooldownMs);
  });};
  document.addEventListener('pointerdown',greet,{passive:true});document.addEventListener('touchend',greet,{passive:true});
})();
