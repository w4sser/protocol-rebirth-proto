// Screenshots of Depth Raid area-3 extract (v2.28.61). Browser-only; not in the npm test chain.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve("/workspace/prp-depth-final-v22861-shots");
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
    seed: "progressed-final",
    raidId: "11111111111111111111111111111111",
    return: "../",
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

async function walkToArea3Extract(page, { standFar }) {
  await page.evaluate(() => window.__NR.depthDismissIntro?.());
  for (let i = 0; i < 2; i++) {
    const cleared = await page.evaluate(() => window.__NR.depthClearArea());
    if (cleared?.event !== "choice-opened" && cleared?.phase !== "choice") throw new Error("area " + (i + 1) + " did not open choice: " + JSON.stringify(cleared));
    await page.evaluate(() => window.__NR.depthGoDeeper());
    const entered = await page.evaluate(() => window.__NR.depthEnterNext());
    if (entered?.event !== "area-entered") throw new Error("did not enter area " + (i + 2) + ": " + JSON.stringify(entered));
    await page.evaluate(() => window.__NR.depthDismissIntro?.());
  }
  const zone = await page.evaluate(() => window.__NR.depthState()?.zone);
  if (zone !== 3) throw new Error("expected area 3, got " + zone);
  const cleared = await page.evaluate(() => window.__NR.depthClearArea());
  if (cleared?.phase !== "choice") throw new Error("area 3 did not open extract choice: " + JSON.stringify(cleared));
  await page.evaluate(() => window.__NR.depthChooseExtract());
  await page.evaluate(() => window.__NR.depthDismissIntro?.());
  const open = await page.evaluate(() => {
    const r = window.__NR.round();
    const st = window.__NR.depthState();
    const exit = r.level.exit;
    const a3 = r.level.depthExits[2];
    return { extractOpen: st.extractOpen, zone: st.zone, exit, a3, match: Math.hypot(exit.x - a3.x, exit.z - a3.z) < 0.01 };
  });
  if (!open.extractOpen || !open.match) throw new Error("extract did not open at area-3 hatch: " + JSON.stringify(open));
  await page.evaluate((far) => {
    const exit = window.__NR.round().level.exit;
    const dz = far ? 7 : 2.8;
    window.__NR.teleport(exit.x, exit.z + dz);
  }, standFar);
  await new Promise(r => setTimeout(r, 700));
}

async function shot(name, w, h, standFar) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await bootToRaid(page, w, h);
  await walkToArea3Extract(page, { standFar });
  const fatal = await page.evaluate(() => !!(document.getElementById("fatal") && document.getElementById("fatal").hidden === false));
  if (fatal) throw new Error(name + " " + w + "x" + h + " showed the fatal overlay");
  const path = `${outDir}/${name}-${w}x${h}.png`;
  await page.screenshot({ path, type: "png" });
  await browser.close();
  console.log("ok", path);
}

for (const [w, h] of SIZES) {
  await shot("a3-extract-open", w, h, false);
  await shot("a3-extract-guide", w, h, true);
}
server.close();
console.log("shots in", outDir);
