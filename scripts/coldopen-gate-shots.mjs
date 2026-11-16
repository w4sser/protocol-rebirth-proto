// PRB-161 follow-up: screenshots proving the raid-return cold open (no splash, no gesture at all
// on this document) shows the "TAP TO WAKE BIT" prompt (.vo-wait-tap) with the lines/button still
// held and NO voice played yet -- and that the prompt doesn't overlap BIT or the version label.
// Tracked here so the harness is reviewable; run manually (NODE_PATH=/workspace/pptr/node_modules
// CHROME_PATH=/usr/bin/google-chrome node scripts/coldopen-gate-shots.mjs) -- not run as part of
// npm test/bug-lint. See /workspace/prp-coldopen-vo-v22840-shots/shot.mjs for the sibling harness
// that covers the splash-shown cold open (PRB-161's first cause); this one is the raid-return path.
import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, extname, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve("/workspace/prp-coldopen-vo-v22840-shots");
const require = createRequire("/workspace/pptr/package.json");
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("puppeteer-core"); }
const launchOpts = {
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  // Deliberately NO --autoplay-policy=no-user-gesture-required: the AudioContext must start (and
  // stay) suspended, with no gesture on this document at all -- the exact condition the gate
  // exists for. If a future Chrome build ever grants autoplay by default anyway, stubbing
  // PR_AUDIO.context.state (see forceSuspended() below) is the fallback.
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};
const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const INSETS = { left: 47, right: 47, top: 0, bottom: 21 };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const target = resolve(root, "." + (p.endsWith("/") ? p + "index.html" : p));
  if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const ext = extname(target);
    let body = await readFile(target);
    if (ext === ".css" || ext === ".html") {
      body = String(body).replace(/env\(\s*safe-area-inset-(left|right|top|bottom)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g, (_, s) => INSETS[s] + "px");
    }
    res.writeHead(200, { "Content-Type": types[ext] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end("Not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const BASE = "http://127.0.0.1:" + port;
console.log("serving", port);
await mkdir(outDir, { recursive: true });

// Mirrors test/coldopen-vo-sync.test.js's bootAppReturningFromRaid(): an old-shaped save
// (load()'s migration chain only recognizes st.v 6..SAVE_VERSION) falls through to the same
// freshState() a brand-new profile gets (introSeen:false), and seeding pr_raid_result_v1 makes
// ingestPendingCoreResult() report coreIngest.ok -- the exact condition that makes setupSplash()
// skip the splash (and its own PR_AUDIO.preload() call) outright.
const SEED_SAVE = { v: 1 };
const SEED_RAID_RESULT = { schema: "protocol-rebirth/raid-result", version: 1, raidId: "shots-ftue-raid-1", outcome: "extract", extracted: [], lost: [], ftue: true };

async function withPage(w, h, fn) {
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.on("pageerror", e => console.log("pageerror", String(e).slice(0, 240)));
  page.on("console", msg => { if (msg.type() === "error") console.log("console error", msg.text().slice(0, 240)); });
  try { return await fn(page); } finally { await browser.close(); }
}

async function gatedColdOpenPage(page) {
  await page.evaluateOnNewDocument((save, raidResult) => {
    localStorage.setItem("pr_meta_save", JSON.stringify(save));
    localStorage.setItem("pr_raid_result_v1", JSON.stringify(raidResult));
  }, SEED_SAVE, SEED_RAID_RESULT);
  await page.goto(BASE + "/index.html", { waitUntil: "load" });
  // No #splash to wait for on this path -- straight onto .intro. Belt-and-suspenders fallback if
  // Chrome ever grants autoplay here anyway: force the context back to 'suspended' the instant it
  // exists, before armVoiceGate() reads it (evaluateOnNewDocument runs before any app script).
  await page.evaluateOnNewDocument(() => {
    const poll = setInterval(() => {
      if (window.PR_AUDIO?.context) { try { Object.defineProperty(window.PR_AUDIO.context, "state", { get: () => "suspended" }); } catch (_) {} clearInterval(poll); }
    }, 1);
  });
  await page.waitForSelector(".intro", { timeout: 20000 });
  await page.waitForSelector(".intro.vo-wait-tap", { timeout: 20000 });
}

const results = [];

for (const [w, h] of [[844, 390], [667, 375], [932, 430]]) {
  const tag = `${w}x${h}`;
  await withPage(w, h, async page => {
    await gatedColdOpenPage(page);

    const info = await page.evaluate(() => {
      const intro = document.querySelector(".intro");
      const prompt = document.querySelector(".intro-wake");
      const bit = document.querySelector(".intro-bit");
      const version = document.getElementById("app-version");
      const lines = [...document.querySelectorAll(".intro-lines p")];
      const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const promptRect = rect(prompt), bitRect = rect(bit);
      return {
        gated: intro.classList.contains("vo-wait") && intro.classList.contains("vo-wait-tap"),
        promptVisible: getComputedStyle(prompt).opacity !== "0",
        promptText: prompt.textContent.trim(),
        linesVisible: lines.some(p => Number(getComputedStyle(p).opacity) > 0.01),
        promptOverlapsBit: overlaps(promptRect, bitRect),
        promptOverlapsVersion: version ? overlaps(promptRect, rect(version)) : false,
        contextState: window.PR_AUDIO?.context?.state ?? "none",
      };
    });
    console.log("coldopen-gate", tag, JSON.stringify(info));
    if (!info.gated) results.push(`coldopen-gate ${tag}: .intro is not gated (.vo-wait/.vo-wait-tap missing)`);
    if (!info.promptVisible) results.push(`coldopen-gate ${tag}: "TAP TO WAKE BIT" prompt not visible`);
    if (info.linesVisible) results.push(`coldopen-gate ${tag}: a line is visible before the gate tap`);
    if (info.promptOverlapsBit) results.push(`coldopen-gate ${tag}: prompt overlaps BIT`);
    if (info.promptOverlapsVersion) results.push(`coldopen-gate ${tag}: prompt overlaps the version label`);
    if (info.contextState === "running") results.push(`coldopen-gate ${tag}: AudioContext is already running -- not exercising the gate`);
    await page.screenshot({ path: `${outDir}/coldopen-gate-${tag}.png` });
  });
}

server.close();
await writeFile(outDir + "/coldopen-gate-results.json", JSON.stringify(results, null, 2));
if (results.length) { console.error("ISSUES:\n" + results.join("\n")); process.exitCode = 1; }
else console.log("coldopen-gate shots: ok ->", outDir);
