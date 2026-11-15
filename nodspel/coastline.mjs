// Pass 9: one deterministic, visual-only Nordic coastline per authored island.
// Logical floors, authored walls, actor navigation and collision are unchanged.
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const unit=n=>((Math.imul(n^(n>>>16),0x7feb352d)^(n>>>15))>>>0)/4294967296;
const circleDistance=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
export function coastSeed(levelSeed,floor){
  const label=[levelSeed,floor.x.toFixed(2),floor.z.toFixed(2),floor.w.toFixed(2),floor.d.toFixed(2)].join(':');
  let s=2166136261;
  for(const ch of label)s=Math.imul(s^ch.charCodeAt(0),16777619);
  return s>>>0;
}
export function coastCoves(seed){
  return [
    {center:.09+.26*unit(seed+113),halfWidth:.048+.007*unit(seed+37)},
    {center:.58+.25*unit(seed+229),halfWidth:.048+.008*unit(seed+43)},
  ];
}
export function coastBeach(t,seed){
  // Two small coves occupying ~20% of angular perimeter. Everything between
  // them is granite or rocky skerry; there is no continuous sand rim.
  return Math.max(...coastCoves(seed).map(p =>
    1-smooth(-.008,.012,circleDistance(t,p.center)-p.halfWidth)));
}
export function coastBeachAt(floor,x,z,levelSeed){
  if(floor.dir)return 0;
  const angle=(Math.atan2(z-floor.z,x-floor.x)+TAU)%TAU;
  return coastBeach(angle/TAU,coastSeed(levelSeed,floor));
}
function rectangleRadius(floor,c,s){
  return Math.min((floor.w/2)/Math.max(1e-8,Math.abs(c)),(floor.d/2)/Math.max(1e-8,Math.abs(s)));
}
function roundedRadius(floor,c,s){
  const a=floor.w/2+1.72,b=floor.d/2+1.72;
  const radius=Math.min(2.2,a*.42,b*.42);
  const ac=Math.abs(c),as=Math.abs(s);
  const right=a/Math.max(1e-8,ac),top=b/Math.max(1e-8,as);
  if(right*as<=b-radius)return right;
  if(top*ac<=a-radius)return top;
  const cx=a-radius,cz=b-radius;
  const dot=ac*cx+as*cz;
  return dot+Math.sqrt(Math.max(0,dot*dot-(cx*cx+cz*cz-radius*radius)));
}
export function coastlineProfile(floor,levelSeed,{samples=72,style='legacy',neighbors=[]}={}){
  if(floor.dir) return null;
  const seed=coastSeed(levelSeed,floor);
  const count=clamp(Math.floor(samples),32,160);
  const phase=TAU*unit(seed+7),phase2=TAU*unit(seed+17),phase3=TAU*unit(seed+29);
  const points=[];
  for(let i=0;i<count;i++){
    const t=i/count,angle=t*TAU,c=Math.cos(angle),s=Math.sin(angle);
    // Three broad, repeatable shoreline bends. No high-frequency noise or
    // jitter on a per-vertex basis; smooth even on 48-sample mobile shores.
    const wave=.38*Math.sin(3*angle+phase)+.23*Math.sin(5*angle+phase2)+.10*Math.sin(7*angle+phase3);
    const inside=rectangleRadius(floor,c,s);
    // At least 0.45 m outside authored gameplay floors everywhere.
    // v2 is an actual extended walkable landform, not just a wavy rim on
    // the rectangular gameplay floor. Reserve a narrow erosion lip for
    // gravity/readability beyond the traversable boundary.
    // Nordic glacial islands are irregular, not rounded authored rectangles.
    // A broad oval body, asymmetric headlands and two sheltered coves are
    // evaluated at the same deterministic angles for shore, water and physics.
    const rx=floor.w*.5+4.6,rz=floor.d*.5+4.6;
    const oval=1/Math.hypot(c/rx,s/rz);
    const headland=1.48*Math.sin(2*angle+phase*.72)+1.12*Math.sin(3*angle+phase2)
      +.56*Math.sin(5*angle+phase3)+.24*Math.sin(7*angle+phase*.32);
    const recessed=coastCoves(seed).reduce((sum,cove)=>sum
      +1.3*Math.exp(-Math.pow(circleDistance(t,cove.center)/.083,2)),0);
    let outer=style==='v2'
      ?Math.max(inside+1.4,oval+1.15+headland-recessed)
      :Math.max(inside+.55,roundedRadius(floor,c,s)+wave);
    if(style==='v2')for(const other of neighbors){
      if(other===floor||other.dir)continue;
      const dx=other.x-floor.x,dz=other.z-floor.z;
      const projected=dx*c+dz*s;
      const across=Math.abs(-dx*s+dz*c);
      const perpendicularSize=other.w*.5*Math.abs(s)+other.d*.5*Math.abs(c);
      if(projected<=inside||across>perpendicularSize+1.2)continue;
      const nearSide=projected-(other.w*.5*Math.abs(c)+other.d*.5*Math.abs(s));
      if(nearSide<=inside||nearSide-inside>14)continue;
      // Opposing islands grow toward each other, but preserve an actual water
      // channel and the authored timber bridge. No artificial land bridges.
      outer=Math.max(inside+.85,Math.min(outer,inside+(nearSide-inside)*.35));
    }
    const playableRadial=style==='v2'?outer-.65:inside;
    const beach=coastBeach(t,seed);
    const cliff=.5+.5*Math.sin(4*angle+phase2);
    points.push({
      x:floor.x+c*outer,z:floor.z+s*outer,
      t,angle,radial:outer,innerRadial:inside,playableRadial,beach,
      kind:beach>.55?'small_beach':cliff>.40?'cliff':'rocky_shore'
    });
  }
  let rockyLength=0,totalLength=0;
  for(let i=0;i<count;i++){
    const p=points[i],q=points[(i+1)%count],len=Math.hypot(q.x-p.x,q.z-p.z);
    totalLength+=len;
    rockyLength+=len*(1-(p.beach+q.beach)*.5);
  }
  return {floor,seed,style,points,rockyRatio:rockyLength/totalLength,totalLength,beachRatio:1-rockyLength/totalLength};
}
// Resolve all v2 coastlines together, after every island is profiled.
// The old per-room rectangle check missed neighboring organic headlands,
// allowing two opaque ground/coast meshes to occupy the same XZ area.
// A shared center-bisector half-plane ensures that every coast polygon
// stays on its own side of a real water channel (including the outer shell).
// This never applies to legacy Archipelago or its gameplay boundaries.
export function separateArchipelagoCoastProfiles(profiles,{halfGap=.55}={}){
  const islands=[...profiles].filter(p=>p?.style==='v2');
  if(islands.length<2)return islands;
  for(const p of islands){
    for(const v of p.points){
      let allowed=v.radial;
      const c=Math.cos(v.angle),sin=Math.sin(v.angle);
      for(const other of islands){
        if(other===p)continue;
        const dx=other.floor.x-p.floor.x,dz=other.floor.z-p.floor.z;
        const distance=Math.hypot(dx,dz),toward=dx*c+dz*sin;
        if(toward<=1e-8||distance<=1e-8)continue;
        // The outer coastline is at least halfGap inside the mid-plane.
        // Coast shell extends another .22 m, so two shells still retain
        // a real positive water gap, not coincident shoreline triangles.
        allowed=Math.min(allowed,(distance*.5-halfGap)*distance/toward);
      }
      // Maintain existing authored room and actor/shore margin. When the
      // supplied level is too tightly packed to contain both independent
      // islands, record a detectable layout conflict rather than silently
      // shifting collisions into the gameplay room.
      const minRadius=v.innerRadial+.84;
      if(allowed<minRadius-1e-7){
        p.separationConflicts=(p.separationConflicts??0)+1;
        allowed=minRadius;
      }
      v.radial=allowed;
      v.playableRadial=allowed-.65;
      v.x=p.floor.x+c*allowed;
      v.z=p.floor.z+sin*allowed;
    }
    let length=0,rocky=0;
    for(let i=0;i<p.points.length;i++){
      const a=p.points[i],b=p.points[(i+1)%p.points.length];
      const segment=Math.hypot(a.x-b.x,a.z-b.z);
      length+=segment;rocky+=segment*(1-(a.beach+b.beach)*.5);
    }
    p.totalLength=length;
    p.rockyRatio=length>0?rocky/length:0;
    p.beachRatio=1-p.rockyRatio;
  }
  return islands;
}

