// Local same-origin Polyfork assets. Free low-poly GLBs: CC BY 4.0.
// Each file is vendored at nodspel/assets/polyfork (see ATTRIBUTION.md).
const SAFE_ID=/^[a-z][a-z0-9-]*-[a-f0-9]{6}$/;
export function polyforkLocalUrl(id,base=import.meta.url){
  if(typeof id!=='string'||!SAFE_ID.test(id))throw new TypeError('Invalid Polyfork model id');
  return new URL('./assets/polyfork/'+id+'.glb',base).href;
}
