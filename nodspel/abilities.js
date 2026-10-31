// Generic ability slot (HUD button next to the aim stick): one data-driven definition
// (id, icon, label, cooldownMs, activate) renders the icon + cooldown ring. DASH ships as the
// default; a later per-character/equipment system swaps in a different definition for the same slot.
import {svgIcon} from './svg-icons.js?v=2.12.1';

export function createDashAbility(requestDash){
  return {
    id:'dash',icon:'dash',label:'Dash',
    cooldownMs:round=>round.stats.dashCooldownMs,
    activate:round=>requestDash(round),
  };
}

// Paints the slot's icon once (on registration / swap) so the markup stays empty and data-driven.
export function mountAbility(button,ability){
  button.replaceChildren(svgIcon(ability.icon));
  button.setAttribute('aria-label',`${ability.label} ready`);
}

// Per-frame render: cooldown ring (--charge, 0..1) + disabled state + aria-label. No permanent text block.
export function renderAbilitySlot(button,ability,charge,remainingMs,unavailable){
  const ready=charge>=1&&!unavailable;
  button.disabled=!ready;
  button.style.setProperty('--charge',charge);
  button.setAttribute('aria-label',remainingMs>0?`${ability.label} cooldown ${(remainingMs/1000).toFixed(1)} seconds`:`${ability.label} ready`);
}
