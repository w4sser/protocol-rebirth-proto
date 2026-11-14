/* Cinematic World Events: quiet, authored stories outside raid combat. */
(function(root){
  "use strict";
  const DAY_MS=24*60*60*1000;
  const EVENTS=Object.freeze({
    "CIN-001":{
      id:"CIN-001",kind:"story",title:"The Awakening",summary:"BIT remembers you.",
      shots:[
        {image:"assets/production/coldopen/bunker-discovery-arch-v1.webp",bit:true,duration:5200,caption:"You're... back?"},
        {image:"assets/production/coldopen/bunker-discovery-arch-v1.webp",bit:true,duration:6500,caption:"You're late... but you're back."},
        {image:"assets/production/coldopen/bunker-discovery-arch-v1.webp",bit:true,duration:5800,caption:"Somewhere past the dark, the Rebirth Core is still waiting."}
      ]
    },
    "CIN-002":{
      id:"CIN-002",kind:"story",title:"The World Beyond",summary:"The sea opens up.",
      shots:[
        {image:"assets/production/env_tunnel.webp",duration:5100,caption:"For so long, there was only concrete and darkness."},
        {image:"assets/production/splash_archipelago_radar_lighthouse.webp",duration:7800,caption:"Beyond the pines, the islands seem to go on forever."},
        {image:"assets/production/splash_archipelago_radar_lighthouse.webp",duration:7800,caption:"BIT: That lighthouse... I remember when it went dark. Why is it still shining?"}
      ]
    },
    "CIN-003":{
      id:"CIN-003",kind:"world",title:"The Listening Station",summary:"Something moves on a distant island.",
      shots:[
        {image:"assets/production/splash_archipelago_radar_lighthouse.webp",duration:5600,caption:"Far beyond the reachable islands, the sea is quiet."},
        {image:"assets/production/splash_archipelago_radar_lighthouse.webp",duration:6500,caption:"An old radar station begins to turn. There is no one there."},
        {image:"assets/production/core_dim.webp",duration:6400,caption:"Deep inside, a receiver comes online. A voice breaks through the static."}
      ]
    }
  });
  let active=null;
  function ensure(state){
    if(!state||typeof state!=="object")return null;
    const ledger=state.cinematicEvents&&typeof state.cinematicEvents==="object"?state.cinematicEvents:(state.cinematicEvents={});
    if(!ledger.seen||typeof ledger.seen!=="object")ledger.seen={};
    if(!ledger.world||typeof ledger.world!=="object")ledger.world={};
    // Historic saves already played the bunker cold open; do not make the opening run twice.
    if(state.introSeen&&!ledger.seen["CIN-001"])ledger.seen["CIN-001"]=1;
    return ledger;
  }
  function seen(state,id){const ledger=ensure(state);return !!(ledger&&ledger.seen[id]);}
  function markSeen(state,id,now){
    if(!EVENTS[id])return false;
    const ledger=ensure(state);
    if(!ledger||ledger.seen[id])return false;
    ledger.seen[id]=Number.isFinite(now)?Math.max(1,now):Date.now();
    if(id==="CIN-003")ledger.world.listeningStationAwake=true;
    return true;
  }
  function worldReady(state,now){
    const ledger=ensure(state);
    if(!ledger||!state.introSeen||!seen(state,"CIN-002")||seen(state,"CIN-003"))return false;
    const timestamp=ledger.seen["CIN-002"];
    return Number.isFinite(timestamp)&&timestamp>1&&Math.max(0,(Number.isFinite(now)?now:Date.now())-timestamp)>=5*DAY_MS;
  }
  function listSeen(state){ensure(state);return Object.keys(EVENTS).filter(id=>seen(state,id)).map(id=>EVENTS[id]);}
  function isPlaying(){return !!active;}
  function safeText(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function play(id,options){
    const evt=EVENTS[id],o=options||{},doc=root.document;
    if(!evt||!doc||active||!doc.getElementById("phone"))return false;
    const host=doc.getElementById("phone"),screen=doc.createElement("section");
    screen.id="pr-cinematic";screen.className="pr-cinematic";
    screen.tabIndex=-1;screen.setAttribute("aria-label",evt.title);
    screen.innerHTML='<div class="cine-frame">'+evt.shots.map((shot,i)=>
      '<div class="cine-shot cine-shot-'+i+'" data-shot="'+i+'" style="background-image:url(&quot;'+safeText(shot.image)+'&quot;)">'+
      (shot.bit?'<img class="cine-bit" alt="" src="assets/production/coldopen/bit-coldopen-v1.webp">':'')+'</div>').join("")+
      '<div class="cine-shade" aria-hidden="true"></div>'+
      '<div class="cine-topline">PROTOCOL REBIRTH <span>WORLD STORY</span></div>'+
      '<div class="cine-subtitles" role="status" aria-live="polite"><p></p></div>'+
      '<button type="button" class="cine-skip" aria-label="Skip cinematic">SKIP</button></div>';
    const caption=screen.querySelector(".cine-subtitles p");
    const shots=[...screen.querySelectorAll(".cine-shot")];
    const prevFocus=doc.activeElement;
    let completed=false;const timers=[];
    const finish=()=>{
      if(completed)return;
      completed=true;timers.forEach(root.clearTimeout.bind(root));doc.removeEventListener("keydown",onKey);
      screen.remove();active=null;
      if(!o.replay&&typeof o.onSeen==="function")o.onSeen(id);
      if(typeof o.onDone==="function")o.onDone();
      if(o.replay&&prevFocus&&typeof prevFocus.focus==="function"&&prevFocus.isConnected)prevFocus.focus();
    };
    const onKey=e=>{if(e.key==="Escape"){e.preventDefault();finish();}};
    function show(i){
      if(completed)return;
      shots.forEach((el,n)=>el.classList.toggle("is-active",n===i));
      screen.dataset.shot=String(i);
      caption.textContent=evt.shots[i].caption;
    }
    active={id,finish};
    host.appendChild(screen);doc.addEventListener("keydown",onKey);
    screen.querySelector(".cine-skip").addEventListener("click",finish);
    show(0);screen.querySelector(".cine-skip").focus();
    let elapsed=0;
    evt.shots.forEach((shot,i)=>{
      if(i)timers.push(root.setTimeout(()=>show(i),elapsed));
      elapsed+=shot.duration;
    });
    timers.push(root.setTimeout(finish,elapsed));
    return true;
  }
  const api=Object.freeze({EVENTS,DAY_MS,ensure,seen,markSeen,worldReady,listSeen,isPlaying,play});
  root.PR_CINEMATICS=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
