import * as THREE from './vendor/three.module.js';

export function buildWorld(level,scene) {
  const group=new THREE.Group();scene.add(group);
  const cube=new THREE.BoxGeometry(1,1,1),materials={};
  const material=color=>materials[color] ||= new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12});
  function box(x,y,z,w,h,d,color='#616973',parent=group){
    const m=new THREE.Mesh(cube,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  for(const f of level.floors){
    box(f.x,-.2,f.z,f.w,.4,f.d,'#444f59');
    box(f.x,-.5,f.z,f.w+.1,.2,f.d+.1,'#252e36');
    const vertices=[];
    for(let x=-f.w/2+1;x<f.w/2;x++)vertices.push(f.x+x,.006,f.z-f.d/2,f.x+x,.006,f.z+f.d/2);
    for(let z=-f.d/2+1;z<f.d/2;z++)vertices.push(f.x-f.w/2,.006,f.z+z,f.x+f.w/2,.006,f.z+z);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#6c7882',transparent:true,opacity:.2})));
  }
  for(const b of [...level.walls,...level.boxes]){
    box(b.x,b.h/2,b.z,b.w,b.h,b.d,level.boxes.includes(b)?'#667078':'#596771');
    box(b.x,b.h+.025,b.z,b.w,.05,b.d,'#7a8990');
  }
  const nodes=level.nodes.map(node=>{
    const g=new THREE.Group();g.position.set(node.x,0,node.z);group.add(g);
    box(0,.1,0,1.9,.2,1.9,'#303b43',g);
    box(0,.65,0,1.4,1,1.4,'#4f6068',g);
    box(0,1.23,0,1.6,.16,1.6,'#79868b',g);
    const coreMaterial=new THREE.MeshStandardMaterial({color:'#8a9b9b',emissive:'#8cf5df',emissiveIntensity:0,roughness:.4});
    const front=new THREE.Mesh(cube,coreMaterial);front.scale.set(.95,.7,.03);front.position.set(0,.69,.711);g.add(front);
    const top=new THREE.Mesh(cube,coreMaterial);top.scale.set(1,.025,1);top.position.y=1.323;g.add(top);
    const light=new THREE.PointLight('#69f6dc',0,8,1.6);light.position.y=1.9;g.add(light);
    const halo=new THREE.Mesh(new THREE.RingGeometry(1.05,1.09,48),new THREE.MeshBasicMaterial({color:'#8cf5df',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));
    halo.rotation.x=-Math.PI/2;halo.position.y=.018;g.add(halo);
    return {node,group:g,coreMaterial,light,halo};
  });
  const exit=level.exit;
  const lootBoxes=level.lootBoxes.map(loot=>{
    const g=new THREE.Group();g.position.set(loot.x,0,loot.z);group.add(g);
    box(0,.32,0,.9,.64,.9,'#84754d',g);box(0,.68,0,1,.08,1,'#b5a372',g);
    box(0,.35,.46,.3,.18,.03,'#8cf5df',g);
    return {loot,group:g};
  });
  const enemies=level.enemies.map(enemy=>{
    const g=new THREE.Group();g.position.set(enemy.x,0,enemy.z);group.add(g);
    box(0,.1,0,1,.2,1,'#30353c',g);box(0,.52,0,.72,.72,.72,'#6e6266',g);
    box(0,.96,0,.55,.18,.55,'#a67072',g);box(0,.64,.5,.18,.18,.65,'#4d2a30',g);
    const eye=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#ff8d84'}));eye.scale.set(.37,.09,.03);eye.position.set(0,.77,.365);g.add(eye);
    return {enemy,group:g};
  });
  const exitMaterial=new THREE.MeshStandardMaterial({color:'#b49b64',emissive:'#8cf5df',emissiveIntensity:0,roughness:.5});
  const gate=new THREE.Mesh(cube,exitMaterial);gate.scale.set(2,.85,.22);gate.position.set(exit.x,.55,exit.z);group.add(gate);
  for(const sign of [-1,1])box(exit.x+sign*1.1,.7,exit.z,.15,1.4,.3,'#88969b');
  const exitPad=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.8),new THREE.MeshBasicMaterial({color:'#b49b64',transparent:true,opacity:.16,side:THREE.DoubleSide}));
  exitPad.rotation.x=-Math.PI/2;exitPad.position.set(exit.x,.022,exit.z);group.add(exitPad);
  function setExit(open){gate.visible=!open;exitMaterial.color.set(open?'#8cf5df':'#b49b64');exitMaterial.emissiveIntensity=open?1:0;exitPad.material.color.set(open?'#8cf5df':'#b49b64');exitPad.material.opacity=open?.45:.16;}
  function animate(time){for(const v of nodes){if(v.node.active){v.coreMaterial.color.set('#8cf5df');v.coreMaterial.emissiveIntensity=2.5;v.light.intensity=12+Math.sin(time*2.5)*1.5;v.halo.material.opacity=.7;v.halo.scale.setScalar(1+Math.sin(time*2.5)*.035);}}}
  function dispose(){
    const geometries=new Set(),mats=new Set();
    group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});
    for(const g of geometries)g.dispose();for(const m of mats)m.dispose();scene.remove(group);
  }
  return {group,nodes,enemies,lootBoxes,setExit,animate,dispose};
}