/**
 * Target-island authoring only. Keep the operator's X/Z boundary fixed and
 * grow two broad rocky headlands OUT into free water. The new landform is
 * rendered by the existing shoreline mesh, not by offshore oval props.
 */
export function authorHeroIslandCoast(profile,{rockAngles=[],bridgeZones=[],neighborProfiles=[]}={}){
  if(profile?.style!=='v2')return profile;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const {floor,points}=profile;
  const options=rockAngles.length?rockAngles:points.filter((p,i)=>i%9===0&&p.beach<.22).map(p=>p.angle);
  const heads=[];
  for(const angle of options){
    const p=points[Math.round(((angle+TAU)%TAU)/TAU*points.length)%points.length];
    const bridgeBlocked=bridgeZones.some(z=>{
      const x=floor.x+Math.cos(angle)*(p.radial+1),t=floor.z+Math.sin(angle)*(p.radial+1);
      return Math.abs(x-z.x)<z.w/2+2&&Math.abs(t-z.z)<z.d/2+2;
    });
    if(p.beach>.46||bridgeBlocked||heads.some(h=>Math.abs(wrap(h.angle-angle))<1.18))continue;
    heads.push({angle,width:heads.length===0?.48:heads.length===1?.42:.38,
      height:heads.length===0?2.45:heads.length===1?1.87:1.43});
    if(heads.length===2)break;
  }
  if(heads.length<2){
    // Fill missing authored sites with protected bays and irregular headlands.
    // No algorithm is allowed to drop cliffs into an actual bridge approach.
    for(const p of points.filter((p,i)=>i%4===0&&p.beach<.30)){
      const x=floor.x+Math.cos(p.angle)*(p.radial+.8);
      const z=floor.z+Math.sin(p.angle)*(p.radial+.8);
      if(bridgeZones.some(b=>Math.abs(x-b.x)<b.w/2+2.5&&Math.abs(z-b.z)<b.d/2+2.5))continue;
      if(heads.some(h=>Math.abs(wrap(h.angle-p.angle))<1.0))continue;
      heads.push({angle:p.angle,width:.40,height:1.50});
      if(heads.length===2)break;
    }
  }
  for(const p of points){
    const c=Math.cos(p.angle),sn=Math.sin(p.angle);
    const base=p.radial;
    // Pass M: the natural shoreline is a SERIES of separated glacial knuckles,
    // not one continuous smooth slope. Each authored headland has a main worn
    // dome, a lower offset shoulder and an asymmetric ridge with dark clefts.
    // The valleys between the blocks remain near sea level.
    const influence=heads.reduce((acc,h)=>{
      const t=wrap(p.angle-h.angle)/h.width;
      const main=Math.exp(-Math.pow((t+.26)/.40,2));
      const shoulder=.76*Math.exp(-Math.pow((t-.44)/.36,2));
      const spur=.42*Math.exp(-Math.pow((t+.91)/.26,2));
      const crack=.22*Math.exp(-Math.pow((t-.06)/.19,2));
      const shape=clamp(main+shoulder+spur-crack,0,1.18);
      return Math.max(acc,shape*(h.height/2.35));
    },0)*(1-p.beach*.96);
    // Pass L: protruding bedrock shoulders are broad, irregular *coastline*
    // silhouettes, never oval boulders dropped over the navigation plane.
    // The neighbor bisector / bridge guards below still own the maximum reach.
    const outline=.88+.17*Math.cos(4*p.angle+profile.seed*.00023)
      +.12*Math.sin(9*p.angle-profile.seed*.00031);
    const prospect=base+influence*(5.75*outline);
    let safe=prospect;
    for(const other of neighborProfiles){
      if(other===profile)continue;
      const dx=other.floor.x-floor.x,dz=other.floor.z-floor.z;
      const distance=Math.hypot(dx,dz),along=dx*c+dz*sn;
      if(along>1e-8&&distance>1e-8)
        safe=Math.min(safe,(distance*.5-.86)*distance/along);
    }
    // Maintain the visible water gap while preserving the full original
    // walkable radius and the authored bridge landing.
    let newRadius=Math.max(base,Math.min(prospect,safe));
    const x=floor.x+c*newRadius,z=floor.z+sn*newRadius;
    const isBridge=bridgeZones.some(b=>{
      const mid= p.playableRadial+(newRadius-p.playableRadial)*.55;
      const mx=floor.x+c*mid,mz=floor.z+sn*mid;
      return Math.abs(x-b.x)<b.w/2+1.6&&Math.abs(z-b.z)<b.d/2+1.6
        || Math.abs(mx-b.x)<b.w/2+1.1&&Math.abs(mz-b.z)<b.d/2+1.1;
    });
    if(isBridge)newRadius=base;
    const actualGain=Math.max(0,newRadius-base);
    p.radial=newRadius;
    p.x=floor.x+c*newRadius;p.z=floor.z+sn*newRadius;
    // A believable 3D cliff needs a broad horizontal root. On crowded
    // archipelagos we cannot grow outwards without closing water channels.
    // Reclaim ONLY the extra organic ground outside the original authored
    // gameplay rectangle, keeping at least 1.10 m of level terrain beyond
    // the old floor, and keep both bridge approaches at their full width.
    const spareInland=Math.max(0,p.playableRadial-p.innerRadial-1.10);
    // Pass Q: retain a broad, flat vegetation apron inside the coast.
    // Tall bedrock cannot be allowed to advance deep into a planar combat zone.
    const inlandRoot=isBridge?0:Math.min(spareInland,1.12*influence);
    p.playableRadial-=inlandRoot;
    p.heroInlandRoot=inlandRoot;
    // Height cannot be directly proportional to *coast expansion*. On a
    // crowded map, neighbors suppress the outward radius and the old formula
    // erased every mountain, leaving a uniformly gray coastal retaining wall.
    // The foot remains strictly outside playableRadial and is flattened
    // anywhere the bridge clearance touches the authored cliff.
    const band=newRadius-p.playableRadial;
    const room=smooth(.62,1.80,band);
    const projectedMass=influence*(.43+.57*room);
    p.heroRelief=isBridge?0:projectedMass;
    p.heroRockMask=isBridge?0:influence;
    // The walkable coastline is updated to match this broader root in the
    // caller. It always contains the full original authored 2D gameplay
    // rectangle; no new vertical traversal or invisible collider is added.
  }
  let total=0,rocky=0;
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length];
    const len=Math.hypot(q.x-p.x,q.z-p.z);
    total+=len;rocky+=len*(1-(p.beach+q.beach)*.5);
  }
  profile.totalLength=total;
  profile.rockyRatio=total?rocky/total:0;
  profile.beachRatio=1-profile.rockyRatio;
  profile.heroHeadlands=heads;
  profile.heroCoast=true;
  return profile;
}

