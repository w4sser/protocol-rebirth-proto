// Non-blocking FTUE move/shoot hints (PR 3, docs/ftue-design.md): opening move hint, after-move aim
// hint, and the idle re-show. Browser-only. Usage: node scripts/shot-ftue-hints.mjs [outdir] [WxH]
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] || "/workspace/prp-ftue-hints-shots");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };
const sizeArg = process.argv[3] ? process.argv[3].match(/^(\d+)x(\d+)$/) : null;
if (process.argv[3] && !sizeArg) throw new Error("Expected size WxH");
const SIZES = sizeArg ? [[Number(sizeArg[1]), Number(sizeArg[2])]] : [[844, 390], [667, 375], [932, 430]];

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
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port;
await mkdir(outDir, { recursive: true });

async function bootFtueRaid(page, w, h) {
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  // Freeze the wall clock (the game clock derives from it) the moment the move hint first shows: it only lives
  // a couple of clock seconds, and a slow headless screenshot would otherwise catch it mid-fade.
  await page.evaluateOnNewDocument(() => {
    window.__realNow = Date.now;
    document.addEventListener("DOMContentLoaded", () => {
      const el = document.getElementById("ftue-hint-move");
      const obs = new MutationObserver(() => { if (el.classList.contains("show")) { const t = Date.now(); Date.now = () => t; obs.disconnect(); } });
      obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    });
  });
  const qs = new URLSearchParams({ seed: "ftue-hints-shot", ftue: "1", q: "high", debug: "1" });
  await page.goto(`${BASE}/nodspel/?${qs}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#tutorial-start", { visible: true, timeout: 25000 });
  await page.waitForFunction(() => !document.getElementById("boot-loader"), { timeout: 25000 });
  const box = await page.$eval("#tutorial-start", el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForFunction(() => document.getElementById("tutorial")?.hidden, { timeout: 8000 });
  await page.waitForFunction(() => !!window.__NR?.round?.(), { timeout: 30000 });

  await page.evaluate(() => { window.__NR.setRoomClearsEnabled(false); window.__NR.round().health = 100000; });
}

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
try {
  for (const [w, h] of SIZES) {
    const page = await browser.newPage();
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await bootFtueRaid(page, w, h);
    const shot = async name => {
      // headless Chrome throttles rAF between evaluates: let three frames render plus a short settle.
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
      await new Promise(r => setTimeout(r, 400));
      await page.screenshot({ path: `${outDir}/${name}-${w}x${h}.png` });
      console.log("shot", name, `${w}x${h}`);
    };
    // the move hint shows for a few game-clock seconds right after the tutorial tap: catch it as soon as it is visible
    await page.waitForFunction(() => { const e = document.getElementById("ftue-hint-move"); return e?.classList.contains("show") && Number(getComputedStyle(e).opacity) > 0.95; }, { timeout: 8000, polling: "raf" });
    await page.screenshot({ path: `${outDir}/01-opening-move-hint-${w}x${h}.png` });
    console.log("shot 01-opening-move-hint", `${w}x${h}`);
    await page.evaluate(() => { Date.now = window.__realNow; });
    // Cross the 3 m move threshold -- teleport is a plain position set, the same path real movement
    // takes through the per-frame hint tick.
    await page.evaluate(() => { const s = window.__NR.state(); window.__NR.teleport(s.level.start.x, s.level.start.z + 4); });
    await page.waitForFunction(() => document.getElementById("ftue-hint-aim")?.classList.contains("show"), { timeout: 8000 });
    await shot("02-after-move-aim-hint");
    // Let the aim hint auto-hide (its show window), then idle past the reshow gap.
    await page.waitForFunction(() => !document.getElementById("ftue-hint-aim")?.classList.contains("show"), { timeout: 8000 });
    await page.waitForFunction(() => document.getElementById("ftue-hint-aim")?.classList.contains("show"), { timeout: 15000 });
    await shot("03-idle-reshow");
    const paused = await page.evaluate(() => window.__NR.round().pauseAt);
    if (paused != null) throw new Error(`round unexpectedly paused at ${w}x${h}`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
if (errors.length) throw new Error(JSON.stringify(errors));
