// v1.55: building popups fit landscape phones (844x390, 667x375 with notch insets): 4 costs in one row, CTA visible.
const fs = require("fs"), assert = require("assert"), path = require("path"), root = path.join(__dirname, "..");
const html = fs.readFileSync(root + "/index.html", "utf8");
assert(/\.bpop \.costs\{flex-wrap:nowrap/.test(html), "costs stay in one row");
assert(/@media \(orientation:landscape\) and \(max-height:480px\)\{[^@]*\.bpop>button\.primary\.big\{min-height:46px/.test(html), "compact landscape popup + CTA");
// Allow the full base suite to run in environments where browsers are prohibited.
if(process.env.SKIP_BROWSER_TESTS === "1") { console.log("popup-fit: static ok (SKIP_BROWSER_TESTS=1, browser layout check skipped)"); process.exit(0); }
// Real layout check when a local Chrome + playwright-core are available (box tooling); otherwise static checks only.
let pw = null; for(const p of [process.env.PLAYWRIGHT_CORE, "playwright-core", "/workspace/mobile-audit/tool/node_modules/playwright-core"]) { try { if(p) { pw = require(p); break; } } catch(e) {} }
const chrome = "/usr/bin/google-chrome";
if(!pw || !fs.existsSync(chrome)) { console.log("popup-fit: static ok (no browser, layout check skipped)"); process.exit(0); }
const { spawn } = require("child_process"), port = 18500 + Math.floor(Math.random() * 400);
const srv = spawn("python3", ["-m", "http.server", String(port)], { cwd:root, stdio:"ignore" });
(async () => {
  try {
    await new Promise(r => setTimeout(r, 800));
    const b = await pw.chromium.launch({ executablePath:chrome, args:["--no-sandbox"] });
    for(const [W, H] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport:{ width:W, height:H }, isMobile:true, hasTouch:true });
      await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ":root{--sl:59px!important;--sr:59px!important;--sb:21px!important}"; document.head.append(s); }));
      const p = await ctx.newPage(); const url = "http://localhost:" + port + "/index.html";
      await p.goto(url); await p.waitForTimeout(1200); await p.evaluate(() => { try { A.dismissIntro(); } catch(e) {} });
      const sv = JSON.parse(await p.evaluate(() => localStorage.getItem("pr_meta_save")));
      Object.assign(sv.modules, { rebirth_core:1, fabricator:1, bit_bay:1 }); sv.introSeen = true; sv.baseState = "core_habitable";
      await p.evaluate(v => localStorage.setItem("pr_meta_save", v), JSON.stringify(sv)); await p.goto(url); await p.waitForTimeout(1500);
      await p.evaluate(() => document.querySelectorAll("#overlay [data-close]").forEach(b => b.click()));
      for(const m of ["rebirth_core", "fabricator", "bit_bay", "storage"]) {
        await p.evaluate(m => { document.getElementById("overlay")?.remove(); A.openBuilding(m); }, m); await p.waitForTimeout(250);
        const r = await p.evaluate(() => { const c = document.querySelector("#overlay .bpop"), b = c && c.querySelector(":scope>button"); const costs = [...(c?.querySelectorAll(".cost") || [])].map(e => Math.round(e.getBoundingClientRect().top));
          return c && { bottom:c.getBoundingClientRect().bottom, top:c.getBoundingClientRect().top, btn:b && b.getBoundingClientRect().bottom, rows:new Set(costs).size, vh:innerHeight }; });
        if(!r) continue;
        assert(r.bottom <= r.vh && r.top >= 0, `${W}x${H} ${m}: popup within viewport (${r.top}-${r.bottom}/${r.vh})`);
        assert(!r.btn || r.btn <= r.vh, `${W}x${H} ${m}: CTA visible`);
        assert(r.rows <= 1, `${W}x${H} ${m}: costs in one row`);
      }
      await ctx.close();
    }
    await b.close(); console.log("popup-fit: ok (layout checked at 844x390, 667x375)");
  } finally { srv.kill(); }
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
