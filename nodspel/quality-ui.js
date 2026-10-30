// v2.9.0 mood pass: Graphics quality toggle in Paused/Settings, next to Audio. Persisted the same way
// audio volumes are (plain localStorage, global - not part of a save slot).
export function createQualityUI({document,container,quality,onChange}){
  if(!container)return;
  const group=document.createElement('fieldset');group.className='quality-settings';
  const legend=document.createElement('legend');legend.textContent='Graphics';group.append(legend);
  const row=document.createElement('div');row.className='quality-row';
  const buttons={};
  for(const q of ['low','high']){
    const b=document.createElement('button');b.type='button';b.textContent=q==='low'?'Low':'High';
    b.setAttribute('aria-pressed',String(q===quality));
    b.onclick=()=>{if(q===quality)return;quality=q;for(const k in buttons)buttons[k].setAttribute('aria-pressed',String(k===quality));onChange(q);};
    buttons[q]=b;row.append(b);
  }
  group.append(row);
  const note=document.createElement('small');note.className='quality-note';note.textContent='Bloom, dust and the vignette only run on High.';group.append(note);
  container.append(group);
  return {setQuality(q){quality=q;for(const k in buttons)buttons[k].setAttribute('aria-pressed',String(k===quality));}};
}
