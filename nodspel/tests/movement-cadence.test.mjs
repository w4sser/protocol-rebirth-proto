import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {moveWithActors} from '../physics.mjs';
import {RULES} from '../levels.js';
import {gameTime,hitstop,advanceHitstop,pausePick,resumePick} from '../perks.js';

const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
// Exercise the shipped frame clock expression, including its pause and first-frame handling.
const timing=source.match(/const dt=frozen\?0:[^;]+;previousGameClock=clock;/)[0];
function frameDt(clock,previousGameClock,frozen=false){
  return vm.runInNewContext(`${timing}dt`,{clock,previousGameClock,frozen});
}
function shippedFunction(name){
  const start=source.indexOf(`function ${name}(`);let end=source.indexOf('{',start),depth=0;
  for(;end<source.length;end++){
    if(source[end]==='{')depth++;
    if(source[end]==='}'&&!--depth)return vm.runInNewContext(`(${source.slice(start,end+1)})`);
  }
  throw Error(name);
}
const assist=shippedFunction('depthJambAssist');
const speed=RULES.playerStats.base.speed,radius=RULES.playerRadius;

for(const fps of [60,30,25,20,15,10])test(`open ground and wall seams preserve speed at ${fps} FPS`,()=>{
  const wall=[{x:-1,z:-2,w:2,d:4},{x:-1,z:2,w:2,d:4}];
  let open={x:3,z:-1.8},slide={x:radius+.001,z:-1.8};
  let clock=0;
  for(let i=0;i<fps;i++){
    const nextClock=(i+1)*1000/fps,dt=frameDt(nextClock,clock);clock=nextClock;
    const before=slide;
    open=moveWithActors(open,{x:0,z:speed*dt},[],[],100,radius);
    slide=moveWithActors(slide,{x:-speed*dt,z:speed*dt},[],wall,100,radius);
    assert.ok(slide.z-before.z>=speed/fps*.99,'wall slide must retain its tangential speed each frame');
  }
  assert.ok(Math.abs(open.z+1.8-speed)<1e-8,`open ground: ${open.z+1.8} m in 1s, expected ${speed}`);
  assert.ok(Math.abs(slide.z+1.8-speed)<1e-8,'separate wall boxes must not cause seam drag');
});

test('frame clock excludes pause/hitstop and bounds a long stall',()=>{
  assert.equal(frameDt(1000,null),0);
  assert.equal(frameDt(900,1000),0);
  assert.equal(frameDt(5000,0,true),0);
  assert.ok(frameDt(5000,0)<=.1,'resuming after a long stall must not jump several seconds');
  const round={pausedMs:0,pauseAt:null};
  hitstop(round,40,100);advanceHitstop(round,120);
  assert.equal(frameDt(gameTime(round,120),100,true),0);
  advanceHitstop(round,150);
  assert.ok(Math.abs(frameDt(gameTime(round,150),100)-.01)<1e-8);
  pausePick(round,150);resumePick(round,2150);
  assert.equal(frameDt(gameTime(round,2150),110),0);
});

for(const alongX of [true,false])test(`Depth doorway does not fight parallel movement or retreat (${alongX?'X':'Z'} span)`,()=>{
  const door=alongX?{x:0,z:0,w:3.2,d:.4}:{x:0,z:0,w:.4,d:3.2};
  const level={depth:true,doors:[door],rooms:[]};
  const rotate=p=>alongX?p:{x:p.z,z:p.x};
  const pos=rotate({x:1,z:-.8});
  for(const delta of [{x:1,z:0},{x:-1,z:0},{x:.8,z:.6},{x:0,z:-1}]){
    const want=rotate(delta),got=assist(level,pos,want);
    assert.ok(Math.hypot(got.x-want.x,got.z-want.z)<1e-9,`input ${JSON.stringify(want)} became ${JSON.stringify(got)}`);
  }
  const crossing=assist(level,pos,rotate({x:0,z:1}));
  assert.ok((alongX?crossing.x:crossing.z)<0,'approaching off-center still assists toward the opening');
});

test('room doorway descriptors receive the same directional assist guard',()=>{
  const level={depth:true,rooms:[{x:0,z:0,w:8,d:8,doors:[{x:0,z:-1}]}]};
  const got=assist(level,{x:1,z:-3.2},{x:1,z:0});
  assert.equal(got.x,1);
  assert.equal(got.z,0);
});
