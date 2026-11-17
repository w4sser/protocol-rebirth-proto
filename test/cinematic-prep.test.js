// Cinematic Raid Prep: real DOM contract + no WebGL required for low-end fallback.
const {JSDOM}=require('jsdom');
const fs=require('fs'), assert=require('assert');
const path=__dirname+'/..';
const dom=new JSDOM(fs.readFileSync(path+'/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost/index.html'});
const w=dom.window;
for(const name of ['items','modules','bit','bit-talents','raid_zones','recipes','vendors','retention','progression','combat'])
  w.eval(fs.readFileSync(path+'/data/'+name+'.js','utf8'));
w.eval(fs.readFileSync(path+'/app.js','utf8'));
w.A.dismissIntro();
w.A.playCombatDemo();
w.A.endCombatDemo();
const d=w.document;
const screen=d.querySelector('#app.s-prep .lobby.pr-cinematic');
assert(screen,'new cinematic lobby is active in Raid Prep');
assert(d.querySelector('.lobby-top .pr-title')?.textContent==='RAID PREPARATION');
assert.equal(d.querySelectorAll('.lobby-side.left .slotgrid>.lslot, .lobby-side.left .slotgrid>.slotwrap').length,3,'two gear slots and consumable row are present');
assert(d.querySelector('.lobby-side.left [data-slot="weapon"]'),'weapon slot remains selectable');
assert(d.querySelector('.lobby-side.left [data-slot="armor"]'),'vest slot remains selectable');
assert(d.querySelector('.lobby-side.left [data-slot="c1"]'),'medkit slot remains selectable');
assert(d.querySelector('.lobby-side.left [data-slot="c2"]'),'second consumable remains accessible');
const stage=d.querySelector('#pr-operator-stage');
assert(stage && stage.dataset.weapon,'three-dimensional operator stage receives equipped weapon');
assert.equal(stage.tabIndex,0,'keyboard user may rotate operator');
assert(d.querySelector('.lobby-hero .hero-art'),'static fallback remains in DOM');
assert(d.querySelector('.pr-dest-preview[data-area]'),'destination art follows the selected area');
assert(d.querySelector('.pr-mission-btn'),'mission planning remains accessible');
assert(d.querySelector('.pr-risk-card .riskbar'),'loss warning stays visible');
assert.equal(d.querySelectorAll('.node-raid-launch').length,1,'only one deploy action');
assert.equal(d.querySelector('.node-raid-launch').getAttribute('onclick'),'A.deployNodeRaid()','deploy retains real raid launch');
assert(!d.querySelector('.lobby-top .hard-btn, .lobby-top .bigmap-btn'),'debug-like options are not top-level');
assert(d.querySelector('#mission-panel .bigmap-btn'),'advanced big map option is in Mission');
w.A.planToggle(true);
assert(!d.querySelector('#mission-panel').hidden,'mission panel opens');
w.A.planToggle(false);
assert(d.querySelector('#mission-panel').hidden,'mission panel closes');
const styles=fs.readFileSync(path+'/ui/raid-prep.css','utf8');
assert(styles.includes('body[data-screen="prep"] #tabs{display:none!important}'),'bottom tabs hidden on prep only');
assert(styles.includes('raid-prep-bunker.avif'),'authored bunker threshold background is used');
assert(!styles.includes('env_base.webp'),'base overview map no longer appears on Deploy');
assert(styles.includes('raid-prep-operator.avif'),'fallback is the hooded faceless scavenger, not the gameplay placeholder');
assert(styles.includes('raid-prep-archipelago.avif'),'Archipelago card is an in-world location preview');
assert(!styles.includes('splash_archipelago_radar_lighthouse.webp'),'destination card must not use a branded promo banner');
for(const asset of ['raid-prep-bunker.avif','raid-prep-archipelago.avif','raid-prep-operator.avif'])
  assert(fs.statSync(path+'/assets/production/'+asset).size>2000,asset+' exists and has image bytes');
const viewer=fs.readFileSync(path+'/ui/raid-prep-scene.mjs','utf8');
// Character + BIT are genuine Three.js meshes, with an independent
// high-detail MENU model; gameplay's low-cost rig must not overwrite yaw.
const models=fs.readFileSync(path+'/ui/raid-prep-models.mjs','utf8');
assert(viewer.includes('createOperatorHeroV3(') && viewer.includes('createMenuBit('),
  'Deploy mounts distinct 3D operator and BIT objects');
assert(viewer.includes("new THREE.WebGLRenderer(") && viewer.includes('renderer.render(scene,camera)'),
  'Deploy renders a real live 3D canvas');
assert(!viewer.includes('loadHumanOperator()') && !viewer.includes('operator.update(dt,{'),
  'Deploy portrait does not use the top-down raid rig that undid user rotation');
assert(viewer.includes("host.setPointerCapture(e.pointerId)") &&
       viewer.includes('orbit.rotation.y=yaw') &&
       viewer.includes("host.dataset.rotation="),
  'pointer drags rotate the visible 3D operator and expose rotation for browser verification');
const heroV3=fs.readFileSync(path+'/ui/raid-prep-operator-v3.mjs','utf8');
assert(heroV3.includes('export function createOperatorHeroV3(') &&
       models.includes('export function createMenuBit('),
  'dedicated high-detail 3D operator v3 and companion exist');
assert(heroV3.includes('shadowed face cavity') && heroV3.includes('overhanging hood peak') &&
       heroV3.includes('rear cloak wide drape') && heroV3.includes('articulated thigh'),
  'sculpted operator v3 has hidden face, angular hood, non-cylindrical limbs and asymmetric cloak');
assert(heroV3.includes('anatomical forearm') && heroV3.includes('fully modeled 3D raid weapon') &&
       heroV3.includes('boot upper') && heroV3.includes('glove finger seam'),
  'operator v3 replaces primitive mannequin anatomy, boots, gloves and weapons');
assert(heroV3.includes('organicLimb(') && heroV3.includes('new THREE.BufferGeometry()'),
  'operator v3 uses actual volume geometry rather than a static hero image');
assert(models.includes("bit-face-master-v3.svg") && models.includes('BIT owner face master v3'),
  'BIT uses the owner-approved smile proportions on the 3D CRT');
assert(fs.readFileSync(path+'/assets/bit-face-master-v3.svg','utf8').includes('#75CFCC'),
  'smile uses the approved cyan face color');
assert(models.includes('SphereGeometry') && models.includes('CylinderGeometry') &&
       models.includes('ExtrudeGeometry'),
  'character and BIT are true volumetric geometry rather than UI billboards');
assert(viewer.includes('function dispose()') && viewer.includes('renderer.forceContextLoss'),
  '3D viewer releases resources on navigation');
assert(fs.readFileSync(path+'/index.html','utf8').includes('ui/raid-prep.css'),'new visual rules are loaded');
console.log('CINEMATIC RAID PREP TEST PASSED');
dom.window.close();
