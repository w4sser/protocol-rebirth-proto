// v1.58 world map: continuous drag (no snapping), pinch + wheel zoom around the gesture point, soft bounds, fog of war.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
function boot(mut){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window, raf = []; w.requestAnimationFrame = f => (raf.push(f), raf.length); w.cancelAnimationFrame = () => {};
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  if(mut) mut(w.DATA);
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, session:()=>session, wmGeom, wmPlayBox, wmRubber };");
  w.A.dismissIntro(); w.A.go("worldmap");
  const flush = (n = 400) => { let t = 0; while(raf.length && n--){ t += 16; raf.shift()(t); } };
  return { w, doc:w.document, T:w.__T, flush };
}
const tr = d => { const m = d.querySelector(".wm-stage").style.transform.match(/translate3d\((-?[\d.]+)px, ?(-?[\d.]+)px/); return [+m[1], +m[2]]; };
const width = d => parseFloat(d.querySelector(".wm-stage").style.width);
function ev(b, t, x, y, id = 1, extra = {}){ const e = new b.w.MouseEvent(t, Object.assign({ bubbles:true, cancelable:true, clientX:x, clientY:y }, extra)); Object.defineProperty(e, "pointerId", { value:id }); b.doc.querySelector(".worldmap").dispatchEvent(e); }
{ // 1) no snap: pan position continuous across pointer events, 1:1 with the finger inside bounds, also across the tap threshold
  const b = boot(); const p0 = tr(b.doc); let prev = p0;
  ev(b, "pointerdown", 400, 200);
  for(let i = 1; i <= 40; i++){ ev(b, "pointermove", 400 - i * 3, 200 - i * 1); const p = tr(b.doc);
    assert(Math.abs(p[0] - prev[0]) <= 3.6 && Math.abs(p[1] - prev[1]) <= 1.6, "step " + i + " jumped " + JSON.stringify([prev, p])); prev = p; }
  const moved = p0[0] - prev[0]; assert(moved > 60 && moved < 120, "map follows the finger (" + moved + ")");
  ev(b, "pointerup", 280, 160); const atUp = tr(b.doc); b.flush();
  // glide after release is smooth too
  assert(Math.abs(tr(b.doc)[0] - atUp[0]) < 200);
  // a re-render (state update) keeps the camera exactly
  const before = tr(b.doc), z = width(b.doc); b.w.A.go("worldmap"); assert.deepEqual(tr(b.doc), before, "re-render does not re-centre"); assert.equal(width(b.doc), z);
  b.w.A.setArea("bunker"); assert.deepEqual(tr(b.doc), before, "selecting an area does not jump the camera"); }
{ // tap (<7px) never pans; drag past an edge is rubber-banded, then springs back inside the bounds
  const b = boot(); const p0 = tr(b.doc); ev(b, "pointerdown", 400, 200); ev(b, "pointermove", 404, 203); assert.deepEqual(tr(b.doc), p0); ev(b, "pointerup", 404, 203);
  ev(b, "pointerdown", 100, 200); let prev = tr(b.doc)[0], deltas = [];
  for(let i = 1; i <= 80; i++){ ev(b, "pointermove", 100 + i * 10, 200); const x = tr(b.doc)[0]; deltas.push(x - prev); prev = x; }
  assert(deltas.every(d => d >= -0.01 && d <= 10.5), "monotone, never a jump");
  assert(deltas[deltas.length - 1] < deltas[2], "resistance past the bound");
  ev(b, "pointerup", 900, 200); b.flush(); const S = b.T.session().wmCam, G = b.T.wmGeom(844, 390, S.z);
  assert(S.fx >= G.bx[0] - 1e-9 && S.fx <= G.bx[1] + 1e-9, "springs back inside the playable box"); }
{ // 2) pinch zoom around the midpoint; limits: min shows the whole playable box, max 2.5x
  const b = boot(), s = b.T.session(); const G0 = b.T.wmGeom(844, 390, s.wmCam.z), wx = s.wmCam.fx + (500 - 422) / G0.s;
  ev(b, "pointerdown", 450, 200, 1); ev(b, "pointerdown", 550, 200, 2);
  ev(b, "pointermove", 425, 200, 1); ev(b, "pointermove", 575, 200, 2);
  const z1 = s.wmCam.z; assert(Math.abs(z1 / G0.z - 1.5) < 0.02, "pinch x1.5 (" + z1 + ")");
  const G1 = b.T.wmGeom(844, 390, z1), wx1 = s.wmCam.fx + (500 - 422) / G1.s; assert(Math.abs(wx1 - wx) < 1e-6, "midpoint stays under the fingers");
  ev(b, "pointermove", 0, 200, 1); ev(b, "pointermove", 1000, 200, 2); assert(s.wmCam.z <= 2.5 + 1e-9, "max 2.5x");
  const before = tr(b.doc); ev(b, "pointerup", 1000, 200, 2); assert.deepEqual(tr(b.doc), before, "lifting one finger does not jump"); ev(b, "pointermove", 3, 200, 1);
  assert(Math.abs(tr(b.doc)[0] - before[0]) <= 3.5); ev(b, "pointerup", 3, 200, 1);
  ev(b, "pointerdown", 400, 200, 3); ev(b, "pointerdown", 440, 200, 4); ev(b, "pointermove", 419, 200, 3); ev(b, "pointermove", 421, 200, 4);
  const Gm = b.T.wmGeom(844, 390, s.wmCam.z); assert.equal(s.wmCam.z, Gm.zMin, "min zoom"); const B = b.T.wmPlayBox();
  assert(Gm.s * (B.x1 - B.x0) <= 844 + 0.5 && Gm.sh * (B.y1 - B.y0) <= 390 + 0.5, "min zoom shows the whole playable region"); }
{ // wheel / trackpad zoom around the cursor
  const b = boot(), s = b.T.session(), z0 = s.wmCam.z, G0 = b.T.wmGeom(844, 390, z0), wx = s.wmCam.fx + (600 - 422) / G0.s;
  const e = new b.w.WheelEvent("wheel", { bubbles:true, cancelable:true, clientX:600, clientY:195, deltaY:-100 }); b.doc.querySelector(".worldmap").dispatchEvent(e);
  assert(s.wmCam.z > z0 && e.defaultPrevented, "wheel up zooms in"); const G1 = b.T.wmGeom(844, 390, s.wmCam.z);
  assert(Math.abs(s.wmCam.fx + (600 - 422) / G1.s - wx) < 1e-6, "zoom anchored at the cursor");
  b.doc.querySelector(".worldmap").dispatchEvent(new b.w.WheelEvent("wheel", { bubbles:true, cancelable:true, clientX:600, clientY:195, deltaY:-30, ctrlKey:true }));
  assert(s.wmCam.z > G1.z, "trackpad pinch (ctrl+wheel) zooms"); }
{ // labels crisp: the stage is re-laid out at the zoomed size, never CSS-scaled
  const b = boot(); ev(b, "pointerdown", 450, 200, 1); ev(b, "pointerdown", 550, 200, 2); ev(b, "pointermove", 400, 200, 1); ev(b, "pointermove", 600, 200, 2);
  assert(!/scale/.test(b.doc.querySelector(".wm-stage").style.transform), "no CSS scale"); assert(/%/.test(b.doc.querySelector(".wm-label").style.left), "labels positioned in % of the stage"); }
{ // 3) fog of war: data-driven holes for every area + route; a new area is revealed automatically
  const b = boot(), d = b.doc; assert(d.querySelector(".wm-stage svg.wm-fogmap"), "fog inside the stage (moves with the map)");
  assert.equal(d.querySelectorAll("[data-fog-hole]").length, 3); assert.equal(d.querySelectorAll("[data-fog-route]").length, 2);
  assert(d.querySelector("#wmFeather feGaussianBlur"), "feathered edges"); assert.equal(d.querySelector(".wm-fogmap rect.fog").getAttribute("fill"), "#0b1526", "AD navy");
  assert(d.querySelector('.wm-region.locked[data-area="town"]'), "locked styling kept");
  const n = boot(D => { D.worldMap.areas.push({ id:"ridge", name:"Ridge", iconId:"area-town", threat:3, region:{ x:5, y:5, w:10, h:10 }, label:{ x:10, y:4 }, requires:{ core:9, scoutItem:"town_survey", from:"town" }, zones:["A"] }); });
  assert(n.doc.querySelector('[data-fog-hole="ridge"]'), "new area revealed through data"); }
console.log("mapzoom ok");
