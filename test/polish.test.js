// Playtest polish: toast queue (one at a time, deferred while a popup is open), shared loader wiring, camera never shows black.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
const w = dom.window, d = w.document;
for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
w.PR_NAVIGATE = () => {};
w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__P={ toast, toastQ, overlay };");
const T = w.__P, shown = () => d.querySelectorAll("#toast .toastmsg").length;
T.toast("one"); T.toast("two"); T.toast("three");
assert.equal(shown(), 1, "toasts show one at a time");
assert.equal(T.toastQ.length, 2, "the rest wait in the queue");
// loader: shared css, present in the raid page, removed after the first frame
const raid = fs.readFileSync(path + "/nodspel/index.html", "utf8"), game = fs.readFileSync(path + "/nodspel/game.mjs", "utf8");
assert(/ui\/loader\.css/.test(raid) && /ui\/loader\.css/.test(fs.readFileSync(path + "/index.html", "utf8")), "both pages load the shared loader css");
assert(/id="boot-loader"[^>]*>.*ui-icons\.svg#bit-face/.test(raid), "raid page ships the loader with the BIT face");
assert(/getElementById\('boot-loader'\)[\s\S]*requestAnimationFrame\(\(\)=>requestAnimationFrame/.test(game), "raid hides the loader after the first rendered frame");
assert(/pr-loader\.out|\.pr-loader\.out/.test(fs.readFileSync(path + "/ui/loader.css", "utf8")), "loader fades out");
// camera: no slack below/beside the art
const app = fs.readFileSync(path + "/app.js", "utf8");
assert(/const pad = \{left:0,right:0,top:0,bottom:0\}/.test(app), "camera pan is clamped to the art bounds (no bottom gutter)");
console.log("POLISH TEST PASSED");