function heroCoastRingData(profile){
  // Pass K: a single continuous glacial shore, with locally sculpted bedrock
  // buttresses rather than a pink-grey retaining wall around the whole island.
  // All 14 radial strips share one mesh. NO separate rock apron or overlaps.
  // Ring 0 is the unchanged flat gameplay seam; ring 13 is the exact water toe.
  const {floor,points,seed}=profile,n=points.length;
  const fractions=[-.045,.035,.085,.15,.235,.335,.44,.55,.66,.755,.83,.90,.965,1];
  // Pass P: rounded, glacially polished domes rather than stacked retaining
  // walls. A long gentle inner shoulder rises beyond the flat actor seam,
  // then tapers gradually over the seaward edge into the same water toe.
  const cap=[0,.014,.075,.23,.51,.78,.95,1.00,.96,.78,.51,.25,.045,0];
  const yFloor=[.010,.008,.004,-.003,-.015,-.026,-.041,-.058,-.081,-.11,-.14,-.19,-.27,-.65];
  const yCove=[.010,.008,.002,-.012,-.036,-.057,-.081,-.11,-.155,-.218,-.28,-.345,-.44,-.65];
  const stoneColors=[
    '#657a6a','#77877f','#8b9290','#aea5a8',
    '#c6b5c0','#c8b8c4','#c5b4c2','#bdafbc',
    '#ad9fae','#9696a8','#7b8798','#667787','#4d6376','#394e60'
  ].map(rgb);
  const positions=[],colors=[],uvs=[],blends=[],indices=[];
  const stoneRoots={masses:(profile.heroHeadlands??[]).map(h=>({angle:h.angle})),shelves:[]};
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // Tectonic fracture facets vary by broad angular block (not a repeated
  // procedural rib every few degrees). Neighboring facets share vertices.
  const sections=points.map(p=>{
    let nearest=null,index=-1,distance=Infinity;
    for(let j=0;j<(profile.heroHeadlands?.length??0);j++){
      const h=profile.heroHeadlands[j],d=Math.abs(wrap(p.angle-h.angle)/h.width);
      if(d<distance){nearest=h;index=j;distance=d;}
    }
    // Interpolate broad erosion blocks: hard jumps between random angular
    // cells previously produced pointed ridge teeth in the low-poly crown.
    // Retain readable facets in shading, not jagged 3D spikes.
    const blockCount=16,erosion=(p.angle/TAU*blockCount+seed*.000041)%blockCount;
    const block=Math.floor(erosion),next=(block+1)%blockCount;
    const fade=smooth(0,1,erosion-block);
    const rough=mix(unit(seed+block*239+97),unit(seed+next*239+97),fade);
    const secondary=mix(unit(seed+block*411+index*101+283),
      unit(seed+next*411+index*101+283),fade);
    const local=nearest?wrap(p.angle-nearest.angle)/nearest.width:8;
    const knuckle=(.83+.21*Math.sin(local*4.4+.9)+.10*Math.sin(local*9.1-1.5));
    const fractured=clamp(.80+.18*rough+.08*secondary+.13*knuckle,.80,1.13);
    const rockMask=clamp(Math.pow(p.heroRockMask??0,1.45),0,1);
    // Scale individual rock blocks unevenly, breaking up the previously
    // sausage-like grey shoreline into recognizable headland silhouettes.
    const crown=.91+.10*Math.cos(local*4.5)+.055*Math.sin(local*8.4+1.3);
    // Match the visual target's broad 2–3 m glacial mounds rather than
    // monumental 4 m cliff walls stretched across the whole shoreline.
    const relief=(p.heroRelief??0)*2.72*fractured*crown;
    return {rough,secondary,local,rockMask,relief,
      fault:.022*Math.sin(5*p.angle+seed*.00013)
        +.018*Math.sin(11*p.angle-seed*.00017)
        +.017*rockMask*Math.sin(15*p.angle+seed*.00029)};
  });
  for(let k=0;k<fractions.length;k++)for(let i=0;i<n;i++){
    const p=points[i],section=sections[i],c=Math.cos(p.angle),sn=Math.sin(p.angle);
    const band=p.radial-p.playableRadial;
    // Keep radial strips ordered even in the narrowest 0.19 m water gap.
    // Angular jointing moves intermediary rings together, never either seam.
    const f=k===0?0:k===fractions.length-1?1:
      clamp(fractions[k]+(k>=3&&k<=11?section.fault:0),.012,.985);
    const radius=k===0?p.playableRadial-.045:
      k===fractions.length-1?p.radial+.22:p.playableRadial+band*f;
    const x=floor.x+c*radius,z=floor.z+sn*radius;

    // The crown is broad and mostly level. Irregular shoulders and cool
    // fractures break it into a few visibly different geological faces.
    const diagonal=.94+.075*Math.sin(p.angle*6.5+seed*.00023+k*.16)
      +.045*Math.cos(p.angle*12-seed*.00039-k*.22);
    const ledge=(k===4?.025:k===5?.045:k===6?.04:k===7?-.025:k===8?-.045:0)
      *section.rockMask*(section.rough-.45);
    const relief=section.relief*cap[k]*diagonal+ledge;
    const y=mix(yFloor[k],yCove[k],p.beach)+relief;
    positions.push(x,y,z);

    // Joined ground color at ring 0; only the three actual granite masses
    // receive bright mineral exposure. Bays remain olive/sand instead of an
    // unbroken painted-grey seawall; sea-facing stone darkens toward the toe.
    const seam=archipelagoGroundColor(profile,
      floor.x+c*(p.playableRadial-.045),
      floor.z+sn*(p.playableRadial-.045),stoneRoots);
    const rock=section.rockMask*(1-p.beach*.94);
    // The previous continuous grey apron survived because even unraised
    // shoreline strips inherited pale mineral-edge tones. Blend ordinary
    // shore into dark olive vegetation; concentrate granite at headlands.
    const calmShore=tint(SOIL_SHADE,SOIL_OLIVE,.58+.14*section.secondary);
    const calmBlend=k===0?0:smooth(.06,.55,f)*(1-rock)*.94;
    const shoreBase=tint(seam,calmShore,calmBlend);
    const exposure=clamp(rock*(.89+.10*section.secondary)
      +(1-p.beach)*(.007+.009*section.rough),0,.99);
    const transition=[0,.010,.045,.16,.40,.68,.85,.94,.96,.98,.99,1,1,1][k];
    const wet=k>=11?(1-p.beach)*.03:0;
    const blend=k===0?0:transition*clamp(.008+exposure*.99+wet,0,1);
    const fissure=section.rockMask*(k>=6&&k<=11?
      Math.pow(Math.max(0,Math.cos(p.angle*21.5+seed*.0002+k*.27)),12)*.20:0);
    const faceShade=clamp(.85+.15*section.rough+.09*section.secondary
      +.06*Math.sin(k*.83+p.angle*6.2)-fissure,.70,1.12);
    const stone=stoneColors[k];
    for(let channel=0;channel<3;channel++){
      const mineral=stone[channel]*faceShade;
      colors.push(clamp(mix(shoreBase[channel],mineral,blend),0,1));
    }
    blends.push(transition);
    const fract=v=>v-Math.floor(v);
    uvs.push(.525+.45*fract(x/4),.025+.45*fract(z/4));
  }
  for(let k=0;k<fractions.length-1;k++)for(let i=0;i<n;i++){
    const j=(i+1)%n,a=k*n+i,b=k*n+j,c=(k+1)*n+i,d=(k+1)*n+j;
    indices.push(a,b,c,b,d,c);
  }
  return {
    positions:new Float32Array(positions),
    colors:new Float32Array(colors),
    uvs:new Float32Array(uvs),
    blends:new Float32Array(blends),
    indices:new Uint16Array(indices),
    rings:fractions.length
  };
}

