// Asset gate for the opt-in generated prop kit (assets/env/nature/rocks-gen/,
// tools/blender/make_props.py). Guards: manifest matches the files on disk,
// every GLB has a real header and the byte size the manifest claims, tris
// stay within the mobile budget from the task brief, and the kit is never
// accidentally wired into gameplay (it must stay opt-in / review-only).
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const DIR = path.join(root, "assets", "env", "nature", "rocks-gen");

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0, "manifest lists at least one asset");

const onDisk = new Set(fs.readdirSync(DIR).filter(f => f.endsWith(".glb")));
const listed = new Set(manifest.assets.map(a => a.file));
for(const f of onDisk) assert.ok(listed.has(f), `${f} exists on disk but is not listed in manifest.json`);
for(const f of listed) assert.ok(onDisk.has(f), `manifest.json lists ${f} but it is missing from ${DIR}`);

for(const entry of manifest.assets){
  const p = path.join(DIR, entry.file);
  const bytes = fs.readFileSync(p);

  // GLB header: magic 'glTF', version 2, declared total length matches the
  // real file size (same checks scripts/validate-props.mjs runs on the
  // hand-authored kits).
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${entry.file}: GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${entry.file}: GLB version 2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${entry.file}: GLB header length field matches real file size`);

  assert.equal(entry.file_size_bytes, bytes.length, `${entry.file}: manifest file_size_bytes matches the real file`);
  assert.ok(bytes.length <= 60_000, `${entry.file}: ${bytes.length}B exceeds the 60KB-per-GLB budget`);

  // tri budgets from the task brief: rocks 150-400, barrel <=500.
  if(entry.kind === "rock"){
    assert.ok(entry.triangle_count >= 150 && entry.triangle_count <= 400,
      `${entry.file}: rock triangle_count ${entry.triangle_count} outside the 150-400 budget`);
  }else if(entry.kind === "barrel"){
    assert.ok(entry.triangle_count <= 500, `${entry.file}: barrel triangle_count ${entry.triangle_count} exceeds the 500 budget`);
  }
}

assert.equal(manifest.origin, "bottom centre", "manifest declares bottom-centre origin");
assert.equal(manifest.up_axis, "Y", "manifest declares Y-up");
assert.equal(manifest.units, "metres", "manifest declares metres");

assert.ok(fs.existsSync(path.join(DIR, "README.md")), "rocks-gen/README.md exists");
assert.ok(/opt-in/i.test(fs.readFileSync(path.join(DIR, "README.md"), "utf8")), "README documents the kit as opt-in");

// Guard against accidentally wiring the review kit into gameplay: nothing
// outside this directory/its own tooling may reference the generated GLBs.
const GAMEPLAY_FILES = [
  ...fs.readdirSync(path.join(root, "data")).filter(f => f.endsWith(".js")).map(f => "data/" + f),
  "app.js", "index.html",
];
for(const rel of GAMEPLAY_FILES){
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.ok(!src.includes("rocks-gen"), `${rel} must not reference the opt-in rocks-gen kit`);
}
{
  const nodspelDir = path.join(root, "nodspel");
  const nodspelFiles = fs.readdirSync(nodspelDir).filter(f => /\.(m?js|html)$/.test(f));
  for(const f of nodspelFiles){
    const src = fs.readFileSync(path.join(nodspelDir, f), "utf8");
    assert.ok(!src.includes("rocks-gen"), `nodspel/${f} must not reference the opt-in rocks-gen kit`);
  }
}

console.log(`rocks-gen-kit: ${manifest.assets.length} assets OK (manifest<->disk, GLB headers, tri/byte budgets, opt-in isolation)`);
