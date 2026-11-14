// D3 cold open (v2.28.28): asset weight budget, reduced-motion coverage and the BIT-spec promise
// that the cold-open derivative is never recoloured by CSS (fade/float/brightness only).
// Run: node test/coldopen.test.js
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const read = f => fs.readFileSync(path + "/" + f, "utf8");

// 1) Both cold-open assets exist and stay well inside the mobile weight budget.
{
  const backdrop = path + "/assets/production/coldopen/bunker-discovery-arch-v1.webp";
  const bit = path + "/assets/production/coldopen/bit-coldopen-v1.webp";
  assert(fs.existsSync(backdrop), "cold-open backdrop exists: " + backdrop);
  assert(fs.existsSync(bit), "cold-open BIT derivative exists: " + bit);
  const backdropKb = fs.statSync(backdrop).size / 1024;
  const bitKb = fs.statSync(bit).size / 1024;
  assert(backdropKb < 350, "backdrop stays under 350 KB: " + backdropKb.toFixed(1) + " KB");
  assert(bitKb < 60, "BIT derivative stays under 60 KB: " + bitKb.toFixed(1) + " KB");
}

// 2) prefers-reduced-motion turns off the push-in and the BIT power-on flicker (and the line/button
// reveal delays), matching the shared pattern already used elsewhere in index.html.
{
  const html = read("index.html");
  const reduced = html.match(/@media \(prefers-reduced-motion: reduce\)\{\s*\.intro-stage\{animation:none[^}]*\}[\s\S]*?\n  \}/);
  assert(reduced, "a prefers-reduced-motion rule covers the cold open");
  const block = reduced[0];
  assert(/\.intro-stage\{animation:none/.test(block), "reduced motion disables the push-in zoom");
  assert(/\.intro-bit\{animation:none/.test(block), "reduced motion disables the BIT power-on flicker and float");
  assert(/\.intro-lines p,\.intro-go\{animation:none/.test(block), "reduced motion disables the line/button reveal delays");
}

// 3) BIT identity lock (docs/bit-character-spec.md): no CSS filter may hue-rotate the derivative --
// fade/float/brightness/drop-shadow only, never a colour change.
{
  const html = read("index.html");
  const introCss = html.slice(html.indexOf(".intro{"), html.indexOf("Full-bleed:"));
  assert(introCss.includes(".intro-bit"), "found the .intro-bit rules to check");
  assert(!/\.intro-bit[^{]*\{[^}]*hue-rotate/.test(introCss), "no hue-rotate on .intro-bit's own rule");
  for(const m of introCss.matchAll(/@keyframes\s+(introBit\w+)\{([\s\S]*?)\n\s*\}\n/g)){
    assert(!/hue-rotate/.test(m[2]), "no hue-rotate in " + m[1]);
  }
  assert(!/hue-rotate/.test(introCss), "no hue-rotate anywhere in the cold-open CSS block");
}

// 4) No 3D/camera files touched by this change -- not mechanically testable from a static check
// (nodspel's camera/GLB code has no cold-open hook to assert against); skipped per task note.

console.log("COLD OPEN TEST PASSED");
