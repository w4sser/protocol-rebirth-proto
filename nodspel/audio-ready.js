// Combat buffers are required for play; voices and music warm independently.
// Failed fetch/decode attempts retry even after the start cap. Pending loads stay cached.
export function prepareCombatAudio(audio,{retryMs=250,schedule=setTimeout}={}){
  if(!audio.init())return Promise.resolve(false);
  const files=[...new Set(Object.entries(audio.config.sfx).filter(([name])=>!name.startsWith('ui-')).map(([,cue])=>cue.file))];
  const load=async file=>{
    while(!audio.decodedFiles.has(file)){
      try{await audio.load(file);}catch(_){await new Promise(resolve=>schedule(resolve,retryMs));}
    }
  };
  // play() prefers an already-decoded Lumina sample (loaded via `files` above) and falls back to
  // synthesis when the file isn't decoded yet -- build every synth variant now too, so the
  // fallback itself cannot hitch on the first shot either.
  for(const weapon of Object.keys(audio.config.shots.weapons))for(const enemy of [false,true])audio.shotBuffer(weapon,enemy);
  return Promise.all(files.map(load)).then(()=>true);
}
export function waitForCombatAudio(ready,{capMs=5000,schedule=setTimeout,cancel=clearTimeout}={}){
  let timer;
  return Promise.race([ready,new Promise(resolve=>{timer=schedule(()=>resolve(false),capMs);})]).finally(()=>cancel(timer));
}
