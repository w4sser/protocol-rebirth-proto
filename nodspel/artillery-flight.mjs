// Pure presentation curve for grenadier/artillery lob. Existing fuse time,
// blast radius and damage are authoritative; this changes visuals only.
const clamp=v=>Math.max(0,Math.min(1,v));
export function artilleryFlight(blast,now){
  const time=Math.max(1,(blast.detonateAt??0)-(blast.at??0));
  const t=clamp((now-(blast.at??0))/time);
  const fromX=Number.isFinite(blast.fromX)?blast.fromX:blast.x;
  const fromZ=Number.isFinite(blast.fromZ)?blast.fromZ:blast.z;
  const arc=Math.sin(Math.PI*t);
  return {
    t,x:fromX+(blast.x-fromX)*t,z:fromZ+(blast.z-fromZ)*t,
    // Bright shell is visible above actors and rocks from the isometric camera.
    y:0.28+(1-t)*.75+3.0*arc,
    size:.20+.06*Math.sin(Math.PI*t),
  };
}
