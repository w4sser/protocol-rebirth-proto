// Pure launch policy for the default visual-only Archipelago dressing.
// This never modifies level geometry or requests remote assets by itself.
export function archipelagoDressingConfig({area,search='',quality='high'}={}){
  const params=new URLSearchParams(search);
  const enabled=area==='archipelago'&&params.get('polyfork')!=='0';
  const requestedMode=params.get('polyforkMode');
  const mode=['scatter','profiles','coastal'].includes(requestedMode)?requestedMode:'coastal';
  // MEDIUM is a high-renderer setting today; keep its dressing budget mobile-safe.
  const visualQuality=quality==='high'?'high':'low';
  return {enabled,mode,quality:visualQuality,density:enabled?(visualQuality==='high'?1:.85):0};
}
