// Pure launch policies for visual-only Archipelago ground and dressing.
// Military Remnants is approved as the default Coastal Life composition; comparisons stay opt-in.
// This never modifies level geometry or requests remote assets by itself.
export function useTexturedGround(area,search=''){
  const params=new URLSearchParams(search);
  return params.get('ground')!=='0'&&!(area==='archipelago'&&params.get('archVisual')==='v2');
}
export function archipelagoDressingConfig({area,search='',quality='high'}={}){
  const params=new URLSearchParams(search);
  // A little authentic coastal life prevents v2 from becoming a bare green plate.
  // Keep the full legacy density only for explicit comparison or default live mode.
  const nativeV2=area==='archipelago'&&params.get('archVisual')==='v2'&&params.get('polyfork')!=='1';
  const enabled=area==='archipelago'&&params.get('polyfork')!=='0';
  const requestedMode=params.get('polyforkMode');
  const mode=['scatter','profiles','coastal','military'].includes(requestedMode)?requestedMode:'military';
  // MEDIUM is a high-renderer setting today; keep its dressing budget mobile-safe.
  const visualQuality=quality==='high'?'high':'low';
  // Pass ZB: HIGH/LOW must plan from the identical v2 density and seed.
  // The LOW planner then chooses a strict, stable subset under its own
  // instance cap instead of making a different composition at density .24.
  // 0.30 remains a sparse layer (and keeps military props below its .5 gate).
  return {enabled,mode,quality:visualQuality,density:!enabled?0:nativeV2?.30:1};
}
