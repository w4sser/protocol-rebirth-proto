// HUD coverage measurement for PR2 (BIT top-right + raid HUD diet).
// Loads a depth raid headless at 844x390 (+667x375, 932x430), computes the percentage of the
// viewport covered by the union of visible HUD element rects, and reports the BIT card rect.
// Usage: node scripts/measure-hud-coverage.mjs [rootDir label]...   (pairs; defaults to this repo as "current")
import http from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const argPairs = [];
if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i += 2) argPairs.push([resolve(process.argv[i]), process.argv[i + 1] || process.argv[i]]);
} else {
  argPairs.push([resolve(thisDir, ".."), "current"]);
}
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };
const SIZES = [[844, 390], [667, 375], [932, 430]];
// Every raid HUD element worth measuring (mirrors game.mjs HUD_SELECTORS + the BIT card).
const HUD_SEL = "#raid-settings-open,.round-hud,#level-corner,.depth-hud,.bag-panel,#dash,#bit-distract,#tool-btn,#abandon,#reset,#use-kit,#ammo-hud,#weapon-name,#player-health,#player-shield,.area-notice,#encounter-hint,.stick,.pickup-toast,.bit-card,#hunter-arrow,#depth-extract-guide,#alarm-banner";
// Informational/permanent-panel subset (excludes move/aim sticks and ability buttons, which are gameplay
// input controls the brief does not ask to shrink or remove) -- this is what the HUD diet actually targets.
const INFO_SEL = ".round-hud,#level-corner,.depth-hud,.bag-panel,#weapon-name,.bit-card,.pickup-toast,.area-notice,#encounter-hint,#alarm-banner,#hunter-arrow,#depth-extract-guide";

function startServer(root) {
  const server = http.createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const target = resolve(root, "." + (p.endsWith("/") ? p + "index.html" : p));
    if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try {
      let body = await readFile(target);
      const ext = extname(target);
      if (ext === ".css" || ext === ".html") {
        body = String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g, (_, s) => INSETS[s] + "px");
      }
      res.writeHead(200, { "Content-Type": types[ext] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
  return server;
}

async function bootToDepthRaid(page, base, w, h) {
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  // seed-label=1 and a tracked quest force the seed debug label and quest chip on (both diet
  // candidates) so the before/after comparison actually reflects the HUD-diet move, not just a
  // scenario where those two chips were never visible either way.
  const qs = new URLSearchParams({ seed: "hud-measure", area: "bunker", q: "high", depth: "1", debug: "1", "seed-label": "1", quest: "extract:cable:1:3" });
  await page.goto(`${base}/nodspel/?${qs}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#tutorial-start", { visible: true, timeout: 25000 });
  await page.waitForFunction(() => !document.getElementById("boot-loader"), { timeout: 25000 });
  await page.click("#tutorial-start");
  await page.waitForFunction(() => window.__NR?.round?.()?.depth, { timeout: 30000 });
  await page.evaluate(() => {
    window.__NR.setRoomClearsEnabled?.(false);
    window.__NR.depthDismissIntro?.();
    // Deterministic measurement: no alarm/hunter state drift between before/after runs.
    const r = window.__NR.round();
    r.health = 100000;
    for (const e of r.level.enemies ?? []) { e.sleeping = true; e.aggro = false; }
  });
  await new Promise(r => setTimeout(r, 600));
}

function coverageInPage(sel) {
  const vw = innerWidth, vh = innerHeight;
  const vis = e => !e.hidden && !e.closest("[hidden]") && getComputedStyle(e).visibility !== "hidden" && +getComputedStyle(e).opacity > .05 && e.getClientRects().length;
  const rects = [...document.querySelectorAll(sel)].filter(vis).map(e => {
    const r = e.getBoundingClientRect();
    return { l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(vw, r.right), b: Math.min(vh, r.bottom) };
  }).filter(r => r.r > r.l && r.b > r.t);
  // Union area via a coarse pixel grid (fast, accurate enough for a coverage percentage at this resolution).
  const STEP = 2;
  let covered = 0, total = 0;
  for (let y = 0; y < vh; y += STEP) {
    for (let x = 0; x < vw; x += STEP) {
      total++;
      if (rects.some(r => x >= r.l && x < r.r && y >= r.t && y < r.b)) covered++;
    }
  }
  return { pct: covered / total * 100, n: rects.length, vw, vh };
}

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = [];
try {
  for (const [root, label] of argPairs) {
    const server = startServer(root);
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const base = "http://127.0.0.1:" + server.address().port;
    try {
      for (const [w, h] of SIZES) {
        const page = await browser.newPage();
        const errs = [];
        page.on("pageerror", e => errs.push(String(e)));
        await bootToDepthRaid(page, base, w, h);
        const baseCov = await page.evaluate(coverageInPage, HUD_SEL);
        const infoBase = await page.evaluate(coverageInPage, INFO_SEL);

        // Force a BIT line and remeasure with the card visible.
        await page.evaluate(() => { window.PRBitCard?.show?.({ id: "hud-measure", text: "Area ahead. Stay sharp." }); });
        await new Promise(r => setTimeout(r, 150));
        const withBit = await page.evaluate(coverageInPage, HUD_SEL);
        const infoWithBit = await page.evaluate(coverageInPage, INFO_SEL);
        const bitRect = await page.evaluate(() => {
          const el = document.querySelector(".bit-card.ctx-raid");
          if (!el || el.hidden || !el.getClientRects().length) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        });

        const removed = await page.evaluate(() => {
          const vis = e => e && !e.hidden && !e.closest("[hidden]") && getComputedStyle(e).visibility !== "hidden" && e.getClientRects().length > 0;
          return {
            seedLabel: vis(document.getElementById("seed-label")),
            roomPips: vis(document.getElementById("room-pips")),
            questChip: vis(document.getElementById("quest-chip")),
            bagItems: vis(document.getElementById("bag-items")),
            bagWeight: vis(document.querySelector(".bag-weight")),
          };
        });

        results.push({ w, h, label, basePct: baseCov.pct, withBitPct: withBit.pct, infoBasePct: infoBase.pct, infoWithBitPct: infoWithBit.pct, n: baseCov.n, bitRect, removed, errs });
        await page.close();
      }
    } finally { server.close(); }
  }
} finally { await browser.close(); }

for (const r of results) {
  console.log(`[${r.label}] ${r.w}x${r.h}: full HUD coverage ${r.basePct.toFixed(2)}% (base), ${r.withBitPct.toFixed(2)}% (with BIT line); informational-panel coverage ${r.infoBasePct.toFixed(2)}% (base), ${r.infoWithBitPct.toFixed(2)}% (with BIT line); ${r.n} visible rects`);
  console.log(`  BIT card rect: ${JSON.stringify(r.bitRect)}`);
  console.log(`  removed elements still visible: ${JSON.stringify(r.removed)}`);
  if (r.errs.length) console.log(`  page errors: ${JSON.stringify(r.errs)}`);
}
console.log(JSON.stringify(results));
