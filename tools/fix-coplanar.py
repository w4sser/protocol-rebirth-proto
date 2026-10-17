#!/usr/bin/env python3
"""Remove internal z-fighting from kit GLBs (v1.59).

Some kit models are built from overlapping boxes/quads whose faces lie in the same plane
and face the same way (e.g. sandbags side by side, wall trims flush with the wall face,
stripes on a decal plate). The GPU cannot decide which one is in front -> flicker/stripes.
For every such plane, each extra shell that shares it gets its face pushed out along the
normal by STEP (1.5 mm, 2 mm cap per rank), so a deterministic one wins. Edits only
POSITION data in place (same byte size); normals/UVs untouched.
usage: python tools/fix-coplanar.py assets/env/bunker/*.glb
"""
import json, struct, sys
import numpy as np
STEP = 0.0015

def read(fn):
    b = bytearray(open(fn, 'rb').read())
    jl = struct.unpack('<I', b[12:16])[0]
    J = json.loads(bytes(b[20:20 + jl]))
    return b, J, 20 + jl + 8

def acc_view(J, i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}[a['componentType']]
    st = bv.get('byteStride') or np.dtype(dt).itemsize * n
    return a, o, n, dt, st

def get(b, base, J, i):
    a, o, n, dt, st = acc_view(J, i)
    return np.array([np.frombuffer(b, dt, n, base + o + k * st) for k in range(a['count'])])

def put(b, base, J, i, arr):
    a, o, n, dt, st = acc_view(J, i)
    for k in range(a['count']):
        b[base + o + k * st: base + o + k * st + 12] = arr[k].astype('<f4').tobytes()
    a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()

def components(P, idx):
    # index connectivity (not position): a flush face quad of one shell can move on its own
    rep = np.arange(len(P))
    par = list(range(len(P)))
    def f(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for t in idx.reshape(-1, 3):
        r = [f(rep[v]) for v in t]
        for x in r[1:]: par[f(x)] = f(r[0])
    return np.array([f(rep[v]) for v in range(len(P))])

def sat(A, B):
    for Pp in (A, B):
        for k in range(3):
            e = Pp[(k + 1) % 3] - Pp[k]; ax = np.array([-e[1], e[0]])
            pa, pb = A @ ax, B @ ax
            if pa.max() <= pb.min() + 1e-5 or pb.max() <= pa.min() + 1e-5: return False
    return True

def conflicts(T):
    """same-facing coplanar overlapping triangle pairs (i, j)"""
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); ln = np.linalg.norm(n, axis=1)
    out = []; valid = ln > 1e-12; n = np.where(valid[:, None], n / np.maximum(ln, 1e-12)[:, None], 0)
    d = (n * T[:, 0]).sum(1)
    for i in range(len(T)):
        if not valid[i]: continue
        for j in range(i + 1, len(T)):
            if not valid[j] or n[i] @ n[j] < 1 - 1e-4 or abs(d[i] - d[j]) > 1e-4: continue
            ax = np.argmax(abs(n[i])); keep = [k for k in range(3) if k != ax]
            A, B = T[i][:, keep], T[j][:, keep]
            if (A.min(0) < B.max(0) - 1e-4).all() and (B.min(0) < A.max(0) - 1e-4).all() and sat(A, B):
                out.append((i, j, n[i], d[i]))
    return out

def fix(fn, write=True):
    b, J, base = read(fn); total = 0
    for mesh in J['meshes']:
        for pr in mesh['primitives']:
            pi = pr['attributes']['POSITION']; P = get(b, base, J, pi).astype(float)
            idx = get(b, base, J, pr['indices']).flatten() if 'indices' in pr else np.arange(len(P))
            for _ in range(4):
                T = P[idx].reshape(-1, 3, 3); C = components(P, idx); tc = C[idx.reshape(-1, 3)[:, 0]]
                cf = conflicts(T)
                if not cf: break
                total += len(cf); planes = {}
                for i, j, nrm, d in cf:
                    k = (tuple(np.round(nrm, 4)), round(float(d), 4))
                    planes.setdefault(k, (nrm, d, set()))[2].update({tc[i], tc[j]})
                for nrm, d, comps in planes.values():
                    for rank, c in enumerate(sorted(comps)[1:], 1):
                        on = (C == c) & (abs(P @ nrm - d) < 1e-4)
                        P[on] += nrm * STEP * rank
            if write: put(b, base, J, pi, P.astype(np.float32))
    if write and total:
        js = json.dumps(J, separators=(',', ':')).encode()
        old = struct.unpack('<I', b[12:16])[0]
        js += b' ' * (old - len(js)) if len(js) <= old else b''
        if len(js) != old:
            pad = (4 - len(js) % 4) % 4; js += b' ' * pad
            b = b[:12] + struct.pack('<I', len(js)) + b'JSON' + js + b[20 + old:]
            b[8:12] = struct.pack('<I', len(b))
        else:
            b[20:20 + old] = js
        open(fn, 'wb').write(b)
    return total

if __name__ == '__main__':
    for fn in sys.argv[1:]:
        n = fix(fn)
        if n: print(f'{fn}: fixed {n} coplanar overlaps')
