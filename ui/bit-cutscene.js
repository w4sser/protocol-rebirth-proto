// PRB-153: full-screen narrative gate, following the cold open. No voice or gameplay effects.
(function(){
  "use strict";
  var queue = [], current = null, retry = null;
  var images = new Map();
  var DURATION = 7000, CROSSFADE = 3150, FADE = 350;

  // Warm only the requested pair, immediately before its story beat. Errors/timeouts resolve
  // to an empty source so a broken connection still gives the player the line and a way out.
  function load(src){
    if(images.has(src)) return images.get(src);
    var promise = new Promise(function(resolve){
      var img = new Image(), settled = false;
      var timeout = setTimeout(function(){ finish(false); }, 3000);
      function finish(ok){
        if(settled) return; settled = true; clearTimeout(timeout);
        img.onload = img.onerror = null; resolve(ok ? src : "");
      }
      img.onload = function(){ finish(true); };
      img.onerror = function(){ finish(false); };
      img.src = src;
    });
    images.set(src, promise); return promise;
  }
  function preload(opts){ return Promise.all([load(opts.from), load(opts.to)]); }
  function reduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function blocked(){
    var b = document.body;
    if(window.matchMedia && window.matchMedia("(orientation: portrait)").matches) return true;
    if(!b || (b.dataset.screen && b.dataset.screen !== "base")) return true;
    if(b.classList.contains("startup-bunker-intro") || b.classList.contains("intro-leaving") || b.classList.contains("has-overlay")) return true;
    if(document.querySelector(".intro, #overlay, #splash:not(.out), #settings-menu:not([hidden])")) return true;
    if(window.PRBitCard && window.PRBitCard.isOpen()) return true;
    return !!(window.PR_AUDIO && window.PR_AUDIO.voiceBusy);
  }
  function advance(){
    if(current || !queue.length) return;
    if(blocked()){
      if(!retry) retry = setTimeout(function(){ retry = null; advance(); }, 250);
      return;
    }
    var job = queue.shift();
    current = { job:job, timers:[], el:null, previous:document.activeElement, reduced:reduced() };
    var run = current;
    preload(job).then(function(sources){
      if(current !== run) return;
      // Loading may have outlasted an intervening popup/navigation. Queue again until clear.
      if(blocked()){ current = null; queue.unshift(job); advance(); return; }
      present(run, sources);
    });
  }
  function later(run, fn, ms){ run.timers.push(setTimeout(fn, ms)); }
  function present(run, sources){
    var el = document.createElement("div");
    el.className = "bit-cutscene" + (run.reduced ? " reduced" : "");
    el.dataset.id = run.job.id;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "BIT: " + run.job.line);
    el.innerHTML = '<div class="bit-cutscene-stage"><img class="bit-cutscene-from" alt=""><img class="bit-cutscene-to" alt=""></div>' +
      '<div class="bit-cutscene-scrim"></div><div class="bit-cutscene-copy"><p class="bit-cutscene-line"></p>' +
      '<button type="button" class="bit-cutscene-continue" aria-label="Continue to base">TAP TO CONTINUE</button></div>';
    ["from", "to"].forEach(function(key, i){
      var img = el.querySelector(".bit-cutscene-" + key);
      if(sources[i]) img.src = sources[i]; else img.hidden = true;
    });
    el.querySelector(".bit-cutscene-line").textContent = run.job.line;
    run.el = el;
    el.addEventListener("click", dismiss);
    el.addEventListener("keydown", function(e){
      if(e.key === "Escape"){ e.preventDefault(); dismiss(); }
      if(e.key === "Tab"){ e.preventDefault(); el.querySelector("button").focus(); }
    });
    document.body.appendChild(el); el.querySelector("button").focus();
    if(run.reduced || !sources[0] || !sources[1]) el.classList.add("line-visible");
    later(run, function(){ el.classList.add("hint-visible"); }, 1500);
    later(run, function(){ el.classList.add("crossfaded", "line-visible"); }, CROSSFADE);
    later(run, dismiss, DURATION);
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
      if(run.previous && run.previous.isConnected) run.previous.focus();
      if(run.job.onDone) try{ run.job.onDone(); }catch(e){}
      advance();
    };
    if(run.el && !run.reduced) setTimeout(finish, FADE); else finish();
  }
  function play(opts){
    if(!opts || !opts.id || !opts.from || !opts.to || !opts.line) return;
    if(current && current.job.id === opts.id || queue.some(function(j){ return j.id === opts.id; })) return;
    queue.push({ id:opts.id, from:opts.from, to:opts.to, line:String(opts.line), onDone:opts.onDone });
    advance();
  }
  window.PRBitCutscene = { play:play, preload:preload, dismiss:dismiss, isOpen:function(){ return !!current; } };
})();
