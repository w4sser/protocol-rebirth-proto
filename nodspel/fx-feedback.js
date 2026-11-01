import {extractAvailable} from './big-level.js?v=2.22.0';

// Gameplay reports events at their actual point of resolution. This adapter
// observes persistent visuals without changing simulation or save data.
export function createPixelFeedback(pixel,haptics,{reducedFx=()=>true,demo=false}={}){
  let level=null,extracts=[],shields=[],demoAt=-Infinity,lastHealth=null,demoClock=0;
  const demoNames=['respawn','impact','hit','explosion','emp','shield','chest','collect','heal'];
  function hold(record,name,visible){
    if(!pixel.enabled){record.slot=null;return;}
    const live=record.slot?.active&&record.slot.serial===record.serial;
    if(!visible){if(live)pixel.stop(record.slot);record.slot=null;return;}
    if(!live){record.slot=pixel.spawn(name,record.item.x,record.item.z,{loop:true});record.serial=record.slot?.serial;}
    else record.slot.sprite.position.set(record.item.x,0,record.item.z);
  }
  const feedback={
    impact(x,z,damage=false){pixel.spawn('impact',x,z,{y:.65});if(damage)pixel.spawn('hit',x,z,{y:.65});},
    explosion(x,z,radius=2){pixel.spawn('explosion',x,z,{scale:Math.max(.65,Math.min(1.5,radius/2))});if(reducedFx())haptics.explosion();},
    emp(x,z){pixel.spawn('emp',x,z);},
    playerHit(x,z){pixel.spawn('hit',x,z,{y:.65});if(reducedFx())haptics.hit();},
    reset(next){pixel.clear();level=next;extracts=(next.extracts??[next.exit]).map(item=>({item,slot:null,serial:0}));shields=next.enemies.filter(e=>e.encounter==='shield_turret').map(item=>({item,slot:null,serial:0}));lastHealth=null;demoAt=-Infinity;},
    sync(round,world,position,clock,dt){
      if(round.level!==level)feedback.reset(round.level);
      const playing=!round.over;
      let nodesOpen=true;
      for(const node of level.nodes)if(!node.active){nodesOpen=false;break;}
      for(const record of extracts)hold(record,'respawn',playing&&(level.big?extractAvailable(record.item,round):nodesOpen));
      for(const record of shields){const e=record.item;hold(record,'shield',playing&&!e.sleeping&&e.active!==false&&e.health>0&&clock>=(e.shieldDownUntil??0));}
      for(const v of world.lootBoxes){
        if(v.loot.revealed&&!v.pixelRevealed)pixel.spawn('chest',v.loot.x,v.loot.z);
        if(v.loot.collected&&!v.pixelCollected)pixel.spawn('collect',v.loot.x,v.loot.z,{y:.6});
        v.pixelRevealed=!!v.loot.revealed;v.pixelCollected=!!v.loot.collected;
      }
      if(lastHealth!=null&&round.health>lastHealth)pixel.spawn('heal',position.x,position.z,{y:.7});
      lastHealth=round.health;
      demoClock+=dt*1000;
      if(demo&&demoClock>=demoAt&&pixel.enabled){
        demoAt=demoClock+5200;
        for(let i=0;i<demoNames.length;i++)pixel.spawn(demoNames[i],position.x+(i%3-1)*3,position.z+(Math.floor(i/3)-1)*3,{loop:false});
      }
      pixel.update(dt);
    },
  };
  return feedback;
}
