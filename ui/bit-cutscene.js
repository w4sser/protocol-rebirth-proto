// PRB-153/PRB-155: full-screen narrative gate, following the cold open. No voice or gameplay effects.
// PRB-155 extends the plain lower-left line into the standard layout (BIT speech bubble + bust,
// an info strip, optional fabricator-style fx) while staying backward compatible: a play() call
// without `bust`/`info` renders exactly as before.
(function(){
  "use strict";
  var queue = [], current = null, retry = null;
  var images = new Map();
  var DURATION = 7000, CROSSFADE = 3150, INFO_DELAY = 600, FADE = 350;

  // Warm only the requested pair (+ optional bust pair), immediately before its story beat.
  // Errors/timeouts resolve to an empty source so a broken connection still gives the player the
  // line and a way out.
  function load(src){
    if(!src) return Promise.resolve("");
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
  function bustIsPair(bust){ return !!(bust && bust.to && bust.to !== bust.from); }
  function preload(opts){
    var list = [load(opts.from), load(opts.to)];
    if(opts.bust){ list.push(load(opts.bust.from)); if(bustIsPair(opts.bust)) list.push(load(opts.bust.to)); }
    return Promise.all(list);
  }
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
      if(sources[i]) img.src = sources[i]; else img.hidden = true;
    });
    if(hasBust){
      var bf = el.querySelector(".bit-cutscene-bust-from"), bt = el.querySelector(".bit-cutscene-bust-to");
      var bustFromSrc = sources[2], bustToSrc = pair ? sources[3] : sources[2];
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
    el.addEventListener("click", dismiss);
    el.addEventListener("keydown", function(e){
      if(e.key === "Escape"){ e.preventDefault(); dismiss(); }
      if(e.key === "Tab"){ e.preventDefault(); el.querySelector("button").focus(); }
    });
    document.body.appendChild(el); el.querySelector("button").focus();
    var missingCore = !sources[0] || !sources[1];
    if(run.reduced || missingCore){
      el.classList.add("line-visible");
      if(job.info && job.info.length) el.classList.add("info-visible");
    }
    if(run.reduced) el.classList.add("hint-visible");
    later(run, function(){ el.classList.add("hint-visible"); }, 1500);
    later(run, function(){ el.classList.add("crossfaded", "line-visible"); }, CROSSFADE);
    if(job.info && job.info.length) later(run, function(){ el.classList.add("info-visible"); }, CROSSFADE + INFO_DELAY);
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
    queue.push({
      id:opts.id, from:opts.from, to:opts.to, line:String(opts.line), onDone:opts.onDone,
      bust:opts.bust || null, info:opts.info || null, effect:opts.effect || null, hologramIcon:opts.hologramIcon || null
    });
    advance();
  }
  window.PRBitCutscene = { play:play, preload:preload, dismiss:dismiss, isOpen:function(){ return !!current; } };
})();
