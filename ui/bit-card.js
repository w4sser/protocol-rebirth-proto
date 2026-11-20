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
  function escText(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  }); }
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
  // PRB-158 (Robert's playtest): base cards hold until the player taps, same as the mini
  // cutscenes -- HOLD_MS ignores an accidental tap in the first second, HINT_MS fades in TAP TO
  // CONTINUE at ~3s. The raid card keeps its old timed auto-dismiss (computeDuration above):
  // the player is mid-combat, so a non-blocking, self-clearing card stays the right call there
  // (see docs/bit-narrator.md "Hold until tap").
  var HOLD_MS = 1000, HINT_MS = 3000;

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

  function reduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }

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
      '<span class="bit-card-copy"><span class="bit-card-bubble"></span><span class="bit-card-info"></span><span class="bit-card-hint">TAP TO CONTINUE</span></span>';
    cardEl.addEventListener("click", function(){ tapDismiss(); });
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
    var raid = isRaidPage();
    el.querySelector(".bit-card-img").src = bust(job.mood);
    el.className = "bit-card mood-" + job.mood + (raid ? " ctx-raid" : "");
    el.querySelector(".bit-card-bubble").textContent = job.text;
    // PRB-162 playtest (Robert, 2026-11-16): the cost/next-step info used to be flattened into
    // the bubble's prose, duplicating whatever the beat's own line already said. It now renders
    // as its own compact chip strip (one line of BIT talk, the numbers live in exactly one place).
    var infoEl = el.querySelector(".bit-card-info");
    infoEl.innerHTML = (job.info || []).map(function(row){
      return '<span class="bit-card-info-row"><span class="bit-card-info-icon">' + (row.iconHtml || "") + '</span>' +
        '<span class="bit-card-info-text">' + escText(row.text) + '</span></span>';
    }).join("");
    infoEl.hidden = !(job.info && job.info.length);
    el.hidden = false;
    // PRB-162 playtest (v2.28.54): the base page repositions this card around rooms/the goal
    // chip (app.js placeBaseBitCard) -- it cannot know a new card appeared without this event.
    window.dispatchEvent(new Event("pr:ui-show"));
    if(raid){
      // Non-blocking, self-clearing: the player is mid-combat (docs/bit-narrator.md).
      var ms = computeDuration(job.text, job.duration);
      current = { job: job, timer: setTimeout(dismiss, ms), locked:false, hintTimer:null };
      return;
    }
    // Base: hold until tapped. No auto-dismiss timer; a tap in the first HOLD_MS is ignored,
    // and the hint fades in at HINT_MS (immediately, no fade, under reduced motion).
    current = { job: job, timer: null, locked:true, hintTimer:null };
    var run = current;
    setTimeout(function(){ if(current === run) run.locked = false; }, HOLD_MS);
    if(reduced()) el.classList.add("hint-visible");
    else run.hintTimer = setTimeout(function(){ if(current === run) el.classList.add("hint-visible"); }, HINT_MS);
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

  function tapDismiss(){
    if(current && current.locked) return;
    dismiss();
  }

  function dismiss(){
    if(!current) return;
    clearTimeout(current.timer); clearTimeout(current.hintTimer);
    var job = current.job;
    if(cardEl){
      cardEl.hidden = true; cardEl.classList.remove("hint-visible");
      // Drop the base page's placeBaseBitCard() override so the next card (or the default
      // bottom-left CSS position on a non-base screen) is not left stuck at a stale spot.
      cardEl.style.removeProperty("left"); cardEl.style.top = ""; cardEl.style.bottom = "";
    }
    current = null;
    if(job.onDone) try{ job.onDone(); }catch(e){}
    window.dispatchEvent(new Event("pr:ui-clear"));
    advance();
  }

  function show(opts){
    opts = opts || {};
    var id = opts.id, text = opts.text;
    if(!id || !text) return;
    if(isQueuedOrCurrent(id)) return;
    var mood = Object.prototype.hasOwnProperty.call(MOODS, opts.mood) ? opts.mood : "smile";
    var job = { id: id, text: String(text), mood: mood, info: Array.isArray(opts.info) ? opts.info : null,
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
