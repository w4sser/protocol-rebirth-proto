// Screenshots of Depth Raid push-without-clear, widened corridors, and cover (v2.28.64).
// Browser-only; not in the npm test chain.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve("/workspace/prp-depth-push-v22864-shots");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };
const SIZES = [[844, 390], [667, 375], [932, 430]];
const SEED = "probe-seed";

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

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function bootToRaid(page, w, h) {
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  const qs = new URLSearchParams({
    seed: SEED,
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
  await page.evaluate(() => {
    window.__NR.setMoodAutoDowngradeEnabled?.(false);
    window.__NR.depthDismissIntro?.();
    const r = window.__NR.round();
    for (const e of r.level.enemies ?? []) { e.aggro = false; e.sleeping = true; e.speed = 0; }
  });
}

async function setup(page, kind) {
  await page.evaluate((kind) => {
    window.__NR.depthDismissIntro?.();
    const r = window.__NR.round();
    for (const e of r.level.enemies ?? []) { e.aggro = false; e.sleeping = true; e.speed = 0; }
    const door1 = (r.level.doors ?? []).find(d => d.id === "depth-door-1");
    const door2 = (r.level.doors ?? []).find(d => d.id === "depth-door-2");
    const link = (r.level.corridors ?? []).find(c => c.depthLink && c.doorId === "depth-door-1");
    const a2 = (r.level.rooms ?? []).find(rm => rm.depthArea === 2 && (rm.enemies || true));
    const coverRoom = (area) => {
      const rooms = (r.level.rooms ?? []).filter(rm => rm.depthArea === area);
      const boxes = r.level.boxes ?? [];
      let best = rooms[0], bestN = -1;
      for (const rm of rooms) {
        const n = boxes.filter(b => b.depthCover && Math.abs(b.x - rm.x) <= rm.w / 2 && Math.abs(b.z - rm.z) <= rm.d / 2).length;
        if (n > bestN) { best = rm; bestN = n; }
      }
      return best;
    };
    if (kind === "push-prompt") {
      if (!door1) throw new Error("no depth-door-1");
      window.__NR.teleport(door1.x, door1.z + 1.15);
      window.__NR.depthForcePushPrompt(true);
    } else if (kind === "corridor") {
      const c = link ?? (r.level.corridors ?? []).find(x => !x.depthLink);
      if (!c) throw new Error("no corridor");
      window.__NR.teleport(c.x, c.z);
    } else if (kind === "cover-a2" || kind === "cover-a3") {
      const area = kind === "cover-a2" ? 2 : 3;
      const rm = coverRoom(area);
      if (!rm) throw new Error("no room in area " + area);
      // Stand at the incoming (north or east) edge looking into the room.
      const start = (r.level.depthStarts ?? []).find(s => s.depthArea === area);
      const incoming = area === 2 ? door1 : door2;
      let x = rm.x, z = rm.z + rm.d / 2 - 1.4;
      if (incoming) {
        const dx = incoming.x - rm.x, dz = incoming.z - rm.z;
        if (Math.abs(dx) > Math.abs(dz)) {
          x = rm.x + Math.sign(dx) * (rm.w / 2 - 1.4);
          z = rm.z;
        } else {
          x = rm.x;
          z = rm.z + Math.sign(dz || 1) * (rm.d / 2 - 1.4);
        }
      } else if (start) {
        x = Math.max(rm.x - rm.w / 2 + 1.4, Math.min(rm.x + rm.w / 2 - 1.4, start.x));
        z = Math.max(rm.z - rm.d / 2 + 1.4, Math.min(rm.z + rm.d / 2 - 1.4, start.z));
      }
      window.__NR.teleport(x, z);
    }
    return {
      kind,
      pos: window.__NR.state().position,
      prompt: !document.getElementById("depth-push")?.hidden,
      copy: document.getElementById("depth-push-copy")?.textContent,
      zone: r.depth?.zone,
    };
  }, kind);
  await sleep(700);
}

async function shot(kind, w, h) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", err => console.error("pageerror", err.message));
  await bootToRaid(page, w, h);
  await setup(page, kind);
  if (kind === "push-prompt") {
    const ui = await page.evaluate(() => {
      const el = document.getElementById("depth-push");
      const r = el?.getBoundingClientRect();
      const sticks = [...document.querySelectorAll(".stick, #move-stick, #aim-stick, #look-stick")].map(s => s.getBoundingClientRect().toJSON());
      return { hidden: !!el?.hidden, text: document.getElementById("depth-push-copy")?.textContent, rect: r && { x: r.x, y: r.y, w: r.width, h: r.height }, sticks };
    });
    if (ui.hidden) throw new Error(`push prompt hidden at ${w}x${h}: ${JSON.stringify(ui)}`);
    if (!/GO DEEPER/i.test(ui.text || "")) throw new Error(`unexpected prompt copy: ${ui.text}`);
  }
  const name = `${kind}-${w}x${h}.png`;
  const path = resolve(outDir, name);
  await page.screenshot({ path, type: "png" });
  await browser.close();
  console.log("wrote", path);
  return path;
}

const kinds = ["push-prompt", "corridor", "cover-a2", "cover-a3"];
const written = [];
for (const kind of kinds) {
  for (const [w, h] of SIZES) {
    written.push(await shot(kind, w, h));
  }
}
server.close();
console.log("shots", written.length);
