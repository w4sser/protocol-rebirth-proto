// Read-only result presentation. The existing raid handoff still owns all rewards.
import '../data/bit.js?v=2.3.1';
import {goalProgress,MATERIALS} from './progression-goal.js?v=2.3.1';
import {extractScrapBonus} from './levels.js?v=2.3.1';
import {ROUND_DURATION_MS} from './round.js?v=2.3.1';
import {svgIcon,setIconText} from './svg-icons.js?v=2.3.1';

const item=id=>globalThis.DATA.items.find(i=>i.id===id);
const count=bag=>Object.entries(bag??{}).filter(([,n])=>n>0).map(([id,n])=>({id,n,name:MATERIALS[id]?.name??id,icon:MATERIALS[id]?.icon??'pickup'}));
const MAX_TILES=8;
const total=rows=>rows.reduce((n,r)=>n+r.n,0);
export const resultTime=ms=>{const s=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

export function resultView(round,{launch={},home=null,pending=false}={}){
  const checkpoint=pending&&!round.over,safe=round.over&&['extract','complete'].includes(round.reason);
  const kind=checkpoint?'checkpoint':safe?'extract':round.reason==='death'?'death':round.reason==='abandon'?'abandon':'timeout';
  const integrated=!!launch.returnUrl,bag={...(checkpoint?round.bag:safe?round.extracted:round.lost)},recovered=[];
  // Show existing meta recovery effects without granting them here. They are applied once at the base.
  const launchGear=(launch.gear??[]).filter(id=>item(id)&&!item(id).free);
  // v2.0: backpack weapons travel with the equipped gear through extract/lost/at-risk reporting (docs/design-playtest-oct25.md §c).
  const equipped=[...Object.values(round.equip??{}),...(round.backpack??[])].filter(id=>id&&item(id)&&!item(id).free);
  let gear=[...new Set(safe||checkpoint?equipped:[...launchGear,...equipped])];
  if(!checkpoint&&!safe&&integrated&&home){
    const rescueLevel=globalThis.DATA.bit.bondLevels.find(l=>l.level===3);
    const first=count(bag)[0];
    if(rescueLevel&&(home.bondXp??0)>=rescueLevel.xp&&first){bag[first.id]--;recovered.push({...first,n:1,by:'BIT recovery'});}
    if(home.secureItem&&launchGear.includes(home.secureItem)){
      const id=home.secureItem;gear=gear.filter(g=>g!==id);recovered.push({id,n:1,name:item(id).name,icon:item(id).icon,by:'Protected gear'});
    }
  }
  const rows=count(bag),bonus=checkpoint||safe?extractScrapBonus(round.levelsCleared):0;
  const goal=launch.goal,progress=goal?goalProgress(goal,checkpoint?round.bag:safe?round.extracted:{}):null;
  let goalText='',goalTitle='',goalReady=false;
  if(goal&&(checkpoint||safe)){
    goalTitle=`${goal.name} LVL ${goal.level}`;goalReady=progress.enoughCarried;
    if(progress.secured)goalText='SUPPLIES ALREADY AT HOME';
    else if(goalReady)goalText=checkpoint?'ENOUGH CARRIED · EXTRACT TO SECURE':'SUPPLIES READY · BUILD AT BASE';
    else goalText=progress.parts.map(p=>`${p.name??MATERIALS[p.id]?.name??p.id} ${Math.min(p.need,p.secured+p.carried)}/${p.need}`).join(' · ');
  }else if(!checkpoint&&!safe){goalTitle=integrated?'YOUR BASE IS SAFE':'BASIC CARBINE AVAILABLE';goalText=integrated?'Home supplies and earned XP are kept. Your Basic Carbine is always available.':'Start a fresh raid with your Basic Carbine.';}
  const headings={checkpoint:['RAID STILL ACTIVE','SECTOR CLEARED','You have not extracted. Your bag is still at risk.','route'],extract:['YOU MADE IT BACK','EXTRACTED','Your loot is secured.','check'],death:['RAID ENDED','YOU DIED','Carried loot and equipment were lost.','close'],timeout:['RAID ENDED','TIME RAN OUT','Time expired before you extracted.','timer'],abandon:['RAID ENDED','RAID ABANDONED','You left before securing your bag.','close']};
  const [eyebrow,title,baseDescription,icon]=headings[kind];
  const hit=round.lastDamageEvent;
  const deathCause=kind==='death'?(hit?`Last hit: ${hit.source} ${hit.attack} - you were ${hit.moving?'moving':'stationary'}.`:'No damage event recorded.') : '';
  const description=kind==='death'?(recovered.length?'Recovery is listed below. Your base is safe.':rows.length||gear.length?baseDescription:'No carried items were lost.'):baseDescription;
  const level=checkpoint?(round.exitLevel??round.level):round.level;
  return {kind,checkpoint,safe,integrated,eyebrow,title,deathCause,description:safe&&!integrated?'Your loot is secured for this run.':description,icon,rows,gear:count(Object.fromEntries(gear.map(id=>[id,1]))),recovered,bonus,goalTitle,goalText,goalReady,
    lootTitle:checkpoint?'CARRIED · NOT SECURED':safe?'SECURED LOOT':'LOST FROM BAG',empty:checkpoint?'Your bag is empty.':safe?'No loot carried out.':'No items lost from your bag.',
    retained:!checkpoint&&integrated?'XP and supplies kept':'',
    meta:`${String(level.area??'bunker').toUpperCase()} · ${round.levelsCleared} SECTOR${round.levelsCleared===1?'':'S'} CLEARED`,
    time:resultTime(round.remainingMs),elapsed:resultTime((round.durationMs??ROUND_DURATION_MS)-round.remainingMs),
    next:checkpoint?'Extract now, or continue with your bag at risk.':safe&&goalReady?'Next: return to base for your upgrade.':safe?(integrated?'Your supplies are ready at the base.':'Start a fresh raid to keep practicing.'):'Regroup for your next raid.',
    totals:{levels:round.levelsCleared,enemies:round.enemiesDefeated,nodes:round.nodesLit,items:total(rows)}};
}

export function renderResult(root,view){
  const doc=root.ownerDocument,$=s=>root.querySelector(s),text=(s,t)=>{$(s).textContent=t;};
  root.dataset.outcome=view.kind;root.classList.remove('show-details');text('#result-details h3',`${view.title} · RAID DETAILS`);
  text('#round-over-eyebrow',view.eyebrow);text('#round-over-title',view.title);text('#result-description',view.description);
  text('#result-death-cause',view.deathCause??'');$('#result-death-cause').hidden=!view.deathCause;
  $('#result-symbol').replaceChildren(svgIcon(view.icon));text('#result-meta',view.meta);
  text('#result-clock-label',view.checkpoint?'TIME LEFT':'TIME IN RAID');text('#result-clock',view.checkpoint?view.time:view.elapsed);
  text('#result-loot-title',`${view.lootTitle} · ${view.totals.items}`);
  const list=(el,rows,compact=false)=>{el.replaceChildren();for(const row of rows){const chip=doc.createElement('div');chip.className=compact?'result-item compact':'result-item';chip.classList.toggle('result-recovered',!!row.recovered);const label=doc.createElement('span');setIconText(label,row.icon,row.name);const n=doc.createElement('b');n.textContent=`${view.safe||row.recovered?'+':''}${row.n}`;chip.append(label,n);el.append(chip);}};
  // Icon tiles with counts (name on hover / for screen readers). Everything fits, or the last tile becomes a compact +N.
  const tiles=(el,rows,sign='')=>{el.replaceChildren();const shown=rows.length>MAX_TILES?rows.slice(0,MAX_TILES-1):rows;
    for(const row of shown){const tile=doc.createElement('div');tile.className='result-tile';tile.title=row.name;tile.setAttribute('role','img');tile.setAttribute('aria-label',`${row.name} ${sign}${row.n}`);const n=doc.createElement('b');n.textContent=`${sign}${row.n}`;tile.append(svgIcon(row.icon),n);el.append(tile);}
    if(shown.length<rows.length){const more=doc.createElement('div');more.className='result-tile result-tile-more';more.title='More item types in Raid details';more.setAttribute('aria-label',`${rows.length-shown.length} more item types`);const n=doc.createElement('b');n.textContent=`+${rows.length-shown.length}`;more.append(n);el.append(more);}};
  tiles($('#result-loot'),view.rows,view.safe?'+':'');
  if(!view.rows.length)text('#result-loot',view.empty);
  const gearEl=$('#result-gear');gearEl.replaceChildren();gearEl.hidden=!view.gear.length;
  if(view.gear.length){const cap=doc.createElement('span');cap.textContent=view.checkpoint?'AT RISK':view.safe?'RETURNED':'LOST';gearEl.append(cap);
    for(const g of view.gear){const chip=doc.createElement('span');chip.className='result-chip';chip.title=g.name;chip.setAttribute('role','img');chip.setAttribute('aria-label',`${g.name} ${cap.textContent.toLowerCase()}`);chip.append(svgIcon(g.icon));gearEl.append(chip);}}
  text('#result-recovery',view.recovered.length?`Recovery: ${total(view.recovered)} item${total(view.recovered)===1?'':'s'} returned at base · see Raid details`:'');$('#result-recovery').hidden=!view.recovered.length;
  text('#result-bonus',view.bonus?`${view.checkpoint?'On extraction':'Extraction bonus'}: +${view.bonus} Scrap`:'');$('#result-bonus').hidden=!view.bonus;
  text('#result-goal-title',view.goalTitle);text('#result-goal-text',view.goalText);$('#result-goal').hidden=!view.goalTitle;$('#result-goal').classList.toggle('ready',view.goalReady);
  text('#result-retained',view.retained);$('#result-retained').hidden=!view.retained||(!view.checkpoint&&!view.safe);
  text('#result-next',view.next);
  list($('#result-all-loot'),[...view.rows,...view.recovered.map(r=>({...r,name:`${r.name} · ${r.by}`,recovered:true}))],true);if(!view.rows.length&&!view.recovered.length)text('#result-all-loot',view.empty);
  text('#summary-levels',`${view.totals.levels} / 3`);text('#summary-enemies',view.totals.enemies);text('#summary-nodes',view.totals.nodes);text('#summary-time',view.time);text('#summary-bonus',view.bonus?`${view.checkpoint?'On extract · ':''}+${view.bonus} Scrap`:'0 Scrap');
  $('#result-report').hidden=false;$('#result-details').hidden=true;text('#result-details-toggle','Raid details');$('#result-details-toggle').setAttribute('aria-expanded','false');
}

export function toggleResultDetails(root){
  const report=root.querySelector('#result-report'),details=root.querySelector('#result-details'),button=root.querySelector('#result-details-toggle');
  const show=details.hidden;root.classList.toggle('show-details',show);report.hidden=show;details.hidden=!show;button.textContent=show?'Back to result':'Raid details';button.setAttribute('aria-expanded',String(show));
}
