// Smoke the deployed PR #247 Pages preview, not a local or main-branch copy.
// Run from the repository root after: npm i --no-save puppeteer
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const publicBase = process.env.PUBLIC_PAGES_URL;
const expectedSha = process.env.EXPECTED_SHA;
assert.ok(publicBase && expectedSha, 'PUBLIC_PAGES_URL and EXPECTED_SHA required');
const base = new URL('previews/archipelago-v2/', publicBase.endsWith('/') ? publicBase : publicBase + '/');
const want = (file) => new URL(file, base).href;

async function fetchText(file) {
  const response = await fetch(want(file) + (file.includes('?') ? '&' : '?') + 'check=' + encodeURIComponent(expectedSha), {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, file + ' must return HTTP 200');
  return response.text();
}

let version;
for (let attempt = 1; attempt <= 12; ++attempt) {
  try {
    version = JSON.parse(await fetchText('preview-version.json'));
    if (version.commit === expectedSha) break;
  } catch (error) {
    if (attempt === 12) throw error;
  }
  if (attempt === 12) throw new Error('Deployed preview is stale: expected ' + expectedSha + ', got ' + version?.commit);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.equal(version.pr, 247);
assert.equal(version.branch, 'feat/archipelago-visual-target-v2');
assert.equal(version.feature, 'archVisual=v2');

const entryHtml = await fetchText('nodspel/index.html');
const playable = await fetchText('nodspel/archipelago-playable.mjs');
const granite = await fetchText('nodspel/archipelago-visual-v2.mjs');
const runtime = await fetchText('nodspel/archipelago.js');
const game = await fetchText('nodspel/game.mjs');
assert.match(entryHtml, /organic-v2/);
assert.match(entryHtml, /preview-storage-shim\.js/);
assert.match(playable, /registerWalkableCoast/);
assert.match(granite, /addArchipelagoGraniteV2/);
assert.match(runtime, /archVisual/);
assert.match(game, /ARCH_VISUAL_V2/);
console.log('PUBLIC V2 ASSETS OK:', base.href, 'source', expectedSha);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  for (const quality of ['low', 'high']) {
    const page = await browser.newPage();
    const errors = [];
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => errors.push('Uncaught: ' + String(error).slice(0, 350)));
    page.on('response', (response) => {
      if (response.status() >= 400 && /\.(?:js|mjs)(?:\?|$)/.test(response.url()) && response.url().startsWith(base.href))
        errors.push('JS HTTP ' + response.status() + ': ' + response.url());
    });
    const url = want('nodspel/?area=archipelago&archVisual=v2&archTarget=1&seed=archipelago-v2-target&q=' + quality);
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal(response.status(), 200, quality + ' route should return HTTP 200');
      await page.waitForFunction(() => !document.querySelector('#boot-loader'), { timeout: 90000 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const state = await page.evaluate(() => ({
        loadingHidden: document.getElementById('loading')?.hidden,
        loadingText: document.getElementById('loading')?.textContent?.trim(),
        canvasReady: [...document.querySelectorAll('canvas')].some((canvas) => canvas.width > 0 && canvas.height > 0),
        search: location.search,
      }));
      assert.equal(state.loadingHidden, true, quality + ' startup error: ' + state.loadingText);
      assert.ok(state.canvasReady, quality + ' did not create a canvas');
      assert.ok(state.search.includes('archVisual=v2'), 'wrong preview flag');
      assert.deepEqual(errors, [], quality + ' browser errors');
      console.log('PUBLIC IPHONE-SIZED BROWSER BOOT OK', quality, url);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
