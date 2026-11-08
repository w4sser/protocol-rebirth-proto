// Pure launch policy for default visual-only Archipelago dressing.
// Military Remnants is approved as the default Coastal Life composition; comparisons stay opt-in.
// This never modifies level geometry or requests remote assets by itself.
export function archipelagoDressingConfig({area,search='',quality='high'}={}){
  const params=new URLSearchParams(search);
  const enabled=area==='archipelago'&&params.get('polyfork')!=='0';
  const requestedMode=params.get('polyforkMode');
  const mode=['scatter','profiles','coastal','military'].includes(requestedMode)?requestedMode:'military';
  // MEDIUM is a high-renderer setting today; keep its dressing budget mobile-safe.
  const visualQuality=quality==='high'?'high':'low';
  // Keep density at the reference value for both tiers: the LOW planner picks
  // a deterministic subset of HIGH and enforces its own 40-instance ceiling.
  return {enabled,mode,quality:visualQuality,density:enabled?1:0};
}
