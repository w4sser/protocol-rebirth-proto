// Screenshots of Depth Raid extract-on-entry (v2.28.63). Browser-only; not in the npm test chain.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve("/workspace/prp-depth-extract-v22863-shots");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };
const SIZES = [[844, 390], [667, 375], [932, 430]];

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

async function bootToRaid(page, w, h) {
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  const qs = new URLSearchParams({
    seed: "gear-on-pad",
    raidId: "11111111111111111111111111111111",
    raids: "5",
    area: "bunker",
    q: "high",
    depth: "1",
    debug: "1",
  });
  await page.goto(`${BASE}/nodspel/?${qs}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#tutorial-start", { visible: true, timeout: 25000 });
  await page.waitForFunction(() => !document.getElementById("boot-loader"), { timeout: 25000 });
  const box = await page.$eval("#tutorial-start", el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForFunction(() => document.getElementById("tutorial")?.hidden, { timeout: 8000 });
  await page.waitForFunction(() => window.__NR?.round?.()?.depth, { timeout: 10000 });
  await page.evaluate(() => { window.__NR.setMoodAutoDowngradeEnabled?.(false); window.__NR.depthDismissIntro?.(); });
}

async function walkToArea2ExtractOpen(page) {
  await page.evaluate(() => window.__NR.depthDismissIntro?.());
  const cleared = await page.evaluate(() => window.__NR.depthClearArea());
  if (cleared?.phase !== "choice") throw new Error("area 1 did not open choice: " + JSON.stringify(cleared));
  await page.evaluate(() => window.__NR.depthGoDeeper());
  const entered = await page.evaluate(() => window.__NR.depthEnterNext());
  if (entered?.event !== "area-entered") throw new Error("did not enter area 2: " + JSON.stringify(entered));
  await page.evaluate(() => window.__NR.depthDismissIntro?.());
  const cleared2 = await page.evaluate(() => window.__NR.depthClearArea());
  if (cleared2?.phase !== "choice") throw new Error("area 2 did not open choice: " + JSON.stringify(cleared2));
  // beam must stay off until EXTRACT is chosen
  const before = await page.evaluate(() => {
    const r = window.__NR.round();
    return { extractOpen: !!window.__NR.depthState()?.extractOpen, exit: r.level.exit, a2: r.level.depthExits[1] };
  });
  if (before.extractOpen) throw new Error("beam was already open before EXTRACT: " + JSON.stringify(before));
  await page.evaluate(() => window.__NR.depthChooseExtract());
  await page.evaluate(() => window.__NR.depthDismissIntro?.());
  const open = await page.evaluate(() => {
    const r = window.__NR.round();
    const st = window.__NR.depthState();
    const exit = r.level.exit;
    const a2 = r.level.depthExits[1];
    return { extractOpen: st.extractOpen, zone: st.zone, r: exit.r, match: Math.hypot(exit.x - a2.x, exit.z - a2.z) < 0.01 };
  });
  if (!open.extractOpen || !open.match) throw new Error("extract did not open at area-2 hatch: " + JSON.stringify(open));
  return open;
}

async function shot(name, w, h, kind) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await bootToRaid(page, w, h);
  const open = await walkToArea2ExtractOpen(page);
  if (kind === "approach") {
    await page.evaluate(() => {
      const exit = window.__NR.round().level.exit;
      window.__NR.teleport(exit.x, exit.z + 6);
      // Keep ROOM CLEAR up with the extract toast so the no-overlap rule is actually on screen.
      window.__NR.areaNotice?.("ROOM CLEAR", 8000);
    });
    await new Promise(r => setTimeout(r, 700));
    const layout = await page.evaluate(() => {
      const notices = [...document.querySelectorAll(".area-notice")].filter(el => el.getClientRects().length);
      const rects = notices.map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, className: el.className, text: el.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      const collisions = [];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i], rects[j])) collisions.push([rects[i], rects[j]]);
      const extract = rects.find(r => r.id === "extract-toast");
      const roomClear = rects.find(r => /ROOM CLEAR/.test(r.text));
      return { rects, collisions, extract, roomClear };
    });
    if (!layout.extract) throw new Error(name + " " + w + "x" + h + " missing EXTRACT OPEN toast: " + JSON.stringify(layout));
    if (!layout.roomClear) throw new Error(name + " " + w + "x" + h + " missing ROOM CLEAR for overlap check: " + JSON.stringify(layout));
    if (layout.collisions.length) throw new Error(name + " " + w + "x" + h + " toasts overlapped: " + JSON.stringify(layout.collisions));
    if (layout.extract.h > 24) throw new Error(name + " " + w + "x" + h + " EXTRACT OPEN wrapped off one line: " + JSON.stringify(layout.extract));
  } else if (kind === "edge-result") {
    await page.evaluate(() => {
      const exit = window.__NR.round().level.exit;
      // 1.2 m off centre: inside the visible pad, outside the old r=1 trigger.
      window.__NR.teleport(exit.x + 1.2, exit.z);
    });
    await page.waitForFunction(() => {
      const el = document.getElementById("round-over");
      return !!(el && el.hidden === false);
    }, { timeout: 10000 }).catch(async (err) => {
      const info = await page.evaluate(() => ({
        url: location.href,
        hasNR: !!window.__NR,
        over: window.__NR?.round?.()?.over,
        reason: window.__NR?.round?.()?.reason,
        hidden: document.getElementById("round-over")?.hidden,
      }));
      console.error("result wait failed", info);
      throw err;
    });
    await new Promise(r => setTimeout(r, 400));
  }
  const fatal = await page.evaluate(() => !!(document.getElementById("fatal") && document.getElementById("fatal").hidden === false));
  if (fatal) throw new Error(name + " " + w + "x" + h + " showed the fatal overlay");
  const path = `${outDir}/${name}-${w}x${h}.png`;
  await page.screenshot({ path, type: "png" });
  await browser.close();
  console.log("ok", path, open);
}

for (const [w, h] of SIZES) {
  await shot("a2-extract-open-approach", w, h, "approach");
  await shot("a2-extract-edge-result", w, h, "edge-result");
}
server.close();
console.log("shots in", outDir);
