// Depth world choices: beam, terminal, hold ring and opened door. Browser-only.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] || "/workspace/prp-world-choice-v22878-shots");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };
const size = (process.argv[3] || "844x390").match(/^(\d+)x(\d+)$/);
if (!size) throw new Error("Expected size WxH");
const SIZES = [[Number(size[1]), Number(size[2])]];

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
  await page.waitForFunction(() => window.__NR?.round?.()?.depth, { timeout: 30000 }).catch(async error => {
    console.error('raid boot failed', await page.evaluate(() => ({url:location.href,hasNR:!!window.__NR,
      depth:window.__NR?.round?.()?.depth,ftue:window.__NR?.round?.()?.ftue,
      fatal:document.getElementById('fatal')?.textContent})));
    throw error;
  });
  await page.evaluate(() => { window.__NR.setMoodAutoDowngradeEnabled?.(false); window.__NR.depthDismissIntro?.(); });
}

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
try {
  for (const [w, h] of SIZES) {
    const page = await browser.newPage();
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await bootToRaid(page, w, h);
    await page.evaluate(() => {
      const r = window.__NR.round();
      r.health = 100000;
      // Deterministic screenshot clock: render freely, advance hold via the real debug state machine.
      const frozen = Date.now(); Date.now = () => frozen;
      window.PRBitCard.dismiss();
      window.PRBitCard.show = () => {};
      // Keep the scene stable without clearing the wing or pausing its clock.
      for (const e of r.level.enemies) { e.sleeping = true; e.aggro = false; }
    });
    const shot = async name => {
      // headless Chrome throttles rAF between evaluates: let three frames render so labels reflect the latest state
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
      await page.screenshot({ path: `${outDir}/${name}-${w}x${h}.png` });
      console.log("shot", name, `${w}x${h}`);
    };
    await new Promise(r => setTimeout(r, 600));
    await shot("01-area-start");
    await page.evaluate(() => {
      const n = window.__NR.round().level.depthTerminals[0];
      window.__NR.teleport(n.x, n.z + 3);
    });
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => window.__NR.depthDismissIntro());
    await shot("02-terminal");
    const hold = await page.evaluate(() => window.__NR.depthHackHold(2000));
    if (hold.progress !== .5) throw new Error('Expected mid-hack hold: '+JSON.stringify(hold));
    await new Promise(r => setTimeout(r, 500));
    await page.waitForFunction(() => [...document.querySelectorAll('.objective-node')].some(el => !el.hidden && el.textContent.includes('HACK')), { polling: 'raf', timeout: 10000 });
    await new Promise(r => setTimeout(r, 400));
    await shot("03-mid-hack");
    console.log('terminal HUD', await page.evaluate(() => {
      const n=window.__NR.round().level.depthTerminals[0];
      return {projected:window.__NR.projectAt(n.x,DATA.raidDepth.hack.labelHeight,n.z),
        labels:[...document.querySelectorAll('.objective-node')].map(el=>({text:el.textContent,hidden:el.hidden,mode:el.dataset.mode,left:el.style.left,top:el.style.top}))};
    }));
    const done = await page.evaluate(() => window.__NR.depthHackHold(2000));
    if (done.event !== 'hack-done') throw new Error('Expected completed hack: '+JSON.stringify(done));
    await new Promise(r => setTimeout(r, 500));
    await shot("04-door-open");
    const state = await page.evaluate(() => ({paused: window.__NR.round().pauseAt, depth: window.__NR.depthState()}));
    if (state.paused != null) throw new Error("Depth unexpectedly paused");
    await page.close();
  }
} finally { await browser.close(); server.close(); }
if (errors.length) throw new Error(JSON.stringify(errors));