// Six opaque rings instead of a 4-ring untextured slab.
// The first ~1.05 m is INSET into the existing walkable rectangle: the same
// ground texture can cover the rectangle-to-coast join, then fade progressively
// to rock (or, occasionally, sand). No alpha sorting or collisions are added.
export const COAST_BLEND_STOPS=Object.freeze([0,0.12,0.53,0.87,1,1]);
// Shared linear-color material model for the gameplay ground and its shore seam.
// Broad, deterministic granite outcrops connect the island interior to the
// coastal masses without introducing raised false cover or extra draw calls.
const rgb=h=>[1,3,5].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
// Slightly darker, healthier Nordic vegetation and worn lavender-grey stone.
// All colors are linear RGB because they feed Three.js vertexColor buffers.
const SOIL_MOSS=rgb('#54734d'),SOIL_OLIVE=rgb('#829464'),SOIL_SHADE=rgb('#405b49');
const SOIL_GRANITE=rgb('#a3a0a7'),SOIL_SHADOW=rgb('#6b7380'),SOIL_SAND=rgb('#968a76');
const SOIL_HEATHER=rgb('#766e80'),SOIL_TRAIL=rgb('#807560'),SOIL_LICHEN=rgb('#82947b');
const mix=(a,b,t)=>a+(b-a)*t;
function tint(a,b,t){return a.map((c,i)=>mix(c,b[i],t));}
function fieldHash(i,j,seed){return unit(seed+Math.imul(i,374761393)+Math.imul(j,668265263));}
function fieldNoise(x,z,seed){
  const i=Math.floor(x),j=Math.floor(z),tx=smooth(0,1,x-i),tz=smooth(0,1,z-j);
  return mix(mix(fieldHash(i,j,seed),fieldHash(i+1,j,seed),tx),mix(fieldHash(i,j+1,seed),fieldHash(i+1,j+1,seed),tx),tz);
}
export function archipelagoGroundColor(profile,x,z,bedrockPlan=null){
  if(profile?.style!=='v2')return SOIL_MOSS;
  const {floor,seed,points}=profile,dx=x-floor.x,dz=z-floor.z;
  const angle=(Math.atan2(dz,dx)+TAU)%TAU,scaled=angle/TAU*points.length,i=Math.floor(scaled),frac=scaled-i;
  const radius=mix(points[i].playableRadial,points[(i+1)%points.length].playableRadial,frac)-.045;
  const f=clamp(Math.hypot(dx,dz)/Math.max(.05,radius),0,1);
  // Two correlated terrain frequencies avoid either broad uniform slabs
  // or per-vertex confetti; they have no relation to active gameplay state.
  const broad=fieldNoise(x*.14+7,z*.14-5,seed);
  const mid=fieldNoise(x*.37-9,z*.37+3,seed+817);
  const grain=fieldNoise(x*.96+13,z*.96-7,seed+1901);
  const channel=.5+.5*Math.sin(x*.31-z*.26+mid*2.5+seed*.0001);
  const beach=coastBeach(angle/TAU,seed);
  let glacial=0,bedrockRoot=0,trail=0;
  for(let j=0;j<(bedrockPlan?.masses?.length??0);j++){
    const mass=bedrockPlan.masses[j];
    const delta=Math.atan2(Math.sin(angle-mass.angle),Math.cos(angle-mass.angle));
    const meander=.045*Math.sin(f*11+seed*.00003+j);
    // Long fingers of granite visually continue from the outcrops into the
    // island clearing. They remain flush with the real walk/collision plane.
    // Pass N: rock mass is strictly along the perimeter. The playable
    // X/Z interior is not a broad grey mountain even where the coastal
    // headland is tall. Keep mineral hints as FLAT ground detail only.
    const fracture=.80+.20*Math.sin(angle*7+f*9+seed*.0002+j);
    const arc=Math.exp(-Math.pow((delta+meander)/(.24+.04*channel),2));
    const v2Hero=!!profile.heroCoast;
    glacial=Math.max(glacial,arc*smooth(v2Hero?.74:.29,.97,f)*fracture);
    bedrockRoot=Math.max(bedrockRoot,Math.pow(arc,.78)*smooth(v2Hero?.82:.58,.995,f)*(.76+.24*mid));
    if(j===0){
      // A subdued, winding worn-earth route toward the buried coastal portal.
      const transverse=Math.sin(delta)*Math.hypot(dx,dz)+Math.sin(f*8+seed*.001)*.43;
      trail=Math.exp(-Math.pow(transverse/1.22,2))*smooth(.09,.29,f)*(1-smooth(.73,.94,f));
    }
  }
  const v2Hero=!!profile.heroCoast;
  const mineralPockets=smooth(.66,.88,broad)*smooth(v2Hero?.79:.59,.94,f)*
    (v2Hero?.045+.07*mid:.18+.30*mid);
  const edgeRock=smooth(v2Hero?.955:.88,.995,f)*(1-beach)*
    (v2Hero?.06+.10*channel:.14+.15*channel);
  const exposed=clamp(glacial*(v2Hero?.17+.08*mid:.49+.20*mid)
    +bedrockRoot*(v2Hero?.09+.05*mid:.26+.13*mid)
    +mineralPockets+edgeRock,0,v2Hero?.38:.90);
  const lichen=smooth(.62,.89,mid)*exposed*(.11+.07*grain);
  let col=tint(SOIL_MOSS,SOIL_OLIVE,clamp(.23+broad*.51+grain*.20,0,1));
  col=tint(col,SOIL_SHADE,.12+.22*(1-mid));
  col=tint(col,SOIL_GRANITE,exposed);
  col=tint(col,SOIL_SHADOW,exposed*(.06+.18*(1-channel)));
  col=tint(col,SOIL_LICHEN,lichen);
  col=tint(col,SOIL_HEATHER,smooth(.64,.88,f)*smooth(.71,.95,mid)*.16*(1-exposed));
  col=tint(col,SOIL_TRAIL,trail*.58*(1-exposed*.65));
  col=tint(col,SOIL_SAND,beach*smooth(.72,1,f)*.36);
  return col;
}

