// FTUE bot: fresh profile -> PLAY -> FTUE raid (re-opened with &debug=1) -> fight, nodes, exit, until extract/complete.
export default async()=>{
 const t=()=>((Date.now()-globalThis.T0)/1000).toFixed(1);const TAG=process.env.TAG||'bot';
 await pg.goto(BASE+'/?x='+Date.now(),{waitUntil:'load'});globalThis.T0=Date.now();await s(2500);
 await pg.evaluate(()=>document.querySelector('#splash-play')?.click());const tPlay=Date.now();console.log('PLAY t='+t());
 for(let i=0;i<40&&!pg.url().includes('nodspel');i++)await s(250);
 const raidUrl=pg.url();console.log('raid url t='+t());
 await pg.goto(raidUrl+'&debug=1',{waitUntil:'load'});await pg.waitForFunction('window.__NR&&window.__NR.state',{timeout:60000});
 await s(500);await snap(TAG+'-start');
 const vp=pg.viewport();const held=new Set();
 const setKeys=async want=>{for(const k of [...held])if(!want.has(k)){await pg.keyboard.up(k);held.delete(k);}for(const k of want)if(!held.has(k)){await pg.keyboard.down(k);held.add(k);}};
 let lastKill=Date.now(),kills0=0,closeR=4,last=null,stuck=0,side=0,shotAt=0,lvl=0,events=[];
 for(let k=0;k<1400;k++){
  if(!pg.url().includes('nodspel')){events.push('left raid t='+t());break;}
  const st=await pg.evaluate(()=>{const {position:p,level:L}=__NR.state(),r=__NR.round();const alive=(L.enemies||[]).filter(e=>e.health>0);
   return {over:r.over,reason:r.reason,lvl:L.number,hp:r.health,p:{x:p.x,z:p.z},en:alive.map(e=>({x:e.x,z:e.z})),nodes:(L.nodes||[]).filter(n=>!n.active).map(n=>({x:n.x,z:n.z})),exit:L.exit,kills:r.enemiesDefeated,
    loot:(L.lootBoxes||[]).filter(b=>!b.collected).map(b=>({x:b.x,z:b.z}))};}).catch(()=>null);
  if(!st){await s(300);continue;}
  const ext=await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.offsetParent&&/EXTRACT\s*&\s*SECURE/i.test(b.innerText));if(b){b.click();return true;}return false;});
  if(ext){events.push('tap EXTRACT & SECURE t='+t());await snap(TAG+'-extract-card');await s(1500);continue;}
  if(st.lvl!==lvl){lvl=st.lvl;events.push(`level ${lvl} t=${t()}`);await snap(TAG+'-L'+lvl);}
  if(st.over){events.push(`over ${st.reason} t=${t()}`);await setKeys(new Set());await snap(TAG+'-over');break;}
  const d=q=>Math.hypot(q.x-st.p.x,q.z-st.p.z);
  const near=st.en.sort((a,b)=>d(a)-d(b))[0];
  let target;
  if(st.kills!==kills0){kills0=st.kills;lastKill=Date.now();closeR=4;}if(near&&Date.now()-lastKill>5000){closeR=Math.max(1.2,closeR-0.02);}
  if(near&&d(near)<9)target=d(near)>closeR?near:null; // close to range then stand and shoot
  else if(st.nodes.length)target=st.nodes.sort((a,b)=>d(a)-d(b))[0];
  else target=st.exit;
  if(near&&d(near)<7.5&&Date.now()-shotAt>450){shotAt=Date.now();const ex=near.x-st.p.x,ez=near.z-st.p.z,L=Math.hypot(ex,ez)||1,ax=(ex-ez)/Math.SQRT2/L,ay=(ex+ez)/Math.SQRT2/L,cx=vp.width-110,cy=vp.height-90;await pg.touchscreen.touchStart(cx,cy);await pg.touchscreen.touchMove(cx+ax*45,cy+ay*45);await s(120);await pg.touchscreen.touchEnd();}
  const want=new Set();
  if(target){let dx=target.x-st.p.x,dz=target.z-st.p.z;const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;
   if(stuck>6){side=(side+1)%4;stuck=-10;}if(stuck<0){const a=[[dz,-dx],[-dz,dx],[-dx,-dz],[dz,-dx]][side];dx=a[0];dz=a[1];}
   const sx=(dx-dz)/Math.SQRT2,sy=(dx+dz)/Math.SQRT2;
   if(sx>.35)want.add('KeyD');if(sx<-.35)want.add('KeyA');if(sy>.35)want.add('KeyS');if(sy<-.35)want.add('KeyW');}
  await setKeys(want);
  if(last&&target&&Math.hypot(st.p.x-last.x,st.p.z-last.z)<.05)stuck++;else if(stuck>0)stuck=0;else if(stuck<0)stuck++;
  last=st.p;
  if(k%60==0)console.log(t(),'L'+st.lvl,'hp',st.hp,'kills',st.kills,'en',st.en.length,'nodes',st.nodes.length,'tgt',target?(target===st.exit?'exit':near&&target===near?'enemy':'node'):'shoot');
  await s(120);
 }
 await setKeys(new Set());
 const ftue=await pg.evaluate(()=>localStorage.getItem('pr_ftue_v1'));
 console.log('EVENTS',events.join(' | '));console.log('FTUE',ftue);
 try{const f=JSON.parse(ftue),b=f.t.play;console.log('REL',Object.entries(f.t).map(([k,v])=>k+'='+((v-b)/1000).toFixed(1)+'s').join(' '),'attempts',f.attempts);}catch{}
 await s(5000);await snap(TAG+'-after');console.log('url after',pg.url().slice(0,80));
};
