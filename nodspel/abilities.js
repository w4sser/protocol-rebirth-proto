// One data-driven ability slot next to the aim stick: icon, label, status and charge bar.
import {svgIcon} from './svg-icons.js?v=2.14.0';

export function createDashAbility(requestDash,cooldownMs=round=>round.stats.dashCooldownMs){
  return {
    id:'dash',icon:'dash',label:'DASH',readyText:'READY',
    cooldownMs,
    activate:round=>requestDash(round),
  };
}

export function mountAbility(button,ability){
  const doc=button.ownerDocument;
  const icon=doc.createElement('span'),label=doc.createElement('strong'),time=doc.createElement('small'),meter=doc.createElement('span'),fill=doc.createElement('i');
  icon.setAttribute('aria-hidden','true');icon.append(svgIcon(ability.icon));
  label.textContent=ability.label;time.id='dash-time';time.textContent=ability.readyText;
  meter.id='dash-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',`${ability.label} charge`);
  meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow','100');
  fill.id='dash-fill';meter.append(fill);
  button.replaceChildren(icon,label,time,meter);
  button.setAttribute('aria-label',`${ability.label} ${ability.readyText}`);
}

// Charge retains the gameplay readiness check; the displayed bar uses the definition's cooldown.
export function renderAbilitySlot(button,ability,charge,remainingMs,unavailable,round){
  const duration=typeof ability.cooldownMs==='function'?ability.cooldownMs(round):ability.cooldownMs;
  const fill=remainingMs<=0?1:Math.max(0,Math.min(1,1-remainingMs/duration));
  button.disabled=charge<1||unavailable;
  button.querySelector('#dash-time').textContent=remainingMs>0?`${(remainingMs/1000).toFixed(1)} s`:ability.readyText;
  button.querySelector('#dash-meter').setAttribute('aria-valuenow',Math.round(fill*100));
  button.querySelector('#dash-fill').style.width=`${fill*100}%`;
  button.setAttribute('aria-label',remainingMs>0?`${ability.label} cooldown ${(remainingMs/1000).toFixed(1)} seconds`:`${ability.label} ${ability.readyText}`);
}
