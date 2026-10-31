import {audioEvent} from './audio.js?v=2.18.0';
import {cards,cardEffect,offer,perkState,PERKS} from './perks.js?v=2.18.0';
const paths={
  chain:'M5 17l7-10 1 6h6l-7 10-1-6H5z M4 4h4 M18 4h2',
  reload:'M5 9a8 8 0 1 1-1 7 M5 4v5h5 M12 8v5l3 2',
  roll:'M4 12a8 8 0 1 0 5-7 M4 4v8h8 M12 8l4 4-4 4',
  shield:'M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3z M8 12h8 M12 8v8',
  medic:'M6 4h12v16H6z M9 11h6 M12 8v6 M9 17h6',
  recon:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  dressing:'M7 3l14 14-4 4L3 7l4-4z M9 9l6 6 M10 14h.01 M14 10h.01',
  ricochet:'M3 19l8-8 4 4 6-10 M16 5h5v5 M4 5h5 M6 3v5'
};
export function perkIcon(id){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[id]??'M6 6l12 12M18 6L6 18');svg.append(p);return svg;}
const LOCK_MS=600;
export function createPerkUI(viewport,action){
  const layer=document.createElement('div');layer.className='perk-overlay';layer.hidden=true;
  const panel=document.createElement('section');panel.className='perk-panel pop-card';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Choose a raid perk');panel.tabIndex=-1;
  const grid=document.createElement('div');grid.className='perk-grid';
  const countdown=document.createElement('div');countdown.className='perk-countdown';countdown.setAttribute('aria-hidden','true');
  const bar=document.createElement('div');bar.className='perk-countdown-bar';countdown.append(bar);
  const scroll=document.createElement('div');scroll.className='perk-scroll';scroll.append(grid);
  panel.append(scroll,countdown);layer.append(panel);viewport.append(layer);
  layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();action('dismiss');}if(e.key==='Tab'){const els=[...panel.querySelectorAll('button:not(:disabled)')],first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
  const background=new Map();
  let autoTimer=0,lockTimer=0,readyAt=Infinity,armedPointer=null,countdownGeneration=0;
  const blockedKeys=new Set();
  const locked=()=>layer.hidden||performance.now()<readyAt||panel.classList.contains('locked');
  layer.addEventListener('pointerdown',e=>{armedPointer=locked()?null:{button:e.target.closest('.perk-choice'),id:e.pointerId};},true);
  layer.addEventListener('pointercancel',()=>{armedPointer=null;},true);
  layer.addEventListener('keydown',e=>{
    if(!['Enter',' '].includes(e.key))return;
    if(locked()||blockedKeys.has(e.key)||e.repeat){blockedKeys.add(e.key);e.preventDefault();e.stopPropagation();}
  },true);
  layer.addEventListener('keyup',e=>{
    if(blockedKeys.delete(e.key)){e.preventDefault();e.stopPropagation();}
  },true);
  function setModal(open){
    viewport.classList.toggle('perk-modal-open',open);
    if(open){for(const el of viewport.children){if(el===layer||background.has(el))continue;background.set(el,el.inert);el.inert=true;}}
    else {for(const [el,inert] of background)el.inert=inert;background.clear();}
  }
  return {layer,open(round,key){
    audioEvent('perk-open');
    clearTimeout(autoTimer);clearTimeout(lockTimer);
    const generation=++countdownGeneration;
    const ids=offer(round,key);grid.replaceChildren();
    bar.style.animation='none';void bar.offsetWidth;
    for(const id of ids){const c=cards.find(c=>c.id===id),button=document.createElement('button');button.type='button';button.className='perk-choice';button.dataset.accent=c.accent;
      const category=document.createElement('span');category.className='perk-category';category.textContent=c.category;
      const name=document.createElement('strong');name.textContent=c.name;const effect=document.createElement('span');effect.className='perk-effect';const effectText=cardEffect(round,key,id);
      for(const part of effectText.split(/([+-]?\d+(?:\.\d+)?(?:%| HP\/s| HP| ms| s)?)/g)){const el=document.createElement(/^[+-]?\d/.test(part)?'b':'span');el.textContent=part;effect.append(el);}
      const pick=document.createElement('span');pick.className='perk-select';pick.textContent='SELECT PERK';
      const badge=document.createElement('span');badge.className='perk-badge';badge.append(perkIcon(id));
      button.append(category,badge,name,effect,pick);button.disabled=true;
      button.onclick=e=>{if(locked()||((e.detail>0||e.pointerType)&&(!armedPointer||armedPointer.button!==button||(e.pointerId!=null&&e.pointerId!==armedPointer.id))))return;armedPointer=null;action('choose',id,button);};
      grid.append(button);
    }
    // A selection needs a new press after the fade, even if an old gesture ends after unlock.
    readyAt=performance.now()+LOCK_MS;armedPointer=null;
    panel.classList.add('locked');setModal(true);layer.hidden=false;panel.focus({preventScroll:true});
    clearTimeout(lockTimer);
    lockTimer=setTimeout(()=>{panel.classList.remove('locked');for(const b of grid.children)b.disabled=false;grid.querySelector('button')?.focus({preventScroll:true});},LOCK_MS);
    // Finish the visible layout before starting the four-second deadline. The input lock
    // runs inside that budget; auto-pick must not depend on animation-frame delivery.
    panel.getBoundingClientRect();
    bar.style.animation=`perk-countdown ${PERKS.pickTimeoutMs}ms linear forwards`;
    autoTimer=setTimeout(()=>{if(generation===countdownGeneration&&!layer.hidden)action('timeout');},PERKS.pickTimeoutMs);
  },confirm(text,selected){countdownGeneration++;audioEvent('perk-select');clearTimeout(autoTimer);clearTimeout(lockTimer);panel.classList.remove('locked');for(const b of grid.children)b.disabled=true;selected?.classList.add('picked');},close(){countdownGeneration++;clearTimeout(autoTimer);clearTimeout(lockTimer);layer.hidden=true;readyAt=Infinity;armedPointer=null;setModal(false);},
  hud(round,container){let el=container.querySelector('.perk-hud');if(!el){el=document.createElement('div');el.className='perk-hud';el.setAttribute('aria-label','Active raid perks');container.append(el);}el.replaceChildren();for(const id of perkState(round).taken){const c=cards.find(c=>c.id===id),span=document.createElement('span');span.dataset.perk=id;span.title=`${c.name}: ${perkState(round).selectedEffects?.[id]??c.effect}`;span.setAttribute('role','img');span.setAttribute('aria-label',span.title);span.append(perkIcon(id));el.append(span);}}
  };
}
