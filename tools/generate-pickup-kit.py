#!/usr/bin/env python3
"""Rebuild bunker pickup GLBs: chunky amber lids, navy shells, no textures.

Y up, ground origin. Preserves the existing manifest dimensions and file hooks.
Run from any directory; no third-party dependencies.
"""
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/env/bunker'
COLORS = {'body': '#1B2740', 'lid': '#FF9D4D', 'strap': '#E7BF7A', 'light': '#FFE0A0'}


def linear(v):
    v = v / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def build(name, dims):
    w, h, d = dims
    groups = {}

    def prism(mat, cx, cy, cz, sx, sy, sz, bevel=0):
        # Eight-sided horizontal outline gives broad chamfered silhouette edges.
        b = min(bevel, sx / 3, sz / 3)
        ring = [(-sx/2+b,-sz/2),(sx/2-b,-sz/2),(sx/2,-sz/2+b),(sx/2,sz/2-b),
                (sx/2-b,sz/2),(-sx/2+b,sz/2),(-sx/2,sz/2-b),(-sx/2,-sz/2+b)]
        pos, normals = groups.setdefault(mat, ([], []))

        def tri(a, b, c):
            u = [b[i]-a[i] for i in range(3)]
            v = [c[i]-a[i] for i in range(3)]
            n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
            length = math.sqrt(sum(x*x for x in n))
            if length < 1e-12:
                return
            for p in (a,b,c):
                pos.extend(p)
                normals.extend(x/length for x in n)

        low = [(cx+x,cy-sy/2,cz+z) for x,z in ring]
        high = [(cx+x,cy+sy/2,cz+z) for x,z in ring]
        for i in range(8):
            j = (i+1)%8
            tri(low[i], high[i], high[j]); tri(low[i], high[j], low[j])
            tri((cx,cy+sy/2,cz),high[j],high[i])
            tri((cx,cy-sy/2,cz),low[i],low[j])

    prism('body',0,h*.35,0,w*.96,h*.7,d*.96,w*.08)
    prism('lid',0,h*.82,0,w,h*.26,d*.98,w*.1)
    for x in (-w*.29,w*.29):
        prism('strap',x,h*.975,0,w*.085,h*.05,d*.92,w*.015)
        for z in (-d*.47,d*.47):
            prism('strap',x,h*.48,z,w*.085,h*.82,d*.055,w*.015)
    prism('strap',0,h*.46,d*.48,w*.19,h*.23,d*.04,w*.025)
    prism('light',0,h*.755,d*.494,w*.4,h*.045,d*.012)

    blob = bytearray(); views=[]; access=[]; meshes=[]; materials=[]

    def accessor(data, count, kind, lo=None, hi=None):
        while len(blob)%4: blob.append(0)
        offset=len(blob); blob.extend(struct.pack('<%sf'%len(data),*data))
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data)*4,'target':34962})
        a={'bufferView':len(views)-1,'componentType':5126,'count':count,'type':kind}
        if lo is not None: a.update(min=lo,max=hi)
        access.append(a); return len(access)-1

    for name_, (pos,normals) in groups.items():
        rgb=[linear(int(COLORS[name_][i:i+2],16)) for i in (1,3,5)]
        mat={'name':name_,'pbrMetallicRoughness':{'baseColorFactor':rgb+[1],'metallicFactor':.08,'roughnessFactor':.8}}
        if name_=='light': mat['emissiveFactor']=rgb
        materials.append(mat)
        p=accessor(pos,len(pos)//3,'VEC3',[min(pos[i::3]) for i in range(3)],[max(pos[i::3]) for i in range(3)])
        n=accessor(normals,len(normals)//3,'VEC3')
        meshes.append({'name':name_,'primitives':[{'attributes':{'POSITION':p,'NORMAL':n},'material':len(materials)-1}]})
    doc={'asset':{'version':'2.0','generator':'Protocol Rebirth pickup kit v2'},'scene':0,
         'scenes':[{'nodes':list(range(len(meshes)))}],'nodes':[{'name':m['name'],'mesh':i} for i,m in enumerate(meshes)],
         'meshes':meshes,'materials':materials,'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':access}
    data=json.dumps(doc,separators=(',',':')).encode(); data+=b' '*(-len(data)%4)
    return struct.pack('<4sII',b'glTF',2,28+len(data)+len(blob))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(blob),b'BIN\0')+blob


if __name__ == '__main__':
    manifest=json.loads((OUT/'manifest.json').read_text())
    for asset in manifest['assets']:
        if asset['file'].startswith('loot_crate_'):
            (OUT/asset['file']).write_bytes(build(asset['file'],asset['approx_dimensions_m']))
            print(asset['file'])
