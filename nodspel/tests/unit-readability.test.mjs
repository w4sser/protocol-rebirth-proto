import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {UNIT_READABILITY,createUnitContactShadow,tuneEnemyReadabilityMaterial} from '../unit-readability.js';

test('soft combat contact shadows share a small texture and material, including on Low',()=>{
  const a=createUnitContactShadow({radius:.8,opacity:.34});
  const b=createUnitContactShadow({radius:1.1,opacity:.34});
  const player=createUnitContactShadow({radius:.9,opacity:.32});
  assert.equal(a.name,'unit-contact-shadow');
  assert.equal(a.geometry,b.geometry);
  assert.equal(a.material,b.material,'enemies share one GPU material, not one each');
  assert.notEqual(a.material,player.material);
  assert.equal(a.material.map,player.material.map,'one 48-pixel radial texture for both sides');
  assert.equal(a.geometry.userData.shared,true);
  assert.equal(a.material.userData.shared,true);
  assert.equal(a.material.depthWrite,false);
  assert.equal(a.castShadow,false);
  assert.equal(a.receiveShadow,false);
  assert.equal(a.scale.x,.8);
  assert.equal(b.scale.x,1.1);
  const {data,width,height}=a.material.map.image;
  assert.equal(width,48);
  assert.equal(height,48);
  const alpha=(x,y)=>data[(y*width+x)*4+3];
  assert(alpha(24,24)>220,'dark grounded centre');
  assert.equal(alpha(0,0),0,'transparent outside edge');
  assert(alpha(32,24)<alpha(24,24),'soft feathered falloff');
});

test('enemy material lift preserves authored accents and patches no extra geometry',()=>{
  const body=new THREE.MeshStandardMaterial({color:'#30353c',metalness:.12,roughness:.82});
  const neutral=UNIT_READABILITY.enemyFillColor;
  assert(tuneEnemyReadabilityMaterial(body));
  assert.equal(body.emissive.getHexString(),neutral.slice(1));
  assert.equal(body.emissiveIntensity,UNIT_READABILITY.enemyFillStrength);
  assert.equal(body.fog,false);
  const shader={
    uniforms:{},
    vertexShader:'#include <common>\n#include <project_vertex>',
    fragmentShader:'#include <common>\n#include <dithering_fragment>'
  };
  body.onBeforeCompile(shader);
  assert.equal(shader.uniforms.prEnemyRimColor.value.getHexString(),UNIT_READABILITY.enemyRimColor.slice(1));
  assert.match(shader.vertexShader,/vPREnemyView/);
  assert.match(shader.fragmentShader,/prEnemyRimColor\*prEnemyEdge/);
  assert.match(body.customProgramCacheKey(),/pr-enemy-readability-v1/);
  const oldCompile=body.onBeforeCompile;
  assert(tuneEnemyReadabilityMaterial(body));
  assert.equal(body.onBeforeCompile,oldCompile,'shader must not be wrapped repeatedly');

  const weakpoint=new THREE.MeshStandardMaterial({
    color:'#e4705f',emissive:'#bb2200',emissiveIntensity:.8
  });
  tuneEnemyReadabilityMaterial(weakpoint);
  assert.equal(weakpoint.emissive.getHexString(),'bb2200','do not wash out coral gameplay accents');
  assert.equal(weakpoint.emissiveIntensity,.8);
  assert.equal(tuneEnemyReadabilityMaterial(new THREE.MeshBasicMaterial()),false);
});