export function coastRingData(profile,{bedrockPlan=null}={}){
  if(profile?.heroCoast)return heroCoastRingData(profile);
  const {floor,points}=profile,n=points.length,positions=[],indices=[],colors=[],uvs=[],blends=[];
  const rock=profile.style==='v2'
    ? ['#6b805b','#7d897d','#8f9295','#a09ca3','#878b93','#596a76']
    : ['#647075','#68747A','#737A7C','#657077','#596576','#3C4756'];
  const beach=['#7F795C','#827B5D','#908064','#8A795D','#74664F','#5D5143'];
  const toLinear=h=>[1,3,5].map(i=>{
    const c=parseInt(h.slice(i,i+2),16)/255;
    return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
  });
  const lerp=(a,b,t)=>a+(b-a)*t;
  const inset=Math.min(1.05,Math.max(.23,Math.min(floor.w,floor.d)*.12));
  for(let ring=0;ring<COAST_BLEND_STOPS.length;ring++)for(let i=0;i<n;i++){
    const p=points[i],c=Math.cos(p.angle),s=Math.sin(p.angle);
    const d=p.radial-p.innerRadial;
    // Legacy feathers from a rectangular room. V2 must NEVER do that:
    // its only visible soil-to-rock seam is the organic actor coastline.
    const radii=profile.style==='v2'?[p.playableRadial-.045,p.playableRadial+.07,
      p.playableRadial+.19,p.playableRadial+.38,p.radial-.055,p.radial+.22]:[
      p.innerRadial-inset,
      p.innerRadial-inset*.54,
      p.innerRadial-.015,
      p.innerRadial+d*.41,
      p.radial-.06,
      p.radial+.22,
    ];
    const radius=Math.max(.05,radii[ring]);
    const x=floor.x+c*radius,z=floor.z+s*radius;
    // The inset feather sits ABOVE the preview terrain (+0.004 m), but BELOW
    // node-progress rings (+0.018 m). Farther out it drops into the cliff side.
    // v2's traversable granite shelf stays nearly level until the true
    // physical coastline. Only its outer erosion lip drops below sea level;
    // actors and their shadows cannot appear suspended over the beach.
    const rockY=profile.style==='v2'?[.010,.009,.007,.003,-.025,-.65]:
      [.010,.010,.0095,-.046,-.085,-.73];
    const sandY=profile.style==='v2'?[.010,.009,.007,.001,-.045,-.54]:
      [.010,.010,.0095,-.115,-.25,-.54];
    // The existing coast shell itself rises into short glacial shoulders at
    // the big outcrops. No separate coplanar granite apron (which flickers on iOS),
    // no height change at the traversable ground seam or the sea-level lip.
    const aDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
    const massProximity=profile.style==='v2'&&bedrockPlan?.masses?.length
      ?Math.max(0,...bedrockPlan.masses.map(m=>Math.exp(-Math.pow(aDelta(p.angle,m.angle)/.48,2)))):0;
    const shelfProximity=profile.style==='v2'&&bedrockPlan?.shelves?.length
      ?Math.max(0,...bedrockPlan.shelves.map(m=>Math.exp(-Math.pow(aDelta(p.angle,m.angle)/.25,2)))):0;
    // Sculpt the SAME coastline mesh into glacial terraces. All relief is
    // beyond the actor boundary; ring 0 remains at +0.010 and the outer water
    // seam remains exactly unchanged. No second/copanar granite apron on iOS.
    const channels=.5+.5*Math.sin(p.angle*11+profile.seed*.003);
    const striation=.5+.25*Math.sin(p.angle*8+profile.seed*.0003)
      +.25*Math.sin(p.angle*15-profile.seed*.0005);
    const ridge=clamp(massProximity*.92+shelfProximity*.26,0,1)*(1-p.beach*.90);
    const localLift=[0,.055,.28,.91,.58,0][ring];
    const eroded=.72+.26*channels+.19*striation;
    positions.push(x,lerp(rockY[ring],sandY[ring],p.beach)+localLift*ridge*eroded,z);
    blends.push(COAST_BLEND_STOPS[ring]);
    const cliffShade=.87+.10*striation+.06*channels;
    const colR=toLinear(rock[ring]),colS=toLinear(beach[ring]);
    if(profile.style==='v2'){
      // Exact shared material at ring zero: the green-painted border vanishes.
      // The other five bands transition to exposed weathered granite/sand.
      const entry=archipelagoGroundColor(profile,floor.x+c*(p.playableRadial-.045),floor.z+s*(p.playableRadial-.045),bedrockPlan);
      // Most of the shore is moss and weathered soil; only headlands and
      // major outcrop connections expose broad bands of granite. The previous
      // unconditional grey blend looked like a continuous concrete seawall.
      const patch=fieldNoise(x*.46+17,z*.46-13,profile.seed+1209);
      const stone=clamp(.11+massProximity*.78+shelfProximity*.24
        +smooth(.62,.88,patch)*.17-p.beach*.32,0,1);
      const transition=[0,.21,.47,.77,.97,1][ring];
      const localStone=ring===5?1:transition*(.19+.81*stone);
      const stoneColor=colR.map((v,k)=>v*(.84+.24*striation)+(colS[k]-v)*p.beach);
      for(let k=0;k<3;k++)colors.push(clamp(lerp(entry[k],stoneColor[k]*cliffShade,localStone),0,1));
    }else{
      for(let k=0;k<3;k++)colors.push(clamp(lerp(colR[k],colS[k],p.beach)*cliffShade,0,1));
    }
    // LOW mode uses the green quadrant of its existing 2x2 atlas for the
    // INNER band; from here both profiles feather toward coastline colors.
    const fract=v=>v-Math.floor(v);
    uvs.push(.525+.45*fract(x/4),.025+.45*fract(z/4));
  }
  for(let ring=0;ring<COAST_BLEND_STOPS.length-1;ring++)for(let i=0;i<n;i++){
    const j=(i+1)%n,a=ring*n+i,b=ring*n+j,c=(ring+1)*n+i,d=(ring+1)*n+j;
    indices.push(a,b,c,b,d,c);
  }
  return {
    positions:new Float32Array(positions),
    colors:new Float32Array(colors),
    uvs:new Float32Array(uvs),
    blends:new Float32Array(blends),
    indices:new Uint16Array(indices),
  };
}
