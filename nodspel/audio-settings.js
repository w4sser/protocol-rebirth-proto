// Settings own the pause only after a successful open; another popup keeps its pause.
export function createAudioSettings({document,audio,canOpen,onPause,onResume}){
  const layer=document.querySelector('#raid-settings'),button=document.querySelector('#raid-settings-open'),closeButton=document.querySelector('#raid-settings-close');
  audio.settingsUI(layer.querySelector('.audio-menu-body'));
  function open(){
    if(!layer.hidden||!canOpen())return false;
    onPause();layer.hidden=false;document.body.classList.add('raid-paused');button.setAttribute('aria-expanded','true');closeButton.focus();return true;
  }
  function close(){
    if(layer.hidden)return false;
    layer.hidden=true;document.body.classList.remove('raid-paused');button.setAttribute('aria-expanded','false');onResume();button.focus();return true;
  }
  button.addEventListener('click',open);closeButton.addEventListener('click',close);
  layer.addEventListener('click',e=>{if(e.target===layer)close();});
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();if(layer.hidden)open();else close();}
    if(e.code==='Tab'&&!layer.hidden){
      const controls=[...layer.querySelectorAll('button,input')].filter(el=>!el.hidden&&!el.disabled),first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  return {open,close,contains:target=>layer.contains(target)};
}
