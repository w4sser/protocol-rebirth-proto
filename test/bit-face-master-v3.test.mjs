import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root));
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000003, `${a} != ${b}`);

test('v3 rendered path obeys the owner sheet, independently of metadata', () => {
  const svg = read('assets/bit-face-master-v3.svg').toString();
  assert.match(svg, /viewBox="0 0 1000 875"/);
  const eyes = [...svg.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
  assert.deepEqual(eyes, [[257, 370, 39, 85], [743, 370, 39, 85]]);
  close(eyes[1][0] - eyes[0][0], 486);
  assert.equal((svg.match(/fill="#75CFCC"/g) || []).length, 3);
  assert.equal((svg.match(/stroke="none"/g) || []).length, 3);
  const d = svg.match(/<path d="([^"]+)"/)[1];
  const commands = [...d.matchAll(/([MCAZ])([^MCAZ]*)/g)].map(m => ({op:m[1], v:m[2].trim().split(/[ ,]+/).filter(Boolean).map(Number)}));
  assert.equal(commands[0].op, 'M');
  const cap = commands.findIndex(c => c.op === 'A');
  const outer = [commands[0].v, ...commands.slice(1,cap).map(c => {assert.equal(c.op,'C'); return c.v.slice(-2);})];
  const lastCap = commands.findLastIndex(c => c.op === 'A');
  const inner = [commands[cap].v.slice(-2), ...commands.slice(cap+1,lastCap).map(c => {assert.equal(c.op,'C'); return c.v.slice(-2);})].reverse();
  assert.equal(outer.length,65);
  assert.equal(inner.length,65);
  for (let i=0;i<outer.length;i++) {
    close(outer[i][0]+outer[64-i][0],1000);
    close(inner[i][0]+inner[64-i][0],1000);
    close(outer[i][1],outer[64-i][1]);
    close(inner[i][1],inner[64-i][1]);
    close(Math.hypot(outer[i][0]-inner[i][0],outer[i][1]-inner[i][1]),32+32*Math.sin(Math.PI*i/64));
  }
  const centre = i => outer[i].map((v,k)=>(v+inner[i][k])/2);
  close(centre(0)[0],315); close(centre(64)[0],685);
  close(centre(64)[0]-centre(0)[0],370);
  close(centre(0)[1],534); close(centre(64)[1],534);
  close(centre(32)[0],500); close(centre(32)[1],649);
  close(centre(32)[1]-centre(0)[1],115);
  close(outer[32][1]-inner[32][1],64);
  // Sweep outwards along the tangent: concave inward semicircles are not round smile ends.
  for (const i of [cap,lastCap]) assert.deepEqual(commands[i].v.slice(0,5),[16,16,0,0,0]);
  // Inspect curve interiors too: changing a Bezier handle must not slip through knot checks.
  const radius=4745/23, cy=10182/23, halfAngle=Math.asin(185/radius);
  const sample=(start,v,u)=>[0,1].map(k=>(1-u)**3*start[k]+3*(1-u)**2*u*v[k]+3*(1-u)*u*u*v[k+2]+u**3*v[k+4]);
  for(let i=0;i<64;i++)for(const u of [0.25,0.5,0.75]){
    const t=(i+u)/64, angle=Math.PI/2+halfAngle*(1-2*t), halfWidth=16+16*Math.sin(Math.PI*t);
    for(const side of [1,-1]){
      const j=side===1?1+i:cap+1+(63-i);
      const start=side===1?outer[i]:inner[i+1];
      const actual=sample(start,commands[j].v,side===1?u:1-u);
      const expected=[500+(radius+side*halfWidth)*Math.cos(angle),cy+(radius+side*halfWidth)*Math.sin(angle)];
      assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<0.0001,'curve deviates from the dimensioned smile');
    }
  }
});

test('legacy vector and uploaded JPG are unchanged', () => {
  const old=read('assets/bit-face-master.svg');
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${old.length}\0`)).update(old).digest('hex'),'d86b24c756d704d054cf0b54380ee1a7a80b9b6e');
  assert.equal(createHash('sha256').update(read('assets/reference/bit/BIT-Face-Proportion-Master-v1_A4-print_2.jpg')).digest('hex'),'2d19d0b9ef893bc54df85093effc8e4e3198c081b1503a82160d3892612b3e08');
});
