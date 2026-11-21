// Raid entry must not show the fatal "raid view stopped" overlay (v2.28.60).
// Covers NODE and DEPTH, a fresh profile (0 raids, no pads) and a progressed
// save (5 raids, pads + shelves), with a real touch tap on Start.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };

function serve(){
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
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

async function enterRaid(base, { depth = false, raids = 0, depthSave = false } = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 1 });
  const crash = [];
  page.on("pageerror", e => crash.push(String(e)));
  await page.evaluateOnNewDocument(s => {
    window.__CRASH = [];
    window.addEventListener("error", e => window.__CRASH.push(e.message || String(e.error || e)));
    if (s.depthSave) try { localStorage.setItem("pr.depthRaid", "1"); } catch {}
  }, { depthSave });
  const qs = new URLSearchParams({
    seed: depth ? "entry-depth" : "entry-node",
    raidId: "11111111111111111111111111111111",
    return: "../",
    raids: String(raids),
    area: "bunker",
    q: "high",
  });
  if (depth) qs.set("depth", "1");
  await page.goto(`${base}/nodspel/?${qs}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#tutorial-start", { visible: true, timeout: 25000 });
  await page.waitForFunction(() => !document.getElementById("boot-loader"), { timeout: 25000 });
  const before = await page.evaluate(() => !!(document.getElementById("fatal") && document.getElementById("fatal").hidden === false));
  const box = await page.$eval("#tutorial-start", el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForFunction(() => document.getElementById("tutorial")?.hidden, { timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  const state = await page.evaluate(() => {
    const f = document.getElementById("fatal");
    return {
      fatal: !!(f && f.hidden === false),
      fatalText: f && f.hidden === false ? f.innerText.slice(0, 300) : null,
      tutorialHidden: !!document.getElementById("tutorial")?.hidden,
      eyebrow: document.querySelector("#tutorial .eyebrow")?.textContent,
      crash: window.__CRASH || [],
    };
  });
  await browser.close();
  return { before, ...state, pageErrors: crash };
}

test("NODE and DEPTH raid entry survive a real Start tap on a fresh and a progressed save", async (t) => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(r => server.close(r)));
  const cases = [
    { name: "fresh NODE", depth: false, raids: 0, depthSave: false, eyebrow: "NODE RAID" },
    { name: "fresh DEPTH", depth: true, raids: 0, depthSave: false, eyebrow: "DEPTH RAID" },
    { name: "progressed NODE (depth save still set)", depth: false, raids: 5, depthSave: true, eyebrow: "NODE RAID" },
    { name: "progressed DEPTH", depth: true, raids: 5, depthSave: true, eyebrow: "DEPTH RAID" },
  ];
  for (const c of cases) {
    const s = await enterRaid(base, c);
    assert.equal(s.before, false, `${c.name}: fatal already up before Start`);
    assert.equal(s.fatal, false, `${c.name}: ${s.fatalText || "fatal overlay after Start"}`);
    assert.equal(s.tutorialHidden, true, `${c.name}: Start tap did not dismiss the tutorial`);
    assert.equal(s.eyebrow, c.eyebrow, `${c.name}: unexpected tutorial eyebrow`);
    assert.deepEqual(s.crash, [], `${c.name}: window errors ${s.crash}`);
    assert.deepEqual(s.pageErrors, [], `${c.name}: pageerrors ${s.pageErrors}`);
  }
});
