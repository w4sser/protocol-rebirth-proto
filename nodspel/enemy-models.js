import {ENEMIES,ENEMY_TUNING} from './enemies.js?v=2.18.1';

// Dependency injection keeps failure/timeout/cloning tests independent of WebGL and fetch.
export function createEnemyModelLoader({load,timeoutMs=ENEMY_TUNING.models.timeoutMs}={}){
  const cache=new Map();
  const fetchModel=load??(async url=>{const {GLTFLoader}=await import('./vendor/GLTFLoader.js');return (await new GLTFLoader().loadAsync(url)).scene;});
  return async function loadEnemyModel(id,{fallback=()=>null}={}){
    const spec=Object.hasOwn(ENEMIES,id)?ENEMIES[id]:null;
    try{
      if(!spec)throw new Error('Unknown enemy');
      if(!cache.has(id))cache.set(id,new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Enemy model timeout')),timeoutMs);
        Promise.resolve().then(()=>fetchModel(spec.model)).then(model=>{
          if(!model?.clone||spec.parts.some(name=>!model.getObjectByName(name)))throw new Error('Enemy model missing named parts');
          resolve(model);
        }).catch(reject).finally(()=>clearTimeout(timer));
      }));
      const template=await cache.get(id),root=template.clone(true),parts=Object.fromEntries(spec.parts.map(name=>[name,root.getObjectByName(name)]));
      return {root,parts,fallback:false};
    }catch{
      // Keep failures cached too: a missing model must not cause a request storm.
      return {root:await fallback(),parts:{},fallback:true};
    }
  };
}
export const loadEnemyModel=createEnemyModelLoader();
