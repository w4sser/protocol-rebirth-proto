// PRB-159 hidden audio debug overlay: Robert cannot plug his iPhone into devtools, so this gives
// him a way to screenshot what the shared AudioManager (window.PR_AUDIO) actually sees in the
// field. Classic script (no module syntax) so one <script> tag works on both the base page and
// the raid page. Triple-tap the version label within ~800ms to toggle it; tap the overlay itself
// to close. While closed, the ONLY runtime cost is the one tap-timestamp listener below -- no
// polling, no timers, no extra DOM beyond the version labels that already exist.
(function(){
  "use strict";
  if(typeof window === "undefined" || typeof document === "undefined") return;

  var TAP_WINDOW_MS = 800;
  var REFRESH_MS = 500;
  var taps = [];
  var overlay = null, refreshTimer = null;

  var LABEL_SELECTOR = "#app-version, #menu-version, #core-version";

  function now(){ return Date.now(); }

  function onTap(){
    var t = now();
    taps.push(t);
    while(taps.length && t - taps[0] > TAP_WINDOW_MS) taps.shift();
    if(taps.length >= 3){ taps.length = 0; toggle(); }
  }

  // Delegated on document (not the labels directly): both pages load this script in <head>,
  // before the labels further down in <body> have been parsed, and the raid page's #core-version
  // sits inside a dialog that may not exist yet either -- a single document-level listener needs
  // no DOM readiness at all and is the one listener kept alive while the overlay stays closed.
  function onDocumentClick(e){
    if(e.target && e.target.closest && e.target.closest(LABEL_SELECTOR)) onTap();
  }

  function shortUA(){
    var ua = navigator.userAgent || "";
    return ua.length > 70 ? ua.slice(0, 70) + "..." : ua;
  }

  function appVersion(){
    var found = document.querySelector(LABEL_SELECTOR);
    return found ? found.textContent : "?";
  }

  function row(label, value){
    return '<div class="audio-debug-row"><span>' + label + '</span><b>' + value + "</b></div>";
  }

  function render(){
    if(!overlay) return;
    var audio = window.PR_AUDIO;
    if(!audio){ overlay.querySelector(".audio-debug-body").innerHTML = row("PR_AUDIO", "not present"); return; }
    var s = audio.debugStats();
    var html = "";
    html += row("context", s.contextState);
    html += row("sampleRate", s.sampleRate == null ? "-" : s.sampleRate + " Hz");
    html += row("baseLatency", s.baseLatency == null ? "-" : s.baseLatency);
    html += row("unlocked / was", s.unlocked + " / " + s.wasUnlocked);
    html += row("format", s.format);
    html += row("decoded", s.decoded + " / " + s.total);
    html += row("pending", s.pending.length ? s.pending.join(", ") : "none");
    html += row("failed", s.failed.length ? s.failed.map(function(f){ return f.file + ": " + f.error; }).join("<br>") : "none");
    html += row("last error", s.lastError || "none");
    html += row("visibility", s.visibilityState);
    html += row("audioSession", s.audioSessionType || "n/a");
    html += row("UA", shortUA());
    html += row("version", appVersion());
    var drops = s.drops.length ? s.drops.map(function(d){ return d.name + ": " + d.reason; }).join("<br>") : "none";
    html += '<div class="audio-debug-row audio-debug-drops"><span>last drops</span><b>' + drops + "</b></div>";
    overlay.querySelector(".audio-debug-body").innerHTML = html;
  }

  function testBeep(){
    var audio = window.PR_AUDIO;
    if(!audio || !audio.init || !audio.init()) return;
    try{
      var ctx = audio.context, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = 880; gain.gain.value = 0.2;
      osc.connect(gain); gain.connect(audio.buses ? audio.buses.sfx : ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
    }catch(_){ /* best-effort diagnostic only */ }
  }

  function playSfx(){
    var audio = window.PR_AUDIO;
    if(audio && audio.play) audio.play("ui-confirm");
  }

  function build(){
    var el = document.createElement("div");
    el.className = "audio-debug-ov";
    el.innerHTML =
      '<div class="audio-debug-body"></div>' +
      '<div class="audio-debug-actions">' +
        '<button type="button" class="audio-debug-beep">Test beep</button>' +
        '<button type="button" class="audio-debug-sfx">Play SFX</button>' +
      "</div>";
    el.addEventListener("click", function(e){
      if(e.target.closest(".audio-debug-beep")){ e.stopPropagation(); testBeep(); return; }
      if(e.target.closest(".audio-debug-sfx")){ e.stopPropagation(); playSfx(); return; }
      close();
    });
    document.body.appendChild(el);
    return el;
  }

  function open(){
    if(!overlay) overlay = build();
    overlay.classList.add("audio-debug-open");
    render();
    refreshTimer = window.setInterval(render, REFRESH_MS);
  }

  function close(){
    if(overlay) overlay.classList.remove("audio-debug-open");
    if(refreshTimer){ window.clearInterval(refreshTimer); refreshTimer = null; }
  }

  function toggle(){
    if(overlay && overlay.classList.contains("audio-debug-open")) close();
    else open();
  }

  document.addEventListener("click", onDocumentClick);

  window.PRAudioDebug = { toggle: toggle, open: open, close: close, isOpen: function(){ return !!(overlay && overlay.classList.contains("audio-debug-open")); } };
})();
