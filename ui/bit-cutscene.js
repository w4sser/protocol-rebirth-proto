// PRB-153/PRB-155: full-screen narrative gate, following the cold open. No voice or gameplay effects.
// PRB-155 extends the plain lower-left line into the standard layout (BIT speech bubble + bust,
// an info strip, optional fabricator-style fx) while staying backward compatible: a play() call
// without `bust`/`info` renders exactly as before.
(function(){
  "use strict";
  var queue = [], current = null, retry = null;
  var images = new Map();
  // PRB-158 (Robert's playtest, 2026-11-15): "the Fabricator box doesn't stay long enough. Keep
  // it until I want to continue." No auto-advance -- HOLD_MS/HINT_MS below replace the old
  // fixed-timeout auto-end; see docs/bit-narrator.md "Hold until tap".
  var CROSSFADE = 3150, INFO_DELAY = 600, FADE = 350, HOLD_MS = 1000, HINT_MS = 3000;

  // PRB-160: keep decoded images alive until their story beat has been dismissed.
  // Loading is warming only; presentation never waits for these promises.
  var owners = new Map();
  function load(src){
    if(!src) return Promise.resolve("");
    if(images.has(src)) return images.get(src).promise;
    var entry = { img:new Image(), decoded:false };
    images.set(src, entry);
    entry.promise = new Promise(function(resolve){
      entry.img.onerror = function(){
        if(images.get(src) === entry) images.delete(src); resolve(""); // a real load error can be retried by a later beat
      };
      entry.img.onload = function(){
        var decoding;
        try { decoding = entry.img.decode ? entry.img.decode() : Promise.resolve(); }
        catch(e){ decoding = Promise.reject(e); }
        Promise.resolve(decoding).then(function(){ entry.decoded = true; resolve(src); }, function(){
          if(images.get(src) === entry) images.delete(src); resolve(src); // decoding failure is not a missing-art verdict
        });
      };
      entry.img.src = src;
    });
    return entry.promise;
  }
  function sources(opts){
    return [opts.from, opts.to, opts.bust && opts.bust.from, opts.bust && (opts.bust.to || opts.bust.from), opts.fallback].filter(Boolean);
  }
  function release(opts){
    owners.delete(opts.id);
    var held = new Set();
    owners.forEach(function(list){ list.forEach(function(src){ held.add(src); }); });
    images.forEach(function(entry, src){ if(!held.has(src)) images.delete(src); });
  }
  // Normalized source-image bounds, including the whole painted BIT chassis and vest.
  var FABRICATOR_GEOMETRY = Object.freeze({
    width:1600, height:720,
    bit:Object.freeze({x:.18, y:.28, right:.30, bottom:.55}),
    vest:Object.freeze({x:.56, y:.40, right:.68, bottom:.63})
  });
  // stage is the live transformed stage rect: object-fit cover crop AND push-in are included.
  function paintedRect(stage, region){
    var scale = Math.max(stage.width / FABRICATOR_GEOMETRY.width, stage.height / FABRICATOR_GEOMETRY.height);
    var w = FABRICATOR_GEOMETRY.width * scale, h = FABRICATOR_GEOMETRY.height * scale;
    var x = stage.x + (stage.width - w) / 2, y = stage.y + (stage.height - h) / 2;
    return {x:x + region.x * w, y:y + region.y * h, right:x + region.right * w, bottom:y + region.bottom * h};
  }
  function bustIsPair(bust){ return !!(bust && bust.to && bust.to !== bust.from); }
  function preload(opts){
    var list = sources(opts);
    if(opts.id) owners.set(opts.id, list);
    return Promise.all(list.map(load));
  }
  function reduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function blocked(){
    var b = document.body;
    if(window.matchMedia && window.matchMedia("(orientation: portrait)").matches) return true;
    if(!b || (b.dataset.screen && b.dataset.screen !== "base")) return true;
    if(b.classList.contains("startup-bunker-intro") || b.classList.contains("intro-leaving") || b.classList.contains("has-overlay")) return true;
    if(document.querySelector(".intro, #overlay, #splash:not(.out), #settings-menu:not([hidden])")) return true;
    if(window.PRBitCard && window.PRBitCard.isOpen()) return true;
    return false;
  }
  function advance(){
    if(current || !queue.length) return;
    if(blocked()){
      // Events handle normal closes immediately. rAF catches navigation/orientation/legacy
      // removals on the next frame, with a 50ms timer when rAF is unavailable.
      if(!retry) retry = window.requestAnimationFrame
        ? window.requestAnimationFrame(function(){ retry = null; advance(); })
        : setTimeout(function(){ retry = null; advance(); }, 50);
      return;
    }
    var job = queue.shift();
    current = { job:job, timers:[], el:null, previous:document.activeElement, reduced:reduced() };
    preload(job);
    present(current, [job.from, job.to, job.bust && job.bust.from, job.bust && (job.bust.to || job.bust.from)]);
  }
  window.addEventListener("pr:ui-clear", advance);
  window.addEventListener("pr:splash-finished", advance);
  function later(run, fn, ms){ run.timers.push(setTimeout(fn, ms)); }
  function sparksHtml(){
    var out = "";
    for(var i = 0; i < 7; i++) out += '<span style="left:' + (8 + i * 13 + (i % 2 ? 3 : -3)) + '%;animation-delay:' + (CROSSFADE / 1000 + 0.15 + i * 0.18).toFixed(2) + 's"></span>';
    return out;
  }
  function present(run, sources){
    var job = run.job, hasBust = !!job.bust, pair = hasBust && bustIsPair(job.bust);
    var side = hasBust && job.bust.side === "right" ? "right" : "left";
    var el = document.createElement("div");
    el.className = "bit-cutscene" + (run.reduced ? " reduced" : "") + (job.effect ? " effect-" + job.effect : "");
    el.dataset.id = job.id;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "BIT: " + job.line);
    var bustHtml = hasBust
      ? '<div class="bit-cutscene-bust side-' + side + '"><img class="bit-cutscene-bust-from" alt="">' + (pair ? '<img class="bit-cutscene-bust-to" alt="">' : '') + '</div>'
      : "";
    var fxHtml = job.effect
      ? '<div class="bit-cutscene-fx"><div class="bit-cutscene-sweep"></div><div class="bit-cutscene-sparks">' + sparksHtml() + '</div>' +
        (job.hologramIcon ? '<div class="bit-cutscene-hologram">' + job.hologramIcon + '</div>' : "") + '</div>'
      : "";
    var copyInner = hasBust ? '<div class="bit-cutscene-bubble"><p class="bit-cutscene-line"></p></div>' : '<p class="bit-cutscene-line"></p>';
    var infoRows = (job.info || []).map(function(){ return '<div class="bci-row"><b class="bci-label"></b><span class="bci-icon"></span><span class="bci-text"></span></div>'; }).join("");
    var infoHtml = (job.info && job.info.length) ? '<div class="bit-cutscene-info">' + infoRows + '</div>' : "";
    el.innerHTML = '<div class="bit-cutscene-stage"><img class="bit-cutscene-from" alt=""><img class="bit-cutscene-to" alt=""></div>' +
      '<div class="bit-cutscene-scrim"></div>' + bustHtml + fxHtml +
      '<div class="bit-cutscene-copy' + (hasBust ? ' has-bust bust-' + side : '') + '">' + copyInner +
      '<button type="button" class="bit-cutscene-continue" aria-label="Continue to base">TAP TO CONTINUE</button></div>' + infoHtml;
    ["from", "to"].forEach(function(key, i){
      var img = el.querySelector(".bit-cutscene-" + key);
      img.onerror = function(){
        if(!job.fallback){ img.hidden = true; return; }
        img.onerror = null; img.src = job.fallback;
      };
      img.onload = function(){ img.classList.remove("art-pending"); };
      if(!images.get(sources[i])?.decoded) img.classList.add("art-pending");
      if(sources[i]) img.src = sources[i]; else img.hidden = true;
    });
    if(hasBust){
      var bf = el.querySelector(".bit-cutscene-bust-from"), bt = el.querySelector(".bit-cutscene-bust-to");
      var bustFromSrc = sources[2], bustToSrc = pair ? sources[3] : sources[2];
      bf.onerror = function(){ bf.hidden = true; };
      if(bt) bt.onerror = function(){ bt.hidden = true; };
      if(bustFromSrc) bf.src = bustFromSrc; else bf.hidden = true;
      if(bt){ if(bustToSrc) bt.src = bustToSrc; else bt.hidden = true; }
    }
    el.querySelector(".bit-cutscene-line").textContent = job.line;
    if(job.info && job.info.length){
      var rows = el.querySelectorAll(".bci-row");
      job.info.forEach(function(row, i){
        var r = rows[i];
        r.querySelector(".bci-label").textContent = row.label || "";
        r.querySelector(".bci-icon").innerHTML = row.iconHtml || "";
        r.querySelector(".bci-text").textContent = row.text || "";
      });
    }
    run.el = el;
    el.addEventListener("click", tapDismiss);
    el.addEventListener("keydown", function(e){
      if(e.key === "Escape"){ e.preventDefault(); tapDismiss(); }
      if(e.key === "Tab"){ e.preventDefault(); el.querySelector("button").focus(); }
    });
    document.body.appendChild(el); el.querySelector("button").focus({preventScroll:true});
    var missingCore = !images.get(job.from)?.decoded || !images.get(job.to)?.decoded;
    if(run.reduced || missingCore){
      el.classList.add("line-visible");
      if(job.info && job.info.length) el.classList.add("info-visible");
    }
    // Reduced motion: the hint (like everything else here) appears immediately, no fade -- same
    // convention this component already used for the bubble/bust/info strip.
    if(run.reduced) el.classList.add("hint-visible");
    else later(run, function(){ el.classList.add("hint-visible"); }, HINT_MS);
    later(run, function(){ el.classList.add("crossfaded", "line-visible"); }, CROSSFADE);
    if(job.info && job.info.length) later(run, function(){ el.classList.add("info-visible"); }, CROSSFADE + INFO_DELAY);
    // No auto-end: the player holds this until they tap/press to continue. Taps in the first
    // HOLD_MS are ignored (no accidental skip while the scene is still settling in).
    run.locked = true;
    later(run, function(){ run.locked = false; }, HOLD_MS);
  }
  function tapDismiss(){
    if(current && current.locked) return;
    dismiss();
  }
  function dismiss(){
    var run = current;
    if(!run || run.ending) return;
    run.ending = true;
    run.timers.forEach(clearTimeout);
    if(run.el) run.el.classList.add("leaving");
    var finish = function(){
      if(run.el) run.el.remove();
      current = null;
      release(run.job);
      if(run.previous && run.previous.isConnected) run.previous.focus();
      if(run.job.onDone) try{ run.job.onDone(); }catch(e){}
      advance();
    };
    if(run.el && !run.reduced) setTimeout(finish, FADE); else finish();
  }
  function play(opts){
    if(!opts || !opts.id || !opts.from || !opts.to || !opts.line) return;
    if(current && current.job.id === opts.id || queue.some(function(j){ return j.id === opts.id; })) return;
    queue.push({
      waitForArt:opts.waitForArt, fallback:opts.fallback, id:opts.id, from:opts.from, to:opts.to, line:String(opts.line), onDone:opts.onDone,
      bust:opts.bust || null, info:opts.info || null, effect:opts.effect || null, hologramIcon:opts.hologramIcon || null
    });
    advance();
  }
  window.PRBitCutscene = { geometry:FABRICATOR_GEOMETRY, paintedRect:paintedRect, play:play, preload:preload, release:release, dismiss:dismiss, isOpen:function(){ return !!current; } };
})();
