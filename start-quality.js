// v2.11.0 START SCREEN: quality -> water profile selection. Pure functions, no DOM beyond what
// is passed in, so it is testable standalone (test/start-quality.test.js) and usable from both
// app.js (browser) and plain Node. Mirrors nodspel/art.js's pickQuality() shape, but this is a
// separate three-tier scheme (low/medium/high) for the start screen's water only -- the raid's
// own two-tier (low/high) graphics setting is untouched.
"use strict";

// ?q=low|medium|high, else saved choice, else auto: touch+weak -> low, touch or small or weak -> medium, else high.
function pickStartQuality({search="", storage=null, nav={}, screen={}}={}){
  const q = new URLSearchParams(search).get("q");
  if(q === "low" || q === "medium" || q === "high") return q;
  try{ const s = storage?.getItem("pr.startQuality"); if(s === "low" || s === "medium" || s === "high") return s; }catch(e){}
  const touch = (nav.maxTouchPoints ?? 0) > 0, small = Math.min(screen.width ?? 9999, screen.height ?? 9999) <= 500, weak = (nav.hardwareConcurrency ?? 8) <= 4;
  if(touch && weak) return "low";
  if(touch || small || weak) return "medium";
  return "high";
}

// Best-effort WebGL2 + float-render-target check (the FFT sim needs both); never throws.
function detectWebGL2(canvasFactory){
  try{
    const canvas = canvasFactory ? canvasFactory() : document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if(!gl) return false;
    return !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  }catch(e){ return false; }
}

// High = FFT water + the baked whitewater foam texture, at a full pixel ratio. Medium = same
// FFT core (the vendored sim has no runtime resolution knob to go lower) but skips the foam
// bake and caps the pixel ratio, which is where most of the mobile cost actually lives. Low or
// no WebGL2 = Ultra Water off entirely; caller shows the static fallback image instead of
// mounting a canvas at all.
function waterProfile(quality, webgl2Available){
  if(!webgl2Available || quality === "low") return {name:"low", water:false, foam:false, pixelRatioCap:1};
  if(quality === "medium") return {name:"medium", water:true, foam:false, pixelRatioCap:1.5};
  return {name:"high", water:true, foam:true, pixelRatioCap:2};
}

// Named startQualityApi, not api: save-slots.js (another plain <script>, same top-level scope
// in the browser) already declares its own top-level `const api` -- two same-named top-level
// `const`s across separate classic <script> tags collide (SyntaxError), unlike modules.
const startQualityApi = { pickStartQuality, detectWebGL2, waterProfile };
if(typeof module !== "undefined") module.exports = startQualityApi;
if(typeof window !== "undefined") window.StartQuality = startQualityApi;
