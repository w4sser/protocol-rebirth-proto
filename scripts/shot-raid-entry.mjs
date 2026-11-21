// Screenshots of NODE / DEPTH raid entry after a real Start tap (v2.28.60).
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve("/workspace/prp-raid-start-crash-v22860-shots");
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

async function shot(name, w, h, { depth, raids }) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  const qs = new URLSearchParams({
    seed: depth ? "entry-depth" : "entry-node",
    raidId: "11111111111111111111111111111111",
    return: "../",
    raids: String(raids),
    area: "bunker",
    q: "high",
  });
  if (depth) qs.set("depth", "1");
  await page.goto(`${BASE}/nodspel/?${qs}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#tutorial-start", { visible: true, timeout: 25000 });
  await page.waitForFunction(() => !document.getElementById("boot-loader"), { timeout: 25000 });
  const before = `${outDir}/${name}-before-${w}x${h}.png`;
  await page.screenshot({ path: before, type: "png" });
  const box = await page.$eval("#tutorial-start", el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForFunction(() => document.getElementById("tutorial")?.hidden, { timeout: 8000 });
  await new Promise(r => setTimeout(r, 900));
  const fatal = await page.evaluate(() => !!(document.getElementById("fatal") && document.getElementById("fatal").hidden === false));
  if (fatal) throw new Error(name + " " + w + "x" + h + " showed the fatal overlay");
  const after = `${outDir}/${name}-after-${w}x${h}.png`;
  await page.screenshot({ path: after, type: "png" });
  await browser.close();
  console.log("ok", before, after);
}

for (const [w, h] of SIZES) {
  await shot("node-fresh", w, h, { depth: false, raids: 0 });
  await shot("node-progressed", w, h, { depth: false, raids: 5 });
  await shot("depth-fresh", w, h, { depth: true, raids: 0 });
  await shot("depth-progressed", w, h, { depth: true, raids: 5 });
}
server.close();
console.log("shots in", outDir);
