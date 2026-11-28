// PR2 (HUD diet + BIT top-right, v2.28.79): screenshot a depth raid at start and with a forced
// BIT line, so the top-right card and the decluttered permanent HUD can be eyeballed.
// Usage: node scripts/shot-hud-bit.mjs <outdir> [WxH]   (defaults to 844x390)
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] || "/workspace/prp-hud-bit-shots");
const size = (process.argv[3] || "844x390").match(/^(\d+)x(\d+)$/);
if (!size) throw new Error("Expected size WxH");
const [w, h] = [Number(size[1]), Number(size[2])];
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
// iPhone-landscape-class notch insets, same convention as the other shot/layout scripts.
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };

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

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  // The depth intro/hack-terminal BIT lines fire automatically (once per profile) and would race
  // our forced line for window.PRBitCard's single "current" slot. Mark both as already seen so the
  // "start" shot is clean and the forced line in shot 02 is the only one that ever shows.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("pr_meta_save", JSON.stringify({ bitCardsSeen: { depth_walk_extract_intro: true, depth_loud_terminal_intro: true } }));
  });
  const qs = new URLSearchParams({ seed: "hud-bit-shot", area: "bunker", q: "high", depth: "1", debug: "1" });
  await page.goto(`${BASE}/nodspel/?${qs}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#tutorial-start", { visible: true, timeout: 25000 });
  await page.waitForFunction(() => !document.getElementById("boot-loader"), { timeout: 25000 });
  await page.click("#tutorial-start");
  await page.waitForFunction(() => window.__NR?.round?.()?.depth, { timeout: 30000 });
  await page.evaluate(() => {
    window.__NR.setRoomClearsEnabled?.(false);
    window.__NR.depthDismissIntro?.();
    const r = window.__NR.round();
    r.health = 100000;
    for (const e of r.level.enemies ?? []) { e.sleeping = true; e.aggro = false; }
    // Depth terminals queue their own hint line automatically; dismiss it so the "start" shot
    // shows the decluttered HUD with no BIT line, and the forced line below is the one captured.
    window.PRBitCard?.dismiss?.();
  });
  const shot = async name => {
    // headless Chrome throttles rAF between evaluates: let a few frames render before shooting.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${outDir}/${name}-${w}x${h}.png` });
    console.log("shot", name, `${w}x${h}`);
  };
  await shot("01-depth-raid-start");
  await page.evaluate(() => { window.PRBitCard?.show?.({ id: "hud-bit-shot", text: "Area ahead. Stay sharp." }); });
  await shot("02-bit-line-top-right");
  await page.close();
} finally { await browser.close(); server.close(); }
if (errors.length) throw new Error(JSON.stringify(errors));
console.log(`shot-hud-bit: ok (screenshots in ${outDir})`);
