import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {BUNKER_DIMS,BUNKER_KINDS,COVER_KINDS,PROP_KINDS_BUNKER} from '../bunker.js';
const dir=new URL('../../assets/env/bunker/',import.meta.url),man=JSON.parse(fs.readFileSync(new URL('manifest.json',dir)));
test('bunker kit: manifest, files and BUNKER_DIMS agree',()=>{
  const files=fs.readdirSync(dir).filter(f=>f.endsWith('.glb')).sort();
  assert.deepEqual(man.assets.map(a=>a.file).sort(),files);
  for(const a of man.assets)assert.deepEqual(BUNKER_DIMS[a.file.replace('.glb','')],a.approx_dimensions_m.map(x=>+x.toFixed(3)),a.file);
  assert.equal(BUNKER_KINDS.length,files.length);});
test('bunker kit: every GLB < 100 KB, atlases present',()=>{
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb')))assert.ok(fs.statSync(new URL(f,dir)).size<100*1024,f);
  for(const t of ['bunker_atlas.png','bunker_emissive.png'])assert.ok(fs.existsSync(new URL(t,dir)),t);});
test('bunker kit: every kind the renderer asks for exists',()=>{
  const need=[...COVER_KINDS,...PROP_KINDS_BUNKER,'floor_grate_2m','wall_straight_2m_a','extract_hatch_open','extract_hatch_locked',
    ...['idle','shielded','active'].map(s=>'node_terminal_'+s),...['off','warn','on'].map(s=>'shock_pad_'+s),...['common','uncommon','rare','epic','legendary'].map(r=>'loot_crate_'+r)];
  for(const k of need)assert.ok(BUNKER_DIMS[k],k);});
