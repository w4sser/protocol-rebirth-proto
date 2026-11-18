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
const op01=fs.readFileSync(path+'/ui/raid-prep-op01.mjs','utf8');
assert(op01.includes("new GLTFLoader().loadAsync("),'menu loads real authored Blender GLB');
assert(op01.includes('OP01_Mobile.glb') && op01.includes('OP01_Hero.glb'),'Mobile and Hero model paths are configured');
assert(viewer.includes('await loadOP01Operator(') && viewer.includes('createMenuBit('),
  'Deploy mounts authored OP01 GLB and 3D BIT');
assert(viewer.includes("new THREE.WebGLRenderer(") && viewer.includes('renderer.render(scene,camera)'),
  'Deploy renders a real live 3D canvas');
assert(!viewer.includes('loadHumanOperator()') && !viewer.includes('operator.update(dt,{'),
  'Deploy portrait does not use the top-down raid rig that undid user rotation');
assert(viewer.includes("host.setPointerCapture(e.pointerId)") &&
       viewer.includes('orbit.rotation.y=yaw') &&
       viewer.includes("host.dataset.rotation="),
  'pointer drags rotate the visible 3D operator and expose rotation for browser verification');
const heroV4=fs.readFileSync(path+'/ui/raid-prep-operator-v4.mjs','utf8');
assert(heroV4.includes('export function createOperatorHeroV4(') &&
       models.includes('export function createMenuBit('),
  'dedicated high-detail 3D operator v4 and companion exist');
assert(heroV4.includes('shadowed face cavity') && heroV4.includes('overhanging hood peak') &&
       heroV4.includes('rear cloak wide drape') && heroV4.includes('articulated thigh'),
  'sculpted operator v4 has hidden face, angular hood, non-cylindrical limbs and asymmetric cloak');
assert(heroV4.includes('anatomical forearm') && heroV4.includes('fully modeled 3D raid weapon') &&
       heroV4.includes('boot upper') && heroV4.includes('glove finger seam'),
  'operator v4 replaces primitive mannequin anatomy, boots, gloves and weapons');
assert(heroV4.includes('organicLimb(') && heroV4.includes('new THREE.BufferGeometry()'),
  'operator v4 uses actual volume geometry rather than a static hero image');
assert(heroV4.includes('athletic-long-legs-v4') && heroV4.includes('lean-v-taper-upper-body-v4') &&
       heroV4.includes('narrow-asymmetric-mantle-v4'),
  'athletic character redesign uses independent proportions for legs, torso and cloak');
assert(heroV4.includes('legs.scale.set(.91,1.18,.89)') &&
       heroV4.includes('upper.scale.set(.90,1,.89)'),
  'lean v4 increases apparent leg length and tapers upper-body width and depth');
// BIT must stay subordinate to OP01: no foreground 3D portrait overlap.
const bitLayout=viewer.match(/const BIT_DEPLOY_LAYOUT=Object.freeze\(\{([\s\S]*?)\}\);/);
assert(bitLayout,'BIT deploy composition should be defined explicitly');
const getLayoutNumber=k=>{
  const m=bitLayout[1].match(new RegExp('(?:^|[,\\s])'+k+'\\s*:\\s*(-?[0-9.]+)'));
  assert(m,'Missing BIT layout setting '+k);
  return Number(m[1]);
};
assert(getLayoutNumber('scale')<=.60 && getLayoutNumber('scale')>=.4,'BIT must be smaller than foreground version');
assert(getLayoutNumber('z')<-.3,'BIT must be behind the operator along camera +Z');
assert(getLayoutNumber('x')<-.4,'BIT should be left of the operator torso');
assert(getLayoutNumber('bobAmplitude')<=.02,'BIT hover must be subtle');
assert(viewer.includes('bit.scale.setScalar(BIT_DEPLOY_LAYOUT.scale)') &&
       viewer.includes('bit.position.set(BIT_DEPLOY_LAYOUT.x,BIT_DEPLOY_LAYOUT.y,BIT_DEPLOY_LAYOUT.z)'),
       'BIT should use shared staging config');
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
