// v2.11.0 START SCREEN: quality -> water profile selection (pure module). Run: node test/start-quality.test.js
const assert = require("assert");
const Q = require("../start-quality.js");

// 1) explicit ?q= wins over everything else
assert.equal(Q.pickStartQuality({search:"?q=low", storage:{getItem:()=>"high"}, nav:{hardwareConcurrency:16}}), "low");
assert.equal(Q.pickStartQuality({search:"?q=high", nav:{maxTouchPoints:5, hardwareConcurrency:2}}), "high");

// 2) saved choice wins over auto-detect
{
  const storage = { getItem:k => k === "pr.startQuality" ? "medium" : null };
  assert.equal(Q.pickStartQuality({storage, nav:{hardwareConcurrency:16}}), "medium");
}

// 3) auto-detect: touch + weak -> low; touch or small or weak alone -> medium; none -> high
assert.equal(Q.pickStartQuality({nav:{maxTouchPoints:5, hardwareConcurrency:4}}), "low", "touch + weak -> low");
assert.equal(Q.pickStartQuality({nav:{maxTouchPoints:5, hardwareConcurrency:8}}), "medium", "touch alone -> medium");
assert.equal(Q.pickStartQuality({nav:{hardwareConcurrency:4}, screen:{width:1920,height:1080}}), "medium", "weak alone -> medium");
assert.equal(Q.pickStartQuality({nav:{hardwareConcurrency:16, maxTouchPoints:0}, screen:{width:1920,height:1080}}), "high", "neither -> high");

// 4) a broken storage never throws and falls through to auto-detect
{
  const storage = { getItem(){ throw new Error("denied"); } };
  assert.equal(Q.pickStartQuality({storage, nav:{hardwareConcurrency:16}}), "high");
}

// 5) detectWebGL2: no context -> false, never throws
assert.equal(Q.detectWebGL2(() => ({ getContext: () => null })), false);
assert.equal(Q.detectWebGL2(() => { throw new Error("no canvas"); }), false);
assert.equal(Q.detectWebGL2(() => ({ getContext: () => { throw new Error("blocked"); } })), false);
// WebGL2 context without the float-render-target extension the FFT sim needs -> still false
assert.equal(Q.detectWebGL2(() => ({ getContext: () => ({ getExtension: () => null }) })), false);
// a full context -> true
assert.equal(Q.detectWebGL2(() => ({ getContext: () => ({ getExtension: name => name === "EXT_color_buffer_float" ? {} : null }) })), true);

// 6) waterProfile: low quality or no WebGL2 always turns water off, regardless of the other
assert.deepEqual(Q.waterProfile("low", true), {name:"low", water:false, foam:false, pixelRatioCap:1});
assert.deepEqual(Q.waterProfile("high", false), {name:"low", water:false, foam:false, pixelRatioCap:1});
assert.deepEqual(Q.waterProfile("medium", false), {name:"low", water:false, foam:false, pixelRatioCap:1});

// 7) medium: FFT water on, but a tighter pixel-ratio cap than high and no foam bake
{
  const med = Q.waterProfile("medium", true), high = Q.waterProfile("high", true);
  assert.equal(med.water, true); assert.equal(high.water, true);
  assert(med.pixelRatioCap < high.pixelRatioCap, "medium caps the pixel ratio below high");
  assert.equal(med.foam, false, "medium skips the foam bake");
  assert.equal(high.foam, true, "high keeps foam");
}

console.log("start-quality.test: ok (quality->water profile selection, low/no-webgl2 fallback)");
