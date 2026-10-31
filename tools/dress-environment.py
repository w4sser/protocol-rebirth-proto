#!/usr/bin/env python3
"""Reproducible, texture-free production kit dressing. Reference originals stay untouched."""
import json
import math
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOWN = ROOT / 'assets/env/town'

# sRGB authoring swatches, converted to glTF's linear baseColorFactor.
SWATCHES = {
    'red_siding': ('#a4483d', .91, 0), 'yellow_siding': ('#d0ac58', .91, 0),
    'wood_dark': ('#51404a', .94, 0), 'wood_mid': ('#796151', .91, 0),
    'roof': ('#414b62', .82, .06), 'roof_edge': ('#6c7185', .72, .12),
    'concrete': ('#797d95', .94, 0), 'concrete_light': ('#989aa8', .94, 0),
    'asphalt': ('#667084', .97, 0), 'sidewalk': ('#989b96', .94, 0),
    'grass': ('#7f8d45', 1, 0), 'grass_light': ('#8d9a50', 1, 0),
    'pine_dark': ('#24494e', 1, 0), 'pine_mid': ('#315c5c', 1, 0),
    'pine_light': ('#416b65', 1, 0), 'bark': ('#675449', 1, 0),
    'car_blue': ('#627080', .48, .22), 'car_rust': ('#795850', .94, .06),
    'rubber': ('#29303c', 1, 0), 'glass': ('#3d5b69', .28, .12),
    'metal': ('#7b8995', .5, .3), 'metal_dark': ('#465263', .66, .22),
    'window_dark': ('#273e4b', .5, 0), 'hedge': ('#395b54', 1, 0),
    'weed': ('#73775c', 1, 0), 'mail_red': ('#a4483d', .9, 0),
    'white': ('#c4c0b2', .9, 0), 'shadow': ('#293345', 1, 0),
}

def linear(hex_color):
    rgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]

def read_glb(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20+size]), data[20+size:]

def write_glb(path, doc, tail):
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, 20+len(data)+len(tail)) +
                     struct.pack('<I4s', len(data), b'JSON') + data + tail)

def dress_materials():
    for path in sorted(TOWN.glob('*.glb')):
        doc, tail = read_glb(path)
        for mat in doc.get('materials', []):
            name = mat.get('name')
            if name not in SWATCHES:
                continue
            color, roughness, metalness = SWATCHES[name]
            pbr = mat.setdefault('pbrMetallicRoughness', {})
            pbr.update(baseColorFactor=[*linear(color), 1], roughnessFactor=roughness,
                       metallicFactor=metalness)
            # The sidewalk kit's repeated dark grooves read as a striped wooden deck.
            if name == 'metal_dark' and path.stem.startswith('tile_'):
                pbr.update(baseColorFactor=[*linear('#777f73'), 1], roughnessFactor=.95, metallicFactor=0)
        # Pavement grooves and per-tile grass tufts repeat across every room and
        # overwhelm phone-size silhouettes. Edge vegetation is already instanced
        # separately by the town renderer; keep the tile itself visually quiet.
        if path.stem.startswith('tile_'):
            for mesh in doc['meshes']:
                mesh['primitives'] = [p for p in mesh['primitives']
                    if doc['materials'][p['material']]['name'] not in ('grass_light',)]
        write_glb(path, doc, tail)

def pine(name='pine_tree', clusters=None, trunk=True):
    # Crown masses instead of stacked Christmas cones. Fits the existing 2.3 x 3.7 x
    # 2.3 m footprint, so town/archipelago visibility and passage checks still agree.
    positions, normals, colors = [], [], []
    def tri(a, b, c, color):
        u = [b[i]-a[i] for i in range(3)]
        v = [c[i]-a[i] for i in range(3)]
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length = math.sqrt(sum(x*x for x in n))
        n = [x/length for x in n]
        for p in (a, b, c):
            positions.extend(p); normals.extend(n); colors.extend(linear(color))
    def mass(center, radius, color, rotation=0):
        rings = []
        for latitude in (-math.pi/2, -math.pi/6, math.pi/6, math.pi/2):
            rings.append([(center[0]+radius[0]*math.cos(latitude)*math.cos(i*math.tau/7+rotation),
                           center[1]+radius[1]*math.sin(latitude),
                           center[2]+radius[2]*math.cos(latitude)*math.sin(i*math.tau/7+rotation)) for i in range(7)])
        for j in range(3):
            for i in range(7):
                ni = (i+1)%7
                if j != 0: tri(rings[j][i], rings[j+1][i], rings[j][ni], color)
                if j != 2: tri(rings[j][ni], rings[j+1][i], rings[j+1][ni], color)
    # Wind lean and exposed trunk make the silhouette recognisably coastal.
    for i in range(6 if trunk else 0):
        a, b = i*math.tau/6, (i+1)*math.tau/6
        lo = (.13*math.cos(a), 0, .13*math.sin(a))
        ln = (.13*math.cos(b), 0, .13*math.sin(b))
        hi = (.16+.08*math.cos(a), 2.55, .08*math.sin(a))
        hn = (.16+.08*math.cos(b), 2.55, .08*math.sin(b))
        tri(lo, hi, ln, '#675449'); tri(ln, hi, hn, '#675449')
    clusters = clusters or [((-.32, 1.96, .03), (.81, .54, .85), '#24494e'),
        ((.43, 2.32, -.08), (.67, .55, .79), '#315c5c'),
        ((-.23, 2.77, .07), (.73, .49, .68), '#315c5c'),
        ((.17, 3.25, 0), (.54, .44, .53), '#416b65')]
    for i, (center, radius, color) in enumerate(clusters):
        mass(center, radius, color, i*.15)
    doc = {'asset': {'version':'2.0', 'generator':'Protocol Rebirth coastal pine'},
           'scene':0, 'scenes':[{'nodes':[0]}], 'nodes':[{'mesh':0, 'name':'pine_tree'}],
           'materials':[{'name':'coastal_pine', 'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1], 'metallicFactor':0, 'roughnessFactor':1}}],
           'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'COLOR_0':2},'material':0}]}],
           'buffers':[], 'bufferViews':[], 'accessors':[]}
    blob = b''
    for ix, values in enumerate((positions, normals, colors)):
        raw = struct.pack('<%sf' % len(values), *values)
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(raw),'target':34962})
        acc = {'bufferView':ix,'componentType':5126,'count':len(values)//3,'type':'VEC3'}
        if ix == 0:
            acc.update(min=[min(values[i::3]) for i in range(3)], max=[max(values[i::3]) for i in range(3)])
        doc['accessors'].append(acc); blob += raw
    doc['buffers'] = [{'byteLength':len(blob)}]
    doc['nodes'][0]['name'] = name
    write_glb(TOWN/(name+'.glb'), doc, struct.pack('<I4s', len(blob), b'BIN\0')+blob)

if __name__ == '__main__':
    dress_materials()
    pine()
    # Keep the original angular bush and hedge geometry; only recolor named materials.
    print('Dressed materials and coastal pine; original angular bushes/hedge preserved.')
