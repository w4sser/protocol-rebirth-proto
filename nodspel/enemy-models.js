import {ENEMIES,ENEMY_TUNING} from './enemies.js?v=2.28.76';

// Dependency injection keeps failure/timeout/cloning tests independent of WebGL and fetch.
export function createEnemyModelLoader({load,timeoutMs=ENEMY_TUNING.models.timeoutMs}={}){
  const cache=new Map();
  const fetchModel=load??(async url=>{const {GLTFLoader}=await import('./vendor/GLTFLoader.js');return (await new GLTFLoader().loadAsync(url)).scene;});
  // Concurrent callers for the same id share one in-flight request (never a storm), but a
  // rejection (timeout, offline, malformed GLB) must not become a permanent session-long
  // fallback: once it settles badly, drop THIS attempt's cache entry so the next call starts a
  // fresh one. Only clear the entry if it is still ours -- a retry may already have replaced it.
  function startLoad(id,spec){
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Enemy model timeout')),timeoutMs);
      Promise.resolve().then(()=>fetchModel(spec.model)).then(model=>{
        if(!model?.clone||spec.parts.some(name=>!model.getObjectByName(name)))throw new Error('Enemy model missing named parts');
        resolve(model);
      }).catch(reject).finally(()=>clearTimeout(timer));
    });
    promise.catch(()=>{if(cache.get(id)===promise)cache.delete(id);});
    cache.set(id,promise);
    return promise;
  }
  async function loadEnemyModel(id,{fallback=()=>null}={}){
    const spec=Object.hasOwn(ENEMIES,id)?ENEMIES[id]:null;
    try{
      if(!spec)throw new Error('Unknown enemy');
      const template=await(cache.get(id)??startLoad(id,spec));
      const root=template.clone(true),parts=Object.fromEntries(spec.parts.map(name=>[name,root.getObjectByName(name)]));
      return {root,parts,fallback:false};
    }catch{
      // The procedural mesh stands in only until a (possibly retried) GLB is ready.
      return {root:await fallback(),parts:{},fallback:true};
    }
  }
  // Fire-and-forget: start fetching every archetype a level will need before anything on screen
  // asks for one, so the first raid's GLB downloads are not racing the environment textures
  // buildWorld() kicks off in the same frame (v2.28.76: Robert 24 Nov 2026, almost every enemy
  // except mortar fell back to the old procedural mesh on first raid).
  loadEnemyModel.preload=ids=>{for(const id of new Set(ids)){const spec=Object.hasOwn(ENEMIES,id)?ENEMIES[id]:null;if(spec&&!cache.has(id))startLoad(id,spec).catch(()=>{});}};
  return loadEnemyModel;
}
export const loadEnemyModel=createEnemyModelLoader();
