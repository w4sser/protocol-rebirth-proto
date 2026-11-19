// Local smoke companion for the legacy /workspace/qa.sh smoke; no external tooling is modified.
// Usage: node smoke-playthrough.mjs [dir]
// Drives one full playthrough loop through the real UI/URLs and fails on any
// pageerror/console.error: splash -> progressed base -> deploy raid -> move+shoot -> extract -> EOR summary.
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {serveStatic, launchBrowser, settle} from '/workspace/prp-tools/lib/serve.mjs';
import {stockholmStamp} from '/workspace/prp-tools/lib/time.mjs';
import {PROGRESSED} from '/workspace/prp-tools/lib/progressed.mjs';

const dir = process.argv[2] || process.cwd();
const OUT_DIR = '/workspace/prp-progress/smoke';
await mkdir(OUT_DIR, {recursive: true});
const runStamp = stockholmStamp();

let failed = null;
const {base, close} = await serveStatic(dir);
const browser = await launchBrowser();

async function run() {
  const page = await browser.newPage();
  await page.setViewport({width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${String(e).slice(0,200)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0,200)}`); });

  let checked = 0;
  function assertClean(step) {
    const fresh = errors.slice(checked);
    checked = errors.length;
    if (fresh.length) throw new Error(`step "${step}": ${fresh.length} error(s): ${fresh.join(' | ')}`);
  }
  async function shot(step) {
    await page.screenshot({path: join(OUT_DIR, `${runStamp}_${step}.png`)});
  }
  async function step(name, fn) {
    console.log(`smoke: ${name}`);
    await fn();
    await shot(name);
    assertClean(name);
  }

  // 1. splash
  await step('splash', async () => {
    await page.goto(`${base}/index.html`, {waitUntil: 'load'});
    await page.waitForFunction(() => !document.getElementById('boot-loader'), {timeout: 20000}).catch(() => {});
    await page.waitForSelector('#splash', {visible: true, timeout: 8000});
  });

  // 2. progressed base
  await step('progressed-base', async () => {
    await page.evaluate(PROGRESSED);
    await page.waitForFunction(() => !document.getElementById('boot-loader'), {timeout: 20000}).catch(() => {});
    await page.waitForFunction(() => !document.getElementById('splash'), {timeout: 8000}).catch(() => {});
    await settle(400);
    const onBase = await page.evaluate(() => document.querySelector('.s-base') != null || document.getElementById('tabs') != null);
    if (!onBase) throw new Error('progressed-base: base shell did not render');
  });

  // 3. deploy raid via the real DEPLOY action (A.deployNodeRaid), real tutorial tap into nodspel
  await step('deploy-raid', async () => {
    await Promise.all([
      page.waitForNavigation({waitUntil: 'load'}),
      page.evaluate(() => {
        // force ?debug=1 onto the real deploy URL so window.__NR (used for extract below) exists
        window.PR_NAVIGATE = u => { const url = new URL(u, location.href); url.searchParams.set('debug', '1'); location.assign(url); };
        A.deployNodeRaid();
      }),
    ]);
    await page.waitForFunction(() => !document.getElementById('boot-loader'), {timeout: 20000}).catch(() => {});
    // Base/FTUE handoff may already have started the raid; never wait for a hidden start button.
    await page.waitForFunction(()=>window.__NR?.round?.()||document.querySelector('#tutorial-start')?.getClientRects().length,{timeout:30000});
    if(await page.evaluate(()=>!!document.querySelector('#tutorial-start')?.getClientRects().length))await page.click('#tutorial-start');
    await page.waitForFunction(()=>window.__NR?.round?.(),{timeout:30000});
    await page.evaluate(() => window.__NR.setRoomClearsEnabled(false));
    await settle(1200);
  });

  // 4. move (WASD) and shoot (Space) for ~4s via real keyboard input
  await step('raid-move-shoot', async () => {
    await page.keyboard.down('KeyD');
    const until = Date.now() + 4000;
    while (Date.now() < until) {
      await page.keyboard.down('Space');
      await settle(60);
      await page.keyboard.up('Space');
      await settle(340);
    }
    await page.keyboard.up('KeyD');
    await settle(200);
  });

  // 5. extract (debug hook) -> auto-navigates back to base -> EOR summary overlay
  await step('extract', async () => {
    await Promise.all([
      page.waitForNavigation({waitUntil: 'load'}),
      page.evaluate(() => window.__NR.extractDemo()),
    ]);
    await page.waitForFunction(() => !document.getElementById('boot-loader'), {timeout: 20000}).catch(() => {});
    await page.evaluate(() => document.getElementById('splash')?.click());
    await page.waitForSelector('#overlay.raid-summary-ov .raid-summary', {visible: true, timeout: 20000});
    await settle(500);
  });

  await page.close();
}

try {
  await run();
  console.log(`SMOKE PASS (screenshots in ${OUT_DIR})`);
} catch (e) {
  failed = e;
  console.error(`SMOKE FAIL: ${e.message}`);
} finally {
  await browser.close();
  await close();
}
process.exit(failed ? 1 : 0);
