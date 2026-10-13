// Operator panel (v1.41): 3 automatic skills, operator speed bonus, weapon mastery stars.
const { JSDOM } = require("jsdom");
const fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/" });
const w = dom.window;
w.localStorage = (() => { let s={}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
for(const s of ["items","modules","bit","raid_zones","recipes","vendors","retention","progression","combat"]) w.eval(fs.readFileSync(path + "/data/" + s + ".js", "utf8"));
w.eval(fs.readFileSync(path + "/app.js", "utf8"));
w.A.dismissIntro();
const op = w.document.querySelector("#currencies .oplvl");
assert(op && op.tagName === "BUTTON", "operator level pill opens the panel");
assert(/A.go\('operator'\)/.test(op.getAttribute("onclick"))); w.A.go("operator");
const t = w.document.getElementById("app").textContent;
for(const s of ["OPERATOR", "Mobility L0", "Stealth L0", "Crafting L0", "Weapon mastery", "Basic Carbine", "+0% speed", "0/10 kills"]) assert(t.includes(s), "panel shows " + s + " — got: " + t.slice(0, 400));
assert.equal(w.document.querySelectorAll("#app .skillrow").length, 3);
assert(w.document.querySelector("#app .actionbar button"), "pinned BACK");
console.log("OPERATOR PANEL TESTS PASSED"); process.exit(0);
