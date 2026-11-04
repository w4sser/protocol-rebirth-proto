// Official Khronos glTF 2.0 validation for the Ground Pass v2 asset set.
// Run: npm install --no-save gltf-validator@2.0.0-dev.3.10
//      node scripts/validate-terrain-glbs.mjs
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const validator = require('gltf-validator');
const dir = fileURLToPath(new URL('../assets/env/terrain/', import.meta.url));
const outDir = fileURLToPath(new URL('../verify-out/ground-v2/', import.meta.url));
const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
const actual = (await readdir(dir)).filter(f => f.endsWith('.glb')).sort();
const listed = (manifest.assets || []).map(a => a.file).filter(f => f.endsWith('.glb')).sort();

if (actual.length !== 40 || listed.length !== 40 || actual.some((f, i) => f !== listed[i])) {
  console.error('Ground asset list mismatch. Expected exactly 40 GLBs, all listed in manifest.json.');
  console.error(JSON.stringify({actual, listed}, null, 2));
  process.exit(1);
}

const reports = {};
let totalErrors = 0, totalWarnings = 0, totalInfos = 0;
for (const file of actual) {
  const abs = join(dir, file);
  let report;
  try {
    report = await validator.validateBytes(new Uint8Array(await readFile(abs)), {
      uri: file,
      format: 'glb',
      maxIssues: 0,
      externalResourceFunction: async uri => {
        const decoded = decodeURIComponent(uri);
        if (/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(decoded)) {
          throw new Error('Refusing external resource URL/path: ' + decoded);
        }
        const path = resolve(dir, decoded);
        if (!path.startsWith(dir + sep)) {
          throw new Error('External resource escapes terrain folder: ' + decoded);
        }
        return new Uint8Array(await readFile(path));
      },
    });
  } catch (error) {
    totalErrors++;
    reports[file] = { exception: String(error) };
    console.error('[ERROR]', file, String(error));
    continue;
  }
  reports[file] = report;
  const { numErrors = 0, numWarnings = 0, numInfos = 0, messages = [] } = report.issues || {};
  totalErrors += numErrors;
  totalWarnings += numWarnings;
  totalInfos += numInfos;
  console.log(`[${numErrors ? 'FAIL' : 'PASS'}] ${file}: ${numErrors} errors, ${numWarnings} warnings, ${numInfos} infos`);
  if (numErrors) {
    for (const issue of messages.filter(m => m.severity === 0).slice(0, 15)) {
      console.error('  ', issue.code, issue.message, issue.pointer || '');
    }
  }
}
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'khronos-glb-validation.json'), JSON.stringify({
  validatorVersion: validator.version(),
  validated: actual.length,
  errors: totalErrors,
  warnings: totalWarnings,
  infos: totalInfos,
  reports
}, null, 2) + '\n');
console.log(`KHRONOS RESULT: ${actual.length}/40 GLBs processed, ${totalErrors} errors, ${totalWarnings} warnings, ${totalInfos} infos`);
if (totalErrors > 0) process.exitCode = 1;
