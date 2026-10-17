// v1.64 first-pickup BIT lines for items whose purpose is not obvious (Oscar playtest). Text is derived from
// DATA.itemInfo (real recipes + sell value), so it can never promise a use that does not exist.
export const HINT_ITEMS=['rebirth_shard'];
const SEEN_KEY='nodspel.hintSeen';
export function hintText(id,info=globalThis.DATA?.itemInfo?.(id)){
  if(!info)return null;
  const recipe=info.uses.find(u=>u.kind==='recipe'),up=info.uses.find(u=>u.kind==='upgrade');
  const rare=['rare','epic','legendary'].includes(info.item.rarity)?' Rare.':'';
  const use=up?` Used for ${up.label}`:recipe?` The Fabricator can turn it into ${recipeOutput(recipe.recipe)}`:'';
  return `BIT: ${info.item.name}.${rare}${use}${use?', or':' You can'} sell it for ${info.sell} Scrap.`;
}
function recipeOutput(rid){const r=(globalThis.DATA?.recipes||[]).find(x=>x.id===rid);if(!r)return 'something useful';
  return r.output.currency?(r.output.currency==='dataCores'?'Data Cores':r.output.currency):(globalThis.DATA.items.find(i=>i.id===r.output.itemId)?.name??'something useful');}
// Returns the first hint item that is in the bag and has never been hinted (and marks it seen), else null.
export function nextPickupHint(bag,storage=globalThis.localStorage){
  let seen=[];try{seen=JSON.parse(storage?.getItem(SEEN_KEY)||'[]');}catch{}
  const id=HINT_ITEMS.find(i=>(bag?.[i]||0)>0&&!seen.includes(i));
  if(!id)return null;
  try{storage?.setItem(SEEN_KEY,JSON.stringify([...seen,id]));}catch{}
  return id;
}
