// PRB-151 BIT narrator card (docs/bit-narrator.md): one reusable "BIT card" used by both the base
// page (index.html/app.js) and the raid page (nodspel/index.html + game.mjs). Classic script (no
// module syntax) so a single <script> tag works on both pages; attaches window.PRBitCard.
//
// PRB-153: owner-approved narrator busts are a card-only identity exception.
// Use the shipped art unchanged; whole-body tilt/hover adds subtle motion.
//
// Persistence is the CALLER's job (see docs/bit-narrator.md) -- this component only dedupes a
// single id against what is currently showing or queued, never across page loads.
(function(){
  "use strict";
  if(typeof window === "undefined" || typeof document === "undefined") return;

  var ART = "assets/production/bit-narrator/";
  var MOODS = { happy:"happy", sad:"sad", worried:"sad", smile:"smile", calm:"smile",
    skeptical:"skeptical", tired:"skeptical" };
  var preloaded = null;
  function bust(mood){ return (isRaidPage() ? "../" : "") + ART + "bust-tilt-" + MOODS[mood] + "-v1.webp"; }
  function preloadBusts(){
    if(preloaded) return;
    preloaded = ["happy", "sad", "smile", "skeptical"].map(function(mood){
      var img = new Image(); img.src = bust(mood); return img;
    });
  }
  var MAX_QUEUE = 4;
  var BLOCK_POLL_MS = 250;
  var BASE_MS = 3000, CHAR_THRESHOLD = 50, CHAR_MS = 40, CAP_MS = 6000;

  var cardEl = null, current = null, queue = [], retryTimer = null;

  function isRaidPage(){ return !!document.getElementById("viewport"); }

  // Never show while: the cold open/intro is up, the splash is active, a base popup/overlay (or a
  // raid dialog: round-over, paused settings, bag) is open. Raid's own FTUE/intro gating lives in
  // the caller (nodspel/loot-value.js), since it needs the launch object this component never sees.
  function isBlocked(){
    var b = document.body;
    if(!b) return true;
    if(b.dataset && b.dataset.screen === "intro") return true;
    if(b.classList.contains("startup-bunker-intro")) return true;
    if(document.querySelector(".intro")) return true;
    var splash = document.getElementById("splash");
    if(splash && !splash.classList.contains("out")) return true;
    if(document.getElementById("overlay")) return true;
    if(window.PRBitCutscene && window.PRBitCutscene.isOpen()) return true;
    if(b.classList.contains("has-overlay")) return true;
    var roundOver = document.getElementById("round-over");
    if(roundOver && !roundOver.hidden) return true;
    var raidSettings = document.getElementById("raid-settings");
    if(raidSettings && !raidSettings.hidden) return true;
    var inventory = document.getElementById("inventory");
    if(inventory && !inventory.hidden) return true;
    return false;
  }

  function computeDuration(text, requested){
    var base = typeof requested === "number" && requested > 0 ? requested : BASE_MS;
    var extra = Math.max(0, String(text || "").length - CHAR_THRESHOLD) * CHAR_MS;
    return Math.min(CAP_MS, base + extra);
  }

  function ensureEl(){
    if(cardEl) return cardEl;
    cardEl = document.createElement("button");
    cardEl.type = "button";
    cardEl.className = "bit-card";
    cardEl.setAttribute("role", "status");
    cardEl.setAttribute("aria-live", "polite");
    cardEl.setAttribute("aria-label", "BIT, tap to continue");
    cardEl.hidden = true;
    // nodspel/index.html is served from /nodspel/, one level below the asset root; index.html is
    // served from the root. Same convention as nodspel's other ../assets/ references.
    cardEl.innerHTML =
      '<img class="bit-card-img" alt="" aria-hidden="true" src="' + bust("smile") + '">' +
      '<span class="bit-card-bubble"></span>';
    cardEl.addEventListener("click", function(){ dismiss(); });
    document.body.appendChild(cardEl);
    return cardEl;
  }

  function isQueuedOrCurrent(id){
    if(current && current.job.id === id) return true;
    for(var i = 0; i < queue.length; i++) if(queue[i].id === id) return true;
    return false;
  }

  function present(job){
    preloadBusts();
    var el = ensureEl();
    el.querySelector(".bit-card-img").src = bust(job.mood);
    el.className = "bit-card mood-" + job.mood + (isRaidPage() ? " ctx-raid" : "");
    el.querySelector(".bit-card-bubble").textContent = job.text;
    el.hidden = false;
    var ms = computeDuration(job.text, job.duration);
    current = { job: job, timer: setTimeout(dismiss, ms) };
  }

  function scheduleRetry(){
    if(retryTimer) return;
    retryTimer = setTimeout(function(){ retryTimer = null; advance(); }, BLOCK_POLL_MS);
  }

  function advance(){
    if(current) return;
    if(!queue.length) return;
    if(isBlocked()){
      if(isRaidPage()){ queue.length = 0; return; } // raid: drop the rest rather than queue through a dialog
      scheduleRetry();
      return;
    }
    present(queue.shift());
  }

  function dismiss(){
    if(!current) return;
    clearTimeout(current.timer);
    var job = current.job;
    if(cardEl) cardEl.hidden = true;
    current = null;
    if(job.onDone) try{ job.onDone(); }catch(e){}
    advance();
  }

  function show(opts){
    opts = opts || {};
    var id = opts.id, text = opts.text;
    if(!id || !text) return;
    if(isQueuedOrCurrent(id)) return;
    var mood = Object.prototype.hasOwnProperty.call(MOODS, opts.mood) ? opts.mood : "smile";
    var job = { id: id, text: String(text), mood: mood,
      duration: typeof opts.duration === "number" ? opts.duration : BASE_MS,
      onDone: typeof opts.onDone === "function" ? opts.onDone : null };
    if(current){ if(queue.length < MAX_QUEUE) queue.push(job); return; }
    if(isBlocked()){
      if(isRaidPage()) return; // raid: drop rather than show mid-dialog
      if(queue.length < MAX_QUEUE) queue.push(job);
      scheduleRetry();
      return;
    }
    present(job);
  }

  window.PRBitCard = {
    show: show,
    dismiss: dismiss,
    isOpen: function(){ return !!current; }
  };
})();
