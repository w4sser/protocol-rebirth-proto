// A native wrapper can supply {pulse(ms), stop()} later without changing callers.
export const VIBRATION_KEY='nodeRaid.vibration';
export function vibrationBackend(nav=globalThis.navigator){
  const ios=/iPad|iPhone|iPod/.test(nav?.userAgent??'')||(/Mac/.test(nav?.platform??'')&&nav?.maxTouchPoints>1);
  const supported=!ios&&typeof nav?.vibrate==='function';
  return {pulse(ms){return supported?nav.vibrate(ms):false;},stop(){if(supported)nav.vibrate(0);}};
}
export function createHaptics({nav=globalThis.navigator,storage=globalThis.localStorage,backend=vibrationBackend(nav)}={}){
  let enabled=true;
  try{enabled=storage?.getItem(VIBRATION_KEY)!=='off';}catch{}
  // Both browser and native backends may reject (permissions, background tab).
  function call(method,arg){try{const result=backend?.[method]?.(arg);result?.catch?.(()=>{});return result??false;}catch{return false;}}
  return {
    get enabled(){return enabled;},
    pulse(ms){return enabled&&ms>0?call('pulse',ms):false;},
    hit(){return this.pulse(18);},
    explosion(){return this.pulse(65);},
    stop(){call('stop');},
    setEnabled(value){enabled=!!value;try{storage?.setItem(VIBRATION_KEY,enabled?'on':'off');}catch{}if(!enabled)call('stop');},
    setBackend(next){call('stop');backend=next??vibrationBackend(nav);},
  };
}
export function createVibrationUI({document,container,haptics}){
  const group=document.createElement('fieldset');group.className='quality-settings';
  const legend=document.createElement('legend');legend.textContent='Vibration';group.append(legend);
  const row=document.createElement('div');row.className='quality-row';
  const button=document.createElement('button');button.type='button';
  function render(){button.textContent=haptics.enabled?'On':'Off';button.setAttribute('aria-label',`Vibration ${haptics.enabled?'on':'off'}`);button.setAttribute('aria-pressed',String(haptics.enabled));}
  button.onclick=()=>{haptics.setEnabled(!haptics.enabled);render();};
  render();row.append(button);group.append(row);container.append(group);
  return button;
}
