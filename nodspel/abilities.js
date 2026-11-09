// One data-driven ability slot next to the aim stick: icon, label, status and charge bar.
import {svgIcon} from './svg-icons.js?v=2.28.9';

export function createDashAbility(requestDash,cooldownMs=round=>round.stats.dashCooldownMs){
  return {
    id:'dash',icon:'dash',label:'DASH',readyText:'READY',
    cooldownMs,
    activate:round=>requestDash(round),
  };
}

// M42: same ability-slot language as dash (icon, label, READY, charge bar) for BIT's distract+zap.
export function createBitDistractAbility(requestBitDistract,cooldownMs){
  return {
    id:'bit-distract',icon:'nav-bit',label:'BIT',readyText:'READY',
    cooldownMs,
    activate:round=>requestBitDistract(round),
  };
}

// Element ids are prefixed with the button's own id (falling back to 'dash') so #dash keeps its
// original #dash-time/#dash-meter/#dash-fill ids while other ability buttons (e.g. #bit-distract) get
// their own, letting each slot be styled/queried independently.
export function mountAbility(button,ability){
  const doc=button.ownerDocument,prefix=button.id||'dash';
  const icon=doc.createElement('span'),label=doc.createElement('strong'),time=doc.createElement('small'),meter=doc.createElement('span'),fill=doc.createElement('i');
  icon.setAttribute('aria-hidden','true');icon.append(svgIcon(ability.icon));
  label.textContent=ability.label;time.id=`${prefix}-time`;time.textContent=ability.readyText;
  meter.id=`${prefix}-meter`;meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',`${ability.label} charge`);
  meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow','100');
  fill.id=`${prefix}-fill`;meter.append(fill);
  button.replaceChildren(icon,label,time,meter);
  button.setAttribute('aria-label',`${ability.label} ${ability.readyText}`);
}

// Charge retains the gameplay readiness check; the displayed bar uses the definition's cooldown.
export function renderAbilitySlot(button,ability,charge,remainingMs,unavailable,round){
  const prefix=button.id||'dash';
  const duration=typeof ability.cooldownMs==='function'?ability.cooldownMs(round):ability.cooldownMs;
  const fill=remainingMs<=0?1:Math.max(0,Math.min(1,1-remainingMs/duration));
  button.disabled=charge<1||unavailable;
  button.querySelector(`#${prefix}-time`).textContent=remainingMs>0?`${(remainingMs/1000).toFixed(1)} s`:ability.readyText;
  button.querySelector(`#${prefix}-meter`).setAttribute('aria-valuenow',Math.round(fill*100));
  button.querySelector(`#${prefix}-fill`).style.width=`${fill*100}%`;
  button.setAttribute('aria-label',remainingMs>0?`${ability.label} cooldown ${(remainingMs/1000).toFixed(1)} seconds`:`${ability.label} ${ability.readyText}`);
}
